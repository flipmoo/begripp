/**
 * EmployeeHoursOverviewPage Component
 *
 * This component displays a table of employee hours with statistics.
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getWeek, getYear, getMonth } from 'date-fns';
import { getEmployeeStats, getEmployeeMonthStats, type EmployeeWithStats, isDataCached, clearEmployeeCache } from '@/services/employee.service';
import { syncHoursData, syncContracts } from '@/services/sync.service';
import { checkApiHealth } from '@/services/api';
import { Button } from '@/components/ui/button';
import { DateSelector } from '@/components/DateSelector';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EmployeeTable from '@/components/EmployeeTable';
import { CacheStatusPopup } from '@/components/CacheStatusPopup';
import { ForceRefreshButton } from '@/components/ui/force-refresh-button';
import Spinner from '@/components/Spinner';
import { useToast } from '@/components/ui/use-toast';
import { generateEmployeeCardsUrl } from '@/utils/url';
import ApiErrorFallback from '@/components/common/ApiErrorFallback';

const EmployeeHoursOverviewPage: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL parameters or defaults
  const initialDate = new Date();

  // Get view mode from URL or localStorage
  const [viewMode, setViewMode] = useState<'week' | 'month'>(() => {
    const viewModeParam = searchParams.get('viewMode');
    if (viewModeParam && (viewModeParam === 'week' || viewModeParam === 'month')) {
      return viewModeParam as 'week' | 'month';
    }

    const storedViewMode = localStorage.getItem('employeesPageViewMode');
    if (storedViewMode && (storedViewMode === 'week' || storedViewMode === 'month')) {
      return storedViewMode as 'week' | 'month';
    }

    return 'week';
  });

  // Initialize selected date from URL parameters or defaults
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const yearParam = searchParams.get('year');

    if (yearParam) {
      const year = parseInt(yearParam);

      if (viewMode === 'week') {
        const weekParam = searchParams.get('week');
        if (weekParam) {
          const week = parseInt(weekParam);
          // Create a date for the specified week
          const date = new Date(year, 0, 1);
          date.setDate(date.getDate() + (week - 1) * 7);
          return date;
        }
      } else {
        const monthParam = searchParams.get('month');
        if (monthParam) {
          const month = parseInt(monthParam) - 1; // Adjust for 0-based months
          return new Date(year, month, 1);
        }
      }
    }

    return initialDate;
  });

  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFromCache, setIsFromCache] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<{isOnline: boolean, isChecking: boolean}>({
    isOnline: true, // Optimistically assume API is online initially
    isChecking: false
  });

  const selectedWeek = getWeek(selectedDate, { weekStartsOn: 1, firstWeekContainsDate: 4 });
  const selectedYear = getYear(selectedDate);
  const selectedMonth = getMonth(selectedDate);

  // Function to merge employee data (handle multiple contracts)
  const mergeEmployeeData = (employees: EmployeeWithStats[]): EmployeeWithStats[] => {
    const employeeMap = new Map<number, EmployeeWithStats>();

    for (const employee of employees) {
      if (!employeeMap.has(employee.id)) {
        // Create a safe copy with default values for required fields
        employeeMap.set(employee.id, {
          ...employee,
          name: employee.name || `Employee ${employee.id}`,
          function: employee.function || '-',
          contractPeriod: employee.contractPeriod || employee.contract_period || '-',
          contractHours: employee.contractHours || employee.contract_hours || 0,
          holidayHours: employee.holidayHours || employee.holiday_hours || 0,
          expectedHours: employee.expectedHours || employee.expected_hours || 0,
          leaveHours: employee.leaveHours || employee.leave_hours || 0,
          writtenHours: employee.writtenHours || employee.written_hours || 0,
          actualHours: employee.actualHours || employee.actual_hours || 0,
          // Nieuwe veldnamen
          contract_period: employee.contract_period || employee.contractPeriod || '-',
          contract_hours: employee.contract_hours || employee.contractHours || 0,
          holiday_hours: employee.holiday_hours || employee.holidayHours || 0,
          expected_hours: employee.expected_hours || employee.expectedHours || 0,
          leave_hours: employee.leave_hours || employee.leaveHours || 0,
          written_hours: employee.written_hours || employee.writtenHours || 0,
          actual_hours: employee.actual_hours || employee.actualHours || 0,
          active: employee.active !== undefined ? employee.active : true
        });
      } else {
        const existingEmployee = employeeMap.get(employee.id)!;

        // Sum up the numeric values with null/undefined checks (oude veldnamen)
        existingEmployee.contractHours = (existingEmployee.contractHours || 0) + (employee.contractHours || employee.contract_hours || 0);
        existingEmployee.holidayHours = (existingEmployee.holidayHours || 0) + (employee.holidayHours || employee.holiday_hours || 0);
        existingEmployee.expectedHours = (existingEmployee.expectedHours || 0) + (employee.expectedHours || employee.expected_hours || 0);
        existingEmployee.leaveHours = (existingEmployee.leaveHours || 0) + (employee.leaveHours || employee.leave_hours || 0);
        existingEmployee.writtenHours = (existingEmployee.writtenHours || 0) + (employee.writtenHours || employee.written_hours || 0);
        existingEmployee.actualHours = (existingEmployee.actualHours || 0) + (employee.actualHours || employee.actual_hours || 0);

        // Sum up the numeric values with null/undefined checks (nieuwe veldnamen)
        existingEmployee.contract_hours = (existingEmployee.contract_hours || 0) + (employee.contract_hours || employee.contractHours || 0);
        existingEmployee.holiday_hours = (existingEmployee.holiday_hours || 0) + (employee.holiday_hours || employee.holidayHours || 0);
        existingEmployee.expected_hours = (existingEmployee.expected_hours || 0) + (employee.expected_hours || employee.expectedHours || 0);
        existingEmployee.leave_hours = (existingEmployee.leave_hours || 0) + (employee.leave_hours || employee.leaveHours || 0);
        existingEmployee.written_hours = (existingEmployee.written_hours || 0) + (employee.written_hours || employee.writtenHours || 0);
        existingEmployee.actual_hours = (existingEmployee.actual_hours || 0) + (employee.actual_hours || employee.actualHours || 0);
      }
    }

    // Log the processed employee data for debugging
    console.log('Processed employee data:', Array.from(employeeMap.values()));

    return Array.from(employeeMap.values());
  };

  // Load employee data
  const loadEmployees = async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if data is already in cache
      const isCached = viewMode === 'week'
        ? isDataCached(selectedYear, selectedWeek)
        : isDataCached(selectedYear, undefined, selectedMonth);

      setIsFromCache(isCached && !forceRefresh);

      let employeeData: EmployeeWithStats[] = [];

      if (viewMode === 'week') {
        console.log(`Loading employees for year=${selectedYear}, week=${selectedWeek}, forceRefresh=${forceRefresh}`);
        try {
          const result = await getEmployeeStats(selectedYear, selectedWeek, forceRefresh);
          console.log('Employee data loaded:', result);

          if (result && result.data && Array.isArray(result.data)) {
            // Check if we have contract data
            const sampleEmployee = result.data[0];
            if (sampleEmployee) {
              console.log('Sample employee data:', {
                id: sampleEmployee.id,
                name: sampleEmployee.name,
                function: sampleEmployee.function,
                contractPeriod: sampleEmployee.contractPeriod,
                contractHours: sampleEmployee.contractHours,
                holidayHours: sampleEmployee.holidayHours
              });
            }

            // Merge employee data to handle multiple contracts
            employeeData = mergeEmployeeData(result.data);
          } else {
            console.warn('Invalid employee data received:', result);
            employeeData = [];
          }
        } catch (error) {
          console.error('Error loading week employee data:', error);
          employeeData = [];
          setError('Failed to load employee data for the selected week');
        }
      } else {
        console.log(`Loading employees for year=${selectedYear}, month=${selectedMonth}, forceRefresh=${forceRefresh}`);
        try {
          const result = await getEmployeeMonthStats(selectedYear, selectedMonth, forceRefresh);
          console.log('Employee month data loaded:', result);

          if (result && result.data && Array.isArray(result.data)) {
            // Check if we have contract data
            const sampleEmployee = result.data[0];
            if (sampleEmployee) {
              console.log('Sample employee month data:', {
                id: sampleEmployee.id,
                name: sampleEmployee.name,
                function: sampleEmployee.function,
                contractPeriod: sampleEmployee.contractPeriod,
                contractHours: sampleEmployee.contractHours,
                holidayHours: sampleEmployee.holidayHours
              });
            }

            // Merge employee data to handle multiple contracts
            employeeData = mergeEmployeeData(result.data);
          } else {
            console.warn('Invalid employee month data received:', result);
            employeeData = [];
          }
        } catch (error) {
          console.error('Error loading month employee data:', error);
          employeeData = [];
          setError('Failed to load employee data for the selected month');
        }
      }

      // Update state with the loaded data
      setEmployees(employeeData);
    } catch (error) {
      console.error('Error loading employee data:', error);
      setError('An unexpected error occurred while loading employee data');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle view mode change
  const handleViewModeChange = (mode: string) => {
    console.log(`View mode changed to: ${mode}`);
    const newMode = mode as 'week' | 'month';
    setViewMode(newMode);
    localStorage.setItem('employeesPageViewMode', newMode);

    // Clear cache and force refresh
    clearEmployeeCache();

    // URL will be updated by the useEffect that watches viewMode
    // We'll force a refresh when the view mode changes
    setTimeout(() => {
      loadEmployees(true);
    }, 0);
  };

  // Update URL with current state
  const updateUrl = (newViewMode?: 'week' | 'month', newDate?: Date) => {
    const mode = newViewMode || viewMode;
    const date = newDate || selectedDate;
    const year = getYear(date);

    const params: Record<string, string> = {
      viewMode: mode,
      year: year.toString()
    };

    if (mode === 'week') {
      const week = getWeek(date, { weekStartsOn: 1, firstWeekContainsDate: 4 });
      params.week = week.toString();
    } else {
      const month = getMonth(date) + 1; // Adjust for 1-based months in URL
      params.month = month.toString();
    }

    setSearchParams(params, { replace: true });
  };

  // Handle sync data
  const handleSyncData = async () => {
    setIsSyncing(true);
    try {
      // Calculate start and end dates based on view mode
      let startDate: string, endDate: string;

      if (viewMode === 'week') {
        // Get start and end of week
        const weekStart = new Date(selectedDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6); // Sunday

        startDate = weekStart.toISOString().split('T')[0];
        endDate = weekEnd.toISOString().split('T')[0];
      } else {
        // Get start and end of month
        const monthStart = new Date(selectedYear, selectedMonth, 1);
        const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);

        startDate = monthStart.toISOString().split('T')[0];
        endDate = monthEnd.toISOString().split('T')[0];
      }

      // Clear cache before syncing
      clearEmployeeCache();

      const success = await syncHoursData(startDate, endDate);

      if (success) {
        toast({
          title: "Data synchronized successfully",
          description: `Hours data for ${viewMode === 'week' ? `week ${selectedWeek}` : `${new Date(selectedYear, selectedMonth).toLocaleString('default', { month: 'long' })}`} has been synchronized.`,
          variant: "default",
        });

        // Reload data with force refresh to get the latest data
        await loadEmployees(true);
      } else {
        toast({
          title: "Synchronization failed",
          description: "Failed to synchronize hours data. Please try again later.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error syncing data:', error);
      toast({
        title: "Synchronization error",
        description: "An error occurred while synchronizing data.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Check API health
  const checkApiStatus = async () => {
    setApiStatus(prev => ({ ...prev, isChecking: true }));
    try {
      // Create an AbortController to timeout the request after 5 seconds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const isHealthy = await checkApiHealth();
      clearTimeout(timeoutId);

      setApiStatus({ isOnline: isHealthy, isChecking: false });
      return isHealthy;
    } catch (error) {
      console.error('Error checking API health:', error);
      setApiStatus({ isOnline: false, isChecking: false });
      return false;
    }
  };

  // Flag to prevent circular updates
  const [isUpdatingFromUrl, setIsUpdatingFromUrl] = useState(false);

  // Listen for URL changes and update state accordingly
  useEffect(() => {
    // Skip if we're currently updating from state changes
    if (isUpdatingFromUrl) return;

    setIsUpdatingFromUrl(true);

    try {
      const viewModeParam = searchParams.get('viewMode');
      const yearParam = searchParams.get('year');

      let stateChanged = false;

      // Update view mode if needed
      if (viewModeParam && (viewModeParam === 'week' || viewModeParam === 'month')) {
        if (viewModeParam !== viewMode) {
          console.log(`Updating viewMode from URL: ${viewModeParam}`);
          setViewMode(viewModeParam as 'week' | 'month');
          stateChanged = true;
        }
      }

      // Update date if needed
      if (yearParam) {
        const year = parseInt(yearParam);

        if (viewModeParam === 'week' || (!viewModeParam && viewMode === 'week')) {
          const weekParam = searchParams.get('week');
          if (weekParam) {
            const week = parseInt(weekParam);
            const currentWeek = getWeek(selectedDate, { weekStartsOn: 1, firstWeekContainsDate: 4 });
            const currentYear = getYear(selectedDate);

            // Only update if the week or year has changed
            if (week !== currentWeek || year !== currentYear) {
              console.log(`Updating date from URL: year=${year}, week=${week}`);
              // Create a date for the specified week
              const date = new Date(year, 0, 1);
              date.setDate(date.getDate() + (week - 1) * 7);
              setSelectedDate(date);
              stateChanged = true;
            }
          }
        } else if (viewModeParam === 'month' || (!viewModeParam && viewMode === 'month')) {
          const monthParam = searchParams.get('month');
          if (monthParam) {
            const month = parseInt(monthParam) - 1; // Adjust for 0-based months
            const currentMonth = getMonth(selectedDate);
            const currentYear = getYear(selectedDate);

            // Only update if the month or year has changed
            if (month !== currentMonth || year !== currentYear) {
              console.log(`Updating date from URL: year=${year}, month=${month + 1}`);
              setSelectedDate(new Date(year, month, 1));
              stateChanged = true;
            }
          }
        }
      }

      // If state changed from URL, force a refresh of the data
      if (stateChanged) {
        setTimeout(() => {
          loadEmployees(true);
        }, 200);
      }
    } finally {
      // Reset flag after a short delay to allow state updates to complete
      setTimeout(() => {
        setIsUpdatingFromUrl(false);
      }, 100);
    }
  }, [searchParams]);

  // Update URL when date or view mode changes
  useEffect(() => {
    // Skip if we're currently updating from URL changes
    if (isUpdatingFromUrl) return;

    console.log(`Updating URL from state: viewMode=${viewMode}, date=${selectedDate.toISOString()}`);
    updateUrl();
  }, [selectedDate, viewMode, isUpdatingFromUrl]);

  // Load data when component mounts or when dependencies change
  useEffect(() => {
    const initializeData = async () => {
      // First check if API is online
      const isApiOnline = await checkApiStatus();

      if (isApiOnline) {
        // Sync contracts first
        try {
          console.log('Syncing contracts...');
          await syncContracts();
        } catch (error) {
          console.error('Error syncing contracts:', error);
          // Continue even if contract sync fails
        }

        // Then load employees
        loadEmployees(false);
      } else {
        setIsLoading(false);
        setError('API server is not responding. Please try again later.');
      }
    };

    initializeData();
  }, [selectedYear, selectedMonth, selectedWeek, viewMode]);
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-3xl font-bold">Employee Hours Overview</h1>
          {isLoading && (
            <div className="flex items-center ml-4 text-sm text-gray-500">
              <Spinner size="small" className="mr-2" />
              <span>Loading...</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ForceRefreshButton
            tooltipText="Refresh data (ignore cache)"
            onRefresh={async () => {
              // Clear cache before refreshing
              clearEmployeeCache();
              await loadEmployees(true);
            }}
          />
          <Button
            variant="outline"
            onClick={handleSyncData}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <Spinner size="small" className="mr-2" />
                Syncing...
              </>
            ) : (
              'Sync Data'
            )}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={generateEmployeeCardsUrl({
              year: selectedYear,
              month: selectedMonth + 1,
              week: selectedWeek,
              viewMode
            })}>
              View as Cards
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={viewMode} onValueChange={handleViewModeChange}>
            <TabsList>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="month">Month</TabsTrigger>
            </TabsList>
          </Tabs>

          <DateSelector
            selectedDate={selectedDate}
            onDateChange={(date) => {
              console.log(`Date changed to: ${date.toISOString()}`);
              setSelectedDate(date);

              // Clear cache and force refresh
              clearEmployeeCache();

              // URL will be updated by the useEffect that watches selectedDate
              // We'll force a refresh when the date changes
              setTimeout(() => {
                loadEmployees(true);
              }, 0);
            }}
            viewMode={viewMode}
          />

          {isFromCache && (
            <CacheStatusPopup
              year={selectedYear}
              week={viewMode === 'week' ? selectedWeek : undefined}
              month={viewMode === 'month' ? selectedMonth : undefined}
            />
          )}
        </div>
      </div>

      {!apiStatus.isOnline ? (
        <ApiErrorFallback
          title="API Server Offline"
          message="De API server is momenteel niet beschikbaar. Probeer het later opnieuw of neem contact op met de beheerder."
          onRetry={checkApiStatus}
          isRetrying={apiStatus.isChecking}
        />
      ) : error ? (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
          <p className="font-bold">Error</p>
          <p>{error}</p>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadEmployees(true)}
              className="mr-2"
            >
              Opnieuw proberen
            </Button>
          </div>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-gray-500">No employee data found for the selected period.</p>
        </div>
      ) : (
        <EmployeeTable employees={employees} />
      )}
    </div>
  );
};

export default EmployeeHoursOverviewPage;
