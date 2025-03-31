import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import CacheStatus from '@/components/CacheStatus';
import { DesktopIcon } from '@radix-ui/react-icons';
import { Badge } from '@/components/ui/badge';
import { isDataCached } from '@/services/employee.service';

interface CacheStatusPopupProps {
  year: number;
  week?: number;
  month?: number;
}

export function CacheStatusPopup({ year, week, month }: CacheStatusPopupProps) {
  const [open, setOpen] = useState(false);
  
  // Check if current data is cached
  const isCached = week !== undefined 
    ? isDataCached(year, week)
    : month !== undefined 
      ? isDataCached(year, undefined, month)
      : false;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="relative"
        >
          <DesktopIcon className="h-4 w-4 mr-1" />
          Cache
          {isCached && (
            <Badge 
              variant="outline" 
              className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center bg-green-100 border-green-500"
            >
              <span className="sr-only">Cached</span>
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <CacheStatus compact />
      </PopoverContent>
    </Popover>
  );
} 