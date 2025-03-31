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
import OverBudgetProjects from '../../components/dashboard/OverBudgetProjects';
import IncompleteHoursFilter, { IncompleteHoursFilterRef } from '@/components/dashboard/IncompleteHoursFilter';
import DashboardStats from '../../components/dashboard/DashboardStats';
import OverdueInvoices from '../../components/dashboard/OverdueInvoices';

const PMDashboardPage: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<GrippProject[]>([]);
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const incompleteHoursFilterRef = useRef<IncompleteHoursFilterRef>(null);
  const [shouldRefreshEmployees, setShouldRefreshEmployees] = useState(true);

  // Laad projecten functie met useCallback om re-renders te voorkomen
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

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

      // Als er geen gecachte projecten zijn, haal ze op van de API
      const activeProjects = await fetchActiveProjects();
      if (activeProjects && activeProjects.length > 0) {
        setProjects(activeProjects);
        
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
  const loadEmployees = useCallback(async () => {
    try {
      // Get current date
      const now = new Date();
      const currentYear = now.getFullYear();
      
      // Get current week
      const currentWeek = Math.floor(now.getDate() / 7) + 1;
      
      // Fetch employee data for the current year and week
      const result = await getEmployeeStats(currentYear, currentWeek);
      setEmployees(result.data); // Gebruik .data om de werknemersarray te krijgen
    } catch (err) {
      console.error('Error loading employees:', err);
      // Don't set error state here to avoid blocking the dashboard if only employee data fails
    }
  }, []);

  // Laad projecten en medewerkers bij het laden van de pagina
  useEffect(() => {
    loadProjects();
    loadEmployees();
  }, [loadProjects, loadEmployees]);

  // Synchroniseer projecten met de Gripp API
  const handleSync = useCallback(async () => {
    try {
      setSyncing(true);
      setError(null);
      
      toast({
        title: "Synchronisatie gestart",
        description: "Dashboard data wordt gesynchroniseerd...",
      });
      
      // Alleen projecten synchroniseren, employee cache behouden
      console.log('Starting project synchronization');
      await syncProjects();
      console.log('Sync request completed');
      
      // Wacht kort om de server tijd te geven om de database bij te werken
      toast({
        title: "Database bijwerken",
        description: "Project database wordt bijgewerkt...",
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Laad de bijgewerkte projecten met force refresh
      toast({
        title: "Data opnieuw laden",
        description: "Projecten worden opnieuw geladen van de server...",
      });
      
      console.log('Forcing projects refresh');
      
      // Forceer een directe refresh van de API
      const timestamp = new Date().getTime();
      const refreshedProjects = await fetchActiveProjects(`?refresh=true&_t=${timestamp}`);
      
      if (refreshedProjects && refreshedProjects.length > 0) {
        console.log(`Successfully loaded ${refreshedProjects.length} projects after sync`);
        
        // Update state direct met de nieuwe projecten
        setProjects(refreshedProjects);
        
        // Werk ook IndexedDB bij voor toekomstige laadcycli
        try {
          await dbService.saveProjects(refreshedProjects);
          console.log('Projects saved to IndexedDB cache');
        } catch (dbError) {
          console.error('Error saving projects to IndexedDB:', dbError);
        }
        
        // Refresh de employees data alleen als nodig
        if (shouldRefreshEmployees) {
          console.log('Refreshing employee data');
          try {
            // Clear employee cache to force refresh
            clearEmployeeCache();
            const refreshedEmployeeStats = await getEmployeeStats();
            setEmployees(refreshedEmployeeStats);
          } catch (employeeError) {
            console.error('Error refreshing employee data:', employeeError);
          }
        }
        
        toast({
          title: "Synchronisatie voltooid",
          description: `Dashboard data is bijgewerkt met ${refreshedProjects.length} projecten.`,
          variant: "default",
        });
      } else {
        console.error('No projects returned after sync or empty array');
        setError('Geen projecten gevonden na synchronisatie');
        toast({
          title: "Waarschuwing",
          description: "Geen projecten gevonden na synchronisatie.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Error syncing projects:', err);
      setError('Er is een fout opgetreden bij het synchroniseren van de projecten');
      toast({
        title: "Synchronisatie mislukt",
        description: "Er is een fout opgetreden bij het synchroniseren van de projecten.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }, [toast, shouldRefreshEmployees]);

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
    
    // Bereken projecten per fase
    const phaseCount = activeProjects.reduce((acc, project) => {
      const phase = project.phase?.searchname || 'Onbekend';
      acc[phase] = (acc[phase] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Bereken projecten per klant
    const clientCount = activeProjects.reduce((acc, project) => {
      const client = project.company?.searchname || 'Onbekend';
      acc[client] = (acc[client] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Bereken projecten met deadline per maand
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
      phaseCount,
      clientCount,
      deadlinesByMonth
    };
  }, [projects]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">PM Dashboard</h1>
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

          {/* Nieuwe componenten */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <OverBudgetProjects projects={projects} />
            <IncompleteHoursFilter ref={incompleteHoursFilterRef} />
            <OverdueInvoices />
          </div>

          {/* Projecten per fase */}
          <Card>
            <CardHeader>
              <CardTitle>Projecten per Fase</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats.phaseCount)
                  .sort(([, countA], [, countB]) => countB - countA)
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

          {/* Projecten per klant */}
          <Card>
            <CardHeader>
              <CardTitle>Projecten per Klant</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(stats.clientCount)
                  .sort(([, countA], [, countB]) => countB - countA)
                  .slice(0, 5) // Toon alleen top 5
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

          {/* Deadlines per maand */}
          <Card>
            <CardHeader>
              <CardTitle>Deadlines per Maand</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
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
  );
};

export default PMDashboardPage; 