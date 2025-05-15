import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { IconInfo } from '@/components/Icons';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useUnifiedInvoices } from '@/contexts/UnifiedInvoicesContext';
import UnifiedInvoiceDetails from './invoices/UnifiedInvoiceDetails';
import { Invoice } from '@/types/unified';

interface UnifiedInvoiceTableProps {
  className?: string;
}

export default function UnifiedInvoiceTable({ className }: UnifiedInvoiceTableProps) {
  const {
    filteredInvoices,
    loading,
    formatDate,
    formatCurrency,
    isPaid,
    isOverdue,
    currentPage,
    totalPages,
    pageSize,
    totalInvoices,
    hasNextPage,
    hasPreviousPage,
    setCurrentPage,
    setPageSize
  } = useUnifiedInvoices();

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  console.log('UnifiedInvoiceTable - filteredInvoices:', filteredInvoices);
  console.log('UnifiedInvoiceTable - loading:', loading);
  console.log('UnifiedInvoiceTable - pagination:', {
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    totalInvoices
  });

  if (loading) {
    return <div className="py-10 text-center text-gray-500">Facturen laden...</div>;
  }

  if (!filteredInvoices || filteredInvoices.length === 0) {
    return (
      <div className="py-10 text-center">
        <div className="text-gray-500 mb-2">Geen facturen gevonden die voldoen aan de filtercriteria.</div>
        <div className="text-sm text-gray-400">
          Dit kan komen door de geselecteerde filters of omdat de API limiet is bereikt.
          <br />
          Probeer andere filters te gebruiken of probeer het later opnieuw.
        </div>
      </div>
    );
  }

  // Handle page change
  const handlePageChange = (page: number) => {
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;

    setCurrentPage(page);
  };

  return (
    <div className={`overflow-x-auto ${className}`}>
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
          {filteredInvoices.map((invoice) => {
            const openAmount = invoice.totalAmount - (isPaid(invoice) ? invoice.totalAmount : 0);
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
                <TableCell>{invoice.companyName || ''}</TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block max-w-[200px] truncate">
                          {invoice.subject || `Factuur ${invoice.number}`}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{invoice.subject || `Factuur ${invoice.number}`}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(invoice.totalExclVat || (invoice.totalAmount ? invoice.totalAmount * 0.826 : 0))}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(invoice.totalAmount)}</TableCell>
                <TableCell className="text-right">
                  {isPaid(invoice) ? formatCurrency(invoice.totalAmount) : formatCurrency(0)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(openAmount)}
                </TableCell>
                <TableCell className="flex items-center gap-2">
                  {isPaid(invoice) ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Betaald
                    </span>
                  ) : isInvoiceOverdue ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Verlopen
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      Openstaand
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedInvoice(invoice)}
                    className="ml-auto"
                  >
                    <IconInfo className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Pagination - Always show pagination controls */}
      <div className="flex justify-between items-center mt-4 px-2">
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            Pagina {currentPage} van {totalPages} ({totalInvoices} facturen)
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Aantal per pagina:</span>
            <select
              className="text-sm border rounded p-1"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="250">250</option>
              <option value="500">500</option>
              <option value="1000">1000</option>
            </select>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(1)}
            disabled={!hasPreviousPage || currentPage === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!hasPreviousPage || currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!hasNextPage || currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(totalPages)}
            disabled={!hasNextPage || currentPage === totalPages}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <UnifiedInvoiceDetails
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />
    </div>
  );
}
