import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';

interface WeekSelectorProps {
  year: number;
  week: number;
  onYearChange: (year: number) => void;
  onWeekChange: (week: number) => void;
  className?: string;
}

export default function WeekSelector({
  year,
  week,
  onYearChange,
  onWeekChange,
  className,
}: WeekSelectorProps) {
  const handlePrevWeek = () => {
    if (week === 1) {
      // Go to previous year, week 52
      onYearChange(year - 1);
      onWeekChange(52);
    } else {
      onWeekChange(week - 1);
    }
  };

  const handleNextWeek = () => {
    if (week === 52) {
      // Go to next year, week 1
      onYearChange(year + 1);
      onWeekChange(1);
    } else {
      onWeekChange(week + 1);
    }
  };

  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevWeek}
          aria-label="Previous week"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        <div className="flex flex-col items-center px-2">
          <span className="font-medium">Week {week}</span>
          <span className="text-sm text-muted-foreground">{year}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNextWeek}
          aria-label="Next week"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
} 