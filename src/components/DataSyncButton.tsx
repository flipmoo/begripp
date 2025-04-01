import React, { useEffect } from 'react';
import { format, startOfMonth, endOfMonth, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ReloadIcon } from '@radix-ui/react-icons';
import { useSyncStore } from '@/stores/sync';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
  
  // Calculate default dates based on viewMode and selected date/period
  const [startDate, setStartDate] = React.useState<Date | undefined>(() => {
    if (selectedDate) {
      return viewMode === 'week'
        ? startOfWeek(selectedDate, { weekStartsOn: 1 })
        : startOfMonth(selectedDate);
    } else if (year && (week || month !== undefined)) {
      if (viewMode === 'week' && week) {
        // Bereken eerste dag van de week in het opgegeven jaar
        const firstDayOfYear = new Date(year, 0, 1);
        return addDays(firstDayOfYear, (week - 1) * 7);
      } else if (viewMode === 'month' && month !== undefined) {
        // Eerste dag van de opgegeven maand
        return new Date(year, month, 1);
      }
    }
    return startOfMonth(new Date());
  });

  const [endDate, setEndDate] = React.useState<Date | undefined>(() => {
    if (selectedDate) {
      return viewMode === 'week'
        ? endOfWeek(selectedDate, { weekStartsOn: 1 })
        : endOfMonth(selectedDate);
    } else if (year && (week || month !== undefined)) {
      if (viewMode === 'week' && week) {
        // Bereken eerste dag van de week en tel er 6 dagen bij op
        const firstDayOfYear = new Date(year, 0, 1);
        const firstDayOfWeek = addDays(firstDayOfYear, (week - 1) * 7);
        return addDays(firstDayOfWeek, 6);
      } else if (viewMode === 'month' && month !== undefined) {
        // Laatste dag van de opgegeven maand
        return endOfMonth(new Date(year, month, 1));
      }
    }
    return endOfMonth(new Date());
  });

  const [calendarOpen, setCalendarOpen] = React.useState(false);
  const [syncStatus, setSyncStatus] = React.useState('');

  // Function to handle sync operation
  const handleSync = async () => {
    if (!startDate || !endDate) return;
    
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
          console.error('Failed to clear cache after sync');
        }
      } catch (cacheError) {
        console.error('Error clearing cache:', cacheError);
      }
      
      // Final step: Trigger callback
      if (onSync) {
        onSync();
      }
      
      setSyncStatus('Synchronisatie voltooid');
      setTimeout(() => setSyncStatus(''), 3000);
      
      // Close the popover after successful sync
      setCalendarOpen(false);
    } catch (error) {
      setSyncStatus('Synchronisatie mislukt');
      console.error('Sync process failed:', error);
      setTimeout(() => setSyncStatus(''), 5000);
    }
  };

  // Auto-sync when date range changes if dates are valid
  const autoSync = async (start: Date, end: Date) => {
    const formattedStartDate = format(start, 'yyyy-MM-dd');
    const formattedEndDate = format(end, 'yyyy-MM-dd');
    
    console.log(`Auto-syncing with date range: ${formattedStartDate} to ${formattedEndDate}`);
    setSyncStatus('Automatische synchronisatie...');
    
    try {
      await sync(formattedStartDate, formattedEndDate);
      
      try {
        await fetch('http://localhost:3002/api/cache/clear', {
          method: 'POST',
        });
      } catch (cacheError) {
        console.error('Error clearing cache:', cacheError);
      }
      
      if (onSync) {
        onSync();
      }
      
      setSyncStatus('Synchronisatie voltooid');
      setTimeout(() => setSyncStatus(''), 3000);
    } catch (error) {
      setSyncStatus('Automatische sync mislukt');
      console.error('Auto-sync failed:', error);
      setTimeout(() => setSyncStatus(''), 5000);
    }
  };

  // Update date range when props change
  useEffect(() => {
    let newStartDate: Date | undefined;
    let newEndDate: Date | undefined;
    
    if (selectedDate) {
      newStartDate = viewMode === 'week'
        ? startOfWeek(selectedDate, { weekStartsOn: 1 })
        : startOfMonth(selectedDate);
      newEndDate = viewMode === 'week'
        ? endOfWeek(selectedDate, { weekStartsOn: 1 })
        : endOfMonth(selectedDate);
    } else if (year && (week || month !== undefined)) {
      if (viewMode === 'week' && week) {
        const firstDayOfYear = new Date(year, 0, 1);
        const firstDayOfWeek = addDays(firstDayOfYear, (week - 1) * 7);
        newStartDate = firstDayOfWeek;
        newEndDate = addDays(firstDayOfWeek, 6);
      } else if (viewMode === 'month' && month !== undefined) {
        const monthDate = new Date(year, month, 1);
        newStartDate = startOfMonth(monthDate);
        newEndDate = endOfMonth(monthDate);
      }
    }
    
    if (newStartDate && newEndDate) {
      setStartDate(newStartDate);
      setEndDate(newEndDate);
    }
  }, [selectedDate, viewMode, year, week, month]);

  const getLastSyncText = () => {
    if (!lastSync) return 'Nooit gesynchroniseerd';
    return `Laatste synchronisatie: ${format(lastSync, 'dd/MM/yyyy HH:mm')}`;
  };

  return (
    <div className="flex flex-col">
      {syncStatus && (
        <Badge variant="outline" className="mb-2 py-1 px-2 bg-blue-50 text-blue-800 border-blue-200 text-xs">
          {syncStatus}
        </Badge>
      )}
      
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <ReloadIcon className={cn("h-4 w-4", isSyncing && "animate-spin")} />
            {isSyncing ? "Synchroniseren..." : "Synchroniseer"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="end">
          <div className="flex flex-col gap-4 min-w-[300px]">
            <div className="text-sm font-medium">Sync data voor periode:</div>
            
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">
                {startDate && endDate
                  ? `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`
                  : "Selecteer datumbereik"}
              </div>
              
              <Calendar
                mode="range"
                selected={{
                  from: startDate,
                  to: endDate,
                }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setStartDate(range.from);
                    setEndDate(range.to);
                    // Auto-sync when a complete date range is selected
                    autoSync(range.from, range.to);
                  } else {
                    setStartDate(range?.from);
                    setEndDate(range?.to);
                  }
                }}
                numberOfMonths={2}
                className="border rounded-md"
              />
            </div>
            
            <Button 
              onClick={handleSync} 
              disabled={isSyncing || !startDate || !endDate}
              className="w-full"
            >
              {isSyncing && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
              Nu Synchroniseren
            </Button>
            
            <div className="text-xs text-gray-500">{getLastSyncText()}</div>
            
            {syncError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded text-xs">
                {syncError}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}