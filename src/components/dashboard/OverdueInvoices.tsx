import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';
import { Badge } from '../ui/badge';
import { API_BASE_URL } from '../../config/api';

// Interface voor factuurgegevens uit de API, aangepast op basis van de factuurlijst in de UI
interface GrippInvoice {
  id: number;
  searchname: string;
  number?: string;  // Factuurnummer
  date?: {         // Datum
    date: string;
    timezone_type: number;
    timezone: string;
  };
  vervaldate?: {    // Vervaldatum
    date: string;
    timezone_type: number;
    timezone: string;
  };
  duedate?: {
    date: string;
    timezone_type: number;
    timezone: string;
  };
  expirydate?: {
    date: string;
    timezone_type: number;
    timezone: string;
  };
  company?: {
    id: number;
    searchname: string;
    discr?: string;
  };
  createdon?: {
    date: string;
    timezone_type: number;
    timezone: string;
  };
  status?: {
    id: number;
    searchname: string;
  };
  totalexclvat?: string;     // Ex. BTW
  totalopeninclvat?: string; // Openstaand bedrag
  totalincldiscountexclvat?: string;
  paymentdate?: {
    date: string;
    timezone_type: number;
    timezone: string;
  };
  payments?: Array<{
    date: {
      date: string;
      timezone_type: number;
      timezone: string;
    };
    amount: string;
  }>;
}

// Interface voor factuurgegevens met berekende velden
interface Invoice extends GrippInvoice {
  overdueDays: number;
}

const OverdueInvoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInvoices = async () => {
      try {
        setLoading(true);

        // Gebruik de dashboard API endpoint voor verlopen facturen
        const response = await fetch(`${API_BASE_URL}/api/dashboard/invoices/overdue`);

        if (!response.ok) {
          throw new Error(`Error fetching overdue invoices: ${response.statusText}`);
        }

        const responseData = await response.json();

        if (!responseData.success) {
          throw new Error('API returned unsuccessful response');
        }

        const data = responseData.data || [];
        console.log('Received overdue invoices from API:', data.length);

        // Log een voorbeeld van de invoice data structuur
        if (data.length > 0) {
          console.log('Sample invoice data structure:', JSON.stringify(data[0], null, 2));
        }

        // Bereken het aantal dagen verlopen voor elke factuur
        const invoicesWithOverdueDays = data.map((invoice: any) => {
          // Bereken het aantal dagen verlopen
          const dueDate = new Date(invoice.dueDate);
          const today = new Date();
          const diffTime = Math.abs(today.getTime() - dueDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          return {
            ...invoice,
            overdueDays: diffDays || invoice.daysOverdue || 15 // Gebruik daysOverdue als fallback
          } as Invoice;
        });

        // Sorteer op aantal dagen verlopen (aflopend)
        const sortedInvoices = invoicesWithOverdueDays.sort((a: Invoice, b: Invoice) =>
          b.overdueDays - a.overdueDays
        );

        console.log('Final invoices count:', sortedInvoices.length);
        setInvoices(sortedInvoices);
      } catch (error) {
        console.error('Error loading invoices:', error);
        // Toon een leeg resultaat bij een fout
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    };

    loadInvoices();
  }, []);

  // Helper function om severity badge kleur te bepalen op basis van verlopen dagen
  const getSeverityColor = (days: number) => {
    if (days > 30) return 'bg-red-500'; // Kritiek
    if (days > 14) return 'bg-amber-500'; // Waarschuwing
    return 'bg-blue-500'; // Informatie
  };

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>Verlopen Facturen ({invoices.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-gray-500">Facturen laden...</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-gray-500">Geen verlopen facturen gevonden</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Factuur</TableHead>
                <TableHead>Klant</TableHead>
                <TableHead className="text-right">Openstaand</TableHead>
                <TableHead className="text-right">Dagen te laat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.slice(0, 31).map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium truncate max-w-[150px]">
                    {invoice.searchname}
                  </TableCell>
                  <TableCell className="truncate max-w-[150px]">
                    {invoice.company?.searchname || 'Onbekend'}
                  </TableCell>
                  <TableCell className="text-right">
                    € {parseFloat(invoice.totalopeninclvat || invoice.totalexclvat || '0').toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className={getSeverityColor(invoice.overdueDays)}>
                      {invoice.overdueDays} dagen
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {invoices.length > 31 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-gray-500">
                    + {invoices.length - 31} meer items
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default OverdueInvoices;