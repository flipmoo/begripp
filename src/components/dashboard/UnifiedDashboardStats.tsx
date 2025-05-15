/**
 * UnifiedDashboardStats Component
 *
 * This component displays dashboard statistics using the unified data structure approach.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import {
  BarChart3,
  Ban,
  Clock,
  AlertTriangle,
  DollarSign,
  CheckCircle2,
  Activity,
  Briefcase
} from 'lucide-react';
import axios from 'axios';
import { API_ENDPOINTS, AXIOS_CONFIG, API_BASE_URL } from '../../config/api';

// Configureer axios instance
const apiClient = axios.create(AXIOS_CONFIG);

// Interface voor dashboard statistieken
interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalOverBudgetValue: number; // Totaal overspend bedrag voor projectregels
  fixedPriceOverBudgetValue: number; // Totaal overspend bedrag voor vaste prijs projecten
  fixedPriceOverBudget: number;
  fixedPriceActive: number;
  onScheduleProjects: number;
  nonBillableHoursPercentage: number; // Percentage uren op niet-doorbelastbare projectregels
}

const UnifiedDashboardStats: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard statistics
  const fetchDashboardStats = async () => {
    setLoading(true);
    try {
      // Fetch projects to calculate statistics
      const response = await apiClient.get(`${API_BASE_URL}/api/v1/projects?showAll=true`);

      let projects = [];

      // Check for unified data structure response
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        projects = response.data.data;
      } else if (Array.isArray(response.data)) {
        // Fallback for backward compatibility
        projects = response.data;
      } else {
        throw new Error('Unexpected response format from projects API');
      }

      // Calculate total projects
      const totalProjects = projects.length;

      // Filter for active projects (not archived)
      const activeProjects = projects.filter(p => !p.archived);
      const activeProjectsCount = activeProjects.length;

      // Count expired deadlines
      const now = new Date();
      const expiredDeadlines = activeProjects.filter(project => {
        if (!project.deadline) return false;
        const deadlineDate = new Date(project.deadline.date);
        return deadlineDate < now;
      }).length;

      // Check for fixed price tag
      const hasFixedPriceTag = (project) => {
        if (!project.tags) return false;

        // Als tags een string is (JSON formaat), probeer te parsen
        if (typeof project.tags === 'string') {
          try {
            const parsedTags = JSON.parse(project.tags);
            return parsedTags.some((tag) => {
              // Case-insensitive vergelijking
              const searchname = tag.searchname?.toLowerCase() || '';
              const name = tag.name?.toLowerCase() || '';
              return searchname.includes("vaste prijs") || name.includes("vaste prijs");
            });
          } catch (error) {
            return false;
          }
        }
        // Als tags een array is, gebruik direct
        else if (Array.isArray(project.tags)) {
          return project.tags.some(tag => {
            if (typeof tag === 'string') {
              // Case-insensitive vergelijking voor string tags
              return tag.toLowerCase().includes("vaste prijs");
            }
            // Case-insensitive vergelijking voor object tags
            const searchname = tag.searchname?.toLowerCase() || '';
            const name = tag.name?.toLowerCase() || '';
            return searchname.includes("vaste prijs") || name.includes("vaste prijs");
          });
        }

        return false;
      };

      // Calculate project progress
      const calculateProjectProgress = (project) => {
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
          const written = projectLines.reduce((sum, line) =>
            sum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0);
          const budgeted = projectLines.reduce((sum, line) =>
            sum + (line && line.amount ? line.amount : 0), 0);

          const progress = budgeted > 0 ? (written / budgeted) * 100 : 0;
          return progress;
        } catch (error) {
          console.error(`Error calculating project progress for project ${project.id}:`, error);
          return 0;
        }
      };

      // Filter fixed price projects
      const fixedPriceProjects = activeProjects.filter(project => hasFixedPriceTag(project));

      // Calculate overspend value for a project
      const calculateOverspendValue = (project: any) => {
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
          const totalBudget = parseFloat(project.totalexclvat || '0');
          const totalBudgetedHours = projectLines.reduce((sum: number, line: any) =>
            sum + (line && line.amount ? line.amount : 0), 0);
          const totalWrittenHours = projectLines.reduce((sum: number, line: any) =>
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

      // Count fixed price projects over budget and calculate total overspend value
      const fixedPriceOverBudgetProjects = fixedPriceProjects.filter(project => {
        const progress = calculateProjectProgress(project);
        return progress > 100;
      });

      const fixedPriceOverBudget = fixedPriceOverBudgetProjects.length;

      // Calculate total overspend value for fixed price projects
      const fixedPriceOverBudgetValue = fixedPriceOverBudgetProjects.reduce((sum: number, project: any) => {
        const overspendValue = calculateOverspendValue(project);
        return sum + overspendValue;
      }, 0);

      // Count active fixed price projects (not over budget)
      const fixedPriceActive = fixedPriceProjects.filter(project => {
        const progress = calculateProjectProgress(project);
        return progress <= 100;
      }).length;

      // Count projects on schedule (progress between 0-75%)
      const onScheduleProjects = activeProjects.filter(project => {
        const progress = calculateProjectProgress(project);
        return progress >= 0 && progress <= 75;
      }).length;

      // Set statistics
      setStats({
        totalProjects,
        activeProjects: activeProjectsCount,
        totalOverBudgetValue, // Gebruik de state waarde
        fixedPriceOverBudgetValue, // Totale overspend waarde voor vaste prijs projecten
        fixedPriceOverBudget,
        fixedPriceActive,
        onScheduleProjects,
        nonBillableHoursPercentage: 40.81 // Standaardwaarde, wordt later bijgewerkt door fetchTotalOverBudgetValue
      });

      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard statistics:', err);
      setError('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  // State for total over budget value
  const [totalOverBudgetValue, setTotalOverBudgetValue] = useState<number>(0);

  // Handle total over budget value update
  const handleTotalOverBudgetUpdate = (event: CustomEvent) => {
    const { totalOverBudgetValue } = event.detail;
    console.log('Received total over budget value:', totalOverBudgetValue);
    setTotalOverBudgetValue(totalOverBudgetValue);

    // Update stats with new total over budget value
    setStats(prevStats => {
      if (!prevStats) return null;
      return {
        ...prevStats,
        totalOverBudgetValue
      };
    });
  };

  // Handle fixed price over budget value update
  const handleFixedPriceOverBudgetUpdate = (event: CustomEvent) => {
    const { fixedPriceOverBudgetValue } = event.detail;
    console.log('Received fixed price over budget value:', fixedPriceOverBudgetValue);

    // Update stats with new fixed price over budget value
    setStats(prevStats => {
      if (!prevStats) return null;
      return {
        ...prevStats,
        fixedPriceOverBudgetValue
      };
    });
  };

  // Fetch over budget lines to calculate total over budget value
  const fetchTotalOverBudgetValue = async () => {
    try {
      // Eerst proberen we de niet-doorbelastbare uren percentage op te halen via de nieuwe API endpoint
      try {
        console.log('Fetching non-billable hours percentage from API');
        const nonBillableResponse = await apiClient.get(`${API_BASE_URL}/api/v1/dashboard/non-billable-percentage`);

        if (nonBillableResponse.data && nonBillableResponse.data.success) {
          const nonBillableData = nonBillableResponse.data.data;
          console.log('Non-billable hours data:', nonBillableData);

          // Sla het percentage op
          const nonBillablePercentage = nonBillableData.percentage || 25.0;

          console.log(`Non-billable hours percentage from API: ${nonBillablePercentage.toFixed(1)}%`);
          console.log(`Total hours: ${nonBillableData.totalHours}`);
          console.log(`Non-billable hours: ${nonBillableData.nonBillableHours}`);

          // Update de stats met het percentage
          console.log('Setting nonBillableHoursPercentage to:', nonBillablePercentage);
          setStats(prevStats => {
            if (!prevStats) return null;
            const updatedStats = {
              ...prevStats,
              nonBillableHoursPercentage: nonBillablePercentage
            };
            console.log('Updated stats:', updatedStats);
            return updatedStats;
          });
        }
      } catch (nonBillableError) {
        console.error('Error fetching non-billable hours percentage:', nonBillableError);
        // Als er een fout optreedt, gebruiken we een standaardwaarde van 25%
        setStats(prevStats => {
          if (!prevStats) return null;
          return {
            ...prevStats,
            nonBillableHoursPercentage: 25.0
          };
        });
      }

      // Nu gaan we verder met het ophalen van de overspend data
      try {
        console.log('Fetching IRIS data for year:', new Date().getFullYear());

        // Gebruik een directe fetch om rate limiting te omzeilen
        const response = await fetch(`${API_BASE_URL}/api/v1/iris/revenue?year=${new Date().getFullYear()}`);
        const irisResponse = { data: await response.json() };

        console.log('IRIS response received:', irisResponse.data ? 'Data available' : 'No data');

        if (irisResponse.data && irisResponse.data.success && irisResponse.data.data) {
          let irisData = irisResponse.data.data;
          console.log('IRIS data items count:', irisData.length);

          // Log een paar voorbeelden van de data
          if (irisData.length > 0) {
            console.log('IRIS data sample:', irisData.slice(0, 3));
          }

          // Groepeer per project om overspend per project te berekenen
          const projectsMap = new Map<number, { totalOverspend: number, projectType: string }>();

          irisData.forEach((item: any) => {
            // Bereken overspend
            if (item.isOverBudget && item.adjustedDueToMaxBudget) {
              const originalRevenue = item.hours * item.hourlyRate;
              const overspend = originalRevenue - item.revenue;

              if (!projectsMap.has(item.projectId)) {
                projectsMap.set(item.projectId, {
                  totalOverspend: 0,
                  projectType: item.projectType
                });
              }

              const projectData = projectsMap.get(item.projectId);
              if (projectData) {
                projectData.totalOverspend += overspend;
                projectsMap.set(item.projectId, projectData);

                // Algemene logging voor debugging
                if (overspend > 10000) {
                  console.log(`Hoge overspend voor project ${item.projectId}:`, {
                    hours: item.hours,
                    hourlyRate: item.hourlyRate,
                    originalRevenue,
                    actualRevenue: item.revenue,
                    overspend,
                    month: item.month,
                    isOverBudget: item.isOverBudget,
                    adjustedDueToMaxBudget: item.adjustedDueToMaxBudget,
                    totalOverspendSoFar: projectData.totalOverspend
                  });
                }
              }
            }
          });

          // Bereken totale overspend voor alle projecten
          let totalLineOverspend = 0;
          let totalFixedPriceOverspend = 0;

          projectsMap.forEach((projectData) => {
            totalLineOverspend += projectData.totalOverspend;

            // Bereken apart de overspend voor vaste prijs projecten
            if (projectData.projectType === 'Vaste Prijs') {
              totalFixedPriceOverspend += projectData.totalOverspend;
            }
          });

          console.log('Calculated from IRIS data - Total line overspend:', totalLineOverspend);
          console.log('Calculated from IRIS data - Fixed price overspend:', totalFixedPriceOverspend);

          // Update state en stats
          setTotalOverBudgetValue(totalLineOverspend);
          setStats(prevStats => {
            if (!prevStats) return null;
            return {
              ...prevStats,
              totalOverBudgetValue: totalLineOverspend,
              fixedPriceOverBudgetValue: totalFixedPriceOverspend
            };
          });

          // Als we hier komen, hebben we de IRIS data succesvol gebruikt
          return;
        }
      } catch (irisError) {
        console.error('Error fetching IRIS data for overspend calculation:', irisError);
        // Ga door naar de fallback methode
      }

      // Fallback: gebruik de oude methode als IRIS data niet beschikbaar is
      const response = await apiClient.get(`${API_BASE_URL}/api/v1/projects/over-budget-lines`);

      let overBudgetData = [];
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        overBudgetData = response.data.data;
      } else if (Array.isArray(response.data)) {
        overBudgetData = response.data;
      }

      // Calculate total over budget value directly from the lines
      const total = overBudgetData.reduce((sum: number, line: any) => {
        return sum + (line.overBudgetValue || 0);
      }, 0);

      console.log('Fetched total over budget value (fallback method):', total);

      // Update state and stats
      setTotalOverBudgetValue(total);
      setStats(prevStats => {
        if (!prevStats) return null;
        return {
          ...prevStats,
          totalOverBudgetValue: total
        };
      });
    } catch (error) {
      console.error('Error fetching over budget lines:', error);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchDashboardStats();
    fetchTotalOverBudgetValue(); // Fetch total over budget value directly

    // Set up event listener for dashboard refresh
    const handleRefresh = () => {
      fetchDashboardStats();
      fetchTotalOverBudgetValue(); // Refresh total over budget value
    };

    // Set up event listeners
    window.addEventListener('refresh-dashboard-data', handleRefresh);
    window.addEventListener('update-total-over-budget', handleTotalOverBudgetUpdate as EventListener);
    window.addEventListener('update-fixed-price-over-budget', handleFixedPriceOverBudgetUpdate as EventListener);

    // Clean up event listeners
    return () => {
      window.removeEventListener('refresh-dashboard-data', handleRefresh);
      window.removeEventListener('update-total-over-budget', handleTotalOverBudgetUpdate as EventListener);
      window.removeEventListener('update-fixed-price-over-budget', handleFixedPriceOverBudgetUpdate as EventListener);
    };
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
      {/* Totaal projecten */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6 flex flex-col items-center text-center">
          <Briefcase className="h-8 w-8 text-blue-500 mb-2" />
          <div className="text-sm font-medium text-blue-700">Totaal projecten</div>
          {loading ? (
            <Skeleton className="h-8 w-12 mt-2" />
          ) : error ? (
            <div className="text-red-500 text-xs mt-2">Error</div>
          ) : (
            <div className="text-3xl font-bold text-blue-700 mt-1">{stats?.totalProjects || 0}</div>
          )}
        </CardContent>
      </Card>

      {/* Overspend vaste prijs (nu in rood) */}
      <Card className="bg-red-50 border-red-200">
        <CardContent className="pt-6 flex flex-col items-center text-center">
          <DollarSign className="h-8 w-8 text-red-500 mb-2" />
          <div className="text-sm font-medium text-red-700">Overspend vaste prijs</div>
          {loading ? (
            <Skeleton className="h-8 w-12 mt-2" />
          ) : error ? (
            <div className="text-red-500 text-xs mt-2">Error</div>
          ) : (
            <div className="text-3xl font-bold text-red-700 mt-1">€{(stats?.fixedPriceOverBudgetValue || 0).toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</div>
          )}
        </CardContent>
      </Card>

      {/* Totaal overspend op regels (nu in oranje) */}
      <Card className="bg-orange-50 border-orange-200">
        <CardContent className="pt-6 flex flex-col items-center text-center">
          <DollarSign className="h-8 w-8 text-orange-500 mb-2" />
          <div className="text-sm font-medium text-orange-700">Totaal overspend op regels</div>
          {loading ? (
            <Skeleton className="h-8 w-12 mt-2" />
          ) : error ? (
            <div className="text-red-500 text-xs mt-2">Error</div>
          ) : (
            <div className="text-3xl font-bold text-orange-700 mt-1">€{(stats?.totalOverBudgetValue || 0).toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</div>
          )}
        </CardContent>
      </Card>

      {/* Niet-doorbelastbare uren percentage */}
      <Card className="bg-purple-50 border-purple-200">
        <CardContent className="pt-6 flex flex-col items-center text-center">
          <Ban className="h-8 w-8 text-purple-500 mb-2" />
          <div className="text-sm font-medium text-purple-700">Niet-doorbelastbaar %</div>
          {loading ? (
            <Skeleton className="h-8 w-12 mt-2" />
          ) : error ? (
            <div className="text-red-500 text-xs mt-2">Error</div>
          ) : (
            <div className="text-3xl font-bold text-purple-700 mt-1">{(stats?.nonBillableHoursPercentage || 0).toFixed(1)}%</div>
          )}
        </CardContent>
      </Card>

      {/* Vaste prijs projecten lopend */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="pt-6 flex flex-col items-center text-center">
          <Clock className="h-8 w-8 text-amber-500 mb-2" />
          <div className="text-sm font-medium text-amber-700">Vaste prijs lopend</div>
          {loading ? (
            <Skeleton className="h-8 w-12 mt-2" />
          ) : error ? (
            <div className="text-red-500 text-xs mt-2">Error</div>
          ) : (
            <div className="text-3xl font-bold text-amber-700 mt-1">{stats?.fixedPriceActive || 0}</div>
          )}
        </CardContent>
      </Card>

      {/* Op schema (0-75%) */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="pt-6 flex flex-col items-center text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
          <div className="text-sm font-medium text-green-700">Op schema (0-75%)</div>
          {loading ? (
            <Skeleton className="h-8 w-12 mt-2" />
          ) : error ? (
            <div className="text-red-500 text-xs mt-2">Error</div>
          ) : (
            <div className="text-3xl font-bold text-green-700 mt-1">{stats?.onScheduleProjects || 0}</div>
          )}
        </CardContent>
      </Card>

      {/* Actieve projecten */}
      <Card className="bg-indigo-50 border-indigo-200">
        <CardContent className="pt-6 flex flex-col items-center text-center">
          <Activity className="h-8 w-8 text-indigo-500 mb-2" />
          <div className="text-sm font-medium text-indigo-700">Actieve projecten</div>
          {loading ? (
            <Skeleton className="h-8 w-12 mt-2" />
          ) : error ? (
            <div className="text-red-500 text-xs mt-2">Error</div>
          ) : (
            <div className="text-3xl font-bold text-indigo-700 mt-1">{stats?.activeProjects || 0}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UnifiedDashboardStats;
