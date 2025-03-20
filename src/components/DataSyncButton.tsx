import React from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
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
  onSyncComplete?: () => void;
}

export function DataSyncButton({ onSyncComplete }: DataSyncButtonProps) {
  const { sync, isSyncing, lastSync, syncError } = useSyncStore();
  const [startDate, setStartDate] = React.useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = React.useState<Date | undefined>(endOfMonth(new Date()));
  const [calendarOpen, setCalendarOpen] = React.useState(false);

  const handleSync = async () => {
    if (!startDate || !endDate) return;
    
    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');
    
    await sync(formattedStartDate, formattedEndDate);
    
    if (onSyncComplete) {
      onSyncComplete();
    }
  };

  const getLastSyncText = () => {
    if (!lastSync) return 'Never synced';
    return `Last synced: ${format(lastSync, 'dd/MM/yyyy HH:mm')}`;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-normal",
                !startDate && "text-muted-foreground"
              )}
            >
              <span>
                {startDate && endDate
                  ? `${format(startDate, 'dd/MM/yyyy')} - ${format(endDate, 'dd/MM/yyyy')}`
                  : "Select date range"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
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
            />
          </PopoverContent>
        </Popover>

        <Button 
          onClick={handleSync} 
          disabled={isSyncing || !startDate || !endDate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-colors duration-200"
        >
          {isSyncing && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
          Sync All Data
        </Button>
      </div>
      
      <div className="text-sm text-gray-500">{getLastSyncText()}</div>
      
      {syncError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mt-2">
          {syncError}
        </div>
      )}
    </div>
  );
} 