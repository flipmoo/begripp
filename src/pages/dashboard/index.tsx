import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { RefreshCw } from 'lucide-react';
import { useToast } from '../../components/ui/use-toast';
import { GrippProject } from '../../types/gripp';
import { fetchActiveProjects, syncProjects } from '../../api/dashboard/grippApi';
import { dbService } from '../../api/dashboard/dbService';
import { getEmployeeStats, EmployeeWithStats, clearEmployeeCache } from '../../services/employee.service';
import { forceRefreshCache } from '../../api/dashboard/utils';
import OverBudgetProjects from '../../components/dashboard/OverBudgetProjects';
import IncompleteHoursFilter, { IncompleteHoursFilterRef } from '@/components/dashboard/IncompleteHoursFilter';
import DashboardStats from '../../components/dashboard/DashboardStats';
import { useEmployeeStore } from '../../stores/employees';
import { useDashboardStore } from '../../stores/dashboard';
import { useProjectsStore } from '../../stores/projects';
import { formatDate } from '../../utils/date';
import { Skeleton } from '../../components/ui/skeleton';
import EmployeeAvailability from '../../components/dashboard/EmployeeAvailability';
import RevenueChart from '../../components/dashboard/RevenueChart';
import ProjectDeadlines from '../../components/dashboard/ProjectDeadlines';

const TeamDashboardPage: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<GrippProject[]>([]);
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const incompleteHoursFilterRef = useRef<IncompleteHoursFilterRef>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [hasShownToast, setHasShownToast] = useState(false);

  // Laad projecten functie met useCallback om re-renders te voorkomen
  const loadProjects = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);

      // Als forceRefresh true is, haal meteen op van API
      if (forceRefresh) {
        console.log('Force refresh requested, clearing IndexedDB cache and fetching from API');
        
        try {
          // Clear the IndexedDB projects cache
          await dbService.clearProjects();
        } catch (clearError) {
          console.error('Error clearing IndexedDB cache:', clearError);
        }
        
        // Fetch fresh data from API with timestamp
        const timestamp = new Date().getTime();
        const activeProjects = await fetchActiveProjects(`?refresh=true&_t=${timestamp}`);
        
        if (activeProjects && activeProjects.length > 0) {
          setProjects(activeProjects);
          setLastRefresh(new Date());
          
          // Save projects to IndexedDB
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

      // Probeer eerst projecten uit de IndexedDB te laden
      try {
        const cachedProjects = await dbService.getAllProjects();
        if (cachedProjects && cachedProjects.length > 0) {
          setProjects(cachedProjects);
          setLoading(false);
          return;
        }
      } catch (dbError) {
        console.error('Error loading projects from IndexedDB:', dbError);
      }

      // Als er geen gecachte projecten zijn of forceRefresh is true, haal ze op van de API
      // Voeg timestamp toe om cache busting te forceren
      const timestamp = new Date().getTime();
      const activeProjects = await fetchActiveProjects(`?_t=${timestamp}`);
      
      if (activeProjects && activeProjects.length > 0) {
        setProjects(activeProjects);
        setLastRefresh(new Date());
        
        // Sla projecten op in IndexedDB
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

  // Laad medewerker gegevens
  const loadEmployees = useCallback(async (forceRefresh = false) => {
    try {
      console.log(`Loading employees with forceRefresh=${forceRefresh}`);
      
      // Get current date
      const now = new Date();
      const currentYear = now.getFullYear();
      
      // Get current week
      const currentWeek = Math.floor(now.getDate() / 7) + 1;
      
      // Clear employee cache if force refresh is requested
      if (forceRefresh) {
        console.log('Force refresh requested, clearing employee cache');
        await clearEmployeeCache();
      }
      
      // Fetch employee data for the current year and week with timestamp to bust cache
      const timestamp = Date.now();
      const result = await getEmployeeStats(currentYear, currentWeek, forceRefresh, timestamp);
      
      console.log(`Loaded ${result.data.length} employees`);
      setEmployees(result.data); // Gebruik .data om de werknemersarray te krijgen
    } catch (err) {
      console.error('Error loading employees:', err);
      // Don't set error state here to avoid blocking the dashboard if only employee data fails
    }
  }, []);

  // Automatisch verversing van dashboard data
  const refreshData = useCallback(async (showToast = false) => {
    console.log('Automatically refreshing dashboard data...');
    try {
      await loadProjects(true);
      await loadEmployees(true);
      
      // Refresh incomplete hours filter
      if (incompleteHoursFilterRef.current) {
        incompleteHoursFilterRef.current.refreshData();
      }
      
      setLastRefresh(new Date());
      
      if (showToast) {
        toast({
          title: "Dashboard bijgewerkt",
          description: "Dashboard data is automatisch ververst.",
          variant: "default",
        });
      }
    } catch (err) {
      console.error('Error refreshing dashboard data:', err);
      if (showToast) {
        toast({
          title: "Verversen mislukt",
          description: "Er is een fout opgetreden bij het verversen van de dashboard data.",
          variant: "destructive",
        });
      }
    }
  }, [loadProjects, loadEmployees, toast]);

  // Refresh data with existing functions
  const loadDashboardData = useCallback(async () => {
    console.log('loadDashboardData: Refreshing all dashboard data...');
    try {
      await loadProjects(true);
      await loadEmployees(true);
      
      // Refresh incomplete hours filter
      if (incompleteHoursFilterRef.current) {
        incompleteHoursFilterRef.current.refreshData();
      }
      
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error in loadDashboardData:', error);
    }
  }, [loadProjects, loadEmployees]);

  // Listen for refresh events from child components
  useEffect(() => {
    const handleRefreshEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('Received refresh event from child component:', customEvent.detail);
      
      // Just use the regular refresh
      loadDashboardData();
    };
    
    // Add event listener
    window.addEventListener('refresh-dashboard-data', handleRefreshEvent);
    
    // Clean up
    return () => {
      window.removeEventListener('refresh-dashboard-data', handleRefreshEvent);
    };
  }, [loadDashboardData]);

  // Laad projecten en medewerkers bij het laden van de pagina
  useEffect(() => {
    loadProjects();
    loadEmployees();
    
    // Start refresh interval
    refreshIntervalRef.current = setInterval(() => {
      refreshData();
    }, 5 * 60 * 1000); // Ververs elke 5 minuten
    
    // Cleanup interval bij unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [loadProjects, loadEmployees, refreshData]);

  // Handle synchronization of projects with the Gripp API
  const handleSync = useCallback(async () => {
    console.log('handleSync called');
    try {
      setSyncing(true);
      
      toast({
        title: "Synchronisatie gestart",
        description: "Projecten worden gesynchroniseerd...",
      });
      
      // Call synchronize API endpoint
      const result = await syncProjects();
      console.log('Sync result:', result);
      
      // Clear the local database to ensure we get fresh data
      try {
        console.log('Clearing IndexedDB cache...');
        await dbService.clearProjects();
        console.log('IndexedDB cache cleared');
      } catch (clearError) {
        console.error('Error clearing IndexedDB cache:', clearError);
      }
      
      // Save projects to cache
      try {
        console.log('Fetching fresh projects from API...');
        const timestamp = new Date().getTime();
        const freshProjects = await fetchActiveProjects(`?refresh=true&_t=${timestamp}`);
        
        if (freshProjects && freshProjects.length > 0) {
          console.log(`Retrieved ${freshProjects.length} projects after sync`);
          
          // Save to IndexedDB
          await dbService.saveProjects(freshProjects);
          console.log('Projects saved to IndexedDB');
          
          // Wait a short time to ensure database operations are complete
          await new Promise(resolve => setTimeout(resolve, 800));
          
          // Force an update with the new projects to ensure component re-renders
          console.log('Updating state with fresh projects');
          setProjects([...freshProjects]);
          setLastRefresh(new Date());
          
          // Force refresh cache for other components that might use the data
          await forceRefreshCache();
          
          toast({
            title: "Synchronisatie voltooid",
            description: `${freshProjects.length} projecten zijn bijgewerkt.`,
          });
        } else {
          console.warn('No projects received after sync');
          toast({
            title: "Synchronisatie waarschuwing",
            description: "Er zijn geen projecten ontvangen na synchronisatie.",
            variant: "destructive",
          });
        }
      } catch (dbError) {
        console.error('Error updating projects after sync:', dbError);
        
        // Attempt direct state update as fallback
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
        
        toast({
          title: "Synchronisatie fout",
          description: "Er is een fout opgetreden bij het bijwerken van de projecten.",
          variant: "destructive",
        });
      }
      
      // Refresh other dashboard data
      loadDashboardData();
    } catch (error) {
      console.error('Error in sync process:', error);
      toast({
        title: "Synchronisatie fout",
        description: "Er is een fout opgetreden bij het synchroniseren.",
        variant: "destructive",
      });
      
      // Try one more time to update projects as fallback
      try {
        const timestamp = new Date().getTime();
        const emergencyProjects = await fetchActiveProjects(`?_t=${timestamp}`);
        if (emergencyProjects && emergencyProjects.length > 0) {
          setProjects([...emergencyProjects]);
        }
      } catch {}
    } finally {
      setSyncing(false);
    }
  }, [loadDashboardData, toast]);

  // Bereken statistieken
  const stats = useMemo(() => {
    const activeProjects = projects.filter(p => !p.archived);
    const projectsWithDeadline = activeProjects.filter(p => p.deadline);
    
    // Bereken totaal budget
    const totalBudget = activeProjects.reduce((sum, project) => 
      sum + parseFloat(project.totalexclvat || '0'), 0);
    
    // Bereken totaal aantal uren
    const totalHours = activeProjects.reduce((sum, project) => {
      if (!project.projectlines || !Array.isArray(project.projectlines)) {
        return sum;
      }
      
      try {
        const projectHours = project.projectlines.reduce((lineSum, line) => 
          lineSum + (line && line.amount ? line.amount : 0), 0);
        return sum + projectHours;
      } catch (error) {
        console.error('Error calculating project hours:', error);
        return sum;
      }
    }, 0);
    
    // Bereken geschreven uren
    const writtenHours = activeProjects.reduce((sum, project) => {
      if (!project.projectlines || !Array.isArray(project.projectlines)) {
        return sum;
      }
      
      try {
        const projectWrittenHours = project.projectlines.reduce((lineSum, line) => 
          lineSum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0);
        return sum + projectWrittenHours;
      } catch (error) {
        console.error('Error calculating written hours:', error);
        return sum;
      }
    }, 0);
    
    // Bereken voortgang percentage
    const progressPercentage = totalHours > 0 ? (writtenHours / totalHours) * 100 : 0;
    
    // Bereken deadlines per maand
    const deadlinesByMonth = projectsWithDeadline.reduce((acc, project) => {
      if (project.deadline) {
        const date = new Date(project.deadline.date);
        const month = date.toLocaleString('nl-NL', { month: 'long' });
        acc[month] = (acc[month] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
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

  // Check if any dashboard data is missing
  const isDataMissing = 
    (loading && !projects?.length) || 
    (loading && !employees?.length) || 
    (loading && !stats.deadlinesByMonth) ||
    error;

  // Show a toast notification when data loads successfully
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

  return (
    <div className="w-full py-8">
      {isDataMissing && (
        <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 mb-6 rounded-md" role="alert">
          <p className="font-bold">API Configuration Notice</p>
          <p>This application requires the API server to run on port 3002 and the frontend on port 3000. If you see missing data, please ensure both servers are running on the correct ports.</p>
          <p className="mt-2 text-sm">Use <code className="bg-amber-200 px-1 rounded">npm run kill-api</code> followed by <code className="bg-amber-200 px-1 rounded">npm run api</code> to restart the API server correctly.</p>
        </div>
      )}
      
      <div className="space-y-6">
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

        {/* Foutmelding */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Laad indicator */}
        {loading ? (
          <div className="text-center py-10">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-500">Dashboard data laden...</p>
          </div>
        ) : (
          <>
            {/* Dashboard Statistieken */}
            <DashboardStats projects={projects} employees={employees} />

            {/* Nieuwe componenten - side by side instead of stacked */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <OverBudgetProjects projects={projects} />
              <IncompleteHoursFilter ref={incompleteHoursFilterRef} />
            </div>

            {/* Deadlines per maand */}
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