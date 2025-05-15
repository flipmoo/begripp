import React, { useEffect } from 'react';
import { format, getWeek, getYear, getMonth, setWeek, setMonth, setYear } from 'date-fns';
import { nl } from 'date-fns/locale';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DateSelectorProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  viewMode?: 'week' | 'month';
}

export function DateSelector({ selectedDate, onDateChange, viewMode = 'week' }: DateSelectorProps) {
  const currentYear = getYear(new Date());
  const currentWeek = getWeek(selectedDate, { weekStartsOn: 1, firstWeekContainsDate: 4 });
  const currentMonth = getMonth(selectedDate);

  // Log the current date and calculated week/month
  useEffect(() => {
    console.log('DateSelector - Selected date:', selectedDate);
    if (viewMode === 'week') {
      console.log('DateSelector - Calculated week:', currentWeek, 'with options { weekStartsOn: 1, firstWeekContainsDate: 4 }');
    } else {
      console.log('DateSelector - Calculated month:', currentMonth);
    }
    console.log('DateSelector - ISO string:', selectedDate.toISOString());
  }, [selectedDate, currentWeek, currentMonth, viewMode]);

  // Generate arrays for weeks 1-53, months 0-11, and years (current year ± 2)
  const weeks = Array.from({ length: 53 }, (_, i) => i + 1);
  const months = Array.from({ length: 12 }, (_, i) => i);
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const handleWeekChange = (value: string) => {
    console.log('DateSelector - Week changed to:', value);
    const newDate = setWeek(selectedDate, parseInt(value), { weekStartsOn: 1, firstWeekContainsDate: 4 });
    console.log('DateSelector - New date after week change:', newDate, newDate.toISOString());

    // Trigger immediate data refresh
    setTimeout(() => {
      onDateChange(newDate);
    }, 0);
  };

  const handleMonthChange = (value: string) => {
    console.log('DateSelector - Month changed to:', value);
    const newDate = setMonth(selectedDate, parseInt(value));
    console.log('DateSelector - New date after month change:', newDate, newDate.toISOString());

    // Trigger immediate data refresh
    setTimeout(() => {
      onDateChange(newDate);
    }, 0);
  };

  const handleYearChange = (value: string) => {
    console.log('DateSelector - Year changed to:', value);
    const newDate = setYear(selectedDate, parseInt(value));
    console.log('DateSelector - New date after year change:', newDate, newDate.toISOString());

    // Trigger immediate data refresh
    setTimeout(() => {
      onDateChange(newDate);
    }, 0);
  };

  return (
    <div className="flex items-center gap-4">
      {viewMode === 'week' && (
        <Select value={currentWeek.toString()} onValueChange={handleWeekChange}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Week" />
          </SelectTrigger>
          <SelectContent>
            {weeks.map((week) => (
              <SelectItem key={week} value={week.toString()}>
                {`Week ${week}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {viewMode === 'month' && (
        <Select value={currentMonth.toString()} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            {months.map((month) => (
              <SelectItem key={month} value={month.toString()}>
                {format(new Date(2024, month), 'MMMM', { locale: nl })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={currentYear.toString()} onValueChange={handleYearChange}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          {years.map((year) => (
            <SelectItem key={year} value={year.toString()}>
              {year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}