import React, { useEffect } from 'react';
import { format, startOfMonth, endOfMonth, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ReloadIcon } from '@radix-ui/react-icons';
import { useSyncStore } from '@/stores/sync';
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface DataSyncButtonProps {
  onSync?: () => void;
  viewMode?: 'week' | 'month';
  selectedDate?: Date;
  year?: number;
  week?: number;
  month?: number;
}

export function DataSyncButton({ 
  onSync, 
  viewMode = 'week',
  selectedDate,
  year,
  week,
  month
}: DataSyncButtonProps) {
  const { sync, isSyncing, lastSync, syncError } = useSyncStore();
  const [syncStatus, setSyncStatus] = React.useState('');
  const [currentPeriod, setCurrentPeriod] = React.useState<{startDate: Date, endDate: Date} | null>(null);

  // Calculate period dates based on viewMode and props
  useEffect(() => {
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    if (selectedDate) {
      startDate = viewMode === 'week'
        ? startOfWeek(selectedDate, { weekStartsOn: 1 })
        : startOfMonth(selectedDate);
      endDate = viewMode === 'week'
        ? endOfWeek(selectedDate, { weekStartsOn: 1 })
        : endOfMonth(selectedDate);
    } else if (year && (week || month !== undefined)) {
      if (viewMode === 'week' && week) {
        const firstDayOfYear = new Date(year, 0, 1);
        const firstDayOfWeek = addDays(firstDayOfYear, (week - 1) * 7);
        startDate = firstDayOfWeek;
        endDate = addDays(firstDayOfWeek, 6);
      } else if (viewMode === 'month' && month !== undefined) {
        const monthDate = new Date(year, month, 1);
        startDate = startOfMonth(monthDate);
        endDate = endOfMonth(monthDate);
      }
    }
    
    if (startDate && endDate) {
      setCurrentPeriod({ startDate, endDate });
    }
  }, [selectedDate, viewMode, year, week, month]);

  // Function to handle sync operation
  const handleSync = async () => {
    if (!currentPeriod) return;
    
    const { startDate, endDate } = currentPeriod;
    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');
    
    setSyncStatus('Synchronisatie gestart...');
    console.log(`Starting sync with date range: ${formattedStartDate} to ${formattedEndDate}`);
    
    try {
      // First step: Sync data with Gripp
      setSyncStatus('Data synchroniseren...');
      await sync(formattedStartDate, formattedEndDate);
      
      // Second step: Clear cache
      setSyncStatus('Cache leegmaken...');
      try {
        const clearCacheResponse = await fetch('http://localhost:3002/api/cache/clear', {
          method: 'POST',
        });
        
        if (!clearCacheResponse.ok) {
          const errorData = await clearCacheResponse.text();
          console.error('Failed to clear cache after sync:', errorData);
          throw new Error(`Cache clearing failed: ${errorData}`);
        } else {
          console.log('Cache cleared successfully');
        }
      } catch (cacheError) {
        console.error('Error clearing cache:', cacheError);
        throw cacheError;
      }
      
      // Final step: Trigger callback
      if (onSync) {
        onSync();
      }
      
      setSyncStatus('Synchronisatie voltooid');
      setTimeout(() => setSyncStatus(''), 3000);
    } catch (error) {
      setSyncStatus('Synchronisatie mislukt');
      console.error('Sync process failed:', error);
      setTimeout(() => setSyncStatus(''), 5000);
    }
  };

  const getLastSyncText = () => {
    if (!lastSync) return 'Nooit gesynchroniseerd';
    return `Laatste sync: ${format(lastSync, 'dd/MM/yyyy HH:mm')}`;
  };

  // Get current period text for display
  const getPeriodText = () => {
    if (!currentPeriod) return 'Geen periode geselecteerd';
    const { startDate, endDate } = currentPeriod;
    return `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`;
  };

  return (
    <div className="flex flex-col">
      {syncStatus && (
        <Badge variant="outline" className="mb-2 py-1 px-2 bg-blue-50 text-blue-800 border-blue-200 text-xs">
          {syncStatus}
        </Badge>
      )}
      
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          onClick={handleSync}
          disabled={isSyncing || !currentPeriod}
        >
          <ReloadIcon className={cn("h-4 w-4", isSyncing && "animate-spin")} />
          {isSyncing ? "Synchroniseren..." : "Sync huidige periode"}
        </Button>
        
        <div className="text-xs text-gray-700">
          {getPeriodText()}
        </div>
      </div>
      
      <div className="text-xs text-gray-500 mt-1">
        {getLastSyncText()}
      </div>
      
      {syncError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-xs mt-2">
          {syncError}
        </div>
      )}
    </div>
  );
}