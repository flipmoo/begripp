import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { EmployeeWithStats } from '@/services/employee.service';

interface EmployeeCardProps {
  employee: EmployeeWithStats;
}

export function EmployeeCard({ employee }: EmployeeCardProps) {
  // Calculate percentage
  const percentage = employee.expectedHours > 0 
    ? Math.round((employee.actualHours / employee.expectedHours) * 100) 
    : 0;
  
  // Calculate difference in hours
  const hoursDifference = employee.actualHours - employee.expectedHours;
  // Round to 2 decimal places
  const roundedHoursDifference = Math.round(hoursDifference * 100) / 100;
  
  // Determine color based on percentage
  const getColorClass = () => {
    if (percentage < 80) return 'text-red-500';
    if (percentage < 95) return 'text-amber-500';
    if (percentage <= 105) return 'text-green-500';
    return 'text-blue-500';
  };
  
  // Determine progress bar color
  const getProgressColor = () => {
    if (percentage < 80) return 'bg-red-500';
    if (percentage < 95) return 'bg-amber-500';
    if (percentage <= 105) return 'bg-green-500';
    return 'bg-blue-500';
  };

  return (
    <Card className="w-full h-full hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-bold">{employee.name}</CardTitle>
            <CardDescription>{employee.function || 'Geen functie'}</CardDescription>
          </div>
          <Badge variant={employee.active ? "default" : "outline"}>
            {employee.active ? 'Actief' : 'Inactief'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Uren</span>
            <span className={`text-xl font-bold ${getColorClass()}`}>
              {percentage}%
            </span>
          </div>
          
          <Progress 
            value={Math.min(percentage, 100)} 
            className="h-2" 
            indicatorClassName={getProgressColor()} 
          />
          
          <div className="grid grid-cols-2 gap-2 pt-2">
            <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
              <div className="text-xs text-gray-500">Verwacht</div>
              <div className="text-lg font-semibold">{employee.expectedHours}u</div>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
              <div className="text-xs text-gray-500">Werkelijk</div>
              <div className="text-lg font-semibold">{employee.actualHours}u</div>
            </div>
          </div>
          
          <div className="flex justify-between items-center pt-2">
            <span className="text-sm">Verschil:</span>
            <span className={`font-medium ${roundedHoursDifference >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {roundedHoursDifference >= 0 ? '+' : ''}{roundedHoursDifference}u
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-0 text-xs text-gray-500">
        <div className="w-full flex justify-between">
          <span>Contract: {employee.contractHours || 0}u</span>
          <span>Verlof: {employee.leaveHours}u</span>
        </div>
      </CardFooter>
    </Card>
  );
} 