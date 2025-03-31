import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Loader2, AlertTriangle, CheckCircle, Filter } from 'lucide-react';
import { Invoice } from '../../types/invoice';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';
import { Badge } from '../../components/ui/badge';
import { format, parseISO, isAfter } from 'date-fns';
import { nl } from 'date-fns/locale';

// Define API base URL - use relative path to work with Vite proxy
const API_BASE = '/api';

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

// Check if an invoice is overdue
const isOverdue = (invoice: Invoice) => {
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
  
  const expiryDate = parseISO(invoice.expirydate.date);
  const today = new Date();
  
  return isUnpaid && !isAfter(expiryDate, today);
};

type InvoiceStatus = 'all' | 'paid' | 'unpaid' | 'overdue';

const InvoicesPage: React.FC = () => {
  const [year, setYear] = useState<string>('all');
  const [status, setStatus] = useState<InvoiceStatus>('all');

  // Query for all invoices
  const invoicesQuery = useQuery({
    queryKey: ['invoices', 'all', year],
    queryFn: async () => {
      const yearParam = year !== 'all' ? `?year=${year}` : '';
      const response = await fetch(`${API_BASE}/invoices${yearParam}`);
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }
      return await response.json();
    },
  });

  // Filter invoices based on status
  const filteredInvoices = useMemo(() => {
    if (!invoicesQuery.data?.rows) {
      return [];
    }

    const invoices = invoicesQuery.data.rows;

    // Apply status filter
    switch (status) {
      case 'paid':
        return invoices.filter((invoice: Invoice) => isPaid(invoice));
      case 'unpaid':
        return invoices.filter((invoice: Invoice) => !isPaid(invoice) && !isOverdue(invoice));
      case 'overdue':
        return invoices.filter((invoice: Invoice) => isOverdue(invoice));
      default:
        return invoices;
    }
  }, [invoicesQuery.data, status]);

  const renderStatusBadge = (invoice: Invoice) => {
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Facturen</h1>
          <p className="text-muted-foreground">
            Overzicht van alle facturen en hun status
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Facturen</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
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
          <CardDescription>
            Totaal aantal: {filteredInvoices.length}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderInvoiceTable()}
        </CardContent>
      </Card>
    </div>
  );
  
  function renderInvoiceTable() {
    if (invoicesQuery.isLoading) {
      return (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (invoicesQuery.isError) {
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
              const openAmount = invoice.totalinclvat - invoice.totalpayed;
              const isInvoiceOverdue = isOverdue(invoice);
              const isInvoiceUnpaid = !isPaid(invoice);
              
              return (
                <TableRow 
                  key={invoice.id}
                  className={`${isInvoiceOverdue ? 'bg-red-50' : isInvoiceUnpaid ? 'bg-amber-50' : ''}`}
                >
                  <TableCell className="font-medium">{invoice.number}</TableCell>
                  <TableCell>{formatDate(invoice.date.date)}</TableCell>
                  <TableCell>{formatDate(invoice.expirydate.date)}</TableCell>
                  <TableCell>{invoice.company.searchname}</TableCell>
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
                  <TableCell className="text-right">{formatCurrency(invoice.totalincldiscountexclvat)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(invoice.totalinclvat)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(invoice.totalpayed)}</TableCell>
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