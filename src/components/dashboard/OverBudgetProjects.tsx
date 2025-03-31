import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { GrippProject } from '../../types/gripp';
import { Dialog, DialogContent } from '../ui/dialog';
import ProjectDetails from './ProjectDetails';
import { RefreshCw } from 'lucide-react';

// Add function to sync projects data
const syncProjectsData = async () => {
  const currentYear = new Date().getFullYear();
  const startDate = `${currentYear}-01-01`;
  const endDate = `${currentYear}-12-31`;
  
  try {
    // Sync the data
    const syncResponse = await fetch(`/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ startDate, endDate }),
    });
    
    if (!syncResponse.ok) {
      throw new Error('Failed to sync data');
    }
    
    // Clear the cache
    const cacheResponse = await fetch('/api/cache/clear', {
      method: 'POST',
    });
    
    if (!cacheResponse.ok) {
      throw new Error('Failed to clear cache');
    }
    
    return true;
  } catch (error) {
    console.error('Error syncing projects data:', error);
    return false;
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
    if (!project.tags) return false;
    
    // Als tags een string is (JSON formaat), probeer te parsen
    if (typeof project.tags === 'string') {
      try {
        const parsedTags = JSON.parse(project.tags);
        return parsedTags.some((tag: { searchname?: string; name?: string }) => 
          (tag.searchname === "Vaste prijs") || (tag.name === "Vaste prijs")
        );
      } catch (error) {
        console.error('Error parsing tags JSON:', error);
        return false;
      }
    } 
    // Als tags een array is, gebruik direct
    else if (Array.isArray(project.tags)) {
      return project.tags.some(tag => {
        if (typeof tag === 'string') return tag === "Vaste prijs";
        return (tag.searchname === "Vaste prijs") || (tag.name === "Vaste prijs");
      });
    }
    return false;
  };
  
  // Calculate project progress
  const calculateProjectProgress = (project: GrippProject) => {
    if (!project.projectlines || !Array.isArray(project.projectlines)) return 0;
    
    try {
      const written = project.projectlines.reduce((sum, line) => 
        sum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0);
      const budgeted = project.projectlines.reduce((sum, line) => 
        sum + (line && line.amount ? line.amount : 0), 0);
      return budgeted > 0 ? (written / budgeted) * 100 : 0;
    } catch (error) {
      console.error('Error calculating project progress:', error);
      return 0;
    }
  };
  
  // Calculate project hourly rates
  const calculateProjectRates = (project: GrippProject) => {
    if (!project.projectlines || !Array.isArray(project.projectlines)) {
      return { startHourlyRate: 0, realizedHourlyRate: 0 };
    }
    
    try {
      const totalBudget = parseFloat(project.totalexclvat || '0');
      const totalBudgetedHours = project.projectlines.reduce((sum, line) => 
        sum + (line && line.amount ? line.amount : 0), 0);
      const totalWrittenHours = project.projectlines.reduce((sum, line) => 
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
  
  // Get projects that are over budget (progress > 100%) and have fixed price
  const overBudgetProjects = projects
    .filter(project => {
      const notArchived = !project.archived;
      return notArchived;
    })
    .filter(project => {
      const hasFixed = hasFixedPriceTag(project);
      return hasFixed;
    })
    .map(project => {
      const progress = calculateProjectProgress(project);
      const rates = calculateProjectRates(project);
      return {
        ...project,
        progress,
        ...rates
      };
    })
    .filter(project => {
      const isOverBudget = project.progress > 100;
      return isOverBudget;
    })
    .sort((a, b) => b.progress - a.progress);

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
      
      if (success) {
        // Dispatch event to refresh dashboard after successful sync
        const refreshEvent = new CustomEvent('refresh-dashboard-data');
        window.dispatchEvent(refreshEvent);
      }
    } catch (error) {
      console.error('Error during project sync:', error);
    } finally {
      setSyncingData(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            Overschreden Budget Projecten ({overBudgetProjects.length})
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
          ) : overBudgetProjects.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-8">
              Geen projecten met overschreden budget gevonden.
            </div>
          ) : (
            <div className="space-y-2">
              {overBudgetProjects.map((project) => (
                <div 
                  key={`project-${project.id}`}
                  className="border rounded-md overflow-hidden cursor-pointer transition-all hover:shadow-md"
                  onClick={() => handleProjectClick(project)}
                >
                  <div className="p-3">
                    <div className="font-medium">{project.name}</div>
                    
                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <span className={getProgressColor(project.progress)}>
                          {Math.round(project.progress)}%
                        </span>
                        <span className="text-xs text-gray-500">
                          {project.organizer 
                            ? `${project.organizer.firstname} ${project.organizer.lastname}` 
                            : 'Geen organisator'}
                        </span>
                      </div>
                      <Progress 
                        value={project.progress > 100 ? 100 : project.progress} 
                        className={`h-2 ${getProgressBarColor(project.progress)}`}
                      />
                    </div>
                    <div className="text-xs text-gray-600 mt-2">
                      Budget: {formatCurrency(parseFloat(project.totalexclvat || '0'))}
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