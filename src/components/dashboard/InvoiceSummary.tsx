import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { useToast } from '../ui/use-toast';
import { Banknote, AlertTriangle, CheckCircle, Clock, RotateCw } from 'lucide-react';
import axios from 'axios';
import { API_ENDPOINTS, AXIOS_CONFIG, API_BASE_URL } from '../../config/api';

// Configureer axios instance
const apiClient = axios.create(AXIOS_CONFIG);

// Define the invoice interface based on our unified data structure
interface Invoice {
  id: number;
  grippId?: number;
  number: string;
  date: string;
  dueDate: string;
  company: number;
  amount?: number;
  taxAmount?: number;
  totalAmount?: number;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  external_id?: string;
  external_data?: string;
  isPaid?: number;
  isOverdue?: number;
  totalExclVat?: number;
  totalInclVat?: number;
  tax_amount?: number;
  company_id?: number;
  company_name?: string;
  due_date?: string;
  companyName?: string;
}

// Define the company interface
interface Company {
  id: number;
  name: string;
}

// Define the invoice with company information
interface InvoiceWithCompany extends Invoice {
  companyName?: string;
  daysOverdue?: number;
}

const InvoiceSummary: React.FC = () => {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceWithCompany[]>([]);
  const [companies, setCompanies] = useState<Record<number, Company>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    totalAmount: 0,
    avgAmount: 0,
    overdueAmount: 0
  });

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      if (!dateString || dateString === 'null' || dateString === '[object Object]') {
        return 'Onbekend';
      }

      // Handle Gripp date object format
      if (typeof dateString === 'object' && dateString.date) {
        dateString = dateString.date;
      }

      const date = new Date(dateString);

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Onbekend';
      }

      return date.toLocaleDateString('nl-NL');
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Onbekend';
    }
  };

  // Calculate days overdue
  const calculateDaysOverdue = (dueDate: string) => {
    try {
      if (!dueDate || dueDate === 'null' || dueDate === '[object Object]') {
        return 0;
      }

      // Handle Gripp date object format
      if (typeof dueDate === 'object' && dueDate.date) {
        dueDate = dueDate.date;
      }

      const today = new Date();
      const due = new Date(dueDate);

      // Check if date is valid
      if (isNaN(due.getTime())) {
        return 0;
      }

      const diffTime = today.getTime() - due.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    } catch (error) {
      console.error('Error calculating days overdue:', error);
      return 0;
    }
  };

  // Calculate total overdue amount
  const calculateOverdueAmount = (invoices: Invoice[]): number => {
    return invoices.reduce((sum, invoice) => {
      const amount = invoice.totalExclVat || invoice.totalInclVat || (invoice.totalAmount ? invoice.totalAmount * 0.826 : 0);
      return sum + amount;
    }, 0);
  };

  // Fetch invoice statistics
  const fetchInvoiceStats = async (): Promise<{
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    totalAmount: number;
    avgAmount: number;
  }> => {
    try {
      // Fetch total count
      const totalResponse = await fetch(`${API_BASE_URL}/api/v1/db-invoices?limit=1&page=1`);
      const totalData = await totalResponse.json();
      const total = totalData.data?.meta?.total || 0;

      // Fetch paid count
      const paidResponse = await fetch(`${API_BASE_URL}/api/v1/db-invoices?isPaid=1&limit=1&page=1`);
      const paidData = await paidResponse.json();
      const paid = paidData.data?.meta?.total || 0;

      // Fetch pending count
      const pendingResponse = await fetch(`${API_BASE_URL}/api/v1/db-invoices?isPaid=0&isOverdue=0&limit=1&page=1`);
      const pendingData = await pendingResponse.json();
      const pending = pendingData.data?.meta?.total || 0;

      // Fetch overdue count
      const overdueResponse = await fetch(`${API_BASE_URL}/api/v1/db-invoices?isOverdue=1&limit=1&page=1`);
      const overdueData = await overdueResponse.json();
      const overdue = overdueData.data?.meta?.total || 0;

      // Calculate average amount (approximation)
      const totalAmount = 0; // We don't have this information without fetching all invoices
      const avgAmount = 0;

      return {
        total,
        paid,
        pending,
        overdue,
        totalAmount,
        avgAmount
      };
    } catch (error) {
      console.error('Error fetching invoice statistics:', error);
      return {
        total: 0,
        paid: 0,
        pending: 0,
        overdue: 0,
        totalAmount: 0,
        avgAmount: 0
      };
    }
  };

  // Get status badge
  const getStatusBadge = (invoice: InvoiceWithCompany) => {
    // Convert status to lowercase for case-insensitive comparison
    const status = invoice.status?.toLowerCase() || '';

    if (status === 'paid' || status === 'betaald' || invoice.isPaid === 1) {
      return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Betaald</Badge>;
    } else if (invoice.daysOverdue && invoice.daysOverdue > 0) {
      return <Badge className="bg-red-500"><AlertTriangle className="h-3 w-3 mr-1" /> {invoice.daysOverdue} dagen te laat</Badge>;
    } else {
      return <Badge className="bg-amber-500"><Clock className="h-3 w-3 mr-1" /> Openstaand</Badge>;
    }
  };

  // Sync invoices from Gripp API
  const syncInvoices = async () => {
    try {
      setIsSyncing(true);
      setError(null);

      toast({
        title: "Synchronisatie gestart",
        description: "Facturen worden gesynchroniseerd met Gripp...",
      });

      console.log('Starting invoice sync...');

      // Use the direct endpoint
      try {
        console.log('Syncing invoices using endpoint: http://localhost:3004/api/v1/sync/invoices');

        const response = await fetch('http://localhost:3004/api/v1/sync/invoices', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          console.error('Sync response error:', errorData);
          throw new Error(`Failed to sync data: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Sync response:', data);

        if (!data.success) {
          throw new Error('Sync failed: ' + (data.error || 'Unknown error'));
        }

        console.log('Sync successful');
      } catch (error) {
        console.error('Error syncing invoices:', error);
        throw error;
      }

      // Clear the cache
      try {
        console.log('Clearing cache using endpoint: http://localhost:3004/api/v1/cache/clear');

        const cacheResponse = await fetch('http://localhost:3004/api/v1/cache/clear', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!cacheResponse.ok) {
          const errorData = await cacheResponse.json().catch(() => null);
          console.error('Cache clear response error:', errorData);
          throw new Error(`Failed to clear cache: ${cacheResponse.status} ${cacheResponse.statusText}`);
        }

        const cacheData = await cacheResponse.json();
        console.log('Cache clear response:', cacheData);
      } catch (error) {
        console.error('Error clearing cache:', error);
        // Continue even if cache clear fails
      }

      toast({
        title: "Synchronisatie voltooid",
        description: "Facturen zijn gesynchroniseerd met Gripp.",
      });

      // Refresh the data
      fetchData();
    } catch (error) {
      console.error('Error syncing invoices:', error);
      setError('Synchronisatie mislukt. Probeer het later opnieuw.');

      toast({
        title: "Synchronisatie mislukt",
        description: "Er is een fout opgetreden bij het synchroniseren van facturen.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Load invoices from the API
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching invoice data...');

      // Fetch all invoices for statistics
      let statsData = null;
      let invoicesData: Invoice[] = [];
      let statsResponse = null;

      try {
        // Haal statistieken op uit de database
        statsResponse = await fetch(`${API_ENDPOINTS.INVOICES.GET_ALL}?limit=1&page=1`, {
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });

        if (statsResponse.ok) {
          statsData = await statsResponse.json();
          console.log('Stats response:', statsData);
        } else {
          console.error('Failed to fetch invoice stats:', statsResponse.status);
        }
      } catch (statsError) {
        console.error('Error fetching stats:', statsError);
      }

      try {
        // Haal verlopen facturen op uit de database voor weergave
        // Gebruik direct de API endpoint voor verlopen facturen
        const overdueUrl = `${API_BASE_URL}/api/v1/db-invoices?isOverdue=1&limit=50&page=1`;
        console.log('Fetching overdue invoices from URL:', overdueUrl);

        const response = await fetch(overdueUrl, {
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        if (response.ok) {
          const responseData = await response.json();
          console.log('Overdue invoices response:', responseData);

          // Log the entire response structure to debug
          console.log('Response data structure:', JSON.stringify(responseData, null, 2));

          // Process response data
          if (responseData.data && responseData.data.rows && Array.isArray(responseData.data.rows)) {
            invoicesData = responseData.data.rows;
            console.log(`Found ${invoicesData.length} overdue invoices from data.rows array`);

            // Set invoices
            setInvoices(invoicesData);

            // Set companies data
            const companyData: Record<number, Company> = {};
            invoicesData.forEach(invoice => {
              if (invoice.company) {
                companyData[invoice.company] = {
                  id: invoice.company,
                  name: invoice.company_name || `Company ${invoice.company}`
                };
              }
            });
            setCompanies(companyData);

            // Update statistics
            if (responseData.data && responseData.data.meta) {
              const meta = responseData.data.meta;
              const total = meta.total || 0;

              // Fetch additional statistics
              fetchInvoiceStats().then(stats => {
                setStats({
                  total: stats.total || 0,
                  paid: stats.paid || 0,
                  pending: stats.pending || 0,
                  overdue: stats.overdue || 0,
                  totalAmount: stats.totalAmount || 0,
                  avgAmount: stats.avgAmount || 0,
                  overdueAmount: calculateOverdueAmount(invoicesData)
                });
              }).catch(error => {
                console.error('Error fetching invoice stats:', error);
              });
            }

            // Return early to skip further processing
            return;
          } else if (responseData.data && Array.isArray(responseData.data)) {
            invoicesData = responseData.data;
            console.log(`Found ${invoicesData.length} overdue invoices from data array`);
          } else if (responseData.result && responseData.result.rows) {
            // Fallback for backward compatibility
            invoicesData = responseData.result.rows;
            console.log(`Found ${invoicesData.length} overdue invoices from result.rows`);
          }

          // Log the structure of invoicesData
          console.log('invoicesData structure:', JSON.stringify(invoicesData.slice(0, 1), null, 2));
        } else {
          console.error('Failed to fetch overdue invoices:', response.status);
        }
      } catch (invoicesError) {
        console.error('Error fetching overdue invoices:', invoicesError);
      }

      // If we couldn't get data from either request, show error
      if (!statsData && invoicesData.length === 0) {
        setError('Failed to load invoice data. Please try again later.');
        return;
      }

      // Log if no invoice data found
      if (!invoicesData || invoicesData.length === 0) {
        console.log('No invoice data found from API');
        // Alleen een waarschuwing tonen, geen error, zodat de component blijft werken
        console.warn('Geen factuurgegevens gevonden in de database.');
      }

      if (invoicesData.length > 0) {
        // Process invoices
        console.log('Processing invoices:', invoicesData);
        const processedInvoices = invoicesData.map((invoice: Invoice) => {
          // Log each invoice to debug
          console.log('Processing invoice:', invoice);

          // Make sure dueDate is a string
          let dueDateStr = invoice.dueDate || invoice.due_date || '';
          if (typeof dueDateStr === 'object' && dueDateStr !== null) {
            dueDateStr = JSON.stringify(dueDateStr);
          }

          const daysOverdue = calculateDaysOverdue(dueDateStr);
          return {
            ...invoice,
            dueDate: dueDateStr,
            daysOverdue
          };
        });

        // Sort by due date (most overdue first)
        processedInvoices.sort((a: InvoiceWithCompany, b: InvoiceWithCompany) => {
          const aDaysOverdue = a.daysOverdue || 0;
          const bDaysOverdue = b.daysOverdue || 0;
          return bDaysOverdue - aDaysOverdue;
        });

        console.log('Setting invoices:', processedInvoices);
        setInvoices(processedInvoices);

        // Haal nauwkeurige statistieken op uit de database
        // Haal aantallen op voor verschillende factuurstatussen
        const paidResponse = await axios.get(API_ENDPOINTS.INVOICES.GET_ALL, {
          params: { isPaid: 1, limit: 1 }
        });

        const unpaidResponse = await axios.get(API_ENDPOINTS.INVOICES.GET_ALL, {
          params: { isPaid: 0, isOverdue: 0, limit: 1 }
        });

        const overdueResponse = await axios.get(API_ENDPOINTS.INVOICES.GET_ALL, {
          params: { isOverdue: 1, limit: 1 }
        });

        // Haal totaal aantal op uit statsData
        const total = statsData?.meta?.total || 0;

        // Haal aantallen op uit de responses
        const paid = paidResponse.data.meta?.total || 0;
        const overdue = overdueResponse.data.meta?.total || 0;
        const pending = unpaidResponse.data.meta?.total || 0;

        console.log('Invoice stats:', { total, paid, pending, overdue });

        // Calculate total amount (approximation based on average)
        // Since we can't get the exact sum from the API, we'll use the average from our sample
        const totalAmount = processedInvoices.reduce((sum, inv) => {
          const amount = inv.totalExclVat || (inv.totalAmount ? inv.totalAmount * 0.826 : 0);
          return sum + amount;
        }, 0);

        // Calculate average amount per invoice for estimation
        const avgAmount = total > 0 ? totalAmount / processedInvoices.length * total : 0;

        // Calculate overdue amount from our overdue invoices
        const overdueAmount = processedInvoices
          .filter(inv => inv.isOverdue === 1 && inv.isPaid !== 1)
          .reduce((sum, inv) => {
            const amount = inv.totalExclVat || (inv.totalAmount ? inv.totalAmount * 0.826 : 0);
            return sum + amount;
          }, 0);

        setStats({
          total,
          paid,
          pending,
          overdue,
          totalAmount,
          avgAmount,
          overdueAmount
        });

        // Fetch company information for each invoice
        const uniqueCompanyIds = [...new Set(processedInvoices.map(inv => inv.company))];
        const companyData: Record<number, Company> = {};

        // Use company names from the invoice data if available
        uniqueCompanyIds.forEach(id => {
          if (id) {
            const invoice = processedInvoices.find(inv => inv.company === id);
            companyData[id] = {
              id,
              name: invoice?.company_name || `Company ${id}`
            };
          }
        });

        setCompanies(companyData);
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError('Failed to load invoice data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when component mounts
  useEffect(() => {
    fetchData();
  }, []);

  // Render loading state
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Facturen Overzicht</CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={true}
            className="flex items-center gap-2"
          >
            <RotateCw className="h-4 w-4 animate-spin" />
            Laden...
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render error state
  if (error) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Facturen Overzicht</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={syncInvoices}
            disabled={isSyncing}
            className="flex items-center gap-2"
          >
            <RotateCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Synchroniseren...' : 'Synchroniseren'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-red-500 mb-4">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
          <p className="text-sm text-gray-500">Klik op de synchroniseren knop om facturen op te halen van Gripp.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Facturen Overzicht</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={syncInvoices}
          disabled={isSyncing}
          className="flex items-center gap-2"
        >
          <RotateCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Synchroniseren...' : 'Synchroniseren'}
        </Button>
      </CardHeader>
      <CardContent>
        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-blue-500" />
              <span className="text-sm text-gray-500">Totaal</span>
            </div>
            <div className="mt-1">
              <span className="text-xl font-bold">{stats.total}</span>
              <span className="text-sm text-gray-500 ml-2">facturen</span>
            </div>
            <div className="mt-1 text-sm">{formatCurrency(stats.avgAmount || 0)}</div>
          </div>

          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm text-gray-500">Betaald</span>
            </div>
            <div className="mt-1">
              <span className="text-xl font-bold">{stats.paid}</span>
              <span className="text-sm text-gray-500 ml-2">facturen</span>
            </div>
            <div className="mt-1 text-sm">
              {stats.total > 0 ? `${Math.round((stats.paid / stats.total) * 100)}%` : '0%'}
            </div>
          </div>

          <div className="bg-amber-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <span className="text-sm text-gray-500">Openstaand</span>
            </div>
            <div className="mt-1">
              <span className="text-xl font-bold">{stats.pending}</span>
              <span className="text-sm text-gray-500 ml-2">facturen</span>
            </div>
            <div className="mt-1 text-sm">
              {stats.total > 0 ? `${Math.round((stats.pending / stats.total) * 100)}%` : '0%'}
            </div>
          </div>

          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-sm text-gray-500">Te laat</span>
            </div>
            <div className="mt-1">
              <span className="text-xl font-bold">{stats.overdue}</span>
              <span className="text-sm text-gray-500 ml-2">facturen</span>
            </div>
            <div className="mt-1 text-sm">{formatCurrency(stats.overdueAmount)}</div>
          </div>
        </div>

        {/* All overdue invoices */}
        <div>
          <h3 className="text-lg font-medium mb-3">Alle Verlopen Facturen</h3>
          {console.log('Rendering invoices:', invoices)}
          {invoices.length === 0 ? (
            <p className="text-sm text-gray-500">Geen verlopen facturen gevonden. Probeer te synchroniseren.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nummer</TableHead>
                  <TableHead>Klant</TableHead>
                  <TableHead>Vervaldatum</TableHead>
                  <TableHead className="text-right">Bedrag</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {console.log('Rendering invoices in table:', invoices)}
                {invoices
                  // Sorteer op vervaldatum (oudste eerst)
                  .sort((a, b) => {
                    const dateA = new Date(a.dueDate || a.due_date || '');
                    const dateB = new Date(b.dueDate || b.due_date || '');
                    return dateA.getTime() - dateB.getTime();
                  })
                  .map(invoice => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">{invoice.number}</TableCell>
                      <TableCell>{companies[invoice.company]?.name || invoice.company_name || invoice.companyName || ''}</TableCell>
                      <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(invoice.totalExclVat || (invoice.totalAmount ? invoice.totalAmount * 0.826 : 0))}
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice)}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default InvoiceSummary;
