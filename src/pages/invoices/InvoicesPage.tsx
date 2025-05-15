import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, CheckCircle, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { Invoice } from '@/types/invoice';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, parseISO, isAfter } from 'date-fns';
import { nl } from 'date-fns/locale';

// Define API base URL - use relative path to work with Vite proxy
const API_BASE = '/api/v1';

// Format date function
const formatDate = (dateString: string) => {
  try {
    return format(parseISO(dateString), 'dd-MM-yyyy', { locale: nl });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
};

// Format number as currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

// Check if an invoice is paid
const isPaid = (invoice: Invoice) => {
  // Use the isPaid field from the unified API if available
  if (invoice.isPaid !== undefined) {
    return invoice.isPaid === 1;
  }

  // Fallback to the old calculation method
  // Convert string values to numbers for reliable comparison
  const totalInclVat = typeof invoice.total === 'string'
    ? parseFloat(invoice.total)
    : invoice.total;

  const totalPayed = typeof invoice.paidAmount === 'string'
    ? parseFloat(invoice.paidAmount)
    : invoice.paidAmount;

  // Check if there is no unpaid amount (with small tolerance for floating point comparison)
  return (totalInclVat - totalPayed) <= 0.01;
};

// Check if an invoice is overdue
const isOverdue = (invoice: Invoice) => {
  // Use the isOverdue field from the unified API if available
  if (invoice.isOverdue !== undefined) {
    return invoice.isOverdue === 1;
  }

  // Fallback to the old calculation method
  if (!invoice.dueDate) return false;

  // Convert string values to numbers for reliable comparison
  const totalInclVat = typeof invoice.total === 'string'
    ? parseFloat(invoice.total)
    : invoice.total;

  const totalPayed = typeof invoice.paidAmount === 'string'
    ? parseFloat(invoice.paidAmount)
    : invoice.paidAmount;

  // Check if there is an unpaid amount
  const isUnpaid = (totalInclVat - totalPayed) > 0.01;

  const expiryDate = parseISO(invoice.dueDate);
  const today = new Date();

  return isUnpaid && !isAfter(expiryDate, today);
};

type InvoiceStatus = 'all' | 'paid' | 'unpaid' | 'overdue';

const InvoicesPage: React.FC = () => {
  const [year, setYear] = useState<string>('all');
  const [status, setStatus] = useState<InvoiceStatus>('all');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(100);

  // We now use a single invoiceQuery instead of separate queries

  // Single query for invoices that handles all statuses
  const invoiceQuery = useQuery({
    queryKey: ['invoices', status, year, page, limit],
    queryFn: async () => {
      // Build the base URL based on status
      let baseUrl = `${API_BASE}/invoices`;
      if (status !== 'all') {
        baseUrl = `${API_BASE}/invoices/${status}`;
      }

      // Add query parameters
      const yearParam = year !== 'all' ? `year=${year}` : '';
      const pageParam = `page=${page}`;
      const limitParam = `limit=${limit}`;
      const queryParams = [yearParam, pageParam, limitParam].filter(Boolean).join('&');
      const url = `${baseUrl}${queryParams ? `?${queryParams}` : ''}`;

      console.log(`Fetching invoices from: ${url}`);

      const response = await fetch(url);
      const data = await response.json();

      return data;
    },
    staleTime: 60000, // 1 minute
  });

  // Use the invoice query data directly
  const invoiceData = invoiceQuery.data;

  // Get the filtered invoices
  const filteredInvoices = useMemo(() => {
    if (!invoiceData?.data) {
      return [];
    }
    return invoiceData.data;
  }, [invoiceData]);

  const renderStatusBadge = (invoice: Invoice) => {
    // Use the status field from the unified API if available
    if (invoice.status) {
      if (invoice.status === 'paid' || isPaid(invoice)) {
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="h-3.5 w-3.5 mr-1" />
            Betaald
          </Badge>
        );
      }

      if (invoice.status === 'overdue' || isOverdue(invoice)) {
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
            Verlopen
          </Badge>
        );
      }

      if (invoice.status === 'unpaid') {
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            Open
          </Badge>
        );
      }
    }

    // Fallback to the old calculation method
    if (isPaid(invoice)) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-3.5 w-3.5 mr-1" />
          Betaald
        </Badge>
      );
    }

    if (isOverdue(invoice)) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <AlertTriangle className="h-3.5 w-3.5 mr-1" />
          Verlopen
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
        Open
      </Badge>
    );
  };

  // Render pagination controls
  function renderPagination() {
    if (!invoiceData?.meta) {
      return null;
    }

    const { page, totalPages, hasNextPage, hasPrevPage } = invoiceData.meta;

    return (
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-muted-foreground">
          Pagina {page} van {totalPages}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={!hasPrevPage}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Vorige
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={!hasNextPage}
          >
            Volgende
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Facturen</h2>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Facturen</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <Select value={status} onValueChange={(value) => {
                setStatus(value as InvoiceStatus);
                setPage(1); // Reset to page 1 when changing filters
              }}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle statussen</SelectItem>
                  <SelectItem value="paid">Betaald</SelectItem>
                  <SelectItem value="unpaid">Openstaand</SelectItem>
                  <SelectItem value="overdue">Verlopen</SelectItem>
                </SelectContent>
              </Select>

              <Select value={year} onValueChange={(value) => {
                setYear(value);
                setPage(1); // Reset to page 1 when changing filters
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecteer jaar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle jaren</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>

              <Select value={limit.toString()} onValueChange={(value) => {
                setLimit(parseInt(value));
                setPage(1); // Reset to page 1 when changing limit
              }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Aantal per pagina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 per pagina</SelectItem>
                  <SelectItem value="25">25 per pagina</SelectItem>
                  <SelectItem value="50">50 per pagina</SelectItem>
                  <SelectItem value="100">100 per pagina</SelectItem>
                  <SelectItem value="250">250 per pagina</SelectItem>
                  <SelectItem value="500">500 per pagina</SelectItem>
                  <SelectItem value="1000">1000 per pagina</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <CardDescription>
            Totaal aantal: {invoiceData?.meta?.count || 0}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderInvoiceTable()}
          {renderPagination()}
        </CardContent>
      </Card>
    </div>
  );

  function renderInvoiceTable() {
    if (invoiceQuery.isLoading) {
      return (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (invoiceQuery.isError) {
      return (
        <div className="flex justify-center items-center py-12 text-red-500">
          <AlertTriangle className="h-6 w-6 mr-2" />
          <span>Er is een fout opgetreden bij het ophalen van de facturen.</span>
        </div>
      );
    }

    if (filteredInvoices.length === 0) {
      return (
        <div className="flex justify-center items-center py-12 text-muted-foreground">
          Geen facturen gevonden.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nummer</TableHead>
              <TableHead>Datum</TableHead>
              <TableHead>Vervaldatum</TableHead>
              <TableHead>Klant</TableHead>
              <TableHead>Onderwerp</TableHead>
              <TableHead className="text-right">Ex. BTW</TableHead>
              <TableHead className="text-right">Incl. BTW</TableHead>
              <TableHead className="text-right">Betaald</TableHead>
              <TableHead className="text-right">Openstaand</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredInvoices.map((invoice: Invoice) => {
              // Calculate open amount based on available fields
              const total = invoice.total || invoice.totalAmount || 0;
              const paid = invoice.paidAmount || 0;
              const openAmount = total - paid;

              const isInvoiceOverdue = isOverdue(invoice);
              const isInvoiceUnpaid = !isPaid(invoice);

              return (
                <TableRow
                  key={invoice.id}
                  className={`${isInvoiceOverdue ? 'bg-red-50' : isInvoiceUnpaid ? 'bg-amber-50' : ''}`}
                >
                  <TableCell className="font-medium">{invoice.number}</TableCell>
                  <TableCell>{formatDate(invoice.date)}</TableCell>
                  <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                  <TableCell>{invoice.companyName}</TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block max-w-[200px] truncate">{invoice.subject || '-'}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{invoice.subject || '-'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(invoice.totalExclVat || invoice.amount || 0)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(total)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(paid)}</TableCell>
                  <TableCell className={`text-right ${openAmount > 0 ? 'text-red-600 font-medium' : ''}`}>
                    {formatCurrency(openAmount)}
                  </TableCell>
                  <TableCell>{renderStatusBadge(invoice)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }
};

export default InvoicesPage;
