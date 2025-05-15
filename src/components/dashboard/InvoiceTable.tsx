import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { AlertTriangle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import axios from 'axios';
import { API_ENDPOINTS, AXIOS_CONFIG } from '../../config/api';

// Configureer axios instance
const apiClient = axios.create(AXIOS_CONFIG);

// Interface voor bedrijfsgegevens
interface Company {
  id: number;
  name: string;
}

// Interface voor factuurgegevens
interface Invoice {
  id: number;
  number: string;
  date: string;
  dueDate: string;
  company: number;
  companyName?: string;
  company_name?: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  status: string;
  isPaid?: number;
  isOverdue?: number;
  daysOverdue?: number;
  totalExclVat?: number;
  totalInclVat?: number;
}

// Interface voor factuur met bedrijfsgegevens
interface InvoiceWithCompany extends Invoice {
  companyData?: Company;
}

interface InvoiceTableProps {
  title?: string;
  showPaid?: boolean;
  showUnpaid?: boolean;
  showOverdue?: boolean;
  maxItems?: number;
  onlyOverdue?: boolean;
}

const InvoiceTable: React.FC<InvoiceTableProps> = ({
  title = "Facturen",
  showPaid = true,
  showUnpaid = true,
  showOverdue = true,
  maxItems = 10,
  onlyOverdue = false
}) => {
  const [invoices, setInvoices] = useState<InvoiceWithCompany[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<InvoiceWithCompany[]>([]);
  const [companies, setCompanies] = useState<Record<number, Company>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(maxItems);
  const [totalItems, setTotalItems] = useState(0);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return '';

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('nl-NL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (e) {
      console.error('Error formatting date:', e);
      return dateString;
    }
  };

  // Get status badge
  const getStatusBadge = (invoice: Invoice) => {
    const status = invoice.status?.toLowerCase() || '';
    const isPaid = status === 'paid' || status === 'betaald' || invoice.isPaid === 1;
    const isOverdue = (invoice.isOverdue === 1 || (invoice.daysOverdue && invoice.daysOverdue > 0)) && !isPaid;

    if (isPaid) {
      return <Badge className="bg-green-500">Betaald</Badge>;
    } else if (isOverdue) {
      return <Badge className="bg-red-500">Te laat ({invoice.daysOverdue} dagen)</Badge>;
    } else {
      return <Badge className="bg-yellow-500">Open</Badge>;
    }
  };

  // Load invoices from the API
  const fetchData = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      console.log(`Fetching invoices for page ${page} with pageSize ${pageSize}, onlyOverdue=${onlyOverdue}`);

      // Fetch invoices from the unified API with pagination
      const response = await axios.get(`${API_ENDPOINTS.INVOICES.GET_ALL}`, {
        params: {
          page,
          limit: pageSize,
          overdue: onlyOverdue ? 1 : undefined
        }
      });

      console.log('Invoices response:', response.data);

      let invoicesData: Invoice[] = [];
      let totalCount = 0;

      if (response.data && response.data.success && response.data.data) {
        // Filter out invoices with invalid data
        invoicesData = response.data.data.filter((invoice: Invoice) => {
          return invoice.dueDate &&
                 invoice.dueDate !== 'null' &&
                 invoice.dueDate !== '[object Object]' &&
                 typeof invoice.dueDate === 'string';
        });

        // Get total count from meta
        totalCount = response.data.meta?.total || invoicesData.length;
        console.log(`Total count from meta: ${totalCount}`);
      } else if (response.data && response.data.result && response.data.result.rows) {
        // Fallback for backward compatibility
        invoicesData = response.data.result.rows;
        totalCount = response.data.result.count || invoicesData.length;
        console.log(`Total count from result: ${totalCount}`);
      }

      // Log if no invoice data found
      if (!invoicesData || invoicesData.length === 0) {
        console.log('No invoice data found from API');
        if (onlyOverdue) {
          setError('Geen verlopen facturen gevonden.');
        } else {
          setError('Geen factuurgegevens gevonden.');
        }
      }

      // Process invoices
      const processedInvoices = invoicesData.map((invoice: Invoice) => {
        // Calculate days overdue if not provided
        if (!invoice.daysOverdue && invoice.dueDate) {
          const dueDate = new Date(invoice.dueDate);
          const today = new Date();
          const diffTime = Math.abs(today.getTime() - dueDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          // Only overdue if due date is in the past
          invoice.daysOverdue = dueDate < today ? diffDays : 0;
        }

        return invoice;
      });

      // Set invoices
      setInvoices(processedInvoices);

      // Calculate total pages
      const pages = Math.ceil(totalCount / pageSize);
      console.log(`Calculated ${pages} pages from ${totalCount} items with pageSize ${pageSize}`);
      setTotalPages(pages > 0 ? pages : 1);
      setTotalItems(totalCount);

      // Apply filters
      filterInvoices(processedInvoices);
    } catch (err) {
      console.error('Error fetching invoices:', err);
      setError('Failed to load invoice data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Filter invoices based on props
  const filterInvoices = (invoicesToFilter: Invoice[]) => {
    const filtered = invoicesToFilter.filter(inv => {
      const status = inv.status?.toLowerCase() || '';
      const isPaid = status === 'paid' || status === 'betaald' || inv.isPaid === 1;
      const isOverdue = (inv.isOverdue === 1 || (inv.daysOverdue && inv.daysOverdue > 0)) && !isPaid;

      if (onlyOverdue) {
        return isOverdue;
      }

      if (!showPaid && isPaid) return false;
      if (!showUnpaid && !isPaid && !isOverdue) return false;
      if (!showOverdue && isOverdue) return false;

      return true;
    });

    setFilteredInvoices(filtered);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    setCurrentPage(page);
    fetchData(page);
  };

  // Fetch data when component mounts or pagination changes
  useEffect(() => {
    fetchData(currentPage);
  }, [currentPage, pageSize, onlyOverdue]);

  // Render loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
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
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-red-500 mb-4">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title} ({totalItems})</CardTitle>
      </CardHeader>
      <CardContent>
        {filteredInvoices.length === 0 ? (
          <p className="text-sm text-gray-500">Geen facturen gevonden die aan de criteria voldoen.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nummer</TableHead>
                <TableHead>Klant</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead>Vervaldatum</TableHead>
                <TableHead className="text-right">Bedrag</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map(invoice => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.number}</TableCell>
                  <TableCell>{companies[invoice.company]?.name || invoice.company_name || invoice.companyName || ''}</TableCell>
                  <TableCell>{formatDate(invoice.date)}</TableCell>
                  <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                  <TableCell className="text-right">
                    {isNaN(invoice.totalExclVat) && isNaN(invoice.amount) ?
                      '€ 0,00' :
                      formatCurrency(isNaN(invoice.totalExclVat) ? invoice.amount : invoice.totalExclVat)}
                  </TableCell>
                  <TableCell>{getStatusBadge(invoice)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="text-sm text-gray-500">
          Pagina {currentPage} van {totalPages} ({totalItems} facturen)
        </div>
        {totalPages > 1 && (
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default InvoiceTable;
