import React, { useState, useEffect } from 'react';
import { format, getWeek, getYear, getMonth, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { getEmployeeStats, getEmployeeMonthStats, type EmployeeWithStats } from '@/services/employee.service';
import { useSyncStore } from '@/stores/sync';
import { useAbsenceSyncStore } from '@/stores/absence-sync';
import { useFilterPresets } from '@/hooks/useFilterPresets';
import { Button } from '@/components/ui/button';
import { Skeleton } from "@/components/ui/skeleton";
import { ReloadIcon, InfoCircledIcon, MagnifyingGlassIcon, Cross2Icon, MixerHorizontalIcon } from '@radix-ui/react-icons';
import { DateSelector } from '@/components/DateSelector';
import { EmployeeAbsenceModal } from '@/components/EmployeeAbsenceModal';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Link } from 'react-router-dom';

export default function EmployeesPage() {
  const initialDate = new Date();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { sync, isSyncing, lastSync, syncError } = useSyncStore();
  const { syncAbsence, isSyncing: isAbsenceSyncing } = useAbsenceSyncStore();
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithStats | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [percentageRange, setPercentageRange] = useState([0, 200]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const selectedWeek = getWeek(selectedDate, { weekStartsOn: 1, firstWeekContainsDate: 4 });
  const selectedYear = getYear(selectedDate);
  const selectedMonth = getMonth(selectedDate);

  const loadEmployees = async () => {
    setIsLoading(true);
    try {
      if (viewMode === 'week') {
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
      } else {
        console.log(`Loading employees for year=${selectedYear}, month=${selectedMonth}`);
        const data = await getEmployeeMonthStats(selectedYear, selectedMonth);
        console.log('Monthly employee data loaded:', data);
        
        // Log holiday hours specifically
        console.log('Holiday hours in loaded monthly data:', data.map(emp => ({ 
          name: emp.name, 
          holidayHours: emp.holidayHours,
          contractPeriod: emp.contractPeriod
        })));
        
        // Merge employee data to handle multiple contracts
        const mergedData = mergeEmployeeData(data);
        setEmployees(mergedData);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Apply filters whenever employees or filter criteria change
  useEffect(() => {
    applyFilters();
  }, [employees, searchQuery, showOnlyActive, percentageRange]);

  // Load employees when date or view mode changes
  useEffect(() => {
    loadEmployees();
  }, [selectedDate, viewMode]);

  // Apply all filters to the employees list
  const applyFilters = () => {
    let result = [...employees];
    
    // Filter by search query (name or function)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(emp => 
        emp.name.toLowerCase().includes(query) || 
        (emp.function && emp.function.toLowerCase().includes(query))
      );
    }
    
    // Filter by active status
    if (showOnlyActive) {
      const currentDate = new Date();
      result = result.filter(emp => {
        if (!emp.contractPeriod || emp.contractPeriod === 'No contract') return false;
        
        const [startStr, endStr] = emp.contractPeriod.split(' - ');
        const startDate = startStr ? parseISO(startStr) : null;
        const endDate = endStr && endStr !== 'heden' ? parseISO(endStr) : null;
        
        return startDate && startDate <= currentDate && (!endDate || endDate >= currentDate);
      });
    }
    
    // Filter by percentage range
    result = result.filter(emp => {
      const percentage = calculatePercentage(emp.actualHours, emp.expectedHours);
      return percentage >= percentageRange[0] && percentage <= percentageRange[1];
    });
    
    setFilteredEmployees(result);
  };

  const handleSync = async () => {
    let start, end;
    
    if (viewMode === 'week') {
      start = startOfWeek(selectedDate, { weekStartsOn: 1 });
      end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    } else {
      start = startOfMonth(selectedDate);
      end = endOfMonth(selectedDate);
    }
    
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

  // Reset all filters
  const resetFilters = () => {
    setSearchQuery('');
    setShowOnlyActive(false);
    setPercentageRange([0, 200]);
  };

  // Format dates for the absence modal
  let startDate, endDate;
  if (viewMode === 'week') {
    startDate = format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    endDate = format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  } else {
    startDate = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
    endDate = format(endOfMonth(selectedDate), 'yyyy-MM-dd');
  }

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
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'week' | 'month')} className="mr-4">
            <TabsList>
              <TabsTrigger value="week">Week View</TabsTrigger>
              <TabsTrigger value="month">Month View</TabsTrigger>
            </TabsList>
          </Tabs>
          <DateSelector selectedDate={selectedDate} onDateChange={setSelectedDate} viewMode={viewMode} />
          <span className="text-sm text-gray-500">{getLastSyncText()}</span>
          <Link to="/employees/cards">
            <Button variant="outline">Card View</Button>
          </Link>
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

      <div className="flex justify-between items-center mb-4">
        <div className="relative w-80">
          <Input
            type="text"
            placeholder="Search by name or function..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2"
            >
              <Cross2Icon className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <MixerHorizontalIcon className="h-4 w-4" />
                Filters
                {(showOnlyActive || percentageRange[0] > 0 || percentageRange[1] < 200) && (
                  <span className="ml-1 h-2 w-2 rounded-full bg-blue-500"></span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <h3 className="font-medium">Filter Options</h3>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="active-only" 
                      checked={showOnlyActive} 
                      onCheckedChange={(checked) => setShowOnlyActive(checked === true)}
                    />
                    <Label htmlFor="active-only">Show only active employees</Label>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Difference Percentage Range</Label>
                  <div className="pt-4">
                    <Slider 
                      value={percentageRange}
                      min={0}
                      max={200}
                      step={5}
                      onValueChange={setPercentageRange}
                    />
                    <div className="flex justify-between mt-2 text-sm text-gray-500">
                      <span>{percentageRange[0]}%</span>
                      <span>{percentageRange[1]}%</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={resetFilters}
                    className="mr-2"
                  >
                    Reset
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => setIsFilterOpen(false)}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        </div>

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
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-gray-500">
                    No employees found matching the current filters.
                    </td>
                  </tr>
              ) : (
                filteredEmployees.map((employee) => {
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
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help">
                                {employee.leaveHours.toFixed(1)}
                                {employee.leaveHours > 0 && (
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    <InfoCircledIcon className="h-3 w-3 inline" />
                                  </span>
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {employee.leaveHours > 0 ? (
                                <div className="p-2">
                                  <p className="font-semibold mb-1">Leave Hours Breakdown:</p>
                                  <p>Total: {employee.leaveHours.toFixed(1)} hours</p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    (Includes vacation, sick leave, and other absences)
                                  </p>
                        </div>
                              ) : "No leave hours"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                        {employee.writtenHours.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {employee.actualHours.toFixed(1)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                        <span className={percentageClass}>
                          {percentage}%
                        </span>
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
