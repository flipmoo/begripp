import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { GrippProject } from '../../types/gripp';
import { CalendarClock, Users, Building, Tag, FileText, Clock, ArrowLeft, BarChart2, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface ProjectDetailsProps {
  project: GrippProject;
  onClose: () => void;
  onRefresh?: () => void;
}

type ViewMode = 'all' | 'combined';

const ProjectDetails: React.FC<ProjectDetailsProps> = ({ project, onClose, onRefresh }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [syncing, setSyncing] = useState(false);

  // Format currency
  const formatCurrency = (value: number) => {
    return value.toLocaleString('nl-NL', { 
      style: 'currency', 
      currency: 'EUR',
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  // Handle sync button click
  const handleSync = async () => {
    if (syncing) return;
    
    try {
      setSyncing(true);
      // If onRefresh is provided, call it to refresh the project data
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Error syncing project data:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Bereken project voortgang
  const calculateProgress = () => {
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

  const progress = calculateProgress();
  
  // Functie om progress bar kleur te bepalen op basis van voortgang
  const getProgressBarColor = (progressValue: number) => {
    if (progressValue > 100) return 'bg-red-500';
    if (progressValue >= 75) return 'bg-amber-500';
    return 'bg-green-500';
  };

  // Format deadline
  const formatDate = (dateObj: { date: string } | null) => {
    if (!dateObj) return 'Niet ingesteld';
    
    try {
      const date = new Date(dateObj.date);
      return date.toLocaleDateString('nl-NL', { 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Ongeldige datum';
    }
  };

  // Bereken voortgang per projectregel
  const projectLinesWithProgress = useMemo(() => {
    if (!project.projectlines || !Array.isArray(project.projectlines)) return [];
    
    try {
      // Calculate total budget from either sellingprice or totalexclvat
      const totalBudget = parseFloat(project.totalexclvat || '0');
      
      // Calculate total budgeted hours
      const totalBudgetedHours = project.projectlines.reduce((sum, line) => 
        sum + (line && line.amount ? line.amount : 0), 0);
      
      return project.projectlines
        .filter((line): line is NonNullable<typeof line> => line !== null && line !== undefined)
        .map(line => {
          const budgeted = line.amount || 0;
          const written = line.amountwritten ? parseFloat(line.amountwritten) : 0;
          const progress = budgeted > 0 ? (written / budgeted) * 100 : 0;
          
          // Gebruik sellingprice als start uurtarief
          const sellingPrice = line.sellingprice ? parseFloat(line.sellingprice) : 
            (budgeted > 0 ? (budgeted / totalBudgetedHours) * totalBudget / budgeted : 0);
          
          // Bereken het totale bedrag (sellingprice * budgeted hours)
          const totalAmount = sellingPrice * budgeted;
          
          // Start uurtarief is nu direct het sellingprice
          const startHourlyRate = sellingPrice;
          
          // Bereken gerealiseerd uurtarief (totaal bedrag / geschreven uren)
          // Maximaal het start uurtarief
          const realizedHourlyRate = written > 0 
            ? Math.min(totalAmount / written, startHourlyRate) 
            : 0;
          
          return {
            ...line,
            progress,
            written,
            startHourlyRate,
            realizedHourlyRate,
            sellingPrice,
            totalAmount
          };
        })
        .filter(line => line.amount > 0); // Filter regels zonder budget
    } catch (error) {
      console.error('Error calculating project lines progress:', error);
      return [];
    }
  }, [project.projectlines, project.totalexclvat]);

  // Bereken gecombineerde voortgang per discipline
  const combinedProjectLines = useMemo(() => {
    if (!project.projectlines || !Array.isArray(project.projectlines)) return [];
    
    try {
      const totalBudget = parseFloat(project.totalexclvat || '0');
      const totalBudgetedHours = project.projectlines.reduce((sum, line) => 
        sum + (line && line.amount ? line.amount : 0), 0);
      const defaultHourlyRate = totalBudgetedHours > 0 ? totalBudget / totalBudgetedHours : 0;
      
      const disciplines = new Map<string, { 
        budgeted: number, 
        written: number, 
        description: string,
        count: number,
        totalSellingPrice: number,
        totalAmount: number
      }>();
      
      // Filter null/undefined lines eerst
      const validLines = project.projectlines.filter((line): line is NonNullable<typeof line> => 
        line !== null && line !== undefined
      );
      
      validLines.forEach(line => {
        if (!line.amount) return; // Skip regels zonder budget
        
        const discipline = line.product?.searchname || 'Overig';
        const budgeted = line.amount || 0;
        const written = line.amountwritten ? parseFloat(line.amountwritten) : 0;
        
        // Gebruik sellingprice als uurtarief
        const sellingPrice = line.sellingprice ? parseFloat(line.sellingprice) : 
          (budgeted > 0 ? (budgeted / totalBudgetedHours) * totalBudget / budgeted : 0);
        
        // Bereken het totale bedrag voor deze regel
        const totalAmount = sellingPrice * budgeted;
        
        if (disciplines.has(discipline)) {
          const existing = disciplines.get(discipline)!;
          disciplines.set(discipline, {
            budgeted: existing.budgeted + budgeted,
            written: existing.written + written,
            description: existing.description,
            count: existing.count + 1,
            totalSellingPrice: existing.totalSellingPrice + sellingPrice,
            totalAmount: existing.totalAmount + totalAmount
          });
        } else {
          disciplines.set(discipline, {
            budgeted,
            written,
            description: line.description || '',
            count: 1,
            totalSellingPrice: sellingPrice,
            totalAmount: totalAmount
          });
        }
      });
      
      return Array.from(disciplines.entries()).map(([discipline, data]) => {
        const progress = data.budgeted > 0 ? (data.written / data.budgeted) * 100 : 0;
        
        // Gemiddeld uurtarief voor de discipline
        const startHourlyRate = data.budgeted > 0 ? data.totalAmount / data.budgeted : defaultHourlyRate;
        
        // Bereken gerealiseerd uurtarief
        const realizedHourlyRate = data.written > 0 
          ? Math.min(data.totalAmount / data.written, startHourlyRate) 
          : 0;
        
        return {
          discipline,
          budgeted: data.budgeted,
          written: data.written,
          progress,
          description: data.description,
          count: data.count,
          startHourlyRate,
          realizedHourlyRate,
          totalSellingPrice: data.totalSellingPrice,
          totalAmount: data.totalAmount
        };
      }).sort((a, b) => b.budgeted - a.budgeted);
    } catch (error) {
      console.error('Error calculating combined project lines:', error);
      return [];
    }
  }, [project.projectlines, project.totalexclvat]);

  // Bereken totale start en gerealiseerd uurtarief voor het project
  const projectRates = useMemo(() => {
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
  }, [project.projectlines, project.totalexclvat]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button 
            onClick={onClose}
            variant="outline"
            size="icon"
            className="h-8 w-8"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold">{project.name}</h2>
        </div>
        <Button
          onClick={handleSync}
          variant="outline"
          size="sm"
          disabled={syncing}
          className="flex items-center gap-1"
        >
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          <span>{syncing ? 'Bijwerken...' : 'Vernieuwen'}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basis informatie */}
        <Card>
          <CardHeader>
            <CardTitle>Projectinformatie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Klant:</span>
              <span>{project.company?.searchname || 'Onbekend'}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Fase:</span>
              <span>{project.phase?.searchname || 'Onbekend'}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Nummer:</span>
              <span>#{project.number}</span>
            </div>
            
            {project.color && (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: project.color }}></div>
                <span className="font-medium">Projectkleur:</span>
                <span>{project.color}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Teamleden:</span>
              <span>{project.employees_starred?.length || 0}</span>
            </div>
          </CardContent>
        </Card>

        {/* Deadlines */}
        <Card>
          <CardHeader>
            <CardTitle>Planning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Start datum:</span>
              <span>{formatDate(project.startdate)}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Deadline:</span>
              <span>{formatDate(project.deadline)}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Opleverdatum:</span>
              <span>{formatDate(project.deliverydate)}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Einddatum:</span>
              <span>{formatDate(project.enddate)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Voortgang */}
        <Card>
          <CardHeader>
            <CardTitle>Voortgang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Totale voortgang</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" indicatorClassName={getProgressBarColor(progress)} />
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Geschreven uren:</span>
              <span>
                {project.projectlines && Array.isArray(project.projectlines) ? 
                  project.projectlines.reduce((sum, line) => 
                    sum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0).toFixed(2) 
                  : '0.00'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="font-medium">Gebudgetteerde uren:</span>
              <span>
                {project.projectlines && Array.isArray(project.projectlines) ? 
                  project.projectlines.reduce((sum, line) => 
                    sum + (line && line.amount ? line.amount : 0), 0).toFixed(2) 
                  : '0.00'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Budget */}
        <Card>
          <CardHeader>
            <CardTitle>Budget</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="font-medium">Totaal excl. BTW:</span>
              <span className="text-lg">
                € {parseFloat(project.totalexclvat || '0').toLocaleString('nl-NL', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-medium">Totaal incl. BTW:</span>
              <span className="text-lg">
                € {parseFloat(project.totalinclvat || '0').toLocaleString('nl-NL', { 
                  minimumFractionDigits: 2, 
                  maximumFractionDigits: 2 
                })}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-medium">Start uurtarief:</span>
              <span>{formatCurrency(projectRates.startHourlyRate)}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-medium">Gerealiseerd uurtarief:</span>
              <span>{formatCurrency(projectRates.realizedHourlyRate)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projectregels met voortgang */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Projectregels</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
            <TabsList>
              <TabsTrigger value="all" className="flex items-center gap-1">
                <FileText className="h-4 w-4" />
                <span>Alle regels</span>
              </TabsTrigger>
              <TabsTrigger value="combined" className="flex items-center gap-1">
                <BarChart2 className="h-4 w-4" />
                <span>Gecombineerd</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="mt-4">
              <div className="space-y-6">
                {projectLinesWithProgress.length === 0 ? (
                  <p className="text-gray-500">Geen projectregels met budget gevonden.</p>
                ) : (
                  projectLinesWithProgress.map((line) => (
                    <div key={line.id} className="space-y-2">
                      <div className="flex flex-col">
                        <div className="flex justify-between">
                          <span className="font-medium">{line.product?.searchname || 'Onbekend'}</span>
                          <span>{Math.round(line.progress)}%</span>
                        </div>
                        <p className="text-sm text-gray-500">{line.description}</p>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{line.written.toFixed(2)} / {line.amount.toFixed(2)} uur</span>
                        <span>
                          Start: {formatCurrency(line.startHourlyRate)} | 
                          Gerealiseerd: {formatCurrency(line.realizedHourlyRate)} | 
                          Waarde: {formatCurrency(line.totalAmount)}
                        </span>
                      </div>
                      <Progress value={line.progress} className="h-2" indicatorClassName={getProgressBarColor(line.progress)} />
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="combined" className="mt-4">
              <div className="space-y-6">
                {combinedProjectLines.length === 0 ? (
                  <p className="text-gray-500">Geen projectregels met budget gevonden.</p>
                ) : (
                  combinedProjectLines.map((line) => (
                    <div key={line.discipline} className="space-y-2">
                      <div className="flex flex-col">
                        <div className="flex justify-between">
                          <span className="font-medium">{line.discipline} ({line.count})</span>
                          <span>{Math.round(line.progress)}%</span>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{line.written.toFixed(2)} / {line.budgeted.toFixed(2)} uur</span>
                        <span>
                          Start: {formatCurrency(line.startHourlyRate)} | 
                          Gerealiseerd: {formatCurrency(line.realizedHourlyRate)} | 
                          Waarde: {formatCurrency(line.totalAmount)}
                        </span>
                      </div>
                      <Progress value={line.progress} className="h-2" indicatorClassName={getProgressBarColor(line.progress)} />
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Beschrijving */}
      {project.description && (
        <Card>
          <CardHeader>
            <CardTitle>Beschrijving</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <div dangerouslySetInnerHTML={{ __html: project.description }} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProjectDetails; 