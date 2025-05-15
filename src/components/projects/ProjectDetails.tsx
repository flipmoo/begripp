import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Progress } from '../../components/ui/progress';
import { RefreshCw, X, BarChart2, FileText } from 'lucide-react';
import { useProjects } from '../../contexts/ProjectsContext';
import { formatDate, formatCurrency } from '../../utils/formatters';
import { calculateProjectProgress, calculateProjectRates } from '../../utils/project-utils';
import { Switch } from '../../components/ui/switch';
import { Label } from '../../components/ui/label';

interface ProjectDetailsProps {
  className?: string;
}

const ProjectDetails: React.FC<ProjectDetailsProps> = ({ className }) => {
  const {
    selectedProject,
    closeProjectDetails,
    refreshSelectedProject,
    loadingDetails,
    calculateProjectProgress
  } = useProjects();

  // State voor de weergavemodus van projectregels (alle regels of gecombineerd per discipline)
  const [viewMode, setViewMode] = useState<'all' | 'combined'>('all');

  // Functie om de kleur van de voortgangsbalk te bepalen op basis van het percentage
  const getProgressColor = (percentage: number): string => {
    return percentage > 100 ? 'bg-red-500' : percentage > 75 ? 'bg-amber-500' : 'bg-green-500';
  };

  // Parse projectlines als het een string is
  const parsedProjectLines = useMemo(() => {
    if (!selectedProject) return [];

    // Als projectlines een string is, probeer het te parsen
    if (selectedProject.projectlines && typeof selectedProject.projectlines === 'string') {
      try {
        return JSON.parse(selectedProject.projectlines);
      } catch (error) {
        console.error('Error parsing projectlines:', error);
        return [];
      }
    }

    // Als projectlines al een array is, gebruik het direct
    if (selectedProject.projectlines && Array.isArray(selectedProject.projectlines)) {
      return selectedProject.projectlines;
    }

    // Anders, return een lege array
    return [];
  }, [selectedProject]);

  // Bereken voortgang per projectregel
  const projectLinesWithProgress = useMemo(() => {
    if (!selectedProject || !parsedProjectLines || parsedProjectLines.length === 0) {
      return [];
    }

    // Calculate total budget from either sellingprice or totalexclvat
    const totalBudget = parseFloat(selectedProject.totalexclvat || '0');

    // Calculate total budgeted hours
    const totalBudgetedHours = parsedProjectLines.reduce((sum, line) =>
      sum + (line && line.amount ? line.amount : 0), 0);

    // Default hourly rate if we can't calculate per line
    const defaultHourlyRate = totalBudgetedHours > 0 ? totalBudget / totalBudgetedHours : 0;

    return parsedProjectLines.map(line => {
      const lineAmount = line?.amount || 0;
      const lineWritten = line && line.amountwritten ? parseFloat(line.amountwritten) : 0;
      const lineRemaining = lineAmount - lineWritten;
      const linePercentage = lineAmount > 0 ? (lineWritten / lineAmount) * 100 : 0;

      // Get selling price from line or calculate from total budget
      const sellingPrice = line.sellingprice
        ? parseFloat(line.sellingprice)
        : defaultHourlyRate;

      // Calculate total amount (selling price * budgeted hours)
      const totalAmount = sellingPrice * lineAmount;

      // Start uurtarief is direct het selling price
      const startHourlyRate = sellingPrice;

      // Calculate realized hourly rate (total amount / written hours)
      // Maximum is the start hourly rate
      const realizedHourlyRate = lineWritten > 0
        ? Math.min(totalAmount / lineWritten, startHourlyRate)
        : 0;

      return {
        ...line,
        amount: lineAmount,
        written: lineWritten,
        remaining: lineRemaining,
        progress: linePercentage,
        progressColor: getProgressColor(linePercentage),
        startHourlyRate,
        realizedHourlyRate,
        sellingPrice,
        totalAmount
      };
    }).filter(line => line.amount > 0); // Filter regels zonder budget
  }, [parsedProjectLines, getProgressColor, selectedProject?.totalexclvat]);

  // Combineer projectregels per discipline
  const combinedProjectLines = useMemo(() => {
    if (!selectedProject || !projectLinesWithProgress.length) {
      return [];
    }

    // Calculate total budget from either sellingprice or totalexclvat
    const totalBudget = parseFloat(selectedProject.totalexclvat || '0');

    // Calculate total budgeted hours
    const totalBudgetedHours = parsedProjectLines.reduce((sum, line) =>
      sum + (line && line.amount ? line.amount : 0), 0);

    // Default hourly rate if we can't calculate per line
    const defaultHourlyRate = totalBudgetedHours > 0 ? totalBudget / totalBudgetedHours : 0;

    // Groepeer projectregels per discipline (product searchname)
    const disciplineMap = new Map();

    projectLinesWithProgress.forEach(line => {
      const discipline = line.product?.searchname || 'Onbekend';

      if (!disciplineMap.has(discipline)) {
        disciplineMap.set(discipline, {
          budgeted: 0,
          written: 0,
          count: 0,
          description: line.description || '',
          lines: [],
          totalSellingPrice: 0,
          totalAmount: 0
        });
      }

      const disciplineData = disciplineMap.get(discipline);
      disciplineData.budgeted += line.amount;
      disciplineData.written += line.written;
      disciplineData.count += 1;
      disciplineData.lines.push(line);
      disciplineData.totalSellingPrice += line.sellingPrice || 0;
      disciplineData.totalAmount += line.totalAmount || 0;
    });

    // Converteer de Map naar een array van gecombineerde projectregels
    return Array.from(disciplineMap.entries()).map(([discipline, data]) => {
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
        remaining: data.budgeted - data.written,
        progress,
        progressColor: getProgressColor(progress),
        count: data.count,
        description: data.description,
        lines: data.lines,
        startHourlyRate,
        realizedHourlyRate,
        totalSellingPrice: data.totalSellingPrice,
        totalAmount: data.totalAmount
      };
    }).sort((a, b) => b.budgeted - a.budgeted); // Sorteer op budget (hoogste eerst)
  }, [projectLinesWithProgress, parsedProjectLines, selectedProject?.totalexclvat, getProgressColor]);

  // Bereken totale start en gerealiseerd uurtarief voor het project
  const projectRates = useMemo(() => {
    if (!selectedProject) {
      return { startHourlyRate: 0, realizedHourlyRate: 0 };
    }

    return calculateProjectRates(selectedProject);
  }, [selectedProject]);

  // Bereken project voortgang en andere waarden
  const progress = useMemo(() => {
    if (!selectedProject) return 0;
    return calculateProjectProgress(selectedProject);
  }, [selectedProject]);

  const progressColor = useMemo(() => {
    return progress > 100 ? 'bg-red-500' : progress > 75 ? 'bg-amber-500' : 'bg-green-500';
  }, [progress]);

  // Gebruik de geparsede projectlines voor de berekeningen
  const totalBudget = useMemo(() => {
    if (!parsedProjectLines) return 0;
    return parsedProjectLines.reduce((sum, line) =>
      sum + (line?.amount || 0), 0);
  }, [parsedProjectLines]);

  const totalWritten = useMemo(() => {
    if (!parsedProjectLines) return 0;
    return parsedProjectLines.reduce((sum, line) =>
      sum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0);
  }, [parsedProjectLines]);

  if (!selectedProject) return null;

  return (
    <Dialog open={!!selectedProject} onOpenChange={(open) => !open && closeProjectDetails()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle className="text-xl font-bold">
              {selectedProject.name}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={closeProjectDetails}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription>
            {selectedProject.company?.searchname} - {selectedProject.phase?.searchname}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{selectedProject.status?.searchname || 'Onbekend'}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Deadline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {selectedProject.deadline ? formatDate(selectedProject.deadline.date) : 'Geen deadline'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Budget</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
              </CardContent>
            </Card>
          </div>

          <Card className={`border ${
            progress > 100
              ? 'border-red-300'
              : progress >= 75
                ? 'border-amber-300'
                : 'border-green-300'
          }`}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-medium">Voortgang</CardTitle>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                  progress > 100
                    ? 'bg-red-200 text-red-800'
                    : progress >= 75
                      ? 'bg-amber-200 text-amber-800'
                      : 'bg-green-200 text-green-800'
                }`}>
                  {progress > 100 ? 'Over budget' :
                   progress >= 75 ? 'Opletten' :
                   'Binnen budget'} ({Math.round(progress)}%)
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Progress value={progress} className={progressColor} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Geschreven: {formatCurrency(totalWritten)}</span>
                  <span>Budget: {formatCurrency(totalBudget)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="details">
            <TabsList className="grid grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="budget">Budget</TabsTrigger>
              <TabsTrigger value="notes">Notities</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Project Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium">Projectnummer</h4>
                      <p>{selectedProject.number || 'Onbekend'}</p>
                    </div>
                    <div>
                      <h4 className="font-medium">Projectleider</h4>
                      <p>{selectedProject.projectmanager?.searchname || 'Onbekend'}</p>
                    </div>
                    <div>
                      <h4 className="font-medium">Projecttype</h4>
                      <p>{selectedProject.type || 'Onbekend'}</p>
                    </div>
                    <div>
                      <h4 className="font-medium">Startdatum</h4>
                      <p>{selectedProject.startdate ? formatDate(selectedProject.startdate.date) : 'Onbekend'}</p>
                    </div>
                    <div>
                      <h4 className="font-medium">Einddatum</h4>
                      <p>{selectedProject.enddate ? formatDate(selectedProject.enddate.date) : 'Onbekend'}</p>
                    </div>
                    <div>
                      <h4 className="font-medium">Aangemaakt op</h4>
                      <p>{selectedProject.created ? formatDate(selectedProject.created.date) : 'Onbekend'}</p>
                    </div>
                    <div>
                      <h4 className="font-medium">Laatst bijgewerkt</h4>
                      <p>{selectedProject.modified ? formatDate(selectedProject.modified.date) : 'Onbekend'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Beschrijving</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    {selectedProject.description ? (
                      <div dangerouslySetInnerHTML={{ __html: selectedProject.description }} />
                    ) : (
                      <p className="text-muted-foreground">Geen beschrijving beschikbaar</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="budget" className="space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Budget Overzicht</CardTitle>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="view-mode"
                        checked={viewMode === 'combined'}
                        onCheckedChange={(checked) => setViewMode(checked ? 'combined' : 'all')}
                      />
                      <Label htmlFor="view-mode" className="text-sm">
                        {viewMode === 'combined' ? 'Gecombineerd per discipline' : 'Alle projectregels'}
                      </Label>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {parsedProjectLines && parsedProjectLines.length > 0 ? (
                    <div className="space-y-6">
                      {/* Tabs voor weergavemodus */}
                      <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'all' | 'combined')}>
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="all" className="flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            <span>Alle regels</span>
                          </TabsTrigger>
                          <TabsTrigger value="combined" className="flex items-center gap-1">
                            <BarChart2 className="h-4 w-4" />
                            <span>Gecombineerd</span>
                          </TabsTrigger>
                        </TabsList>

                        {/* Alle projectregels */}
                        <TabsContent value="all" className="mt-4">
                          {projectLinesWithProgress.length === 0 ? (
                            <p className="text-muted-foreground">Geen projectregels met budget gevonden.</p>
                          ) : (
                            <div className="space-y-6">
                              {projectLinesWithProgress.map((line, index) => (
                                <div key={index} className={`space-y-2 p-3 rounded-md border ${
                                  line.progress > 100
                                    ? 'border-red-300 bg-red-50'
                                    : line.progress >= 75
                                      ? 'border-amber-300 bg-amber-50'
                                      : 'border-green-300 bg-green-50'
                                }`}>
                                  <div className="flex flex-col">
                                    <div className="flex justify-between items-center">
                                      <span className="font-medium">{line.product?.searchname || 'Onbekend'}</span>
                                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                        line.progress > 100
                                          ? 'bg-red-200 text-red-800'
                                          : line.progress >= 75
                                            ? 'bg-amber-200 text-amber-800'
                                            : 'bg-green-200 text-green-800'
                                      }`}>
                                        {line.progress > 100 ? 'Over budget' :
                                         line.progress >= 75 ? 'Opletten' :
                                         'Binnen budget'} ({Math.round(line.progress)}%)
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-500">{line.description}</p>
                                  </div>
                                  <Progress value={line.progress} className={`h-2 ${line.progressColor}`} />
                                  <div className="flex justify-between text-xs text-gray-500">
                                    <span>{line.written.toFixed(2)} / {line.amount.toFixed(2)} uur</span>
                                    <span>
                                      Start: {formatCurrency(line.startHourlyRate)} |
                                      Gerealiseerd: {formatCurrency(line.realizedHourlyRate)} |
                                      Waarde: {formatCurrency(line.totalAmount)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </TabsContent>

                        {/* Gecombineerde projectregels per discipline */}
                        <TabsContent value="combined" className="mt-4">
                          {combinedProjectLines.length === 0 ? (
                            <p className="text-muted-foreground">Geen projectregels met budget gevonden.</p>
                          ) : (
                            <div className="space-y-6">
                              {combinedProjectLines.map((line, index) => (
                                <div key={index} className={`space-y-2 p-3 rounded-md border ${
                                  line.progress > 100
                                    ? 'border-red-300 bg-red-50'
                                    : line.progress >= 75
                                      ? 'border-amber-300 bg-amber-50'
                                      : 'border-green-300 bg-green-50'
                                }`}>
                                  <div className="flex flex-col">
                                    <div className="flex justify-between items-center">
                                      <span className="font-medium">{line.discipline} ({line.count})</span>
                                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                        line.progress > 100
                                          ? 'bg-red-200 text-red-800'
                                          : line.progress >= 75
                                            ? 'bg-amber-200 text-amber-800'
                                            : 'bg-green-200 text-green-800'
                                      }`}>
                                        {line.progress > 100 ? 'Over budget' :
                                         line.progress >= 75 ? 'Opletten' :
                                         'Binnen budget'} ({Math.round(line.progress)}%)
                                      </span>
                                    </div>
                                  </div>
                                  <Progress value={line.progress} className={`h-2 ${line.progressColor}`} />
                                  <div className="flex justify-between text-xs text-gray-500">
                                    <span>{line.written.toFixed(2)} / {line.budgeted.toFixed(2)} uur</span>
                                    <span>
                                      Start: {formatCurrency(line.startHourlyRate)} |
                                      Gerealiseerd: {formatCurrency(line.realizedHourlyRate)} |
                                      Waarde: {formatCurrency(line.totalAmount)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>

                      {/* Totaal */}
                      <div className={`pt-4 mt-4 border-t p-3 rounded-md border ${
                        progress > 100
                          ? 'border-red-300 bg-red-50'
                          : progress >= 75
                            ? 'border-amber-300 bg-amber-50'
                            : 'border-green-300 bg-green-50'
                      }`}>
                        <div className="flex justify-between font-medium items-center">
                          <span className="text-lg">Totaal</span>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            progress > 100
                              ? 'bg-red-200 text-red-800'
                              : progress >= 75
                                ? 'bg-amber-200 text-amber-800'
                                : 'bg-green-200 text-green-800'
                          }`}>
                            {progress > 100 ? 'Over budget' :
                             progress >= 75 ? 'Opletten' :
                             'Binnen budget'} ({Math.round(progress)}%)
                          </span>
                        </div>
                        <Progress value={progress} className={`h-2 mt-2 ${progressColor}`} />
                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                          <span>{totalWritten.toFixed(2)} / {totalBudget.toFixed(2)} uur</span>
                          <span>
                            Start: {formatCurrency(projectRates.startHourlyRate)} |
                            Gerealiseerd: {formatCurrency(projectRates.realizedHourlyRate)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Geen budget informatie beschikbaar</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Notities</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    {selectedProject.notes ? (
                      <div dangerouslySetInnerHTML={{ __html: selectedProject.notes }} />
                    ) : (
                      <p className="text-muted-foreground">Geen notities beschikbaar</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={closeProjectDetails}
          >
            Sluiten
          </Button>
          <Button
            onClick={refreshSelectedProject}
            disabled={loadingDetails}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingDetails ? 'animate-spin' : ''}`} />
            Bijwerken
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectDetails;
