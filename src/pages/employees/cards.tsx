import React, { useState, useEffect } from 'react';
import { format, getWeek, getYear, getMonth, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { getEmployeeStats, getEmployeeMonthStats, type EmployeeWithStats } from '@/services/employee.service';
import { useSyncStore } from '@/stores/sync';
import { useAbsenceSyncStore } from '@/stores/absence-sync';
import { useFilterPresets } from '@/hooks/useFilterPresets';
import { Button } from '@/components/ui/button';
import { Skeleton } from "@/components/ui/skeleton";
import { ReloadIcon, MagnifyingGlassIcon, Cross2Icon, MixerHorizontalIcon } from '@radix-ui/react-icons';
import { DateSelector } from '@/components/DateSelector';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { EmployeeCard } from '@/components/EmployeeCard';
import { Link } from 'react-router-dom';

export default function EmployeeCardsPage() {
  const initialDate = new Date();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { sync, isSyncing, lastSync, syncError } = useSyncStore();
  const { syncAbsence, isSyncing: isAbsenceSyncing } = useAbsenceSyncStore();
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [percentageRange, setPercentageRange] = useState([0, 200]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [excludedEmployees, setExcludedEmployees] = useState<number[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  
  // Use the filter presets hook
  const { presets, savePreset, deletePreset, getPreset } = useFilterPresets();
  
  // Sorting states
  const [sortBy, setSortBy] = useState<'percentage' | 'name'>('percentage');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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
        
        // Merge employee data to handle multiple contracts
        const mergedData = mergeEmployeeData(data);
        setEmployees(mergedData);
      } else {
        console.log(`Loading employees for year=${selectedYear}, month=${selectedMonth}`);
        const data = await getEmployeeMonthStats(selectedYear, selectedMonth);
        console.log('Monthly employee data loaded:', data);
        
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
  }, [employees, searchQuery, showOnlyActive, percentageRange, excludedEmployees, sortBy, sortDirection]);

  // Load employees when date or view mode changes
  useEffect(() => {
    loadEmployees();
  }, [selectedDate, viewMode]);

  // Apply all filters to the employees list
  const applyFilters = () => {
    let result = [...employees];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(emp => 
        emp.name.toLowerCase().includes(query) || 
        (emp.function && emp.function.toLowerCase().includes(query))
      );
    }
    
    // Apply active filter
    if (showOnlyActive) {
      result = result.filter(emp => emp.active);
    }
    
    // Apply percentage range filter
    result = result.filter(emp => {
      const percentage = emp.expectedHours > 0 
        ? Math.round((emp.actualHours / emp.expectedHours) * 100) 
        : 0;
      return percentage >= percentageRange[0] && percentage <= percentageRange[1];
    });
    
    // Apply excluded employees filter
    if (excludedEmployees.length > 0) {
      result = result.filter(emp => !excludedEmployees.includes(emp.id));
    }
    
    // Sort the results
    result = sortEmployees(result);
    
    setFilteredEmployees(result);
  };

  // Calculate percentage for an employee
  const calculatePercentage = (employee: EmployeeWithStats): number => {
    return employee.expectedHours > 0 
      ? Math.round((employee.actualHours / employee.expectedHours) * 100) 
      : 0;
  };
  
  // Sort employees based on current sort settings
  const sortEmployees = (employees: EmployeeWithStats[]): EmployeeWithStats[] => {
    return [...employees].sort((a, b) => {
      if (sortBy === 'percentage') {
        const percentageA = calculatePercentage(a);
        const percentageB = calculatePercentage(b);
        return sortDirection === 'asc' ? percentageA - percentageB : percentageB - percentageA;
      } else {
        // Sort by name
        return sortDirection === 'asc' 
          ? a.name.localeCompare(b.name) 
          : b.name.localeCompare(a.name);
      }
    });
  };
  
  // Toggle sort direction or change sort field
  const toggleSort = (field: 'percentage' | 'name') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc'); // Default to descending for percentage, ascending for name
    }
  };

  const handleSync = async () => {
    try {
      // Format dates for the sync API
      const startDate = viewMode === 'week' 
        ? format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        : format(startOfMonth(selectedDate), 'yyyy-MM-dd');
      
      const endDate = viewMode === 'week'
        ? format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        : format(endOfMonth(selectedDate), 'yyyy-MM-dd');
      
      await sync(startDate, endDate);
      await syncAbsence(startDate, endDate);
      loadEmployees();
    } catch (error) {
      console.error('Error during sync:', error);
    }
  };

  const getLastSyncText = () => {
    if (!lastSync) return 'Nooit';
    return format(new Date(lastSync), 'dd-MM-yyyy HH:mm:ss');
  };

  const resetFilters = () => {
    setSearchQuery('');
    setShowOnlyActive(false);
    setPercentageRange([0, 200]);
    setExcludedEmployees([]);
    setSortBy('percentage');
    setSortDirection('desc');
    setSelectedPreset(null);
    setIsFilterOpen(false);
  };

  const saveCurrentFilterAsPreset = (name: string) => {
    const presetId = savePreset(name, {
      showOnlyActive,
      percentageRange: percentageRange as [number, number],
      excludedEmployees,
      viewMode
    });
    setSelectedPreset(presetId);
  };

  const loadPreset = (id: string) => {
    const preset = getPreset(id);
    if (preset) {
      setShowOnlyActive(preset.filters.showOnlyActive);
      setPercentageRange(preset.filters.percentageRange);
      setExcludedEmployees(preset.filters.excludedEmployees);
      setViewMode(preset.filters.viewMode);
      setSelectedPreset(id);
    }
  };

  const handleDeletePreset = (id: string) => {
    deletePreset(id);
    if (selectedPreset === id) {
      setSelectedPreset(null);
    }
  };

  // Merge employee data to handle multiple contracts
  const mergeEmployeeData = (employees: EmployeeWithStats[]): EmployeeWithStats[] => {
    const employeeMap = new Map<number, EmployeeWithStats>();
    
    for (const employee of employees) {
      if (!employeeMap.has(employee.id)) {
        employeeMap.set(employee.id, { ...employee });
      } else {
        const existingEmployee = employeeMap.get(employee.id)!;
        
        // Sum up the numeric values
        existingEmployee.contractHours = (existingEmployee.contractHours || 0) + (employee.contractHours || 0);
        existingEmployee.holidayHours = (existingEmployee.holidayHours || 0) + (employee.holidayHours || 0);
        existingEmployee.expectedHours += employee.expectedHours;
        existingEmployee.leaveHours += employee.leaveHours;
        existingEmployee.writtenHours += employee.writtenHours;
        existingEmployee.actualHours += employee.actualHours;
        
        // Combine contract periods if they're different
        if (employee.contractPeriod && existingEmployee.contractPeriod !== employee.contractPeriod) {
          existingEmployee.contractPeriod = `${existingEmployee.contractPeriod}, ${employee.contractPeriod}`;
        }
      }
    }
    
    return Array.from(employeeMap.values());
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold">Medewerkers Cards</h1>
        
        <div className="flex items-center gap-2">
          <Link to="/employees">
            <Button variant="outline">
              Tabel View
            </Button>
          </Link>
          
          <Button 
            variant="outline" 
            onClick={handleSync} 
            disabled={isSyncing || isAbsenceSyncing}
          >
            {(isSyncing || isAbsenceSyncing) ? (
              <>
                <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                Synchroniseren...
              </>
            ) : (
              <>
                <ReloadIcon className="mr-2 h-4 w-4" />
                Synchroniseren
              </>
            )}
          </Button>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <DateSelector 
            selectedDate={selectedDate} 
            onDateChange={setSelectedDate} 
            viewMode={viewMode}
          />
          
          <Tabs 
            value={viewMode} 
            onValueChange={(value) => setViewMode(value as 'week' | 'month')}
            className="w-[200px]"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Maand</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              type="search"
              placeholder="Zoeken..."
              className="pl-8 w-full sm:w-[200px]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-gray-500 hover:text-gray-700"
              >
                <Cross2Icon className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <MixerHorizontalIcon className="h-4 w-4" />
                Filters
                {(showOnlyActive || percentageRange[0] > 0 || percentageRange[1] < 200 || excludedEmployees.length > 0) && (
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

                <div className="space-y-2">
                  <Label>Excluded Employees</Label>
                  <div className="max-h-32 overflow-y-auto space-y-2 border rounded-md p-2">
                    {employees.map(emp => (
                      <div key={emp.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`exclude-${emp.id}`}
                          checked={excludedEmployees.includes(emp.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setExcludedEmployees(prev => [...prev, emp.id]);
                            } else {
                              setExcludedEmployees(prev => prev.filter(id => id !== emp.id));
                            }
                          }}
                        />
                        <Label htmlFor={`exclude-${emp.id}`} className="text-sm">
                          {emp.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Filter Presets</Label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input 
                        id="preset-name"
                        placeholder="Preset name"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value) {
                            saveCurrentFilterAsPreset(e.currentTarget.value);
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const input = document.getElementById('preset-name') as HTMLInputElement;
                          if (input.value) {
                            saveCurrentFilterAsPreset(input.value);
                            input.value = '';
                          }
                        }}
                      >
                        Save
                      </Button>
                    </div>
                    
                    <div className="max-h-32 overflow-y-auto space-y-2 border rounded-md p-2">
                      {presets.map(preset => (
                        <div key={preset.id} className="flex items-center justify-between">
                          <Button
                            variant={selectedPreset === preset.id ? "default" : "ghost"}
                            size="sm"
                            className="flex-1 justify-start"
                            onClick={() => loadPreset(preset.id)}
                          >
                            {preset.name}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePreset(preset.id)}
                          >
                            <Cross2Icon className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      {presets.length === 0 && (
                        <div className="text-sm text-gray-500 text-center py-2">
                          No presets saved
                        </div>
                      )}
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
      
      {syncError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Fout bij synchroniseren: </strong>
          <span className="block sm:inline">{syncError}</span>
        </div>
      )}
      
      <div className="text-sm text-gray-500">
        Laatste synchronisatie: {getLastSyncText()}
      </div>
      
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-[200px] w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredEmployees.length > 0 ? (
              filteredEmployees.map((employee) => (
                <EmployeeCard key={employee.id} employee={employee} />
              ))
            ) : (
              <div className="col-span-full text-center py-10">
                <p className="text-gray-500">Geen medewerkers gevonden die voldoen aan de filters.</p>
              </div>
            )}
          </div>
          
          <div className="text-sm text-gray-500">
            {filteredEmployees.length} medewerker{filteredEmployees.length !== 1 ? 's' : ''} weergegeven
            {filteredEmployees.length !== employees.length && ` (van ${employees.length} totaal)`}
          </div>
        </>
      )}
    </div>
  );
} 