import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { useToast } from '../ui/use-toast';
import { Banknote, AlertTriangle, CheckCircle, Clock, RotateCw } from 'lucide-react';
import axios from 'axios';
import { API_ENDPOINTS, AXIOS_CONFIG } from '../../config/api';

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

      // Call the sync endpoint to sync invoices from Gripp
      const response = await axios.post(API_ENDPOINTS.SYNC.INVOICES, {
        forceRefresh: true
      });

      if (!response.data || !response.data.success) {
        throw new Error('Synchronisatie mislukt');
      }

      toast({
        title: "Synchronisatie voltooid",
        description: `${response.data.data.created} nieuwe facturen toegevoegd, ${response.data.data.updated} facturen bijgewerkt.`,
        variant: "default",
      });

      // Refresh the data
      fetchData();
    } catch (error) {
      console.error('Error syncing invoices:', error);
      setError('Synchronisatie mislukt. Probeer het later opnieuw.');

      toast({
        title: "Synchronisatie mislukt",
        description: "Er is een fout opgetreden bij het synchroniseren van facturen. De Gripp API key is mogelijk niet correct geconfigureerd.",
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

      // Fetch all invoices for statistics
      const statsResponse = await axios.get(`${API_ENDPOINTS.INVOICES.GET_ALL}`, {
        params: {
          limit: 1, // We need just the meta data for stats
          page: 1
        }
      });

      // Fetch overdue invoices for display
      const response = await axios.get(`${API_ENDPOINTS.INVOICES.GET_ALL}`, {
        params: {
          limit: 2500, // Verhoog de limiet om alle facturen op te halen
          isOverdue: 1, // Filter op verlopen facturen
          page: 1 // Begin bij pagina 1
        }
      });
      console.log('Invoices response:', response.data);

      let invoicesData: Invoice[] = [];

      if (response.data && response.data.success && response.data.data) {
        // Filter out invoices with invalid data
        invoicesData = response.data.data.filter((invoice: Invoice) => {
          return invoice.dueDate &&
                 invoice.dueDate !== 'null' &&
                 invoice.dueDate !== '[object Object]' &&
                 typeof invoice.dueDate === 'string';
        });
      } else if (response.data && response.data.result && response.data.result.rows) {
        // Fallback for backward compatibility
        invoicesData = response.data.result.rows;
      }

      // Log if no invoice data found
      if (!invoicesData || invoicesData.length === 0) {
        console.log('No invoice data found from API');
        setError('Geen factuurgegevens gevonden. Synchroniseer eerst facturen via de Gripp API.');
      }

      if (invoicesData.length > 0) {
        // Process invoices
        const processedInvoices = invoicesData.map((invoice: Invoice) => {
          const daysOverdue = calculateDaysOverdue(invoice.dueDate);
          return {
            ...invoice,
            daysOverdue
          };
        });

        // Sort by due date (most overdue first)
        processedInvoices.sort((a: InvoiceWithCompany, b: InvoiceWithCompany) => {
          const aDaysOverdue = a.daysOverdue || 0;
          const bDaysOverdue = b.daysOverdue || 0;
          return bDaysOverdue - aDaysOverdue;
        });

        setInvoices(processedInvoices);

        // Get accurate statistics from API
        // Fetch counts for different invoice statuses
        const paidResponse = await axios.get(`${API_ENDPOINTS.INVOICES.GET_ALL}`, {
          params: { isPaid: 1, limit: 1 }
        });

        const unpaidResponse = await axios.get(`${API_ENDPOINTS.INVOICES.GET_ALL}`, {
          params: { isPaid: 0, isOverdue: 0, limit: 1 }
        });

        const overdueResponse = await axios.get(`${API_ENDPOINTS.INVOICES.GET_ALL}`, {
          params: { isOverdue: 1, limit: 1 }
        });

        // Get total from statsResponse
        const total = statsResponse.data.meta?.total || 0;

        // Get counts from responses
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
          {invoices.filter(inv => {
            const status = inv.status?.toLowerCase() || '';
            const isPaid = status === 'paid' || status === 'betaald' || inv.isPaid === 1;
            // Gebruik de isOverdue vlag in plaats van daysOverdue berekening
            return inv.isOverdue === 1 && !isPaid;
          }).length === 0 ? (
            <p className="text-sm text-gray-500">Geen verlopen facturen gevonden.</p>
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
                {invoices
                  .filter(inv => {
                    // Alleen verlopen facturen die NIET betaald zijn
                    const status = inv.status?.toLowerCase() || '';
                    const isPaid = status === 'paid' || status === 'betaald' || inv.isPaid === 1;
                    // Gebruik de isOverdue vlag in plaats van daysOverdue berekening
                    return inv.isOverdue === 1 && !isPaid;
                  })
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
