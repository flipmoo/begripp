/**
 * Employees Page
 *
 * This page displays employee data with filtering, sorting, and period selection.
 * It supports both weekly and monthly views and allows for data synchronization.
 */

// React and hooks
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

// Date utilities
import { getWeek, getYear, getMonth } from 'date-fns';
import { getWeekDays } from '@/utils/date-utils';

// Services and types
import {
  getEmployeeStats,
  getEmployeeMonthStats,
  type EmployeeWithStats,
  enrichEmployeesWithAbsences
} from '@/services/employee.service';
import { AbsencesByEmployee } from '@/services/absence.service';

// Custom hooks
import { useFilterPresets } from '@/hooks/useFilterPresets';

// UI Components
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Icons
import { ChevronLeftIcon, ChevronRightIcon } from '@radix-ui/react-icons';
import { RefreshCw } from 'lucide-react';
import { IconPerson } from '@/components/Icons';

// Custom components
import { DataSyncButton } from '@/components/DataSyncButton';
import EmployeeTable from '@/components/EmployeeTable';
import Spinner from '@/components/Spinner';
import ErrorMessage from '@/components/ErrorMessage';
import CacheStatus from '@/components/CacheStatus';

// Utilities
import { generateEmployeeCardsUrl } from '@/utils/url';

/**
 * EmployeesPage Component
 *
 * Main page for displaying and managing employee data with various filtering,
 * sorting, and time period selection options.
 *
 * Features:
 * - Weekly and monthly view modes
 * - Period selection (year, week, month)
 * - Employee data filtering and sorting
 * - Filter presets management
 * - Data synchronization
 * - URL parameter persistence
 */
export default function EmployeesPage() {
  // Initialize with current date
  const initialDate = new Date();
  const [searchParams, setSearchParams] = useSearchParams();

  // ===== Period Selection State =====

  /**
   * Initialize selected date from URL parameters, localStorage, or defaults
   * Priority: localStorage > URL parameters > current date
   */
  const [selectedDate, setSelectedDate] = useState(() => {
    // Try to get from localStorage first
    const storedDate = localStorage.getItem('employeesPageDate');
    if (storedDate) {
      return new Date(storedDate);
    }

    // Try to get from URL parameters
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

    // Default to current date
    return initialDate;
  });

  /**
   * Initialize view mode from localStorage or URL parameters
   * Priority: localStorage > URL parameters > default (week)
   */
  const [viewMode, setViewMode] = useState<'week' | 'month'>(() => {
    const storedViewMode = localStorage.getItem('employeesPageViewMode');
    if (storedViewMode && (storedViewMode === 'week' || storedViewMode === 'month')) {
      return storedViewMode;
    }
    return searchParams.get('viewMode') === 'month' ? 'month' : 'week';
  });

  // ===== Data State =====

  // Employee data
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<EmployeeWithStats[]>([]);
  const [absences, setAbsences] = useState<AbsencesByEmployee>({});

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isFromCache, setIsFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeWithStats | null>(null);

  // ===== Filter State =====

  // Text search
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');

  // Active employees filter
  const [showOnlyActive, setShowOnlyActive] = useState(() => searchParams.get('active') === 'true');

  // Percentage range filter
  const [percentageRange, setPercentageRange] = useState<[number, number]>(() => {
    const minParam = searchParams.get('minPercentage');
    const maxParam = searchParams.get('maxPercentage');
    return [
      minParam ? parseInt(minParam) : 0,
      maxParam ? parseInt(maxParam) : 200
    ];
  });

  // Filter UI state
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Excluded employees
  const [excludedEmployees, setExcludedEmployees] = useState<number[]>(() => {
    const excludedParam = searchParams.get('excluded');
    return excludedParam ? excludedParam.split(',').map(id => parseInt(id)) : [];
  });

  // Filter presets
  const [selectedPreset, setSelectedPreset] = useState<string | null>(() => {
    return searchParams.get('preset');
  });

  // Filter presets hook
  const { presets, savePreset, deletePreset, getPreset } = useFilterPresets();

  // ===== Sorting State =====

  // Sort field
  const [sortBy, setSortBy] = useState<'percentage' | 'name'>(() => {
    return searchParams.get('sortBy') === 'name' ? 'name' : 'percentage';
  });

  // Sort direction
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

  // Update localStorage when date or viewMode changes
  useEffect(() => {
    localStorage.setItem('employeesPageDate', selectedDate.toISOString());
    localStorage.setItem('employeesPageViewMode', viewMode);
  }, [selectedDate, viewMode]);

  // Load employees when date or view mode changes
  useEffect(() => {
    console.log('Date or viewMode changed, fetching new data...');
    // Set a small timeout to prevent double fetching when both date and viewMode change
    const timer = setTimeout(() => {
      fetchData();
    }, 50);

    return () => clearTimeout(timer);
  }, [selectedDate, viewMode]);

  /**
   * Fetch employee data based on the current view mode and selected period
   *
   * This function:
   * 1. Fetches employee data for the selected week or month
   * 2. Enriches the data with absence information
   * 3. Updates the component state with the fetched data
   *
   * @param forceRefresh - Whether to bypass cache and fetch fresh data
   */
  const fetchData = useCallback(async (forceRefresh?: boolean) => {
    try {
      // Update UI state to show loading
      setIsLoading(true);
      setIsRefreshing(forceRefresh || false);
      setError(null);

      console.log('EmployeesPage component: Loading employee data directly...');

      let fetchedEmployees: EmployeeWithStats[] = [];

      // Fetch data based on view mode
      if (viewMode === 'week') {
        // Weekly view - fetch data for the selected week
        console.log(`Fetching weekly data for year ${selectedYear}, week ${selectedWeek}`);
        const result = await getEmployeeStats(selectedYear, selectedWeek, forceRefresh);
        fetchedEmployees = result.data;
        setEmployees(fetchedEmployees);
        setIsFromCache(result.fromCache);
      } else if (viewMode === 'month') {
        // Monthly view - fetch data for the selected month
        console.log(`Fetching monthly data for year ${selectedYear}, month ${selectedMonth + 1}`);
        const result = await getEmployeeMonthStats(selectedYear, selectedMonth + 1, forceRefresh);
        fetchedEmployees = result.data;
        setEmployees(fetchedEmployees);
        setIsFromCache(result.fromCache);
      }

      // Enrich employee data with absence information
      try {
        // In a real implementation, this would fetch absence data from an API
        // For now, we're using an empty object as a placeholder
        const absencesByEmployee = {}; // Placeholder for actual absence data

        // Enrich employees with absence data
        const employeesWithAbsences = enrichEmployeesWithAbsences(fetchedEmployees, absencesByEmployee);
        setAbsences(absencesByEmployee);

        console.log(`Successfully loaded ${fetchedEmployees.length} employees`);
      } catch (absenceError) {
        console.error('Error enriching employees with absences:', absenceError);
        // Don't let absence errors prevent showing the employee data
        setAbsences({});
      }

    } catch (err) {
      // Handle errors gracefully
      console.error('Error fetching employee data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load employee data');
    } finally {
      // Always reset loading states
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedWeek, selectedYear, selectedMonth, viewMode]);

  // Apply filters whenever employees or filter criteria change
  useEffect(() => {
    applyFilters();
  }, [employees, searchQuery, showOnlyActive, percentageRange, excludedEmployees, sortBy, sortDirection]);

  /**
   * Apply all active filters to the employees list
   *
   * This function applies multiple filters in sequence:
   * 1. Text search filter (name and function)
   * 2. Active employees filter
   * 3. Percentage range filter
   * 4. Excluded employees filter
   *
   * Finally, it sorts the filtered results and updates the state.
   */
  const applyFilters = () => {
    // Start with a copy of the full employee list
    let result = [...employees];

    // 1. Apply text search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(emp =>
        // Match on employee name
        emp.name.toLowerCase().includes(query) ||
        // Match on employee function/role if available
        (emp.function && emp.function.toLowerCase().includes(query))
      );
    }

    // 2. Apply active employees filter
    if (showOnlyActive) {
      result = result.filter(emp => emp.active);
    }

    // 3. Apply percentage range filter (hours completion percentage)
    result = result.filter(emp => {
      // Calculate completion percentage
      const percentage = emp.expectedHours > 0
        ? Math.round((emp.actualHours / emp.expectedHours) * 100)
        : 0;

      // Check if percentage is within the selected range
      return percentage >= percentageRange[0] && percentage <= percentageRange[1];
    });

    // 4. Apply excluded employees filter
    if (excludedEmployees.length > 0) {
      result = result.filter(emp => !excludedEmployees.includes(emp.id));
    }

    // 5. Sort the filtered results
    result = sortEmployees(result);

    // Update state with filtered and sorted employees
    setFilteredEmployees(result);

    // Log filter results
    console.log(`Applied filters: ${employees.length} total → ${result.length} filtered`);
  };

  /**
   * Calculate percentage of actual hours compared to expected hours
   *
   * @param actual - Actual hours worked
   * @param expected - Expected hours to work
   * @returns Percentage as a rounded integer
   */
  const calculatePercentage = (actual: number, expected: number) => {
    if (expected === 0) return 0;
    return Math.round((actual / expected) * 100);
  };

  /**
   * Determine CSS color class based on percentage value
   *
   * - Red: < 80% (significantly under target)
   * - Amber: 80-94% (slightly under target)
   * - Green: 95-105% (on target)
   * - Blue: > 105% (over target)
   *
   * @param percentage - The percentage value to evaluate
   * @returns CSS class name for the appropriate color
   */
  const getPercentageColor = (percentage: number) => {
    if (percentage < 80) return 'text-red-500';    // Significantly under target
    if (percentage < 95) return 'text-amber-500';  // Slightly under target
    if (percentage <= 105) return 'text-green-500'; // On target
    return 'text-blue-500';                        // Over target
  };

  /**
   * Sort employees based on current sort settings
   *
   * Supports sorting by:
   * - Percentage (hours completion)
   * - Name (alphabetical)
   *
   * @param employees - Array of employees to sort
   * @returns New sorted array of employees
   */
  const sortEmployees = (employees: EmployeeWithStats[]): EmployeeWithStats[] => {
    return [...employees].sort((a, b) => {
      if (sortBy === 'percentage') {
        // Sort by percentage of hours completion
        const percentageA = calculatePercentage(a.actualHours, a.expectedHours);
        const percentageB = calculatePercentage(b.actualHours, b.expectedHours);

        // Apply sort direction
        return sortDirection === 'asc'
          ? percentageA - percentageB  // Ascending: low to high
          : percentageB - percentageA; // Descending: high to low
      } else {
        // Sort alphabetically by name
        return sortDirection === 'asc'
          ? a.name.localeCompare(b.name, 'nl')  // Ascending: A to Z
          : b.name.localeCompare(a.name, 'nl'); // Descending: Z to A
      }
    });
  };

  /**
   * Reset all filters to their default values
   *
   * This resets:
   * - Search query
   * - Active employees filter
   * - Percentage range
   * - Excluded employees
   * - Sort settings
   * - Selected preset
   */
  const resetFilters = () => {
    // Reset all filter values to defaults
    setSearchQuery('');
    setShowOnlyActive(false);
    setPercentageRange([0, 200]);
    setExcludedEmployees([]);

    // Reset sort settings
    setSortBy('percentage');
    setSortDirection('desc');

    // Reset preset selection
    setSelectedPreset(null);

    // Close filter panel if open
    setIsFilterOpen(false);

    console.log('All filters reset to defaults');
  };

  /**
   * Save the current filter settings as a named preset
   *
   * @param name - The name to give to the preset
   */
  const saveCurrentFilterAsPreset = (name: string) => {
    // Create a preset with the current filter settings
    const presetId = savePreset(name, {
      showOnlyActive,
      percentageRange: percentageRange as [number, number],
      excludedEmployees,
      viewMode
    });

    // Select the newly created preset
    setSelectedPreset(presetId);

    console.log(`Filter preset "${name}" saved with ID: ${presetId}`);
  };

  /**
   * Load a saved filter preset by ID
   *
   * @param id - The ID of the preset to load
   */
  const loadPreset = (id: string) => {
    const preset = getPreset(id);

    if (preset) {
      console.log(`Loading preset: ${preset.name}`);

      // Apply the preset's filter settings
      setShowOnlyActive(preset.filters.showOnlyActive);
      setPercentageRange(preset.filters.percentageRange);
      setExcludedEmployees(preset.filters.excludedEmployees);

      // Store the selected preset ID
      setSelectedPreset(id);

      // Handle view mode changes
      const previousViewMode = viewMode;
      setViewMode(preset.filters.viewMode);

      // Reload employees if view mode changed
      if (preset.filters.viewMode !== previousViewMode) {
        console.log(`View mode changed from ${previousViewMode} to ${preset.filters.viewMode}, reloading data`);
        setTimeout(() => fetchData(), 0);
      }
    } else {
      console.warn(`Preset with ID ${id} not found`);
    }
  };

  /**
   * Delete a filter preset
   *
   * @param id - The ID of the preset to delete
   */
  const handleDeletePreset = (id: string) => {
    console.log(`Deleting preset with ID: ${id}`);

    // Delete the preset
    deletePreset(id);

    // If the deleted preset was selected, clear the selection
    if (selectedPreset === id) {
      setSelectedPreset(null);
    }
  };

  /**
   * Refresh employee data with force refresh
   *
   * Triggers a data refresh that bypasses the cache and fetches fresh data
   */
  const handleRefresh = () => {
    console.log('Manual refresh triggered');
    fetchData(true);
  };

  /**
   * Navigate to the previous period (week or month)
   *
   * In week mode:
   * - If current week is 1, go to week 52 of previous year
   * - Otherwise go to previous week
   *
   * In month mode:
   * - If current month is January, go to December of previous year
   * - Otherwise go to previous month
   */
  const handlePrevPeriod = () => {
    if (viewMode === 'week') {
      if (selectedWeek === 1) {
        // Go to previous year, week 52
        console.log(`Navigating from week 1/${selectedYear} to week 52/${selectedYear - 1}`);
        setSelectedDate(new Date(selectedYear - 1, 11, 31));
      } else {
        // Go to previous week
        console.log(`Navigating from week ${selectedWeek} to week ${selectedWeek - 1}`);
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() - 7);
        setSelectedDate(newDate);
      }
    } else {
      if (selectedMonth === 0) {
        // Go to previous year, December
        console.log(`Navigating from January/${selectedYear} to December/${selectedYear - 1}`);
        setSelectedDate(new Date(selectedYear - 1, 11, 1));
      } else {
        // Go to previous month
        const prevMonth = monthOptions[selectedMonth - 1]?.label;
        console.log(`Navigating from ${monthOptions[selectedMonth]?.label} to ${prevMonth}`);
        setSelectedDate(new Date(selectedYear, selectedMonth - 1, 1));
      }
    }
  };

  /**
   * Navigate to the next period (week or month)
   *
   * In week mode:
   * - If current week is 52, go to week 1 of next year
   * - Otherwise go to next week
   *
   * In month mode:
   * - If current month is December, go to January of next year
   * - Otherwise go to next month
   */
  const handleNextPeriod = () => {
    if (viewMode === 'week') {
      if (selectedWeek === 52) {
        // Go to next year, week 1
        console.log(`Navigating from week 52/${selectedYear} to week 1/${selectedYear + 1}`);
        setSelectedDate(new Date(selectedYear + 1, 0, 1));
      } else {
        // Go to next week
        console.log(`Navigating from week ${selectedWeek} to week ${selectedWeek + 1}`);
        const newDate = new Date(selectedDate);
        newDate.setDate(newDate.getDate() + 7);
        setSelectedDate(newDate);
      }
    } else {
      if (selectedMonth === 11) {
        // Go to next year, January
        console.log(`Navigating from December/${selectedYear} to January/${selectedYear + 1}`);
        setSelectedDate(new Date(selectedYear + 1, 0, 1));
      } else {
        // Go to next month
        const nextMonth = monthOptions[selectedMonth + 1]?.label;
        console.log(`Navigating from ${monthOptions[selectedMonth]?.label} to ${nextMonth}`);
        setSelectedDate(new Date(selectedYear, selectedMonth + 1, 1));
      }
    }
  };

  /**
   * Handle year selection change
   *
   * Updates the selected date to the same month/day in the new year
   *
   * @param year - The new year value
   */
  const handleYearChange = (year: number) => {
    console.log(`Year changed from ${selectedYear} to ${year}`);
    setSelectedDate(new Date(year, selectedDate.getMonth(), selectedDate.getDate()));
  };

  /**
   * Handle week selection change
   *
   * Updates the selected date to the specified week in the current year
   *
   * @param week - The new week number (1-52)
   */
  const handleWeekChange = (week: number) => {
    console.log(`Week changed from ${selectedWeek} to ${week}`);
    // Calculate the date of the first day of the selected week
    // Week 1 starts on Jan 1, each week adds 7 days
    setSelectedDate(new Date(selectedYear, 0, 1 + (week - 1) * 7));
  };

  /**
   * Handle month selection change
   *
   * Updates the selected date to the first day of the specified month
   *
   * @param month - The new month value (0-11)
   */
  const handleMonthChange = (month: number) => {
    console.log(`Month changed from ${monthOptions[selectedMonth]?.label} to ${monthOptions[month]?.label}`);
    setSelectedDate(new Date(selectedYear, month, 1));
  };

  /**
   * Handle view mode change between week and month
   *
   * When changing view modes, we maintain the same time period as much as possible:
   * - When switching to week view: use the first week of the current month
   * - When switching to month view: use the month of the current week
   *
   * @param mode - The new view mode ('week' or 'month')
   */
  const handleViewModeChange = (mode: 'week' | 'month') => {
    console.log(`View mode changed from ${viewMode} to ${mode}`);
    setViewMode(mode);

    // Keep the same date period, only change the view mode
    if (mode === 'week') {
      // When switching from month to week, use the first week of the month
      setSelectedDate(new Date(selectedYear, selectedMonth, 1));
    } else {
      // When switching from week to month, keep the month of the current week
      setSelectedDate(new Date(selectedYear, selectedMonth, 1));
    }
  };

  /**
   * Update URL parameters when filters or period selection changes
   *
   * This effect synchronizes the component state with the URL, making it possible to:
   * - Share links with specific filters applied
   * - Use browser back/forward navigation
   * - Bookmark specific views
   *
   * Only non-default values are included in the URL to keep it clean.
   */
  useEffect(() => {
    const params: Record<string, string> = {};

    // ===== Period parameters =====

    // Always include year
    params.year = selectedYear.toString();

    // Include week or month based on view mode
    if (viewMode === 'week') {
      params.week = selectedWeek.toString();
    } else {
      // Month is 0-based in JS but 1-based in URL
      params.month = (selectedMonth + 1).toString();
    }

    // Always include view mode
    params.viewMode = viewMode;

    // ===== Filter parameters (only include non-default values) =====

    // Text search filter
    if (searchQuery) {
      params.search = searchQuery;
    }

    // Active employees filter
    if (showOnlyActive) {
      params.active = 'true';
    }

    // Percentage range filter (min)
    if (percentageRange[0] !== 0) {
      params.minPercentage = percentageRange[0].toString();
    }

    // Percentage range filter (max)
    if (percentageRange[1] !== 200) {
      params.maxPercentage = percentageRange[1].toString();
    }

    // Excluded employees filter
    if (excludedEmployees.length > 0) {
      params.excluded = excludedEmployees.join(',');
    }

    // Selected preset
    if (selectedPreset) {
      params.preset = selectedPreset;
    }

    // ===== Sort parameters =====

    // Sort field (default: percentage)
    if (sortBy !== 'percentage') {
      params.sortBy = sortBy;
    }

    // Sort direction (default: desc)
    if (sortDirection !== 'desc') {
      params.sortDirection = sortDirection;
    }

    // Update URL without adding to browser history
    setSearchParams(params, { replace: true });
  }, [
    // Period dependencies
    selectedYear,
    selectedWeek,
    selectedMonth,
    viewMode,

    // Filter dependencies
    searchQuery,
    showOnlyActive,
    percentageRange,
    excludedEmployees,
    selectedPreset,

    // Sort dependencies
    sortBy,
    sortDirection,

    // Function dependency
    setSearchParams
  ]);

  /**
   * Render the employees page UI
   */
  return (
    <div className="container mx-auto py-6">
      <div className="max-w-full mx-auto">
        {/* ===== Page Header ===== */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Medewerkers</h1>

          {/* Action buttons */}
          <div className="flex gap-2">
            {/* Manual refresh button */}
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

            {/* Cards view link */}
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

            {/* Data synchronization button */}
            <DataSyncButton
              onSync={handleRefresh}
              viewMode={viewMode}
              year={selectedYear}
              week={selectedWeek}
              month={selectedMonth}
              selectedDate={selectedDate}
            />

            {/* Cache status indicator */}
            <CacheStatus />
          </div>
        </div>

        {/* ===== Period Selection Controls ===== */}
        <div className="space-y-4 mb-6">
          {/* View mode tabs and loading indicator */}
          <div className="flex items-center justify-between">
            {/* Week/Month view mode selector */}
            <Tabs value={viewMode} onValueChange={(value) => handleViewModeChange(value as 'week' | 'month')}>
              <TabsList>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Maand</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Loading indicator (only shown during initial load) */}
            {isLoading && !isRefreshing && (
              <div className="flex items-center text-sm text-gray-500">
                <Spinner size="small" className="mr-2" />
                <span>Loading data...</span>
              </div>
            )}
          </div>

          {/* Period selection controls */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Year selector dropdown */}
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

              {/* Week/Month selector (changes based on view mode) */}
              {viewMode === 'week' ? (
                // Week selector (shown in week view)
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
                // Month selector (shown in month view)
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

              {/* Previous/Next period navigation */}
              <div className="flex items-end">
                <div className="flex items-center gap-2">
                  {/* Previous period button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrevPeriod}
                    aria-label="Previous period"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </Button>

                  {/* Current period display */}
                  <div className="flex flex-col items-center px-2 min-w-28 text-center">
                    <span className="font-medium">
                      {viewMode === 'week' ? `Week ${selectedWeek}` : monthOptions[selectedMonth]?.label}
                    </span>
                    <span className="text-sm text-muted-foreground">{selectedYear}</span>
                  </div>

                  {/* Next period button */}
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

        {/* ===== Error Message ===== */}
        {error && <ErrorMessage message={error} className="mb-6" />}

        {/* ===== Employee Data Display ===== */}
        {isLoading ? (
          // Loading state
          <div className="flex justify-center items-center h-64">
            <Spinner size="large" />
            <span className="ml-2 text-gray-500">Loading employee data...</span>
          </div>
        ) : (
          // Employee table with filtered data
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
