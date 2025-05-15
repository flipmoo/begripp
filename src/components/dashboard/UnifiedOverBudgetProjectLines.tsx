/**
 * UnifiedOverBudgetProjectLines Component
 *
 * This component displays project lines that are over budget
 * using the unified data structure approach.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { Skeleton } from '../../components/ui/skeleton';
import { RefreshCw, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import axios from 'axios';
import { API_ENDPOINTS, AXIOS_CONFIG, API_BASE_URL } from '../../config/api';
import { GrippProject, GrippProjectLine } from '../../types/gripp';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import ProjectDetails from './ProjectDetails';

// Configureer axios instance
const apiClient = axios.create(AXIOS_CONFIG);

// Interface voor project line met progress
interface ProjectLineWithProgress extends GrippProjectLine {
  projectId: number;
  projectName: string;
  progress: number;
  written: number;
  budgeted: number;
  discipline: string;
  projectTotalProgress: number; // Totale voortgang van het project
  clientName: string; // Klantnaam
  overBudgetHours: number; // Uren over budget
  overBudgetValue: number; // Waarde van uren over budget
  hourlyRate: number; // Uurtarief
}

// Interface voor gegroepeerde projectregels
interface GroupedProjectLines {
  projectId: number;
  projectName: string;
  projectTotalProgress: number;
  clientName: string; // Klantnaam
  totalOverBudgetValue: number; // Totale waarde van uren over budget
  totalBudget: number; // Totaal budget in euro's
  remainingBudget: number; // Restant beschikbaar budget in euro's
  lines: ProjectLineWithProgress[];
}

const UnifiedOverBudgetProjectLines: React.FC = () => {
  const [overBudgetProjects, setOverBudgetProjects] = useState<GroupedProjectLines[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingData, setSyncingData] = useState<boolean>(false);
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});
  const [selectedProject, setSelectedProject] = useState<GrippProject | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Format currency without the € symbol
  const formatCurrencyValue = (value: number) => {
    return new Intl.NumberFormat('nl-NL', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Get progress color based on percentage
  const getProgressColor = (progress: number) => {
    if (progress > 100) return 'text-red-500';
    if (progress >= 75) return 'text-amber-500';
    return 'text-green-500';
  };

  // Get progress bar color based on percentage
  const getProgressBarColor = (progress: number) => {
    if (progress > 100) return 'bg-red-500';
    if (progress >= 75) return 'bg-amber-500';
    return 'bg-green-500';
  };

  // Fetch projects and calculate over budget lines
  const fetchOverBudgetLines = async () => {
    setLoading(true);
    try {
      // Fetch projects
      const response = await apiClient.get(API_ENDPOINTS.DASHBOARD.PROJECTS);

      let projects: GrippProject[] = [];

      // Check for unified data structure response
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        projects = response.data.data;
      } else if (Array.isArray(response.data)) {
        // Fallback for backward compatibility
        projects = response.data;
      } else {
        throw new Error('Unexpected response format from projects API');
      }

      // Filter for active projects
      const activeProjects = projects.filter(p => !p.archived);

      // Calculate total progress for each project
      const projectProgressMap = new Map<number, number>();

      activeProjects.forEach(project => {
        // Parse projectlines als het een string is
        let projectLines = [];
        if (project.projectlines) {
          if (typeof project.projectlines === 'string') {
            try {
              projectLines = JSON.parse(project.projectlines);
            } catch (error) {
              console.error(`Error parsing projectlines for project ${project.id}:`, error);
              projectLines = [];
            }
          } else if (Array.isArray(project.projectlines)) {
            projectLines = project.projectlines;
          }
        }

        if (projectLines && projectLines.length > 0) {
          const totalBudgeted = projectLines.reduce((sum, line) =>
            sum + (line && line.amount ? line.amount : 0), 0);

          const totalWritten = projectLines.reduce((sum, line) =>
            sum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0);

          const totalProgress = totalBudgeted > 0 ? (totalWritten / totalBudgeted) * 100 : 0;
          projectProgressMap.set(project.id, totalProgress);
        }
      });

      // Extract all project lines and calculate progress
      const allProjectLines: ProjectLineWithProgress[] = [];

      activeProjects.forEach(project => {
        // Parse projectlines als het een string is
        let projectLines = [];
        if (project.projectlines) {
          if (typeof project.projectlines === 'string') {
            try {
              projectLines = JSON.parse(project.projectlines);
            } catch (error) {
              console.error(`Error parsing projectlines for project ${project.id}:`, error);
              projectLines = [];
            }
          } else if (Array.isArray(project.projectlines)) {
            projectLines = project.projectlines;
          }
        }

        if (projectLines && projectLines.length > 0) {
          projectLines.forEach(line => {
            if (!line || line.rowtype?.id === 2) return; // Skip null lines or group labels

            const budgeted = line.amount || 0;
            if (budgeted <= 0) return; // Skip lines without budget

            const written = line.amountwritten ? parseFloat(line.amountwritten) : 0;
            const progress = (written / budgeted) * 100;

            // Calculate over budget hours
            const overBudgetHours = progress > 100 ? written - budgeted : 0;

            // Get hourly rate from selling price
            const hourlyRate = line.sellingprice ? parseFloat(line.sellingprice) : 0;

            // Calculate value of over budget hours
            const overBudgetValue = overBudgetHours * hourlyRate;

            // Get discipline name from product
            const discipline = line.product?.searchname || 'Unknown';

            // Get client name
            let clientName = 'Geen klant';

            // Als company een object is met searchname
            if (project.company && typeof project.company === 'object' && 'searchname' in project.company) {
              clientName = project.company.searchname;
            }
            // Als company een string is (mogelijk JSON)
            else if (typeof project.company === 'string') {
              try {
                const companyObj = JSON.parse(project.company);
                if (companyObj && companyObj.searchname) {
                  clientName = companyObj.searchname;
                }
              } catch (e) {
                // Als het geen geldige JSON is, gebruik de string zelf
                clientName = project.company;
              }
            }
            // Fallback naar companyname
            else if (project.companyname) {
              clientName = project.companyname;
            }

            allProjectLines.push({
              ...line,
              projectId: project.id,
              projectName: project.name,
              progress,
              written,
              budgeted,
              discipline,
              projectTotalProgress: projectProgressMap.get(project.id) || 0,
              clientName,
              overBudgetHours,
              overBudgetValue,
              hourlyRate
            });
          });
        }
      });

      // Filter for over budget lines (progress > 100%) in projects that are still under budget
      const overBudgetLines = allProjectLines
        .filter(line => line.progress > 100 && line.projectTotalProgress <= 100)
        .sort((a, b) => b.overBudgetValue - a.overBudgetValue); // Sort by highest over budget value

      // Create a map of project budgets
      const projectBudgetMap = new Map<number, { totalBudget: number, usedBudget: number }>();

      // Calculate total budget and used budget for each project
      activeProjects.forEach(project => {
        if (project.totalexclvat) {
          const totalBudget = parseFloat(project.totalexclvat);

          // Calculate used budget based on written hours and hourly rates
          let usedBudget = 0;

          // Parse projectlines als het een string is
          let projectLines = [];
          if (project.projectlines) {
            if (typeof project.projectlines === 'string') {
              try {
                projectLines = JSON.parse(project.projectlines);
              } catch (error) {
                console.error(`Error parsing projectlines for project ${project.id}:`, error);
                projectLines = [];
              }
            } else if (Array.isArray(project.projectlines)) {
              projectLines = project.projectlines;
            }
          }

          if (projectLines && projectLines.length > 0) {
            projectLines.forEach(line => {
              if (line && line.amountwritten && line.sellingprice) {
                const written = parseFloat(line.amountwritten);
                const hourlyRate = parseFloat(line.sellingprice);
                usedBudget += written * hourlyRate;
              }
            });
          }

          projectBudgetMap.set(project.id, { totalBudget, usedBudget });
        }
      });

      // Group by project ID
      const groupedByProject = overBudgetLines.reduce((acc, line) => {
        if (!acc[line.projectId]) {
          // Get budget information for this project
          const budgetInfo = projectBudgetMap.get(line.projectId) || { totalBudget: 0, usedBudget: 0 };
          const totalBudget = budgetInfo.totalBudget;
          const usedBudget = budgetInfo.usedBudget;
          const remainingBudget = totalBudget - usedBudget;

          acc[line.projectId] = {
            projectId: line.projectId,
            projectName: line.projectName,
            projectTotalProgress: line.projectTotalProgress,
            clientName: line.clientName,
            totalOverBudgetValue: 0, // Will be calculated below
            totalBudget,
            remainingBudget,
            lines: []
          };
        }
        acc[line.projectId].lines.push(line);
        // Add this line's over budget value to the project total
        acc[line.projectId].totalOverBudgetValue += line.overBudgetValue;
        return acc;
      }, {});

      // Convert back to array and sort by project with highest total over budget value
      const sortedProjects = Object.values(groupedByProject).map(project => {
        // Sort lines within each project by highest over budget value
        project.lines.sort((a, b) => b.overBudgetValue - a.overBudgetValue);
        return project;
      }).sort((a, b) => b.totalOverBudgetValue - a.totalOverBudgetValue);

      // Calculate total over budget value across all projects
      const totalOverBudgetValue = sortedProjects.reduce((sum, project) =>
        sum + project.totalOverBudgetValue, 0);

      console.log('Total over budget value from UnifiedOverBudgetProjectLines:', totalOverBudgetValue);

      // Dispatch event with total over budget value for the dashboard stats
      const totalOverBudgetEvent = new CustomEvent('update-total-over-budget', {
        detail: { totalOverBudgetValue }
      });
      window.dispatchEvent(totalOverBudgetEvent);

      setOverBudgetProjects(sortedProjects);
      setError(null);
    } catch (err) {
      console.error('Error fetching over budget project lines:', err);
      setError('Failed to load over budget project lines');
    } finally {
      setLoading(false);
    }
  };

  // Sync projects data
  const syncProjectsData = async () => {
    setSyncingData(true);
    try {
      // Use the project-specific sync endpoint
      const syncResponse = await fetch(`${API_BASE_URL}/api/v1/projects/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!syncResponse.ok) {
        const errorData = await syncResponse.json().catch(() => null);
        console.error('Sync response error:', errorData);
        throw new Error(`Failed to sync data: ${syncResponse.status} ${syncResponse.statusText}`);
      }

      const syncData = await syncResponse.json();
      console.log('Sync response:', syncData);

      // Clear the cache using the project-specific endpoint
      const cacheResponse = await fetch(`${API_BASE_URL}/api/v1/cache/clear`, {
        method: 'POST',
      });

      if (!cacheResponse.ok) {
        const errorData = await cacheResponse.json().catch(() => null);
        console.error('Cache clear response error:', errorData);
        throw new Error(`Failed to clear cache: ${cacheResponse.status} ${cacheResponse.statusText}`);
      }

      const cacheData = await cacheResponse.json();
      console.log('Cache clear response:', cacheData);

      // Refresh data
      await fetchOverBudgetLines();

      // Dispatch event to refresh dashboard
      const refreshEvent = new CustomEvent('refresh-dashboard-data');
      window.dispatchEvent(refreshEvent);

      console.log('Project data successfully synced and dashboard refreshed');
    } catch (error) {
      console.error('Error during project sync:', error);
      setError('Failed to sync project data');
    } finally {
      setSyncingData(false);
    }
  };

  // Toggle expanded state for a project
  const toggleProjectExpanded = (projectId: number) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  // Open project details modal
  const openProjectDetails = async (projectId: number) => {
    try {
      setLoading(true);
      // Fetch the full project details
      const response = await apiClient.get(API_ENDPOINTS.DASHBOARD.PROJECT_DETAILS(projectId));

      if (response.data && response.data.success) {
        setSelectedProject(response.data.data);
      } else if (response.data) {
        // Fallback for backward compatibility
        setSelectedProject(response.data);
      } else {
        throw new Error('Unexpected response format from project details API');
      }

      setIsDialogOpen(true);
    } catch (err) {
      console.error('Error fetching project details:', err);
      setError('Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  // Close project details modal
  const closeProjectDetails = () => {
    setIsDialogOpen(false);
    setSelectedProject(null);
  };

  // Handle refresh project
  const handleRefreshProject = () => {
    closeProjectDetails();
    fetchOverBudgetLines();
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchOverBudgetLines();

    // Set up event listener for dashboard refresh
    const handleRefresh = () => {
      fetchOverBudgetLines();
    };

    window.addEventListener('refresh-dashboard-data', handleRefresh);

    // Clean up event listener
    return () => {
      window.removeEventListener('refresh-dashboard-data', handleRefresh);
    };
  }, []);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Project Regels Over Budget (Project Binnen Budget) ({overBudgetProjects.length})
          </CardTitle>
          <button
            onClick={syncProjectsData}
            disabled={syncingData}
            className="p-1 text-gray-500 hover:text-blue-500 focus:outline-none"
            title="Refresh project data from Gripp"
          >
            <RefreshCw className={`h-5 w-5 ${syncingData ? 'animate-spin text-blue-500' : ''}`} />
          </button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : error ? (
            <div className="text-center text-sm text-red-500 py-8">
              {error}
            </div>
          ) : syncingData ? (
            <div className="text-center text-sm text-gray-500 py-8 flex flex-col items-center">
              <RefreshCw className="h-6 w-6 animate-spin mb-2" />
              Project gegevens worden gesynchroniseerd...
            </div>
          ) : overBudgetProjects.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-8">
              Geen project regels gevonden die over budget zijn terwijl het project binnen budget is.
            </div>
          ) : (
            <div className="w-full">
              {overBudgetProjects.map((project) => (
                <div
                  key={`project-${project.projectId}`}
                  className="border border-gray-200 rounded-md mb-4 hover:shadow-sm"
                >
                  <div className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <div className="font-medium">{project.projectName}</div>
                        <div className="text-sm font-medium text-blue-600 flex items-center">
                          <span className="mr-1">Klant:</span>
                          <span className="font-bold">{project.clientName}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-green-600 font-medium px-2 py-1 bg-green-50 rounded-full">
                          Project: {Math.round(project.projectTotalProgress)}%
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mb-1">
                      <div className="text-xs text-gray-500">
                        {project.lines.length} {project.lines.length === 1 ? 'regel' : 'regels'} over budget
                      </div>
                      <div className="text-xs text-red-500 font-medium px-2 py-1 bg-red-50 rounded-md">
                        Totaal overspend: <span className="font-bold">€{formatCurrencyValue(project.totalOverBudgetValue)}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mb-3">
                      <div className="text-xs text-gray-500">
                        Totaal budget: €{formatCurrencyValue(project.totalBudget)}
                      </div>
                      <div className={`text-xs font-medium px-2 py-1 rounded-md ${
                        project.remainingBudget > 0
                          ? 'text-green-600 bg-green-50'
                          : 'text-red-500 bg-red-50'
                      }`}>
                        Restant budget: <span className="font-bold">€{formatCurrencyValue(project.remainingBudget)}</span>
                      </div>
                    </div>

                    <div className="space-y-3 mt-3 border-t pt-3">
                      <div className="flex justify-between items-center">
                        <button
                          onClick={() => toggleProjectExpanded(project.projectId)}
                          className="flex items-center gap-2 text-left p-2 hover:bg-gray-50 rounded-md"
                        >
                          <span className="text-sm font-medium">
                            {expandedProjects[project.projectId] ? 'Verberg details' : 'Toon details'}
                          </span>
                          {expandedProjects[project.projectId] ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>

                        <button
                          onClick={() => openProjectDetails(project.projectId)}
                          className="flex items-center gap-1 text-sm text-blue-600 p-2 hover:bg-blue-50 rounded-md"
                        >
                          <span>Project details</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>

                      {expandedProjects[project.projectId] && (
                        <div className="space-y-3 mt-2">
                          {project.lines.map((line, index) => (
                            <div key={`line-${line.id}-${index}`} className="border-b pb-3 last:border-b-0 last:pb-0">
                              <div className="flex justify-between items-center">
                                <div className="font-medium text-sm">{line.discipline}</div>
                                <div className="text-xs text-red-500 font-medium px-2 py-1 bg-red-50 rounded-full">
                                  {Math.round(line.progress)}%
                                </div>
                              </div>

                              <div className="flex justify-between items-center mt-1 text-xs text-gray-500">
                                <span>{line.written.toFixed(1)} / {line.budgeted.toFixed(1)} uur</span>
                                <span className="text-red-500 font-medium">
                                  +{line.overBudgetHours.toFixed(1)} uur <span className="font-bold">(€{formatCurrencyValue(line.overBudgetValue)})</span>
                                </span>
                              </div>

                              <Progress
                                value={Math.min(line.progress, 150)} // Cap at 150% for visual clarity
                                className="h-2 mt-2"
                                indicatorClassName={`${line.progress > 100 ? 'bg-red-600' : 'bg-blue-600'}`}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Details Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedProject && (
            <ProjectDetails
              project={selectedProject}
              onClose={closeProjectDetails}
              onRefresh={handleRefreshProject}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default UnifiedOverBudgetProjectLines;
