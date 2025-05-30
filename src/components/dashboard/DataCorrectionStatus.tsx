import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';

// Define status types
type CorrectionStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

interface DataCorrection {
  id: string;
  source: string;
  target: string;
  field: string;
  status: CorrectionStatus;
  timestamp: number;
  description: string;
}

// Mock data for demo purposes
const initialCorrections: DataCorrection[] = [
  {
    id: '1',
    source: 'Nmbrs',
    target: 'Werknemer #1021',
    field: 'contracturen',
    status: 'completed',
    timestamp: Date.now() - 3600000, // 1 hour ago
    description: 'Contract uren gewijzigd van 32 naar 40 uur'
  },
  {
    id: '2',
    source: 'Exact',
    target: 'Project #P-2023-042',
    field: 'budget',
    status: 'pending',
    timestamp: Date.now() - 7200000, // 2 hours ago
    description: 'Budget aanpassing van €10.000 naar €15.000'
  },
  {
    id: '3',
    source: 'Nmbrs',
    target: 'Werknemer #1045',
    field: 'verlofuren',
    status: 'in_progress',
    timestamp: Date.now() - 86400000, // 1 day ago
    description: 'Verlofuren correctie: 24 uur toegevoegd'
  },
  {
    id: '4',
    source: 'TMetrix',
    target: 'Project #P-2023-039',
    field: 'uren',
    status: 'failed',
    timestamp: Date.now() - 172800000, // 2 days ago
    description: 'Uren correctie kon niet worden doorgevoerd'
  }
];

const DataCorrectionStatus: React.FC = () => {
  const [corrections, setCorrections] = useState<DataCorrection[]>(initialCorrections);

  // Function to get status badge with appropriate styling
  const getStatusBadge = (status: CorrectionStatus) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Voltooid
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Clock className="h-3 w-3 mr-1" />
            In Uitvoering
          </Badge>
        );
      case 'pending':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <Clock className="h-3 w-3 mr-1" />
            Wachtend
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Mislukt
          </Badge>
        );
    }
  };

  // Helper function to retry failed corrections
  const retryCorrection = (id: string) => {
    setCorrections(
      corrections.map(correction => 
        correction.id === id 
          ? { ...correction, status: 'in_progress' as CorrectionStatus } 
          : correction
      )
    );
    
    // Simulate that the retry would succeed after 2 seconds
    setTimeout(() => {
      setCorrections(
        corrections.map(correction => 
          correction.id === id 
            ? { ...correction, status: 'completed' as CorrectionStatus } 
            : correction
        )
      );
    }, 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Correctie Status</CardTitle>
        <CardDescription>
          Overzicht van recente datacorrecties tussen systemen
        </CardDescription>
      </CardHeader>
      <CardContent>
        {corrections.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-muted-foreground">
            <CheckCircle className="h-8 w-8 mb-2" />
            <p>Geen recente datacorrecties</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bron</TableHead>
                <TableHead>Doel</TableHead>
                <TableHead>Veld</TableHead>
                <TableHead>Wijziging</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {corrections.map(correction => (
                <TableRow key={correction.id}>
                  <TableCell className="font-medium">{correction.source}</TableCell>
                  <TableCell>{correction.target}</TableCell>
                  <TableCell>{correction.field}</TableCell>
                  <TableCell>{correction.description}</TableCell>
                  <TableCell>{getStatusBadge(correction.status)}</TableCell>
                  <TableCell>
                    {new Date(correction.timestamp).toLocaleString('nl-NL', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </TableCell>
                  <TableCell>
                    {correction.status === 'failed' && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => retryCorrection(correction.id)}
                      >
                        Opnieuw
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default DataCorrectionStatus; 