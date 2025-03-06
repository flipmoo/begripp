import React, { useState, useEffect } from 'react';
import { format, getWeek, getYear, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import { getEmployeeStats, type EmployeeWithStats } from '@/services/employee.service';
import { useSyncStore } from '@/stores/sync';
import { useAbsenceSyncStore } from '@/stores/absence-sync';
import { Button } from '@/components/ui/button';
import { Skeleton } from "@/components/ui/skeleton";
import { ReloadIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { DateSelector } from '@/components/DateSelector';
import { EmployeeAbsenceModal } from '@/components/EmployeeAbsenceModal';
import { Tooltip } from '@/components/ui/tooltip';

export default function EmployeesPage() {
  const initialDate = new Date();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { sync, isSyncing, lastSync, syncError } = useSyncStore();
  const { syncAbsence, isSyncing: isAbsenceSyncing } = useAbsenceSyncStore();
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithStats | null>(null);

  const selectedWeek = getWeek(selectedDate, { weekStartsOn: 1, firstWeekContainsDate: 4 });
  const selectedYear = getYear(selectedDate);

  const loadEmployees = async () => {
    setIsLoading(true);
    try {
      console.log(`Loading employees for year=${selectedYear}, week=${selectedWeek}`);
      const data = await getEmployeeStats(selectedYear, selectedWeek);
      console.log('Employee data loaded:', data);
      
      // Log holiday hours specifically
      console.log('Holiday hours in loaded data:', data.map(emp => ({ 
        name: emp.name, 
        holidayHours: emp.holidayHours,
        contractPeriod: emp.contractPeriod
      })));
      
      // Merge employee data to handle multiple contracts
      const mergedData = mergeEmployeeData(data);
      setEmployees(mergedData);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, [selectedDate]);

  const handleSync = async () => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    
    const startDate = format(start, 'yyyy-MM-dd');
    const endDate = format(end, 'yyyy-MM-dd');
    
    console.log(`Syncing data for period: ${startDate} to ${endDate}`);
    
    // Sync both employees/contracts and absences
    await sync(startDate, endDate);
    await syncAbsence(startDate, endDate);
    await loadEmployees();
  };

  const getLastSyncText = () => {
    if (!lastSync) return 'Never synced';
    return `Last synced: ${format(lastSync, 'dd/MM/yyyy HH:mm')}`;
  };

  const calculatePercentage = (actual: number, expected: number) => {
    if (expected === 0) return 0;
    return Math.round((actual / expected) * 100);
  };

  // Format dates for the absence modal
  const startDate = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const endDate = format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');

  // Helper function to merge employee data
  const mergeEmployeeData = (employees: EmployeeWithStats[]): EmployeeWithStats[] => {
    const employeeMap = new Map<number, EmployeeWithStats>();

    employees.forEach((employee) => {
      const existingEmployee = employeeMap.get(employee.id);
      
      if (!existingEmployee) {
        // For new employees, just add them to the map
        employeeMap.set(employee.id, { ...employee });
        return;
      }

      // If we have contract periods, compare them to keep the most recent one
      if (employee.contractPeriod && existingEmployee.contractPeriod) {
        const currentDate = new Date();
        const existingEndDate = existingEmployee.contractPeriod.split(' - ')[1];
        const newEndDate = employee.contractPeriod.split(' - ')[1];
        
        const existingDate = existingEndDate === 'heden' ? currentDate : existingEndDate ? parseISO(existingEndDate) : new Date(2000, 0, 1);
        const newDate = newEndDate === 'heden' ? currentDate : newEndDate ? parseISO(newEndDate) : new Date(2000, 0, 1);

        if (newDate > existingDate) {
          // Keep the new contract data but sum up leave and holiday hours
          employeeMap.set(employee.id, {
            ...employee,
            leaveHours: (employee.leaveHours || 0) + (existingEmployee.leaveHours || 0),
            holidayHours: (employee.holidayHours || 0) + (existingEmployee.holidayHours || 0)
          });
        } else {
          // Keep existing contract but sum up leave and holiday hours
          employeeMap.set(employee.id, {
            ...existingEmployee,
            leaveHours: (employee.leaveHours || 0) + (existingEmployee.leaveHours || 0),
            holidayHours: (employee.holidayHours || 0) + (existingEmployee.holidayHours || 0)
          });
        }
      } else if (!existingEmployee.contractPeriod && employee.contractPeriod) {
        // If the new employee has a contract period and the existing one doesn't, use the new one
        // but keep summing leave and holiday hours
        employeeMap.set(employee.id, {
          ...employee,
          leaveHours: (employee.leaveHours || 0) + (existingEmployee.leaveHours || 0),
          holidayHours: (employee.holidayHours || 0) + (existingEmployee.holidayHours || 0)
        });
      } else {
        // If neither has a contract period or the existing one is more recent, keep the existing one
        // but sum up leave and holiday hours
        employeeMap.set(employee.id, {
          ...existingEmployee,
          leaveHours: (employee.leaveHours || 0) + (existingEmployee.leaveHours || 0),
          holidayHours: (employee.holidayHours || 0) + (existingEmployee.holidayHours || 0)
        });
      }
    });

    return Array.from(employeeMap.values());
  };

  return (
    <div className="w-full px-8 py-12">
      <div className="flex justify-between items-center mb-8 border-b border-gray-200 pb-6">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Employee Hours Overview</h1>
        <div className="flex items-center gap-6">
          <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} />
          <span className="text-sm text-gray-500">{getLastSyncText()}</span>
          <Button 
            onClick={handleSync} 
            disabled={isSyncing || isAbsenceSyncing}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-colors duration-200"
          >
            {(isSyncing || isAbsenceSyncing) && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
            Sync Data
          </Button>
        </div>
      </div>

      {syncError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {syncError}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[200px]">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[150px]">Function</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[150px]">Contract Period</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Contract Hours</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Holiday Hours</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Expected Hours</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Leave Hours</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Written Hours</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actual Hours</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Difference %</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-4">
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </td>
                </tr>
              ) : (
                employees.map((employee) => {
                  const percentage = calculatePercentage(employee.actualHours, employee.expectedHours);
                  const percentageClass = percentage < 100 ? 'text-red-600' : 'text-green-600';

                  return (
                    <tr 
                      key={employee.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedEmployee(employee)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {employee.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.function || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {employee.contractPeriod || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {employee.contractHours?.toFixed(1) || '0.0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {employee.holidayHours?.toFixed(1) || '0.0'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {employee.expectedHours.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        <Tooltip
                          content={
                            employee.leaveHours > 0 ? (
                              <div className="p-2">
                                <p className="font-semibold mb-1">Leave Hours Breakdown:</p>
                                <p>Total: {employee.leaveHours.toFixed(1)} hours</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  (Includes vacation, sick leave, and other absences)
                                </p>
                              </div>
                            ) : "No leave hours"
                          }
                        >
                          <span className="cursor-help">
                            {employee.leaveHours.toFixed(1)}
                            {employee.leaveHours > 0 && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                <InfoCircledIcon className="h-3 w-3 inline" />
                              </span>
                            )}
                          </span>
                        </Tooltip>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {employee.writtenHours.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {employee.actualHours.toFixed(1)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium text-right ${percentageClass}`}>
                        {percentage}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedEmployee && (
        <EmployeeAbsenceModal
          employee={selectedEmployee}
          isOpen={!!selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          startDate={startDate}
          endDate={endDate}
        />
      )}
    </div>
  );
} 
