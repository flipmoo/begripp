/**
 * Team Dashboard Page
 *
 * This page displays an overview of team performance, project statuses,
 * employee availability, and other key metrics for project management.
 */

// React and hooks
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// UI Components
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { Skeleton } from '../../components/ui/skeleton';
import { useToast } from '../../components/ui/use-toast';

// Icons
import { RefreshCw } from 'lucide-react';

// Types
import { GrippProject } from '../../types/gripp';
import { EmployeeWithStats } from '../../services/employee.service';

// API and Services
import { fetchActiveProjects, syncProjects } from '../../api/dashboard/grippApi';
import { dbService } from '../../api/dashboard/dbService';
import { getEmployeeStats, clearEmployeeCache } from '../../services/employee.service';
import { forceRefreshCache } from '../../api/dashboard/utils';

// Dashboard Components
import OverBudgetProjects from '../../components/dashboard/OverBudgetProjects';
import IncompleteHoursFilter, { IncompleteHoursFilterRef } from '../../components/dashboard/IncompleteHoursFilter';
import DashboardStats from '../../components/dashboard/DashboardStats';
import EmployeeAvailability from '../../components/dashboard/EmployeeAvailability';
import ProjectDeadlines from '../../components/dashboard/ProjectDeadlines';

// Stores
import { useEmployeeStore } from '../../stores/employees';
import { useDashboardStore } from '../../stores/dashboard';
import { useProjectsStore } from '../../stores/projects';

// Utilities
import { formatDate } from '../../utils/date';

/**
 * TeamDashboardPage Component
 *
 * Main dashboard page that displays project statistics, employee data,
 * and provides tools for project management and monitoring.
 *
 * Features:
 * - Real-time project statistics
 * - Employee availability tracking
 * - Project deadline visualization
 * - Over-budget project alerts
 * - Incomplete hours tracking
 * - Automatic data refresh
 * - Manual synchronization with Gripp API
 */
const TeamDashboardPage: React.FC = () => {
  // Hooks
  const { toast } = useToast();

  // Data state
  const [projects, setProjects] = useState<GrippProject[]>([]);
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [hasShownToast, setHasShownToast] = useState(false);

  // Refs
  const incompleteHoursFilterRef = useRef<IncompleteHoursFilterRef>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Load projects from cache or API
   *
   * This function attempts to load projects using the following strategy:
   * 1. If forceRefresh is true, clear cache and fetch directly from API
   * 2. If forceRefresh is false, try to load from IndexedDB cache first
   * 3. If cache is empty or unavailable, fetch from API
   *
   * @param forceRefresh - Whether to bypass cache and fetch directly from API
   */
  const loadProjects = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Force refresh path - clear cache and fetch from API
      if (forceRefresh) {
        console.log('Force refresh requested, clearing IndexedDB cache and fetching from API');

        try {
          // Clear the IndexedDB projects cache
          await dbService.clearProjects();
        } catch (clearError) {
          console.error('Error clearing IndexedDB cache:', clearError);
        }

        // Fetch fresh data from API with timestamp for cache busting
        const timestamp = new Date().getTime();
        const activeProjects = await fetchActiveProjects(`?refresh=true&_t=${timestamp}`);

        if (activeProjects && activeProjects.length > 0) {
          setProjects(activeProjects);
          setLastRefresh(new Date());

          // Save projects to IndexedDB for future use
          try {
            await dbService.saveProjects(activeProjects);
          } catch (dbError) {
            console.error('Error saving projects to IndexedDB:', dbError);
          }
        } else {
          setError('Geen projecten gevonden');
        }

        setLoading(false);
        return;
      }

      // Normal path - try cache first
      try {
        // Attempt to load from IndexedDB cache
        const cachedProjects = await dbService.getAllProjects();
        if (cachedProjects && cachedProjects.length > 0) {
          console.log(`Loaded ${cachedProjects.length} projects from cache`);
          setProjects(cachedProjects);
          setLoading(false);
          return;
        }
      } catch (dbError) {
        console.error('Error loading projects from IndexedDB:', dbError);
      }

      // Cache miss - fetch from API
      console.log('No cached projects found, fetching from API');
      const timestamp = new Date().getTime();
      const activeProjects = await fetchActiveProjects(`?_t=${timestamp}`);

      if (activeProjects && activeProjects.length > 0) {
        console.log(`Fetched ${activeProjects.length} projects from API`);
        setProjects(activeProjects);
        setLastRefresh(new Date());

        // Save to cache for future use
        try {
          await dbService.saveProjects(activeProjects);
        } catch (dbError) {
          console.error('Error saving projects to IndexedDB:', dbError);
        }
      } else {
        setError('Geen projecten gevonden');
      }
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Er is een fout opgetreden bij het laden van de projecten');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Load employee data with statistics
   *
   * Fetches employee data including hours, availability, and other statistics
   * for the current week. Can force a refresh to bypass cache.
   *
   * @param forceRefresh - Whether to bypass cache and fetch fresh data
   */
  const loadEmployees = useCallback(async (forceRefresh = false) => {
    try {
      console.log(`Loading employees with forceRefresh=${forceRefresh}`);

      // Get current date information
      const now = new Date();
      const currentYear = now.getFullYear();

      // Calculate current week number
      const currentWeek = Math.floor(now.getDate() / 7) + 1;

      // Clear employee cache if force refresh is requested
      if (forceRefresh) {
        console.log('Force refresh requested, clearing employee cache');
        await clearEmployeeCache();
      }

      // Fetch employee data with timestamp for cache busting
      const timestamp = Date.now();
      const result = await getEmployeeStats(currentYear, currentWeek, forceRefresh, timestamp);

      // Update state with employee data
      console.log(`Loaded ${result.data.length} employees`);
      setEmployees(result.data);
    } catch (err) {
      console.error('Error loading employees:', err);
      // We don't set error state here to avoid blocking the entire dashboard
      // if only the employee data fails to load
    }
  }, []);

  /**
   * Refresh all dashboard data
   *
   * Refreshes all data sources for the dashboard, including:
   * - Projects data
   * - Employee statistics
   * - Incomplete hours filter
   *
   * @param showToast - Whether to show a toast notification about the refresh
   */
  const refreshData = useCallback(async (showToast = false) => {
    console.log('Automatically refreshing dashboard data...');
    try {
      // Refresh all data sources with force refresh to bypass cache
      await loadProjects(true);
      await loadEmployees(true);

      // Refresh the incomplete hours filter component
      if (incompleteHoursFilterRef.current) {
        incompleteHoursFilterRef.current.refreshData();
      }

      // Update last refresh timestamp
      setLastRefresh(new Date());

      // Show success notification if requested
      if (showToast) {
        toast({
          title: "Dashboard bijgewerkt",
          description: "Dashboard data is automatisch ververst.",
          variant: "default",
        });
      }
    } catch (err) {
      console.error('Error refreshing dashboard data:', err);

      // Show error notification if requested
      if (showToast) {
        toast({
          title: "Verversen mislukt",
          description: "Er is een fout opgetreden bij het verversen van de dashboard data.",
          variant: "destructive",
        });
      }
    }
  }, [loadProjects, loadEmployees, toast]);

  /**
   * Load all dashboard data with force refresh
   *
   * Similar to refreshData but without toast notifications.
   * Used primarily for internal component communication.
   */
  const loadDashboardData = useCallback(async () => {
    console.log('loadDashboardData: Refreshing all dashboard data...');
    try {
      // Force refresh all data sources
      await loadProjects(true);
      await loadEmployees(true);

      // Refresh the incomplete hours filter component
      if (incompleteHoursFilterRef.current) {
        incompleteHoursFilterRef.current.refreshData();
      }

      // Update last refresh timestamp
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error in loadDashboardData:', error);
    }
  }, [loadProjects, loadEmployees]);

  /**
   * Listen for refresh events from child components
   *
   * Sets up an event listener for the 'refresh-dashboard-data' custom event
   * that can be triggered by child components to request a dashboard refresh.
   */
  useEffect(() => {
    // Event handler for refresh events
    const handleRefreshEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('Received refresh event from child component:', customEvent.detail);

      // Trigger dashboard data refresh
      loadDashboardData();
    };

    // Register event listener
    window.addEventListener('refresh-dashboard-data', handleRefreshEvent);

    // Clean up event listener on component unmount
    return () => {
      window.removeEventListener('refresh-dashboard-data', handleRefreshEvent);
    };
  }, [loadDashboardData]);

  /**
   * Initialize dashboard data and set up auto-refresh
   *
   * This effect runs once when the component mounts and:
   * 1. Loads initial project and employee data
   * 2. Sets up an interval to automatically refresh data every 5 minutes
   * 3. Cleans up the interval when the component unmounts
   */
  useEffect(() => {
    // Load initial data
    loadProjects();
    loadEmployees();

    // Set up automatic refresh interval (every 5 minutes)
    const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
    refreshIntervalRef.current = setInterval(() => {
      refreshData();
    }, REFRESH_INTERVAL);

    // Clean up interval when component unmounts
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [loadProjects, loadEmployees, refreshData]);

  /**
   * Handle manual synchronization with the Gripp API
   *
   * This function is triggered by the sync button and performs a full
   * synchronization with the Gripp API, including:
   * 1. Calling the sync API endpoint
   * 2. Clearing local cache
   * 3. Fetching fresh data
   * 4. Updating the UI
   *
   * Includes multiple fallback mechanisms in case of errors.
   */
  const handleSync = useCallback(async () => {
    console.log('handleSync called');
    try {
      // Update UI to show syncing state
      setSyncing(true);

      // Show initial toast notification
      toast({
        title: "Synchronisatie gestart",
        description: "Projecten worden gesynchroniseerd...",
      });

      // Step 1: Call the sync API endpoint to trigger server-side sync
      const result = await syncProjects();
      console.log('Sync result:', result);

      // Step 2: Clear local cache to ensure fresh data
      try {
        console.log('Clearing IndexedDB cache...');
        await dbService.clearProjects();
        console.log('IndexedDB cache cleared');
      } catch (clearError) {
        console.error('Error clearing IndexedDB cache:', clearError);
      }

      // Step 3: Fetch and save fresh data
      try {
        console.log('Fetching fresh projects from API...');
        const timestamp = new Date().getTime();
        const freshProjects = await fetchActiveProjects(`?refresh=true&_t=${timestamp}`);

        if (freshProjects && freshProjects.length > 0) {
          console.log(`Retrieved ${freshProjects.length} projects after sync`);

          // Save to IndexedDB for future use
          await dbService.saveProjects(freshProjects);
          console.log('Projects saved to IndexedDB');

          // Wait a short time to ensure database operations are complete
          await new Promise(resolve => setTimeout(resolve, 800));

          // Update state with fresh data (create new array to ensure re-render)
          console.log('Updating state with fresh projects');
          setProjects([...freshProjects]);
          setLastRefresh(new Date());

          // Force refresh cache for other components
          await forceRefreshCache();

          // Show success notification
          toast({
            title: "Synchronisatie voltooid",
            description: `${freshProjects.length} projecten zijn bijgewerkt.`,
          });
        } else {
          // Handle case where no projects were returned
          console.warn('No projects received after sync');
          toast({
            title: "Synchronisatie waarschuwing",
            description: "Er zijn geen projecten ontvangen na synchronisatie.",
            variant: "destructive",
          });
        }
      } catch (dbError) {
        console.error('Error updating projects after sync:', dbError);

        // Fallback: Try direct API fetch without caching
        try {
          console.log('Attempting fallback refresh...');
          const timestamp = new Date().getTime();
          const fallbackProjects = await fetchActiveProjects(`?_t=${timestamp}`);
          if (fallbackProjects && fallbackProjects.length > 0) {
            setProjects([...fallbackProjects]);
            console.log('State updated with fallback projects');
          }
        } catch (fallbackError) {
          console.error('Fallback refresh failed:', fallbackError);
        }

        // Show error notification
        toast({
          title: "Synchronisatie fout",
          description: "Er is een fout opgetreden bij het bijwerken van de projecten.",
          variant: "destructive",
        });
      }

      // Step 4: Refresh other dashboard data
      loadDashboardData();
    } catch (error) {
      // Handle any unexpected errors in the sync process
      console.error('Error in sync process:', error);
      toast({
        title: "Synchronisatie fout",
        description: "Er is een fout opgetreden bij het synchroniseren.",
        variant: "destructive",
      });

      // Emergency fallback: Try one more time to update projects
      try {
        const timestamp = new Date().getTime();
        const emergencyProjects = await fetchActiveProjects(`?_t=${timestamp}`);
        if (emergencyProjects && emergencyProjects.length > 0) {
          setProjects([...emergencyProjects]);
        }
      } catch (emergencyError) {
        console.error('Emergency fallback failed:', emergencyError);
      }
    } finally {
      // Always reset syncing state when done
      setSyncing(false);
    }
  }, [loadDashboardData, toast]);

  /**
   * Calculate dashboard statistics from project data
   *
   * Computes various statistics including:
   * - Active project counts
   * - Budget totals
   * - Hour allocations and usage
   * - Progress percentages
   * - Deadline distributions by month
   *
   * Uses memoization to avoid recalculating on every render.
   */
  const stats = useMemo(() => {
    // Filter for active and deadline-having projects
    const activeProjects = projects.filter(p => !p.archived);
    const projectsWithDeadline = activeProjects.filter(p => p.deadline);

    // Calculate total budget across all active projects
    const totalBudget = activeProjects.reduce((sum, project) =>
      sum + parseFloat(project.totalexclvat || '0'), 0);

    // Calculate total allocated hours across all project lines
    const totalHours = activeProjects.reduce((sum, project) => {
      // Skip projects without valid project lines
      if (!project.projectlines || !Array.isArray(project.projectlines)) {
        return sum;
      }

      try {
        // Sum up allocated hours from all project lines
        const projectHours = project.projectlines.reduce((lineSum, line) =>
          lineSum + (line && line.amount ? line.amount : 0), 0);
        return sum + projectHours;
      } catch (error) {
        console.error('Error calculating project hours:', error);
        return sum; // Return current sum on error
      }
    }, 0);

    // Calculate total written (used) hours across all project lines
    const writtenHours = activeProjects.reduce((sum, project) => {
      // Skip projects without valid project lines
      if (!project.projectlines || !Array.isArray(project.projectlines)) {
        return sum;
      }

      try {
        // Sum up written hours from all project lines
        const projectWrittenHours = project.projectlines.reduce((lineSum, line) =>
          lineSum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0);
        return sum + projectWrittenHours;
      } catch (error) {
        console.error('Error calculating written hours:', error);
        return sum; // Return current sum on error
      }
    }, 0);

    // Calculate overall progress percentage
    const progressPercentage = totalHours > 0
      ? Math.min((writtenHours / totalHours) * 100, 100) // Cap at 100%
      : 0;

    // Group deadlines by month for visualization
    const deadlinesByMonth = projectsWithDeadline.reduce((acc, project) => {
      if (project.deadline) {
        const date = new Date(project.deadline.date);
        const month = date.toLocaleString('nl-NL', { month: 'long' });
        acc[month] = (acc[month] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Return computed statistics
    return {
      activeProjectsCount: activeProjects.length,
      projectsWithDeadlineCount: projectsWithDeadline.length,
      totalBudget,
      totalHours,
      writtenHours,
      progressPercentage,
      deadlinesByMonth
    };
  }, [projects]);

  /**
   * Determine if any critical dashboard data is missing
   *
   * Used to show a warning message when data might not be loading correctly
   */
  const isDataMissing =
    (loading && !projects?.length) ||
    (loading && !employees?.length) ||
    (loading && !stats.deadlinesByMonth) ||
    error;

  /**
   * Show a toast notification when data loads successfully
   *
   * This effect runs when loading completes and shows a success notification
   * with information about the loaded data. Only shows once per component mount.
   */
  useEffect(() => {
    if (!loading && !error && projects.length > 0 && !hasShownToast) {
      toast({
        title: "Dashboard Data Loaded",
        description: `Successfully loaded ${projects.length} projects and ${employees.length} employees.`,
        variant: "default",
      });
      setHasShownToast(true);
    }
  }, [loading, error, projects, employees, toast, hasShownToast]);

  /**
   * Render the dashboard UI
   */
  return (
    <div className="w-full py-8">
      {/* API Configuration Warning */}
      {isDataMissing && (
        <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 mb-6 rounded-md" role="alert">
          <p className="font-bold">API Configuration Notice</p>
          <p>This application requires the API server to run on port 3002 and the frontend on port 3000. If you see missing data, please ensure both servers are running on the correct ports.</p>
          <p className="mt-2 text-sm">Use <code className="bg-amber-200 px-1 rounded">npm run kill-api</code> followed by <code className="bg-amber-200 px-1 rounded">npm run api</code> to restart the API server correctly.</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Header with title and sync button */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Team Dashboard</h1>
          <Button
            onClick={handleSync}
            className="flex items-center gap-2"
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Synchroniseren...' : 'Synchroniseren'}
          </Button>
        </div>

        {/* Error message display */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Loading state or dashboard content */}
        {loading ? (
          <div className="text-center py-10">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-500">Dashboard data laden...</p>
          </div>
        ) : (
          <>
            {/* Main dashboard statistics */}
            <DashboardStats projects={projects} employees={employees} />

            {/* Project monitoring components */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <OverBudgetProjects projects={projects} />
              <IncompleteHoursFilter ref={incompleteHoursFilterRef} />
            </div>

            {/* Deadlines by month visualization */}
            <Card className="w-full">
              <CardHeader>
                <CardTitle>Deadlines per Maand</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {Object.entries(stats.deadlinesByMonth)
                    .sort(([, countA], [, countB]) => countB - countA)
                    .map(([month, count]) => (
                      <div key={month} className="space-y-1">
                        <div className="flex justify-between">
                          <span>{month}</span>
                          <span>{count}</span>
                        </div>
                        <Progress
                          value={(count / stats.projectsWithDeadlineCount) * 100}
                          className="h-2"
                        />
                      </div>
                    ))
                  }
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default TeamDashboardPage;