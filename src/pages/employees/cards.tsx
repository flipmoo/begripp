import React, { useState, useEffect } from 'react';
import { getWeek, getYear, getMonth } from 'date-fns';
import { getEmployeeStats, getEmployeeMonthStats, type EmployeeWithStats, isDataCached, updateFunctionTitles } from '@/services/employee.service';
import { useFilterPresets } from '@/hooks/useFilterPresets';
import { Button } from '@/components/ui/button';
import { Skeleton } from "@/components/ui/skeleton";
import { MagnifyingGlassIcon, Cross2Icon, MixerHorizontalIcon } from '@radix-ui/react-icons';
import { DateSelector } from '@/components/DateSelector';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { EmployeeCard } from '@/components/EmployeeCard';
import { Link, useSearchParams } from 'react-router-dom';
import { CacheStatusPopup } from '@/components/CacheStatusPopup';
import { generateEmployeesUrl } from '@/utils/url';
import Spinner from '@/components/Spinner';

export default function EmployeeCardsPage() {
  const initialDate = new Date();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize state from localStorage or URL parameters or defaults
  const [selectedDate, setSelectedDate] = useState(() => {
    const storedDate = localStorage.getItem('employeesPageDate');
    
    if (storedDate) {
      return new Date(storedDate);
    }
    
    const yearParam = searchParams.get('year');
    const weekParam = searchParams.get('week');
    const monthParam = searchParams.get('month');
    
    if (yearParam) {
      const year = parseInt(yearParam);
      
      if (weekParam) {
        // If year and week are provided, set date to that week
        const week = parseInt(weekParam);
        const date = new Date(year, 0, 1 + (week - 1) * 7);
        return date;
      } else if (monthParam) {
        // If year and month are provided, set date to that month
        const month = parseInt(monthParam);
        return new Date(year, month - 1, 1);
      }
    }
    
    return initialDate;
  });
  
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFromCache, setIsFromCache] = useState<boolean>(false);
  
  const [viewMode, setViewMode] = useState<'week' | 'month'>(() => {
    const storedViewMode = localStorage.getItem('employeesPageViewMode');
    if (storedViewMode && (storedViewMode === 'week' || storedViewMode === 'month')) {
      return storedViewMode;
    }
    return searchParams.get('viewMode') === 'month' ? 'month' : 'week';
  });
  
  // Update localStorage when date or viewMode changes
  useEffect(() => {
    localStorage.setItem('employeesPageDate', selectedDate.toISOString());
    localStorage.setItem('employeesPageViewMode', viewMode);
  }, [selectedDate, viewMode]);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [showOnlyActive, setShowOnlyActive] = useState(() => searchParams.get('active') === 'true');
  const [percentageRange, setPercentageRange] = useState(() => {
    const minParam = searchParams.get('minPercentage');
    const maxParam = searchParams.get('maxPercentage');
    return [
      minParam ? parseInt(minParam) : 0,
      maxParam ? parseInt(maxParam) : 200
    ];
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [excludedEmployees, setExcludedEmployees] = useState<number[]>(() => {
    const excludedParam = searchParams.get('excluded');
    return excludedParam ? excludedParam.split(',').map(id => parseInt(id)) : [];
  });
  const [selectedPreset, setSelectedPreset] = useState<string | null>(() => {
    return searchParams.get('preset');
  });
  
  // Use the filter presets hook
  const { presets, savePreset, deletePreset, getPreset } = useFilterPresets();
  
  // Sorting states
  const [sortBy, setSortBy] = useState<'percentage' | 'name'>(() => {
    return searchParams.get('sortBy') === 'name' ? 'name' : 'percentage';
  });
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => {
    return searchParams.get('sortDirection') === 'asc' ? 'asc' : 'desc';
  });

  const selectedWeek = getWeek(selectedDate, { weekStartsOn: 1, firstWeekContainsDate: 4 });
  const selectedYear = getYear(selectedDate);
  const selectedMonth = getMonth(selectedDate);
  
  // Update URL when filters change
  useEffect(() => {
    const params: Record<string, string> = {};
    
    // Always include year
    params.year = selectedYear.toString();
    
    // Include week or month based on view mode
    if (viewMode === 'week') {
      params.week = selectedWeek.toString();
    } else {
      params.month = (selectedMonth + 1).toString();
    }
    
    params.viewMode = viewMode;
    
    // Only include other filters if they're not the default values
    if (searchQuery) {
      params.search = searchQuery;
    }
    
    if (showOnlyActive) {
      params.active = 'true';
    }
    
    if (percentageRange[0] !== 0) {
      params.minPercentage = percentageRange[0].toString();
    }
    
    if (percentageRange[1] !== 200) {
      params.maxPercentage = percentageRange[1].toString();
    }
    
    if (excludedEmployees.length > 0) {
      params.excluded = excludedEmployees.join(',');
    }
    
    if (selectedPreset) {
      params.preset = selectedPreset;
    }
    
    if (sortBy !== 'percentage') {
      params.sortBy = sortBy;
    }
    
    if (sortDirection !== 'desc') {
      params.sortDirection = sortDirection;
    }
    
    setSearchParams(params, { replace: true });
  }, [selectedYear, selectedWeek, selectedMonth, viewMode, searchQuery, showOnlyActive, percentageRange, excludedEmployees, selectedPreset, sortBy, sortDirection, setSearchParams]);

  // Load employees when date or view mode changes
  useEffect(() => {
    console.log('Date or viewMode changed in cards view, fetching new data...');
    // Set a small timeout to prevent double fetching when both date and viewMode change
    const timer = setTimeout(() => {
      loadEmployees();
    }, 50);
    
    return () => clearTimeout(timer);
  }, [selectedDate, viewMode]);

  const loadEmployees = async () => {
    setIsLoading(true);
    try {
      // Update function titles from Gripp
      await updateFunctionTitles();
      
      // Check if data is already in cache
      const isCached = viewMode === 'week' 
        ? isDataCached(selectedYear, selectedWeek)
        : isDataCached(selectedYear, undefined, selectedMonth);
      
      setIsFromCache(isCached);
      
      if (viewMode === 'week') {
        console.log(`Loading employees for year=${selectedYear}, week=${selectedWeek}`);
        const result = await getEmployeeStats(selectedYear, selectedWeek);
        console.log('Employee data loaded:', result);
        
        // Merge employee data to handle multiple contracts
        const mergedData = mergeEmployeeData(result.data);
        setEmployees(mergedData);
      } else {
        console.log(`Loading employees for year=${selectedYear}, month=${selectedMonth}`);
        const result = await getEmployeeMonthStats(selectedYear, selectedMonth);
        console.log('Monthly employee data loaded:', result);
        
        // Merge employee data to handle multiple contracts
        const mergedData = mergeEmployeeData(result.data);
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
      
      // Reload employees if view mode changed
      if (preset.filters.viewMode !== viewMode) {
        setTimeout(() => loadEmployees(), 0);
      }
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <h1 className="text-3xl font-bold">Employee Cards</h1>
          {isLoading && (
            <div className="flex items-center ml-4 text-sm text-gray-500">
              <Spinner size="small" className="mr-2" />
              <span>Loading...</span>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to={generateEmployeesUrl({
            year: selectedYear, 
            month: selectedMonth + 1,
            week: selectedWeek,
            viewMode
          })}>
            Back to Table View
          </Link>
        </Button>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'week' | 'month')}>
            <TabsList>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <DateSelector 
            selectedDate={selectedDate} 
            onDateChange={setSelectedDate} 
            viewMode={viewMode}
          />
          
          {isFromCache && (
            <CacheStatusPopup 
              year={selectedYear} 
              week={viewMode === 'week' ? selectedWeek : undefined} 
              month={viewMode === 'month' ? selectedMonth : undefined} 
            />
          )}
          <Link to={generateEmployeesUrl({
            year: selectedYear,
            week: viewMode === 'week' ? selectedWeek : undefined,
            month: viewMode === 'month' ? selectedMonth : undefined,
            viewMode,
            search: searchQuery,
            active: showOnlyActive,
            minPercentage: percentageRange[0],
            maxPercentage: percentageRange[1],
            sortBy,
            sortDirection
          })}>
            <Button variant="outline">Table View</Button>
          </Link>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6">
        <div>
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
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-4">
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
          
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-[200px] w-full rounded-xl" />
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-4">
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
              
              <div className="text-sm text-gray-500 mt-4">
                {filteredEmployees.length} medewerker{filteredEmployees.length !== 1 ? 's' : ''} weergegeven
                {filteredEmployees.length !== employees.length && ` (van ${employees.length} totaal)`}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 