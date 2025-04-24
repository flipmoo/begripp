/**
 * Invoices Page
 *
 * This page displays invoice data with filtering and status visualization.
 * It supports filtering by year and payment status.
 */

// React and hooks
import React, { useState, useMemo } from 'react';

// Data fetching
import { useQuery } from '@tanstack/react-query';

// Date utilities
import { format, parseISO, isAfter } from 'date-fns';
import { nl } from 'date-fns/locale';

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

// Icons
import { Loader2, AlertTriangle, CheckCircle, Filter } from 'lucide-react';

// Types
import { Invoice } from '@/types/invoice';

/**
 * API base URL for invoice data
 * Using a relative path to work with Vite proxy
 */
const API_BASE = '/api';

/**
 * Format a date string to localized format
 *
 * @param dateString - ISO date string to format
 * @returns Formatted date string in Dutch format (dd-MM-yyyy)
 */
const formatDate = (dateString: string) => {
  try {
    return format(parseISO(dateString), 'dd-MM-yyyy', { locale: nl });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString; // Return original string on error
  }
};

/**
 * Format a number as currency
 *
 * @param amount - Number to format as currency
 * @returns Formatted currency string in Dutch format (€ X.XXX,XX)
 */
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

/**
 * Check if an invoice is fully paid
 *
 * An invoice is considered paid when the total amount including VAT
 * equals the amount paid (with a small tolerance for floating point comparison).
 *
 * @param invoice - Invoice to check
 * @returns Boolean indicating if the invoice is paid
 */
const isPaid = (invoice: Invoice) => {
  // Convert string values to numbers for reliable comparison
  const totalInclVat = typeof invoice.totalinclvat === 'string'
    ? parseFloat(invoice.totalinclvat)
    : invoice.totalinclvat;

  const totalPayed = typeof invoice.totalpayed === 'string'
    ? parseFloat(invoice.totalpayed)
    : invoice.totalpayed;

  // Check if there is no unpaid amount (with small tolerance for floating point comparison)
  return (totalInclVat - totalPayed) <= 0.01;
};

/**
 * Check if an invoice is overdue
 *
 * An invoice is considered overdue when:
 * 1. It has an unpaid amount
 * 2. The expiry date has passed
 *
 * @param invoice - Invoice to check
 * @returns Boolean indicating if the invoice is overdue
 */
const isOverdue = (invoice: Invoice) => {
  // If no expiry date is set, it can't be overdue
  if (!invoice.expirydate?.date) return false;

  // Convert string values to numbers for reliable comparison
  const totalInclVat = typeof invoice.totalinclvat === 'string'
    ? parseFloat(invoice.totalinclvat)
    : invoice.totalinclvat;

  const totalPayed = typeof invoice.totalpayed === 'string'
    ? parseFloat(invoice.totalpayed)
    : invoice.totalpayed;

  // Check if there is an unpaid amount
  const isUnpaid = (totalInclVat - totalPayed) > 0.01;

  // Check if expiry date has passed
  const expiryDate = parseISO(invoice.expirydate.date);
  const today = new Date();

  return isUnpaid && !isAfter(expiryDate, today);
};

/**
 * Possible invoice status filter values
 */
type InvoiceStatus = 'all' | 'paid' | 'unpaid' | 'overdue';

/**
 * Invoices Page Component
 *
 * Displays a list of invoices with filtering capabilities and status visualization.
 * Features:
 * - Filter by year
 * - Filter by payment status (all, paid, unpaid, overdue)
 * - Visual indicators for payment status
 * - Responsive table layout
 */
const InvoicesPage: React.FC = () => {
  /**
   * Selected year filter
   * 'all' means show invoices from all years
   */
  const [year, setYear] = useState<string>('all');

  /**
   * Selected status filter
   * - 'all': Show all invoices
   * - 'paid': Show only paid invoices
   * - 'unpaid': Show only unpaid (but not overdue) invoices
   * - 'overdue': Show only overdue invoices
   */
  const [status, setStatus] = useState<InvoiceStatus>('all');

  /**
   * Fetch invoices data from API
   *
   * Uses React Query to fetch and cache invoice data.
   * Automatically refetches when the year filter changes.
   */
  const invoicesQuery = useQuery({
    queryKey: ['invoices', 'all', year], // Cache key includes year for automatic refetching
    queryFn: async () => {
      // Add year parameter to URL if a specific year is selected
      const yearParam = year !== 'all' ? `?year=${year}` : '';
      const response = await fetch(`${API_BASE}/invoices${yearParam}`);

      // Handle API errors
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }

      return await response.json();
    },
  });

  /**
   * Filter invoices based on selected status
   *
   * Applies the status filter to the fetched invoices.
   * Recalculates when either the data or the status filter changes.
   */
  const filteredInvoices = useMemo(() => {
    // Return empty array if data is not yet available
    if (!invoicesQuery.data?.rows) {
      return [];
    }

    const invoices = invoicesQuery.data.rows;
    console.log(`Filtering ${invoices.length} invoices by status: ${status}`);

    // Apply status filter
    switch (status) {
      case 'paid':
        return invoices.filter((invoice: Invoice) => isPaid(invoice));
      case 'unpaid':
        // Unpaid but not overdue
        return invoices.filter((invoice: Invoice) => !isPaid(invoice) && !isOverdue(invoice));
      case 'overdue':
        return invoices.filter((invoice: Invoice) => isOverdue(invoice));
      default:
        // 'all' - return all invoices
        return invoices;
    }
  }, [invoicesQuery.data, status]);

  /**
   * Render a status badge for an invoice
   *
   * Returns a colored badge with an icon indicating the invoice status:
   * - Green with checkmark: Paid
   * - Red with warning triangle: Overdue
   * - Amber: Open (unpaid but not overdue)
   *
   * @param invoice - The invoice to render a status badge for
   * @returns JSX element with appropriate badge
   */
  const renderStatusBadge = (invoice: Invoice) => {
    // Paid invoice - green badge with checkmark
    if (isPaid(invoice)) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-3.5 w-3.5 mr-1" />
          Betaald
        </Badge>
      );
    }

    // Overdue invoice - red badge with warning triangle
    if (isOverdue(invoice)) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <AlertTriangle className="h-3.5 w-3.5 mr-1" />
          Verlopen
        </Badge>
      );
    }

    // Open invoice - amber badge
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
        Open
      </Badge>
    );
  };

  /**
   * Render the invoices page UI
   */
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* ===== Page Header ===== */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturen</h1>
          <p className="text-muted-foreground">
            Overzicht van alle facturen en hun status
          </p>
        </div>
      </div>

      {/* ===== Invoices Card ===== */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Facturen</CardTitle>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Status filter */}
              <Select value={status} onValueChange={(value) => setStatus(value as InvoiceStatus)}>
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

              {/* Year filter */}
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Selecteer jaar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle jaren</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results count */}
          <CardDescription>
            Totaal aantal: {filteredInvoices.length}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Render invoice table with loading/error states */}
          {renderInvoiceTable()}
        </CardContent>
      </Card>
    </div>
  );

  /**
   * Render the invoice table with appropriate loading, error, or empty states
   *
   * @returns JSX element with the invoice table or appropriate status message
   */
  function renderInvoiceTable() {
    // Loading state
    if (invoicesQuery.isLoading) {
      return (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    // Error state
    if (invoicesQuery.isError) {
      return (
        <div className="flex justify-center items-center py-12 text-red-500">
          <AlertTriangle className="h-6 w-6 mr-2" />
          <span>Er is een fout opgetreden bij het ophalen van de facturen.</span>
        </div>
      );
    }

    // Empty state
    if (filteredInvoices.length === 0) {
      return (
        <div className="flex justify-center items-center py-12 text-muted-foreground">
          Geen facturen gevonden.
        </div>
      );
    }

    // Render invoice table
    return (
      <div className="overflow-x-auto">
        <Table>
          {/* Table header */}
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

          {/* Table body */}
          <TableBody>
            {filteredInvoices.map((invoice: Invoice) => {
              // Calculate open amount
              const openAmount = invoice.totalinclvat - invoice.totalpayed;

              // Determine invoice status for styling
              const isInvoiceOverdue = isOverdue(invoice);
              const isInvoiceUnpaid = !isPaid(invoice);

              // Apply background color based on status
              const rowClassName = isInvoiceOverdue
                ? 'bg-red-50'  // Overdue invoices: red background
                : isInvoiceUnpaid
                  ? 'bg-amber-50'  // Unpaid invoices: amber background
                  : '';  // Paid invoices: default background

              return (
                <TableRow
                  key={invoice.id}
                  className={rowClassName}
                >
                  {/* Invoice number */}
                  <TableCell className="font-medium">{invoice.number}</TableCell>

                  {/* Invoice date */}
                  <TableCell>{formatDate(invoice.date.date)}</TableCell>

                  {/* Expiry date */}
                  <TableCell>{formatDate(invoice.expirydate.date)}</TableCell>

                  {/* Company name */}
                  <TableCell>{invoice.company.searchname}</TableCell>

                  {/* Subject with tooltip for long text */}
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block max-w-[200px] truncate">{invoice.subject}</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{invoice.subject}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>

                  {/* Amount excluding VAT */}
                  <TableCell className="text-right">
                    {formatCurrency(invoice.totalincldiscountexclvat)}
                  </TableCell>

                  {/* Amount including VAT */}
                  <TableCell className="text-right">
                    {formatCurrency(invoice.totalinclvat)}
                  </TableCell>

                  {/* Amount paid */}
                  <TableCell className="text-right">
                    {formatCurrency(invoice.totalpayed)}
                  </TableCell>

                  {/* Open amount (highlight if > 0) */}
                  <TableCell className={`text-right ${openAmount > 0 ? 'text-red-600 font-medium' : ''}`}>
                    {formatCurrency(openAmount)}
                  </TableCell>

                  {/* Status badge */}
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