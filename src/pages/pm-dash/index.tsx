/**
 * Project Manager Dashboard Page
 *
 * This page displays project management statistics and insights including:
 * - Project statistics (count, budget, hours)
 * - Over-budget projects
 * - Incomplete hours
 * - Overdue invoices
 * - Projects by phase, client, and deadline month
 */

// React and hooks
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';

// Icons
import { RefreshCw } from 'lucide-react';

// Types
import { GrippProject } from '@/types/gripp';

// Services and APIs
import { fetchActiveProjects, syncProjects } from '@/api/dashboard/grippApi';
import { dbService } from '@/api/dashboard/dbService';
import {
  getEmployeeStats,
  EmployeeWithStats,
  clearEmployeeCache
} from '@/services/employee.service';

// Dashboard components
import OverBudgetProjects from '@/components/dashboard/OverBudgetProjects';
import IncompleteHoursFilter, { IncompleteHoursFilterRef } from '@/components/dashboard/IncompleteHoursFilter';
import DashboardStats from '@/components/dashboard/DashboardStats';
import OverdueInvoices from '@/components/dashboard/OverdueInvoices';

/**
 * Project Manager Dashboard Page Component
 *
 * Displays comprehensive project management statistics and insights
 * with data synchronization capabilities.
 */
const PMDashboardPage: React.FC = () => {
  const { toast } = useToast();

  // ===== Data State =====

  /**
   * Project data from Gripp API
   */
  const [projects, setProjects] = useState<GrippProject[]>([]);

  /**
   * Employee data with statistics
   */
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);

  // ===== UI State =====

  /**
   * Whether data is currently loading
   */
  const [loading, setLoading] = useState(true);

  /**
   * Error message to display
   */
  const [error, setError] = useState<string | null>(null);

  /**
   * Whether data is currently being synchronized
   */
  const [syncing, setSyncing] = useState(false);

  /**
   * Whether to refresh employee data during synchronization
   */
  const [shouldRefreshEmployees, setShouldRefreshEmployees] = useState(true);

  /**
   * Reference to the incomplete hours filter component
   */
  const incompleteHoursFilterRef = useRef<IncompleteHoursFilterRef>(null);

  /**
   * Load projects from cache or API
   *
   * This function attempts to load projects using the following strategy:
   * 1. Try to load from IndexedDB cache first
   * 2. If cache is empty or unavailable, fetch from API
   * 3. Update the cache with fresh data when fetching from API
   */
  const loadProjects = useCallback(async () => {
    try {
      // Update UI state to show loading
      setLoading(true);
      setError(null);

      // First try to load from IndexedDB cache
      try {
        console.log('Attempting to load projects from IndexedDB cache');
        const cachedProjects = await dbService.getAllProjects();

        if (cachedProjects && cachedProjects.length > 0) {
          console.log(`Loaded ${cachedProjects.length} projects from cache`);
          setProjects(cachedProjects);
          setLoading(false);
          return; // Exit early if we successfully loaded from cache
        } else {
          console.log('No projects found in cache or empty result');
        }
      } catch (dbError) {
        console.error('Error loading projects from IndexedDB:', dbError);
        // Continue to API fetch on cache error
      }

      // If we reach here, we need to fetch from API
      console.log('Fetching projects from API');
      const activeProjects = await fetchActiveProjects();

      if (activeProjects && activeProjects.length > 0) {
        console.log(`Fetched ${activeProjects.length} projects from API`);
        setProjects(activeProjects);

        // Update IndexedDB cache with fresh data
        try {
          console.log('Saving projects to IndexedDB cache');
          await dbService.saveProjects(activeProjects);
          console.log('Projects saved to cache successfully');
        } catch (dbError) {
          console.error('Error saving projects to IndexedDB:', dbError);
          // Non-critical error, don't show to user
        }
      } else {
        console.warn('No projects found from API');
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
   * Fetches employee data for the current week including hours,
   * availability, and other statistics.
   */
  const loadEmployees = useCallback(async () => {
    try {
      console.log('Loading employee data');

      // Get current date information
      const now = new Date();
      const currentYear = now.getFullYear();

      // Calculate current week number
      const currentWeek = Math.floor(now.getDate() / 7) + 1;

      console.log(`Fetching employee data for year ${currentYear}, week ${currentWeek}`);

      // Fetch employee data for the current year and week
      const result = await getEmployeeStats(currentYear, currentWeek);
      console.log(`Loaded ${result.data.length} employees`);

      // Update state with employee data
      setEmployees(result.data);
    } catch (err) {
      console.error('Error loading employees:', err);
      // Don't set error state here to avoid blocking the dashboard
      // if only employee data fails to load
    }
  }, []);

  /**
   * Load initial data when component mounts
   *
   * This effect runs once when the component mounts and:
   * 1. Loads project data (from cache or API)
   * 2. Loads employee data for the current week
   */
  useEffect(() => {
    console.log('PM Dashboard: Initial data loading');
    loadProjects();
    loadEmployees();
  }, [loadProjects, loadEmployees]);

  /**
   * Synchronize projects with the Gripp API
   *
   * This function performs a full synchronization process:
   * 1. Call the sync API endpoint to trigger server-side sync
   * 2. Wait for server processing to complete
   * 3. Fetch fresh data from API
   * 4. Update local state and cache
   * 5. Optionally refresh employee data
   */
  const handleSync = useCallback(async () => {
    try {
      // Update UI to show syncing state
      setSyncing(true);
      setError(null);

      // Show initial toast notification
      toast({
        title: "Synchronisatie gestart",
        description: "Dashboard data wordt gesynchroniseerd...",
      });

      // Step 1: Call the sync API endpoint to trigger server-side sync
      console.log('Starting project synchronization');
      await syncProjects();
      console.log('Sync request completed');

      // Step 2: Wait for server processing to complete
      toast({
        title: "Database bijwerken",
        description: "Project database wordt bijgewerkt...",
      });

      // Give the server time to process the sync request
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Fetch fresh data from API
      toast({
        title: "Data opnieuw laden",
        description: "Projecten worden opnieuw geladen van de server...",
      });

      console.log('Forcing projects refresh');

      // Fetch with cache busting
      const timestamp = new Date().getTime();
      const refreshedProjects = await fetchActiveProjects(`?refresh=true&_t=${timestamp}`);

      // Step 4: Process the fetched data
      if (refreshedProjects && refreshedProjects.length > 0) {
        console.log(`Successfully loaded ${refreshedProjects.length} projects after sync`);

        // Update state with fresh data
        setProjects(refreshedProjects);

        // Update IndexedDB cache for future use
        try {
          console.log('Saving projects to IndexedDB cache');
          await dbService.saveProjects(refreshedProjects);
          console.log('Projects saved to IndexedDB cache');
        } catch (dbError) {
          console.error('Error saving projects to IndexedDB:', dbError);
          // Non-critical error, continue
        }

        // Step 5: Optionally refresh employee data
        if (shouldRefreshEmployees) {
          console.log('Refreshing employee data');
          try {
            // Clear employee cache to force refresh
            clearEmployeeCache();
            const refreshedEmployeeStats = await getEmployeeStats();
            setEmployees(refreshedEmployeeStats.data);
            console.log(`Refreshed ${refreshedEmployeeStats.data.length} employees`);
          } catch (employeeError) {
            console.error('Error refreshing employee data:', employeeError);
            // Non-critical error, continue
          }
        }

        // Show success notification
        toast({
          title: "Synchronisatie voltooid",
          description: `Dashboard data is bijgewerkt met ${refreshedProjects.length} projecten.`,
          variant: "default",
        });
      } else {
        // Handle case where no projects were returned
        console.error('No projects returned after sync or empty array');
        setError('Geen projecten gevonden na synchronisatie');

        toast({
          title: "Waarschuwing",
          description: "Geen projecten gevonden na synchronisatie.",
          variant: "destructive",
        });
      }
    } catch (err) {
      // Handle errors in the sync process
      console.error('Error syncing projects:', err);
      setError('Er is een fout opgetreden bij het synchroniseren van de projecten');

      toast({
        title: "Synchronisatie mislukt",
        description: "Er is een fout opgetreden bij het synchroniseren van de projecten.",
        variant: "destructive",
      });
    } finally {
      // Always reset syncing state when done
      setSyncing(false);
    }
  }, [toast, shouldRefreshEmployees]);

  /**
   * Calculate dashboard statistics from project data
   *
   * Computes various statistics including:
   * - Active project counts
   * - Budget totals
   * - Hour allocations and usage
   * - Progress percentages
   * - Project distributions by phase, client, and deadline month
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

    // Group projects by phase
    const phaseCount = activeProjects.reduce((acc, project) => {
      const phase = project.phase?.searchname || 'Onbekend';
      acc[phase] = (acc[phase] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group projects by client
    const clientCount = activeProjects.reduce((acc, project) => {
      const client = project.company?.searchname || 'Onbekend';
      acc[client] = (acc[client] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

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
      phaseCount,
      clientCount,
      deadlinesByMonth
    };
  }, [projects]);

  /**
   * Render the PM dashboard UI
   */
  return (
    <div className="space-y-6">
      {/* ===== Page Header ===== */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">PM Dashboard</h1>

        {/* Synchronization button */}
        <Button
          onClick={handleSync}
          className="flex items-center gap-2"
          disabled={syncing}
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Synchroniseren...' : 'Synchroniseren'}
        </Button>
      </div>

      {/* ===== Error Message ===== */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* ===== Loading State or Dashboard Content ===== */}
      {loading ? (
        // Loading indicator
        <div className="text-center py-10">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="mt-2 text-gray-500">Dashboard data laden...</p>
        </div>
      ) : (
        <>
          {/* ===== Main Dashboard Statistics ===== */}
          <DashboardStats projects={projects} employees={employees} />

          {/* ===== Project Monitoring Components ===== */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <OverBudgetProjects projects={projects} />
            <IncompleteHoursFilter ref={incompleteHoursFilterRef} />
            <OverdueInvoices />
          </div>

          {/* ===== Projects by Phase Visualization ===== */}
          <Card>
            <CardHeader>
              <CardTitle>Projecten per Fase</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats.phaseCount)
                  .sort(([, countA], [, countB]) => countB - countA) // Sort by count descending
                  .map(([phase, count]) => (
                    <div key={phase} className="space-y-1">
                      <div className="flex justify-between">
                        <span>{phase}</span>
                        <span>{count}</span>
                      </div>
                      <Progress
                        value={(count / stats.activeProjectsCount) * 100}
                        className="h-2"
                      />
                    </div>
                  ))
                }
              </div>
            </CardContent>
          </Card>

          {/* ===== Projects by Client Visualization ===== */}
          <Card>
            <CardHeader>
              <CardTitle>Projecten per Klant</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats.clientCount)
                  .sort(([, countA], [, countB]) => countB - countA) // Sort by count descending
                  .slice(0, 5) // Show only top 5 clients
                  .map(([client, count]) => (
                    <div key={client} className="space-y-1">
                      <div className="flex justify-between">
                        <span>{client}</span>
                        <span>{count}</span>
                      </div>
                      <Progress
                        value={(count / stats.activeProjectsCount) * 100}
                        className="h-2"
                      />
                    </div>
                  ))
                }
              </div>
            </CardContent>
          </Card>

          {/* ===== Deadlines by Month Visualization ===== */}
          <Card>
            <CardHeader>
              <CardTitle>Deadlines per Maand</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats.deadlinesByMonth)
                  .sort(([, countA], [, countB]) => countB - countA) // Sort by count descending
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
  );
};

export default PMDashboardPage;