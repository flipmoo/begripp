import React from 'react';
import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from '@/components/ui/table';
import { EmployeeWithStats } from '@/services/employee.service';
import { AbsencesByEmployee } from '@/services/absence.service';
import { IconInfo } from './Icons';
import { Button } from './ui/button';

interface EmployeeTableProps {
  employees: EmployeeWithStats[];
  weekDays?: Date[];
  absences?: AbsencesByEmployee;
}

export default function EmployeeTable({ employees }: EmployeeTableProps) {
  const getDifferenceColor = (difference: number) => {
    if (difference < 0) return 'text-red-600';
    return 'text-green-600';
  };

  const calculateDifference = (actual: number, expected: number) => {
    return actual - expected;
  };

  const formatHours = (hours: number) => {
    return `${hours.toFixed(1)}`;
  };

  const formatDifference = (difference: number) => {
    if (difference === 0) return '0';
    return `${difference > 0 ? '+' : ''}${difference.toFixed(1)}`;
  };

  // Create a map to deduplicate employees
  const uniqueEmployees = employees.reduce((acc, employee) => {
    // Use a composite key of ID and name to ensure uniqueness
    const key = `${employee.id}-${employee.name}`;
    if (!acc.has(key)) {
      acc.set(key, { ...employee, uniqueKey: key });
    }
    return acc;
  }, new Map());

  // Convert map back to array
  const deduplicatedEmployees = Array.from(uniqueEmployees.values());

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
            <TableHead className="text-right">LEAVE HOURS</TableHead>
            <TableHead className="text-right">EXPECTED HOURS</TableHead>
            <TableHead className="text-right">WRITTEN HOURS</TableHead>
            <TableHead className="text-right">ACTUAL HOURS</TableHead>
            <TableHead className="text-right">DIFFERENCE</TableHead>
            <TableHead className="text-right">ACTIONS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deduplicatedEmployees.length > 0 ? (
            deduplicatedEmployees.map((employee) => (
              <TableRow key={employee.uniqueKey}>
                <TableCell className="font-medium">{employee.name}</TableCell>
                <TableCell>{employee.function || '-'}</TableCell>
                <TableCell>{employee.contractPeriod || '-'}</TableCell>
                <TableCell className="text-right">{employee.contractHours || 0}</TableCell>
                <TableCell className="text-right">{employee.holidayHours || 0}</TableCell>
                <TableCell className="text-right">{formatHours(employee.leave_hours || employee.leaveHours || 0)}</TableCell>
                <TableCell className="text-right">{formatHours(employee.expected_hours || employee.expectedHours || 0)}</TableCell>
                <TableCell className="text-right">{formatHours(employee.written_hours || employee.writtenHours || 0)}</TableCell>
                <TableCell className="text-right">{formatHours(employee.actual_hours || employee.actualHours || 0)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className={getDifferenceColor(calculateDifference(
                      employee.actual_hours || employee.actualHours || 0,
                      employee.expected_hours || employee.expectedHours || 0
                    ))}>
                      {formatDifference(calculateDifference(
                        employee.actual_hours || employee.actualHours || 0,
                        employee.expected_hours || employee.expectedHours || 0
                      ))}
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