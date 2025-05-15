import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, RotateCw } from 'lucide-react';
import UnifiedInvoiceTable from '@/components/UnifiedInvoiceTable';
import UnifiedInvoiceFilters from '@/components/invoices/UnifiedInvoiceFilters';
import { UnifiedInvoicesProvider, useUnifiedInvoices } from '@/contexts/UnifiedInvoicesContext';
import { useToast } from '@/components/ui/use-toast';
import { API_ENDPOINTS, API_BASE_URL } from '@/config/api';

const UnifiedInvoicesPage: React.FC = () => {
  return (
    <UnifiedInvoicesProvider>
      <UnifiedInvoicesPageContent />
    </UnifiedInvoicesProvider>
  );
};

const UnifiedInvoicesPageContent: React.FC = () => {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

  const {
    filteredInvoices,
    totalInvoices,
    loading,
    isRefreshing,
    error,
    year,
    status,
    setYear,
    setStatus,
    fetchData
  } = useUnifiedInvoices();

  const handleRefresh = () => {
    fetchData(true);
  };

  const handleSync = async () => {
    try {
      setIsSyncing(true);

      toast({
        title: "Synchronisatie gestart",
        description: "Facturen worden gesynchroniseerd met Gripp...",
      });

      // Use API_BASE_URL to ensure consistent configuration
      const response = await fetch(`${API_BASE_URL}/api/v1/sync/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          incremental: false
        })
      });

      if (!response.ok) {
        throw new Error(`Sync failed with status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error('Sync failed: ' + (data.error || 'Unknown error'));
      }

      toast({
        title: "Synchronisatie voltooid",
        description: "Facturen zijn gesynchroniseerd met Gripp.",
      });

      // Fetch fresh data with the refresh flag
      fetchData(true);
    } catch (error) {
      console.error('Error syncing invoices:', error);
      toast({
        title: "Synchronisatie mislukt",
        description: error instanceof Error ? error.message : "Er is een fout opgetreden bij het synchroniseren van facturen.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Facturen</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isRefreshing}
            onClick={handleRefresh}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Vernieuwen...' : 'Vernieuwen'}
          </Button>

          <Button
            variant="default"
            size="sm"
            disabled={isSyncing}
            onClick={handleSync}
            className="flex items-center gap-2"
          >
            <RotateCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Synchroniseren...' : 'Synchroniseren met Gripp'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <UnifiedInvoiceFilters className="mb-6" />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle>Facturen</CardTitle>
          </div>
          <CardDescription>
            Totaal aantal: {totalInvoices}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="py-10 text-center text-red-500">
              Error: {error}
            </div>
          ) : (
            <UnifiedInvoiceTable />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UnifiedInvoicesPage;
