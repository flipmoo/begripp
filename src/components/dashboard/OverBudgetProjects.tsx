import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { GrippProject } from '../../types/gripp';
import { Dialog, DialogContent } from '../ui/dialog';
import ProjectDetails from './ProjectDetails';
import { RefreshCw } from 'lucide-react';

// Add function to sync projects data
const syncProjectsData = async () => {
  try {
    // Use the project-specific sync endpoint
    const syncResponse = await fetch(`http://localhost:3004/api/v1/projects/sync`, {
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

    // Clear the cache
    const cacheResponse = await fetch(`http://localhost:3004/api/v1/cache/clear`, {
      method: 'POST',
    });

    if (!cacheResponse.ok) {
      const errorData = await cacheResponse.json().catch(() => null);
      console.error('Cache clear response error:', errorData);
      throw new Error(`Failed to clear cache: ${cacheResponse.status} ${cacheResponse.statusText}`);
    }

    const cacheData = await cacheResponse.json();
    console.log('Cache clear response:', cacheData);

    return true;
  } catch (error) {
    console.error('Error syncing projects data:', error);
    throw error; // Propageer de fout zodat we deze kunnen zien in de UI
  }
};

interface OverBudgetProjectsProps {
  projects: GrippProject[];
}

const OverBudgetProjects: React.FC<OverBudgetProjectsProps> = ({ projects }) => {
  const [selectedProject, setSelectedProject] = useState<GrippProject | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [syncingData, setSyncingData] = useState(false);

  // Format currency
  const formatCurrency = (value: number) => {
    return value.toLocaleString('nl-NL', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Get progress color based on percentage
  const getProgressColor = (progress: number) => {
    if (progress > 100) return 'text-red-500';
    if (progress >= 75) return 'text-amber-500';
    return 'text-green-500';
  };

  // Get progress indicator color for the bar
  const getProgressBarColor = (progress: number) => {
    if (progress > 100) return 'bg-red-500';
    if (progress >= 75) return 'bg-amber-500';
    return 'bg-green-500';
  };

  // Check if a project has "Vaste prijs" tag
  const hasFixedPriceTag = (project: GrippProject) => {
    console.log(`Checking fixed price tag for project ${project.id} (${project.name})`);

    if (!project.tags) {
      console.log(`Project ${project.id} has no tags`);
      return false;
    }

    // Als tags een string is (JSON formaat), probeer te parsen
    if (typeof project.tags === 'string') {
      console.log(`Project ${project.id} has tags as string: ${project.tags}`);
      try {
        const parsedTags = JSON.parse(project.tags);
        const hasFixedPrice = parsedTags.some((tag: { searchname?: string; name?: string }) => {
          // Case-insensitive vergelijking
          const searchname = tag.searchname?.toLowerCase() || '';
          const name = tag.name?.toLowerCase() || '';
          return searchname.includes("vaste prijs") || name.includes("vaste prijs");
        });
        console.log(`Project ${project.id} has fixed price tag: ${hasFixedPrice}`);
        return hasFixedPrice;
      } catch (error) {
        console.error(`Error parsing tags JSON for project ${project.id}:`, error);
        return false;
      }
    }
    // Als tags een array is, gebruik direct
    else if (Array.isArray(project.tags)) {
      console.log(`Project ${project.id} has tags as array:`, project.tags);
      const hasFixedPrice = project.tags.some(tag => {
        if (typeof tag === 'string') {
          // Case-insensitive vergelijking voor string tags
          return tag.toLowerCase().includes("vaste prijs");
        }
        // Case-insensitive vergelijking voor object tags
        const searchname = tag.searchname?.toLowerCase() || '';
        const name = tag.name?.toLowerCase() || '';
        return searchname.includes("vaste prijs") || name.includes("vaste prijs");
      });
      console.log(`Project ${project.id} has fixed price tag: ${hasFixedPrice}`);
      return hasFixedPrice;
    }

    console.log(`Project ${project.id} has tags of unknown type:`, typeof project.tags);
    return false;
  };

  // Calculate project progress
  const calculateProjectProgress = (project: GrippProject) => {
    console.log(`Calculating progress for project ${project.id} (${project.name})`);

    // Parse projectlines als het een string is
    let projectLines = [];
    if (project.projectlines) {
      if (typeof project.projectlines === 'string') {
        try {
          projectLines = JSON.parse(project.projectlines);
        } catch (error) {
          console.error(`Error parsing projectlines for project ${project.id}:`, error);
          return 0;
        }
      } else if (Array.isArray(project.projectlines)) {
        projectLines = project.projectlines;
      }
    }

    if (!projectLines || projectLines.length === 0) {
      console.log(`Project ${project.id} has no project lines or not an array`);
      return 0;
    }

    try {
      const written = projectLines.reduce((sum, line) =>
        sum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0);
      const budgeted = projectLines.reduce((sum, line) =>
        sum + (line && line.amount ? line.amount : 0), 0);

      const progress = budgeted > 0 ? (written / budgeted) * 100 : 0;
      console.log(`Project ${project.id}: written=${written}, budgeted=${budgeted}, progress=${progress}%`);

      return progress;
    } catch (error) {
      console.error(`Error calculating project progress for project ${project.id}:`, error);
      return 0;
    }
  };

  // Calculate project hourly rates
  const calculateProjectRates = (project: GrippProject) => {
    // Parse projectlines als het een string is
    let projectLines = [];
    if (project.projectlines) {
      if (typeof project.projectlines === 'string') {
        try {
          projectLines = JSON.parse(project.projectlines);
        } catch (error) {
          console.error(`Error parsing projectlines for project ${project.id}:`, error);
          return { startHourlyRate: 0, realizedHourlyRate: 0 };
        }
      } else if (Array.isArray(project.projectlines)) {
        projectLines = project.projectlines;
      }
    }

    if (!projectLines || projectLines.length === 0) {
      return { startHourlyRate: 0, realizedHourlyRate: 0 };
    }

    try {
      const totalBudget = parseFloat(project.budget || project.totalexclvat || '0');
      const totalBudgetedHours = projectLines.reduce((sum, line) =>
        sum + (line && line.amount ? line.amount : 0), 0);
      const totalWrittenHours = projectLines.reduce((sum, line) =>
        sum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0);

      const startHourlyRate = totalBudgetedHours > 0 ? totalBudget / totalBudgetedHours : 0;
      const realizedHourlyRate = totalWrittenHours > 0
        ? Math.min(totalBudget / totalWrittenHours, startHourlyRate)
        : 0;

      return { startHourlyRate, realizedHourlyRate };
    } catch (error) {
      console.error('Error calculating project rates:', error);
      return { startHourlyRate: 0, realizedHourlyRate: 0 };
    }
  };

  // Calculate hourly rate difference percentage
  const calculateHourlyRateDifference = (start: number, realized: number) => {
    if (start === 0) return 0;
    return ((realized - start) / start) * 100;
  };

  // Calculate total overspend value for a project
  const calculateOverspendValue = (project: GrippProject) => {
    // Parse projectlines als het een string is
    let projectLines = [];
    if (project.projectlines) {
      if (typeof project.projectlines === 'string') {
        try {
          projectLines = JSON.parse(project.projectlines);
        } catch (error) {
          console.error(`Error parsing projectlines for project ${project.id}:`, error);
          return 0;
        }
      } else if (Array.isArray(project.projectlines)) {
        projectLines = project.projectlines;
      }
    }

    if (!projectLines || projectLines.length === 0) {
      return 0;
    }

    try {
      const totalBudget = parseFloat(project.budget || project.totalexclvat || '0');
      const totalBudgetedHours = projectLines.reduce((sum, line) =>
        sum + (line && line.amount ? line.amount : 0), 0);
      const totalWrittenHours = projectLines.reduce((sum, line) =>
        sum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0);

      // Als het project over budget is (progress > 100%)
      if (totalBudgetedHours > 0 && totalWrittenHours > totalBudgetedHours) {
        const overBudgetHours = totalWrittenHours - totalBudgetedHours;
        const hourlyRate = totalBudget / totalBudgetedHours;
        return overBudgetHours * hourlyRate;
      }

      return 0;
    } catch (error) {
      console.error(`Error calculating overspend value for project ${project.id}:`, error);
      return 0;
    }
  };

  // Get all projects and show their budget status
  const overBudgetProjects = Array.isArray(projects) ? projects
    // Filter out archived projects
    .filter(project => {
      console.log(`Project ${project.id} (${project.name}) archived: ${project.archived}`);
      return !project.archived;
    })
    // Calculate progress and rates for each project
    .map(project => {
      const hasFixed = hasFixedPriceTag(project);
      const progress = calculateProjectProgress(project);
      const rates = calculateProjectRates(project);
      const overspendValue = calculateOverspendValue(project);
      console.log(`Project ${project.id} (${project.name}): hasFixed=${hasFixed}, progress=${progress}%, overspend=${overspendValue}, totalexclvat=${project.totalexclvat}, budget=${project.budget}`);
      return {
        ...project,
        hasFixedPrice: hasFixed,
        progress,
        overspendValue,
        ...rates
      };
    })
    // Sort by overspend value (highest first)
    .sort((a, b) => (b.overspendValue || 0) - (a.overspendValue || 0)) : [];

  // Calculate total overspend value for fixed price projects over budget
  useEffect(() => {
    if (overBudgetProjects.length > 0) {
      const fixedPriceOverBudgetProjects = overBudgetProjects.filter(p => p.hasFixedPrice && p.progress > 100);
      const totalOverspendValue = fixedPriceOverBudgetProjects.reduce((sum, project) => sum + (project.overspendValue || 0), 0);

      console.log('Total overspend value for fixed price projects:', totalOverspendValue);

      // Dispatch event with total overspend value for fixed price projects
      const fixedPriceOverBudgetEvent = new CustomEvent('update-fixed-price-over-budget', {
        detail: { fixedPriceOverBudgetValue: totalOverspendValue }
      });
      window.dispatchEvent(fixedPriceOverBudgetEvent);
    }
  }, [overBudgetProjects]);

  const handleProjectClick = (project: GrippProject) => {
    setSelectedProject(project);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
  };

  const handleRefreshProject = () => {
    setIsDialogOpen(false);
  };

  // Enhanced refresh handler that now actually syncs data
  const refreshProjects = async () => {
    setSyncingData(true);
    try {
      console.log('Syncing project data from Gripp...');
      const success = await syncProjectsData();

      // Dispatch event to refresh dashboard after successful sync
      const refreshEvent = new CustomEvent('refresh-dashboard-data');
      window.dispatchEvent(refreshEvent);

      // Toon een melding dat de synchronisatie is voltooid
      console.log('Project data successfully synced and dashboard refreshed');
    } catch (error) {
      console.error('Error during project sync:', error);
      // Hier zou je een toast of andere melding kunnen tonen aan de gebruiker
    } finally {
      setSyncingData(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Vaste Prijs Projecten Over Budget ({overBudgetProjects.filter(p => p.hasFixedPrice && p.progress > 100).length})
          </CardTitle>
          <button
            onClick={refreshProjects}
            disabled={syncingData}
            className="p-1 text-gray-500 hover:text-blue-500 focus:outline-none"
            title="Refresh projectdata from Gripp"
          >
            <RefreshCw className={`h-5 w-5 ${syncingData ? 'animate-spin text-blue-500' : ''}`} />
          </button>
        </CardHeader>
        <CardContent>
          {syncingData ? (
            <div className="text-center text-sm text-gray-500 py-8 flex flex-col items-center">
              <RefreshCw className="h-6 w-6 animate-spin mb-2" />
              Project gegevens worden gesynchroniseerd...
            </div>
          ) : overBudgetProjects.filter(p => p.hasFixedPrice && p.progress > 100).length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-8">
              Geen vaste prijs projecten over budget gevonden.
            </div>
          ) : (
            <div className="space-y-2">
              {overBudgetProjects.filter(p => p.hasFixedPrice && p.progress > 100).map((project) => (
                <div
                  key={`project-${project.id}`}
                  className={`border rounded-md overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                    project.progress > 100 ? 'border-red-300 bg-red-50' :
                    project.progress >= 75 && project.progress <= 100 ? 'border-amber-300 bg-amber-50' :
                    'border-green-300 bg-green-50'
                  }`}
                  onClick={() => handleProjectClick(project)}
                >
                  <div className="p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{project.name}</div>
                        <div className="text-sm font-medium text-blue-600 flex items-center">
                          <span className="mr-1">Klant:</span>
                          <span className="font-bold">
                          {(() => {
                            // Als company een object is met searchname
                            if (project.company && typeof project.company === 'object' && 'searchname' in project.company) {
                              return project.company.searchname;
                            }

                            // Als company een string is (mogelijk JSON)
                            if (typeof project.company === 'string') {
                              try {
                                const companyObj = JSON.parse(project.company);
                                if (companyObj && companyObj.searchname) {
                                  return companyObj.searchname;
                                }
                              } catch (e) {
                                // Als het geen geldige JSON is, gebruik de string zelf
                                return project.company;
                              }
                            }

                            // Fallback naar companyname of 'Geen klant'
                            return project.companyname || 'Geen klant';
                          })()}
                          </span>
                        </div>
                      </div>
                      <div className={`text-xs font-medium px-2 py-1 rounded-full ${
                        project.progress > 100 ? 'bg-red-200 text-red-800' :
                        project.progress >= 75 && project.progress <= 100 ? 'bg-amber-200 text-amber-800' :
                        'bg-green-200 text-green-800'
                      }`}>
                        {project.progress > 100 ? 'Over budget' :
                         project.progress >= 75 && project.progress <= 100 ? 'Waarschuwing' :
                         'Binnen budget'}
                      </div>
                    </div>

                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <span className={getProgressColor(project.progress)}>
                          {Math.round(project.progress)}%
                        </span>
                      </div>
                      <Progress
                        value={project.progress > 100 ? 100 : project.progress}
                        className={`h-2 ${getProgressBarColor(project.progress)}`}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <div className="text-xs text-gray-600">
                        Budget: {formatCurrency(parseFloat(project.budget || project.totalexclvat || '0'))}
                      </div>
                      <div className="text-xs text-red-500 font-medium px-2 py-1 bg-red-50 rounded-md">
                        Overspend: <span className="font-bold">{formatCurrency(project.overspendValue || 0)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="text-left">
                        <div className="text-xs text-gray-500">Start uurtarief</div>
                        <div className="text-sm font-medium text-gray-700">{formatCurrency(project.startHourlyRate)}</div>
                      </div>

                      <div className="flex items-center px-2">
                        {project.startHourlyRate > project.realizedHourlyRate ? (
                          <div className="flex items-center gap-1">
                            <span className="text-red-500 text-sm">→</span>
                            <span className="text-xs text-red-500 whitespace-nowrap">
                              -{Math.abs(Math.round(calculateHourlyRateDifference(project.startHourlyRate, project.realizedHourlyRate)))}%
                            </span>
                          </div>
                        ) : project.startHourlyRate < project.realizedHourlyRate ? (
                          <div className="flex items-center gap-1">
                            <span className="text-green-500 text-sm">→</span>
                            <span className="text-xs text-green-500 whitespace-nowrap">
                              +{Math.round(calculateHourlyRateDifference(project.startHourlyRate, project.realizedHourlyRate))}%
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <span className="text-gray-400 text-sm">=</span>
                            <span className="text-xs text-gray-400">0%</span>
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-gray-500">Gerealiseerd</div>
                        <div className={`text-sm font-medium ${
                          project.startHourlyRate > project.realizedHourlyRate
                            ? 'text-red-500'
                            : project.startHourlyRate < project.realizedHourlyRate
                              ? 'text-green-500'
                              : 'text-gray-700'
                        }`}>
                          {formatCurrency(project.realizedHourlyRate)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedProject && (
            <ProjectDetails
              project={selectedProject}
              onClose={handleCloseDialog}
              onRefresh={handleRefreshProject}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OverBudgetProjects;