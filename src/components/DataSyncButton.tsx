import React from 'react';
import { format, startOfMonth, endOfMonth, addDays, subDays, startOfWeek, endOfWeek } from 'date-fns';
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

  const handleSync = async () => {
    if (!startDate || !endDate) return;
    
    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');
    
    await sync(formattedStartDate, formattedEndDate);
    
    if (onSync) {
      onSync();
    }
  };

  // Update date range when props change
  React.useEffect(() => {
    if (selectedDate) {
      setStartDate(viewMode === 'week'
        ? startOfWeek(selectedDate, { weekStartsOn: 1 })
        : startOfMonth(selectedDate));
      setEndDate(viewMode === 'week'
        ? endOfWeek(selectedDate, { weekStartsOn: 1 })
        : endOfMonth(selectedDate));
    } else if (year && (week || month !== undefined)) {
      if (viewMode === 'week' && week) {
        const firstDayOfYear = new Date(year, 0, 1);
        const firstDayOfWeek = addDays(firstDayOfYear, (week - 1) * 7);
        setStartDate(firstDayOfWeek);
        setEndDate(addDays(firstDayOfWeek, 6));
      } else if (viewMode === 'month' && month !== undefined) {
        const monthDate = new Date(year, month, 1);
        setStartDate(startOfMonth(monthDate));
        setEndDate(endOfMonth(monthDate));
      }
    }
  }, [selectedDate, viewMode, year, week, month]);

  const getLastSyncText = () => {
    if (!lastSync) return 'Never synced';
    return `Last synced: ${format(lastSync, 'dd/MM/yyyy HH:mm')}`;
  };

  return (
    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <ReloadIcon className={cn("h-4 w-4", isSyncing && "animate-spin")} />
          Sync
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="end">
        <div className="flex flex-col gap-4 min-w-[300px]">
          <div className="text-sm font-medium">Sync data voor periode:</div>
          
          <div className="flex flex-col gap-2">
            <div className="text-sm">
              {startDate && endDate
                ? `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`
                : "Select date range"}
            </div>
            
            <Calendar
              mode="range"
              selected={{
                from: startDate,
                to: endDate,
              }}
              onSelect={(range) => {
                setStartDate(range?.from);
                setEndDate(range?.to);
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
            Start Sync
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
  );
} 