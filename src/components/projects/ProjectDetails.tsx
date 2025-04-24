import React from 'react';
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
import { RefreshCw, X } from 'lucide-react';
import { useProjects } from '../../contexts/ProjectsContext';
import { formatDate, formatCurrency } from '../../utils/formatters';

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
  
  if (!selectedProject) return null;
  
  const progress = calculateProjectProgress(selectedProject);
  const progressColor = progress > 100 ? 'bg-red-500' : progress > 75 ? 'bg-amber-500' : 'bg-green-500';
  
  const totalBudget = selectedProject.projectlines?.reduce((sum, line) =>
    sum + (line?.amount || 0), 0) || 0;
  
  const totalWritten = selectedProject.projectlines?.reduce((sum, line) =>
    sum + (line && line.amountwritten ? parseFloat(line.amountwritten) : 0), 0) || 0;
  
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
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Voortgang</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Progress value={progress} className={progressColor} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Geschreven: {formatCurrency(totalWritten)}</span>
                  <span>{progress.toFixed(1)}%</span>
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
                <CardHeader>
                  <CardTitle>Budget Overzicht</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedProject.projectlines && selectedProject.projectlines.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2">Omschrijving</th>
                            <th className="text-right py-2">Budget</th>
                            <th className="text-right py-2">Geschreven</th>
                            <th className="text-right py-2">Resterend</th>
                            <th className="text-right py-2">%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedProject.projectlines.map((line, index) => {
                            const lineAmount = line?.amount || 0;
                            const lineWritten = line && line.amountwritten ? parseFloat(line.amountwritten) : 0;
                            const lineRemaining = lineAmount - lineWritten;
                            const linePercentage = lineAmount > 0 ? (lineWritten / lineAmount) * 100 : 0;
                            
                            return (
                              <tr key={index} className="border-b">
                                <td className="py-2">{line?.description || 'Onbekend'}</td>
                                <td className="text-right py-2">{formatCurrency(lineAmount)}</td>
                                <td className="text-right py-2">{formatCurrency(lineWritten)}</td>
                                <td className="text-right py-2">{formatCurrency(lineRemaining)}</td>
                                <td className={`text-right py-2 ${linePercentage > 100 ? 'text-red-500' : linePercentage > 75 ? 'text-amber-500' : 'text-green-500'}`}>
                                  {linePercentage.toFixed(1)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="border-t font-bold">
                            <td className="py-2">Totaal</td>
                            <td className="text-right py-2">{formatCurrency(totalBudget)}</td>
                            <td className="text-right py-2">{formatCurrency(totalWritten)}</td>
                            <td className="text-right py-2">{formatCurrency(totalBudget - totalWritten)}</td>
                            <td className={`text-right py-2 ${progress > 100 ? 'text-red-500' : progress > 75 ? 'text-amber-500' : 'text-green-500'}`}>
                              {progress.toFixed(1)}%
                            </td>
                          </tr>
                        </tfoot>
                      </table>
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
