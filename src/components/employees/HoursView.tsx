import React from 'react';
import type { GrippHour } from '../../types/gripp';
import { Card, CardContent } from '../ui/card';
import { cn } from '../../lib/utils';

type ViewMode = 'week' | 'month';

interface HoursViewProps {
  hours: GrippHour[];
  viewMode: ViewMode;
}

const getDaysInMonth = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
};

const getWeekNumber = (date: Date) => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

const groupHoursByPeriod = (hours: GrippHour[], viewMode: ViewMode) => {
  const grouped = new Map<string, number>();

  hours.forEach(hour => {
    const date = new Date(hour.date.date);
    const key = viewMode === 'week' 
      ? `Week ${getWeekNumber(date)}`
      : `${date.toLocaleString('default', { month: 'long' })}`;
    
    grouped.set(key, (grouped.get(key) || 0) + hour.amount);
  });

  return grouped;
};

export function HoursView({ hours, viewMode }: HoursViewProps) {
  const groupedHours = groupHoursByPeriod(hours, viewMode);
  const periods = Array.from(groupedHours.entries());
  const maxHours = Math.max(...periods.map(([_, hours]) => hours));

  return (
    <div className="space-y-4">
      {periods.map(([period, totalHours]) => (
        <Card key={period} className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium">{period}</h4>
              <span className="text-sm text-muted-foreground">{totalHours} hours</span>
            </div>
            <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500 ease-in-out rounded-full",
                  totalHours >= 40 ? "bg-green-500" : "bg-primary"
                )}
                style={{
                  width: `${Math.min((totalHours / maxHours) * 100, 100)}%`,
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>0h</span>
              <span>{maxHours}h</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
} 