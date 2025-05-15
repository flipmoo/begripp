/**
 * UnifiedInvoiceDetails Component
 *
 * This component displays detailed information about an invoice.
 */

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { GrippInvoice } from '../../types/gripp';
import { formatCurrency } from '../../utils/formatters';

interface UnifiedInvoiceDetailsProps {
  invoice: GrippInvoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UnifiedInvoiceDetails: React.FC<UnifiedInvoiceDetailsProps> = ({
  invoice,
  open,
  onOpenChange,
}) => {
  if (!invoice) return null;

  const isPaid = invoice.totalopeninclvat === '0.00';
  const isOverdue = new Date(invoice.expirydate) < new Date() && !isPaid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Invoice Details: {invoice.number}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">General Information</h3>
            <div className="space-y-2">
              <div>
                <span className="font-medium">Invoice Number:</span> {invoice.number}
              </div>
              <div>
                <span className="font-medium">Subject:</span> {invoice.subject || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Company:</span> {invoice.companyname || 'N/A'}
              </div>
              <div>
                <span className="font-medium">Status:</span>{' '}
                <span className={`font-semibold ${isPaid ? 'text-green-600' : isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                  {isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Unpaid'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Financial Details</h3>
            <div className="space-y-2">
              <div>
                <span className="font-medium">Total (Excl. VAT):</span> {formatCurrency(parseFloat(invoice.totalincldiscountexclvat || '0'))}
              </div>
              <div>
                <span className="font-medium">Total (Incl. VAT):</span> {formatCurrency(parseFloat(invoice.totalinclvat || '0'))}
              </div>
              <div>
                <span className="font-medium">Amount Paid:</span> {formatCurrency(parseFloat(invoice.totalpayed || '0'))}
              </div>
              <div>
                <span className="font-medium">Amount Due:</span> {formatCurrency(parseFloat(invoice.totalopeninclvat || '0'))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Dates</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="font-medium">Invoice Date:</span>{' '}
              {invoice.date ? new Date(invoice.date).toLocaleDateString() : 'N/A'}
            </div>
            <div>
              <span className="font-medium">Due Date:</span>{' '}
              <span className={isOverdue && !isPaid ? 'text-red-600 font-semibold' : ''}>
                {invoice.expirydate ? new Date(invoice.expirydate).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div>
              <span className="font-medium">Payment Date:</span>{' '}
              {isPaid ? 'Paid in full' : 'Not yet paid'}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedInvoiceDetails;
