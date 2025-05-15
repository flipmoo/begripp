import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useToast } from '@/components/ui/use-toast';
import { Invoice } from '@/types/unified';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

// Debounce function to limit API calls
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Define the context type
interface UnifiedInvoicesContextType {
  // State
  invoices: Invoice[];
  filteredInvoices: Invoice[];
  totalInvoices: number;
  loading: boolean;
  isRefreshing: boolean;
  error: string | null;
  isFromCache: boolean;

  // Pagination
  currentPage: number;
  totalPages: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  setCurrentPage: (page: number) => void;
  setPageSize: (size: number) => void;

  // Filters
  year: string;
  status: string;
  searchQuery: string;

  // Actions
  setYear: (year: string) => void;
  setStatus: (status: string) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;
  fetchData: (forceRefresh?: boolean) => Promise<void>;

  // Utility functions
  isPaid: (invoice: Invoice) => boolean;
  isOverdue: (invoice: Invoice) => boolean;
  formatDate: (dateString: string) => string;
  formatCurrency: (amount: number) => string;
}

// Create the context with a default value
const UnifiedInvoicesContext = createContext<UnifiedInvoicesContextType | undefined>(undefined);

// Helper functions (defined outside the component to avoid dependency issues)
const checkIsPaid = (invoice: Invoice): boolean => {
  // Use the isPaid field from the API if available
  if (invoice.isPaid !== undefined) {
    // Handle both boolean and number types
    if (typeof invoice.isPaid === 'boolean') {
      return invoice.isPaid;
    } else if (typeof invoice.isPaid === 'number') {
      return invoice.isPaid === 1;
    }
  }

  // Fallback to status check
  return invoice.status === 'paid';
};

const checkIsOverdue = (invoice: Invoice): boolean => {
  // If the invoice is paid, it can't be overdue
  if (checkIsPaid(invoice)) return false;

  // Use the isOverdue field from the API if available
  if (invoice.isOverdue !== undefined) {
    // Handle both boolean and number types
    if (typeof invoice.isOverdue === 'boolean') {
      return invoice.isOverdue;
    } else if (typeof invoice.isOverdue === 'number') {
      return invoice.isOverdue === 1;
    }
  }

  // Fallback to date check
  try {
    const today = new Date();
    const dueDate = new Date(invoice.dueDate || invoice.due_date || '');

    // Check if date is valid
    if (isNaN(dueDate.getTime())) {
      console.warn('Invalid due date:', invoice.dueDate);
      return false;
    }

    return dueDate < today;
  } catch (e) {
    console.warn('Error checking if invoice is overdue:', e);
    return false;
  }
};

const formatDateString = (dateString: string): string => {
  if (!dateString) return '-';

  try {
    const date = new Date(dateString);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date:', dateString);
      return '-';
    }

    return date.toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (e) {
    console.warn('Error formatting date:', e);
    return '-';
  }
};

const formatCurrencyValue = (amount: number): string => {
  try {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  } catch (e) {
    console.warn('Error formatting currency:', e);
    return `€${amount.toFixed(2)}`;
  }
};

// Provider component
export const UnifiedInvoicesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast();

  // State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [totalInvoices, setTotalInvoices] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(250); // Default to 250 items per page for better usability
  const [totalPages, setTotalPages] = useState<number>(1);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [hasPreviousPage, setHasPreviousPage] = useState<boolean>(false);

  // Custom page size setter that resets to page 1
  const handleSetPageSize = useCallback((size: number) => {
    console.log(`Setting page size to ${size} and resetting to page 1`);
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  // Filters
  const [year, setYear] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Debounce search query to prevent too many API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Utility functions (wrapped in useCallback)
  const isPaid = useCallback(checkIsPaid, []);
  const isOverdue = useCallback(checkIsOverdue, []);
  const formatDate = useCallback(formatDateString, []);
  const formatCurrency = useCallback(formatCurrencyValue, []);

  // Fetch data from the unified API
  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setIsRefreshing(forceRefresh);
      setError(null);

      // Use the API_BASE_URL from the config
      let url = `${API_ENDPOINTS.INVOICES.GET_ALL}`;
      let params: Record<string, any> = {
        page: currentPage,
        limit: pageSize
      };

      // Add year filter if not 'all'
      if (year !== 'all') {
        params.year = year;
      }

      // Add status filter if not 'all'
      if (status !== 'all') {
        // Map status to API parameters
        switch (status) {
          case 'paid':
            params.isPaid = 1;
            break;
          case 'unpaid':
            params.isPaid = 0;
            params.isOverdue = 0;
            break;
          case 'overdue':
            params.isOverdue = 1;
            break;
          default:
            // No specific filter
            break;
        }
      }

      // Add search query if provided (use debounced value)
      if (debouncedSearchQuery) {
        params.search = debouncedSearchQuery;
        console.log(`Using debounced search query: ${debouncedSearchQuery}`);
      }

      // Add refresh parameter if needed
      params.refresh = forceRefresh === true;

      console.log(`Fetching invoices for page ${currentPage} with pageSize ${pageSize}, status=${status}, searchQuery=${searchQuery}`);

      // Make sure we're explicitly passing the page parameter
      params.page = currentPage;

      // Use the pageSize as the limit
      params.limit = pageSize;

      // Add a timestamp to prevent caching
      params._t = Date.now();

      console.log('Fetching invoices with params:', params);
      console.log('Fetching from URL:', url);

      let response;

      try {
        // Try to fetch from API with a longer timeout
        console.log('Trying to fetch from API...');
        response = await axios.get(url, {
          params,
          timeout: 30000, // Increase timeout to 30 seconds
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        console.log('API response:', response.data);
        console.log('API response data:', response.data.data);
      } catch (apiError: any) {
        console.error('API error:', apiError);

        // Check if this is a rate limit error (429)
        const isRateLimitError = apiError?.response?.status === 429;

        if (isRateLimitError) {
          console.log('API rate limit reached, showing error message');
          setError('API limiet bereikt. De Gripp API heeft een limiet van 1000 verzoeken per dag. Probeer het later opnieuw of neem contact op met de beheerder.');
        } else {
          console.log('API not available, returning empty data');
        }

        // Create an empty response structure with complete metadata
        response = {
          data: {
            success: true,
            data: [],
            meta: {
              total: 0,
              count: 0,
              page: currentPage,
              limit: pageSize,
              totalPages: 1,
              hasNextPage: false,
              hasPrevPage: false,
              fromCache: false,
              timestamp: new Date().toISOString(),
              error: isRateLimitError ? 'API rate limit reached' : 'API not available'
            }
          }
        };
      }

      if (response.data && response.data.success) {
        // Check if the data is in the expected format
        let invoicesData;

        if (response.data.data && response.data.data.rows) {
          // New API format where data is in data.rows
          invoicesData = response.data.data.rows;
          console.log('Using new API format with data.rows');
        } else {
          // Old format or direct array
          invoicesData = response.data.data || [];
        }

        // Ensure invoicesData is always an array
        if (!Array.isArray(invoicesData)) {
          console.warn('invoicesData is not an array:', invoicesData);
          invoicesData = [];
        }

        console.log('Invoices data:', invoicesData);
        console.log('Total invoices from API:', response.data.meta?.total || response.data.data?.count || invoicesData.length);

        try {
          // Enhance invoices with calculated fields
          const enhancedInvoices = invoicesData.map((invoice: any) => {
            if (!invoice || typeof invoice !== 'object') {
              console.warn('Invalid invoice data:', invoice);
              return null;
            }

            // Map API response fields to our Invoice type with safe defaults
            const mappedInvoice: Invoice = {
              id: invoice.id || 0,
              grippId: invoice.grippId,
              number: invoice.number || '',
              date: invoice.date || new Date().toISOString(),
              dueDate: invoice.dueDate || invoice.due_date || new Date().toISOString(),
              due_date: invoice.due_date,
              company: invoice.company_id || invoice.company || 0,
              company_id: invoice.company_id,
              companyName: invoice.company_name || invoice.companyName || '',
              company_name: invoice.company_name,
              amount: typeof invoice.amount === 'number' ? invoice.amount : 0,
              taxAmount: typeof invoice.taxAmount === 'number' ? invoice.taxAmount : 0,
              totalAmount: typeof invoice.totalAmount === 'number' ? invoice.totalAmount : 0,
              status: invoice.status || 'unknown',
              subject: invoice.subject || '', // Add the subject field
              createdAt: invoice.createdAt || new Date().toISOString(),
              updatedAt: invoice.updatedAt || new Date().toISOString(),
              isPaid: invoice.isPaid, // Keep the original value (0/1 or boolean)
              isOverdue: invoice.isOverdue, // Keep the original value (0/1 or boolean)
              // Include formatted fields if available
              formattedDate: invoice.formattedDate,
              formattedDueDate: invoice.formattedDueDate,
              daysOverdue: invoice.daysOverdue
            };

            // Calculate open amount
            const openAmount = mappedInvoice.isPaid ? 0 : mappedInvoice.totalAmount;

            return {
              ...mappedInvoice,
              openAmount
            };
          }).filter(Boolean); // Remove any null values

          console.log('Enhanced invoices:', enhancedInvoices);
          setInvoices(enhancedInvoices);

          // Set total invoices and calculate total pages
          const total = response.data.meta?.total ||
                       response.data.meta?.count ||
                       response.data.data?.count ||
                       enhancedInvoices.length;
          setTotalInvoices(total);

          // Calculate total pages from the API response or calculate it
          const calculatedTotalPages = response.data.meta?.totalPages ||
                                      Math.ceil(total / pageSize);
          console.log(`Pagination info: total=${total}, pages=${calculatedTotalPages}, current=${response.data.meta?.page || currentPage}`);
          setTotalPages(calculatedTotalPages > 0 ? calculatedTotalPages : 1);

          // Check if there are more pages based on API response
          const hasMoreItems = response.data.data?.more_items_in_collection || false;

          // Update pagination state using API response or calculate it
          setHasNextPage(response.data.meta?.hasNextPage !== undefined
            ? response.data.meta.hasNextPage
            : hasMoreItems || currentPage < calculatedTotalPages);

          setHasPreviousPage(response.data.meta?.hasPrevPage !== undefined
            ? response.data.meta.hasPrevPage
            : currentPage > 1);

          console.log('Pagination state updated:', {
            total,
            currentPage,
            totalPages: calculatedTotalPages,
            hasNextPage: response.data.meta?.hasNextPage,
            hasPreviousPage: response.data.meta?.hasPrevPage
          });

          setIsFromCache(response.data.meta?.fromCache || false);
        } catch (err) {
          console.error('Error processing invoice data:', err);
          setError('Er is een fout opgetreden bij het verwerken van de factuurgegevens. Probeer het later opnieuw of neem contact op met de beheerder.');
        }
      } else {
        console.error('Failed to load invoice data:', response.data);
        setError('Het laden van de factuurgegevens is mislukt. Probeer het later opnieuw of neem contact op met de beheerder.');
      }
    } catch (err) {
      console.error('Error fetching invoice data:', err);
      setError(err instanceof Error ? err.message : 'Het laden van de factuurgegevens is mislukt. Probeer het later opnieuw of neem contact op met de beheerder.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [year, status, debouncedSearchQuery, currentPage, pageSize]);

  // Reset all filters
  const resetFilters = useCallback(() => {
    console.log('Resetting all filters');
    setYear('all');
    setStatus('all');
    setSearchQuery('');
    // Reset to page 1 when filters are reset
    setCurrentPage(1);
  }, [setCurrentPage]);

  // Apply all filters to the invoices list
  const applyFilters = useCallback(() => {
    console.log(`Applying filters: year=${year}, status=${status}, search=${debouncedSearchQuery}`);

    // If no invoices, return empty array
    if (!invoices.length) {
      setFilteredInvoices([]);
      return;
    }

    // We're now using server-side filtering and pagination, so we just pass the invoices through
    // This ensures we don't filter out items that should be on the current page
    setFilteredInvoices(invoices);

    console.log(`Using server-side filtering: ${invoices.length} invoices on current page`);
  }, [invoices]);

  // Reset to page 1 when filters change (but not when currentPage itself changes)
  useEffect(() => {
    if (currentPage !== 1) {
      console.log('Filters changed, resetting to page 1');
      setCurrentPage(1);
    }
  }, [year, status, debouncedSearchQuery, setCurrentPage]);

  // Load invoices when filters or pagination changes
  useEffect(() => {
    console.log(`Loading invoices for page ${currentPage} with filters: year=${year}, status=${status}, search=${debouncedSearchQuery}`);
    fetchData();
  }, [fetchData, currentPage, year, status, debouncedSearchQuery]);

  // Apply filters when invoices or filter values change
  useEffect(() => {
    console.log('Filters or invoices changed, applying filters');
    applyFilters();
  }, [invoices, year, status, debouncedSearchQuery, applyFilters]);

  // This effect is no longer needed as we have a more specific one above

  // Create the context value
  const contextValue: UnifiedInvoicesContextType = {
    // State
    invoices,
    filteredInvoices,
    totalInvoices,
    loading,
    isRefreshing,
    error,
    isFromCache,

    // Pagination
    currentPage,
    totalPages,
    pageSize,
    hasNextPage,
    hasPreviousPage,
    setCurrentPage,
    setPageSize: handleSetPageSize,

    // Filters
    year,
    status,
    searchQuery,

    // Actions
    setYear,
    setStatus,
    setSearchQuery,
    resetFilters,
    fetchData,

    // Utility functions
    isPaid,
    isOverdue,
    formatDate,
    formatCurrency
  };

  return (
    <UnifiedInvoicesContext.Provider value={contextValue}>
      {children}
    </UnifiedInvoicesContext.Provider>
  );
};

// Custom hook to use the unified invoices context
export const useUnifiedInvoices = (): UnifiedInvoicesContextType => {
  const context = useContext(UnifiedInvoicesContext);

  if (context === undefined) {
    throw new Error('useUnifiedInvoices must be used within a UnifiedInvoicesProvider');
  }

  return context;
};
