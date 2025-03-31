import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getWeek, getYear, getMonth, format } from 'date-fns';
import { getEmployeeStats, getEmployeeMonthStats, type EmployeeWithStats, isDataCached, updateFunctionTitles, enrichEmployeesWithAbsences } from '@/services/employee.service';
import { Absence, AbsencesByEmployee } from '@/services/absence.service';
import { API_BASE } from '@/services/api';
import { useFilterPresets } from '@/hooks/useFilterPresets';
import { Button } from '@/components/ui/button';
import { Skeleton } from "@/components/ui/skeleton";
import { InfoCircledIcon, MagnifyingGlassIcon, Cross2Icon, MixerHorizontalIcon, ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { RefreshCw, Calendar, CalendarRange } from 'lucide-react';
import { DateSelector } from '@/components/DateSelector';
import { EmployeeAbsenceModal } from '@/components/EmployeeAbsenceModal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CacheStatusPopup } from '@/components/CacheStatusPopup';
import { Table, TableHeader, TableBody, TableCell, TableRow, TableHead } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Link, useSearchParams } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { generateEmployeeCardsUrl } from '@/utils/url';
import { AbsenceSyncButton } from '@/components/AbsenceSyncButton';
import { DataSyncButton } from '@/components/DataSyncButton';
import { getWeekNumber, getWeekDays } from '@/utils/date-utils';
import { IconPerson, IconSync } from '@/components/Icons';
import EmployeeTable from '@/components/EmployeeTable';
import WeekSelector from '@/components/WeekSelector';
import Spinner from '@/components/Spinner';
import ErrorMessage from '@/components/ErrorMessage';
import CacheStatus from '@/components/CacheStatus';
import { Badge } from '@/components/ui/badge';

export default function EmployeesPage() {
  const initialDate = new Date();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize state from URL parameters or defaults
  const [selectedDate, setSelectedDate] = useState(() => {
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
  
  const [viewMode, setViewMode] = useState<'week' | 'month'>(() => {
    return searchParams.get('viewMode') === 'month' ? 'month' : 'week';
  });
  
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFromCache, setIsFromCache] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithStats | null>(null);
  const [absences, setAbsences] = useState<AbsencesByEmployee>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  
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
  
  // Get current week and year
  const selectedWeek = getWeek(selectedDate, { weekStartsOn: 1, firstWeekContainsDate: 4 });
  const selectedYear = getYear(selectedDate);
  const selectedMonth = getMonth(selectedDate);

  // Generate year options (current year and 2 years back/forward)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [
      { value: currentYear - 2, label: `${currentYear - 2}` },
      { value: currentYear - 1, label: `${currentYear - 1}` },
      { value: currentYear, label: `${currentYear}` },
      { value: currentYear + 1, label: `${currentYear + 1}` },
      { value: currentYear + 2, label: `${currentYear + 2}` },
    ];
  }, []);

  // Generate week options (1-52)
  const weekOptions = useMemo(() => {
    return Array.from({ length: 52 }, (_, i) => ({
      value: i + 1,
      label: `Week ${i + 1}`
    }));
  }, []);

  // Generate month options
  const monthOptions = useMemo(() => {
    return [
      { value: 0, label: 'Januari' },
      { value: 1, label: 'Februari' },
      { value: 2, label: 'Maart' },
      { value: 3, label: 'April' },
      { value: 4, label: 'Mei' },
      { value: 5, label: 'Juni' },
      { value: 6, label: 'Juli' },
      { value: 7, label: 'Augustus' },
      { value: 8, label: 'September' },
      { value: 9, label: 'Oktober' },
      { value: 10, label: 'November' },
      { value: 11, label: 'December' }
    ];
  }, []);

  const weekDays = useMemo(() => getWeekDays(selectedYear, selectedWeek), [selectedYear, selectedWeek]);

  // Functies om tussen periodes te navigeren
  const handlePrevPeriod = () => {
    if (viewMode === 'week') {
      if (selectedWeek === 1) {
        // Go to previous year, week 52
        setSelectedDate(new Date(selectedYear - 1, 11, 31));
      } else {
        // Go to previous week
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() - 7);
        setSelectedDate(newDate);
      }
    } else {
      if (selectedMonth === 0) {
        // Go to previous year, December
        setSelectedDate(new Date(selectedYear - 1, 11, 1));
      } else {
        // Go to previous month
        setSelectedDate(new Date(selectedYear, selectedMonth - 1, 1));
      }
    }
  };

  const handleNextPeriod = () => {
    if (viewMode === 'week') {
      if (selectedWeek === 52) {
        // Go to next year, week 1
        setSelectedDate(new Date(selectedYear + 1, 0, 1));
      } else {
        // Go to next week
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + 7);
        setSelectedDate(newDate);
      }
    } else {
      if (selectedMonth === 11) {
        // Go to next year, January
        setSelectedDate(new Date(selectedYear + 1, 0, 1));
      } else {
        // Go to next month
        setSelectedDate(new Date(selectedYear, selectedMonth + 1, 1));
      }
    }
  };

  const handleYearChange = (year: number) => {
    setSelectedDate(new Date(year, selectedDate.getMonth(), selectedDate.getDate()));
  };

  const handleWeekChange = (week: number) => {
    setSelectedDate(new Date(selectedYear, 0, 1 + (week - 1) * 7));
  };

  const handleMonthChange = (month: number) => {
    setSelectedDate(new Date(selectedYear, month, 1));
  };

  const handleViewModeChange = (mode: 'week' | 'month') => {
    setViewMode(mode);
    
    // We behouden dezelfde datum, alleen het viewMode verandert
    if (mode === 'week') {
      // Als we van maand naar week gaan, nemen we de eerste week van de maand
      setSelectedDate(new Date(selectedYear, selectedMonth, 1));
    } else {
      // Als we van week naar maand gaan, behouden we de maand van de huidige week
      setSelectedDate(new Date(selectedYear, selectedMonth, 1));
    }
  };

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
    fetchData();
  }, [selectedDate, viewMode]);

  const fetchData = async (forceRefresh = false) => {
    try {
      // Always show loading at start
      setIsLoading(true);
      
      if (forceRefresh) {
        setIsRefreshing(true);
      }
      
      setError(null);

      // Direct timeout op fetch operaties
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconden timeout
      
      try {
        // Fetch employee data directly
        let result;
        
        if (viewMode === 'week') {
          result = await getEmployeeStats(selectedYear, selectedWeek, undefined, forceRefresh);
        } else {
          result = await getEmployeeMonthStats(selectedYear, selectedMonth, forceRefresh);
        }
        
        // Set the from cache status and employees data
        setIsFromCache(result.fromCache);
        
        // Get week days for the selected week
        const weekDays = getWeekDays(selectedYear, selectedWeek);
        
        // Calculate start and end dates for the period
        const startDate = viewMode === 'week' 
          ? weekDays[0] // First day of the week
          : new Date(selectedYear, selectedMonth, 1); // First day of the month
        
        const endDate = viewMode === 'week'
          ? weekDays[weekDays.length - 1] // Last day of the week
          : new Date(selectedYear, selectedMonth + 1, 0); // Last day of the month
            
        // Fetch absences with abort controller
        try {
          console.log(`Fetching absences from ${format(startDate, 'yyyy-MM-dd')} to ${format(endDate, 'yyyy-MM-dd')}`);
          const absencesResponse = await fetch(
            `${API_BASE}/absences?startDate=${format(startDate, 'yyyy-MM-dd')}&endDate=${format(endDate, 'yyyy-MM-dd')}`,
            { signal: controller.signal }
          );
          
          if (absencesResponse.ok) {
            const absencesData = await absencesResponse.json();
            console.log(`Found ${absencesData.length} absence records for the period`);
            
            // Group absences by employee
            const absencesByEmployee: AbsencesByEmployee = {};
            if (Array.isArray(absencesData)) {
              absencesData.forEach((absence: Absence) => {
                const employeeId = absence.employee.id;
                if (!absencesByEmployee[employeeId]) {
                  absencesByEmployee[employeeId] = [];
                }
                absencesByEmployee[employeeId].push(absence);
              });
            }
            
            // Combine data - use result.data instead of just result
            const enrichedEmployees = enrichEmployeesWithAbsences(result.data, absencesByEmployee);
            setEmployees(enrichedEmployees);
            setAbsences(absencesByEmployee);
          } else {
            // Alleen de employees data gebruiken als absences mislukken
            console.error('Error fetching absences:', absencesResponse.status);
            setEmployees(result.data);
          }
        } catch (absenceErr) {
          // Alleen de employees data gebruiken als absences mislukken
          console.error('Error fetching absences:', absenceErr);
          setEmployees(result.data);
        }
        
        // Reset refreshing state
        if (forceRefresh) {
          setIsRefreshing(false);
        }
        
        // Wis de timeout omdat we klaar zijn
        clearTimeout(timeoutId);
      } catch (err) {
        // Cancel timeout als er een fout optreedt
        clearTimeout(timeoutId);
        
        // Reset refreshing state
        if (forceRefresh) {
          setIsRefreshing(false);
        }
        
        // Log de fout en toon een foutmelding
        console.error('Error fetching data:', err);
        
        if (err.name === 'AbortError') {
          setError('Het laden van data duurde te lang. Probeer het opnieuw.');
        } else {
          setError('Er is een fout opgetreden bij het laden van data.');
        }
        
        // Toon fallback data als we geen employees hebben
        if (employees.length === 0) {
          setEmployees([{
            id: 0,
            name: "Fout bij laden",
            function: "Ververs de pagina",
            expectedHours: 0,
            leaveHours: 0,
            writtenHours: 0,
            actualHours: 0,
            active: true
          }]);
        }
      }
    } catch (err) {
      console.error('Unexpected error in fetchData:', err);
      setError('Er is een onverwachte fout opgetreden.');
      
      // Toon fallback data als we geen employees hebben
      if (employees.length === 0) {
        setEmployees([{
          id: 0,
          name: "Fout bij laden",
          function: "Ververs de pagina",
          expectedHours: 0,
          leaveHours: 0,
          writtenHours: 0,
          actualHours: 0,
          active: true
        }]);
      }
    } finally {
      // Always turn off loading indicators, even on error
      setIsLoading(false);
      if (forceRefresh) {
        setIsRefreshing(false);
      }
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

  // Calculate percentage
  const calculatePercentage = (actual: number, expected: number) => {
    if (expected === 0) return 0;
    return Math.round((actual / expected) * 100);
  };

  // Determine color based on percentage
  const getPercentageColor = (percentage: number) => {
    if (percentage < 80) return 'text-red-500';
    if (percentage < 95) return 'text-amber-500';
    if (percentage <= 105) return 'text-green-500';
    return 'text-blue-500';
  };

  // Sort employees based on current sort settings
  const sortEmployees = (employees: EmployeeWithStats[]): EmployeeWithStats[] => {
    return [...employees].sort((a, b) => {
      if (sortBy === 'percentage') {
        const percentageA = calculatePercentage(a.actualHours, a.expectedHours);
        const percentageB = calculatePercentage(b.actualHours, b.expectedHours);
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
        setTimeout(() => fetchData(), 0);
      }
    }
  };

  const handleDeletePreset = (id: string) => {
    deletePreset(id);
    if (selectedPreset === id) {
      setSelectedPreset(null);
    }
  };

  // Functie om data te verversen na synchronisatie
  const handleRefresh = () => {
    fetchData(true);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="max-w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Medewerkers</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isRefreshing}
              onClick={handleRefresh}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <Link to={generateEmployeeCardsUrl({
                year: selectedYear,
                month: selectedMonth + 1,
                week: selectedWeek,
                viewMode
              })}>
                <IconPerson className="w-4 h-4 mr-2" />
                Cards
              </Link>
            </Button>
            <DataSyncButton 
              onSync={handleRefresh} 
              viewMode={viewMode}
              year={selectedYear}
              week={selectedWeek}
              month={selectedMonth}
              selectedDate={selectedDate}
            />
            <CacheStatus />
          </div>
        </div>
        
        {/* Period Selector */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between">
            <Tabs value={viewMode} onValueChange={(value) => handleViewModeChange(value as 'week' | 'month')}>
              <TabsList>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Maand</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Year selector */}
              <div>
                <Label className="mb-1 block">Jaar</Label>
                <Select 
                  value={selectedYear.toString()} 
                  onValueChange={(value) => handleYearChange(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer jaar" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map(option => (
                      <SelectItem key={option.value} value={option.value.toString()}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Week/Month selector */}
              {viewMode === 'week' ? (
                <div>
                  <Label className="mb-1 block">Week</Label>
                  <Select 
                    value={selectedWeek.toString()} 
                    onValueChange={(value) => handleWeekChange(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer week" />
                    </SelectTrigger>
                    <SelectContent>
                      {weekOptions.map(option => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div>
                  <Label className="mb-1 block">Maand</Label>
                  <Select 
                    value={selectedMonth.toString()} 
                    onValueChange={(value) => handleMonthChange(parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer maand" />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map(option => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Navigation buttons */}
              <div className="flex items-end">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevPeriod}
                    aria-label="Previous period"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex flex-col items-center px-2 min-w-28 text-center">
                    <span className="font-medium">
                      {viewMode === 'week' ? `Week ${selectedWeek}` : monthOptions[selectedMonth]?.label}
                    </span>
                    <span className="text-sm text-muted-foreground">{selectedYear}</span>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPeriod}
                    aria-label="Next period"
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {error && <ErrorMessage message={error} className="mb-6" />}
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Spinner size="large" />
            <span className="ml-2 text-gray-500">Loading employee data...</span>
          </div>
        ) : (
          <EmployeeTable 
            employees={filteredEmployees}
            weekDays={weekDays}
            absences={absences}
          />
        )}
      </div>
    </div>
  );
} 
