import React from 'react';
import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from '@/components/ui/table';
import { EmployeeWithStats } from '@/services/employee.service';
import { format } from 'date-fns';
import { AbsencesByEmployee } from '@/services/absence.service';
import { IconInfo } from './Icons';
import { Button } from './ui/button';

interface EmployeeTableProps {
  employees: EmployeeWithStats[];
  weekDays: Date[];
  absences: AbsencesByEmployee;
}

export default function EmployeeTable({ employees, weekDays, absences }: EmployeeTableProps) {
  const getPercentageColor = (percentage: number) => {
    if (percentage < 80) return 'text-red-600';
    if (percentage < 90) return 'text-amber-500';
    if (percentage > 110) return 'text-blue-600';
    return 'text-green-600';
  };

  const calculatePercentage = (actual: number, expected: number) => {
    if (expected === 0) return 0;
    return Math.round((actual / expected) * 100);
  };

  const formatHours = (hours: number) => {
    return `${hours.toFixed(1)}`;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">EMPLOYEE</TableHead>
            <TableHead>FUNCTION</TableHead>
            <TableHead>CONTRACT PERIOD</TableHead>
            <TableHead className="text-right">CONTRACT HOURS</TableHead>
            <TableHead className="text-right">HOLIDAY HOURS</TableHead>
            <TableHead className="text-right">EXPECTED HOURS</TableHead>
            <TableHead className="text-right">LEAVE HOURS</TableHead>
            <TableHead className="text-right">WRITTEN HOURS</TableHead>
            <TableHead className="text-right">ACTUAL HOURS</TableHead>
            <TableHead className="text-right">PERCENTAGE</TableHead>
            <TableHead className="text-right">ACTIONS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.length > 0 ? (
            employees.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="font-medium">{employee.name}</TableCell>
                <TableCell>{employee.function || '-'}</TableCell>
                <TableCell>{employee.contractPeriod || '-'}</TableCell>
                <TableCell className="text-right">{employee.contractHours || 0}</TableCell>
                <TableCell className="text-right">{employee.holidayHours || 0}</TableCell>
                <TableCell className="text-right">{formatHours(employee.expectedHours)}</TableCell>
                <TableCell className="text-right">{formatHours(employee.leaveHours)}</TableCell>
                <TableCell className="text-right">{formatHours(employee.writtenHours)}</TableCell>
                <TableCell className="text-right">{formatHours(employee.actualHours)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className={getPercentageColor(calculatePercentage(employee.actualHours, employee.expectedHours))}>
                      {calculatePercentage(employee.actualHours, employee.expectedHours)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {}}
                  >
                    <IconInfo className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-6 text-gray-500">
                No employees found matching the filter criteria.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
} 