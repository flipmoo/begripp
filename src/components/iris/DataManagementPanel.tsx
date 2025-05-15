import React, { useState, useEffect } from 'react';
import { useIris } from '../../contexts/IrisContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { toast } from '../ui/use-toast';
import { API_BASE_URL } from '../../config/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '../ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Settings } from 'lucide-react';

/**
 * DataManagementPanel Component
 *
 * Deze component biedt een dialoogvenster voor het beheren van data zoals
 * maandelijkse targets, definitieve omzet en budget vorig jaar.
 */
export const DataManagementPanel: React.FC = () => {
  const { selectedYear, fetchMonthlyTargets, fetchFinalRevenue, revenueData } = useIris();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2">
          <Settings className="h-4 w-4 mr-2" />
          Data beheren
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>IRIS Data Beheer</DialogTitle>
          <DialogDescription>
            Beheer maandelijkse targets, definitieve omzet en budget vorig jaar.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="targets" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="targets">Maandelijkse Targets</TabsTrigger>
            <TabsTrigger value="revenue">Definitieve Omzet</TabsTrigger>
            <TabsTrigger value="previous-budget">Budget Vaste Prijs</TabsTrigger>
          </TabsList>

          <TabsContent value="targets" className="mt-4">
            <MonthlyTargetForm />
          </TabsContent>

          <TabsContent value="revenue" className="mt-4">
            <FinalRevenueForm />
          </TabsContent>

          <TabsContent value="previous-budget" className="mt-4">
            <PreviousYearBudgetForm />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <DialogPrimitive.Close asChild>
            <Button variant="outline">Sluiten</Button>
          </DialogPrimitive.Close>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * MonthlyTargetForm Component
 *
 * Deze component toont een formulier voor het bewerken van maandelijkse targets.
 */
const MonthlyTargetForm: React.FC = () => {
  const { selectedYear, monthlyTargets, fetchMonthlyTargets } = useIris();
  const [formTargets, setFormTargets] = useState<Array<{ month: number; targetAmount: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Maandnamen
  const monthNames = [
    'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
    'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
  ];

  // Initialiseer targets wanneer monthlyTargets verandert
  useEffect(() => {
    if (monthlyTargets && monthlyTargets.length > 0) {
      const initialTargets = monthNames.map((_, index) => {
        const month = index + 1;
        const target = monthlyTargets.find(t => t.month === month);
        return {
          month,
          targetAmount: target ? target.targetAmount.toString() : '200000'
        };
      });
      setFormTargets(initialTargets);
    } else {
      // Als er geen targets zijn, maak standaard targets
      const defaultTargets = monthNames.map((_, index) => ({
        month: index + 1,
        targetAmount: '200000'
      }));
      setFormTargets(defaultTargets);
    }
  }, [monthlyTargets, monthNames]);

  // Update een target
  const handleTargetChange = (month: number, value: string) => {
    setFormTargets(prev =>
      prev.map(target =>
        target.month === month ? { ...target, targetAmount: value } : target
      )
    );
  };

  // Sla targets op
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/iris/targets/monthly`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          year: selectedYear,
          targets: formTargets.map(target => ({
            month: target.month,
            targetAmount: parseFloat(target.targetAmount) || 0
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save targets: ${response.statusText}`);
      }

      await fetchMonthlyTargets(selectedYear);

      toast({
        title: 'Targets opgeslagen',
        description: 'De maandelijkse targets zijn succesvol opgeslagen.',
      });
    } catch (error) {
      console.error('Error saving targets:', error);
      toast({
        title: 'Fout bij opslaan',
        description: 'Er is een fout opgetreden bij het opslaan van de targets.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Maandelijkse Targets {selectedYear}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {formTargets.map(target => (
              <div key={target.month} className="space-y-2">
                <Label htmlFor={`target-${target.month}`}>{monthNames[target.month - 1]}</Label>
                <div className="flex items-center">
                  <span className="mr-2">€</span>
                  <Input
                    id={`target-${target.month}`}
                    type="number"
                    value={target.targetAmount}
                    onChange={(e) => handleTargetChange(target.month, e.target.value)}
                    min="0"
                    step="1000"
                  />
                </div>
              </div>
            ))}
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Opslaan...' : 'Targets opslaan'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

/**
 * FinalRevenueForm Component
 *
 * Deze component toont een formulier voor het bewerken van definitieve omzet.
 */
const FinalRevenueForm: React.FC = () => {
  const { selectedYear, finalRevenue, fetchFinalRevenue } = useIris();

  // Maandnamen
  const monthNames = [
    'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
    'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
  ];

  // Initialiseer revenue state met default waarden
  const [formData, setFormData] = useState(() => {
    // Maak een array met 12 maanden met waarde 0
    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      amount: '0'
    }));
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update formData wanneer finalRevenue verandert
  useEffect(() => {
    if (finalRevenue && finalRevenue.length > 0) {
      const newFormData = [...formData];

      finalRevenue.forEach(item => {
        if (item.month >= 1 && item.month <= 12) {
          newFormData[item.month - 1] = {
            month: item.month,
            amount: item.amount.toString()
          };
        }
      });

      setFormData(newFormData);
    }
  }, [finalRevenue]);

  // Update een maand
  const handleAmountChange = (month: number, value: string) => {
    setFormData(prev =>
      prev.map(item =>
        item.month === month ? { ...item, amount: value } : item
      )
    );
  };

  // Sla definitieve omzet op
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/iris/revenue/final`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          year: selectedYear,
          revenue: formData.map(item => ({
            month: item.month,
            amount: parseFloat(item.amount) || 0
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save final revenue: ${response.statusText}`);
      }

      // Forceer een refresh van de data
      await fetchFinalRevenue(selectedYear, true);

      toast({
        title: 'Definitieve omzet opgeslagen',
        description: 'De definitieve omzet is succesvol opgeslagen.',
      });
    } catch (error) {
      console.error('Error saving final revenue:', error);
      toast({
        title: 'Fout bij opslaan',
        description: 'Er is een fout opgetreden bij het opslaan van de definitieve omzet.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Definitieve Omzet {selectedYear}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {formData.map(item => (
              <div key={item.month} className="space-y-2">
                <Label htmlFor={`revenue-${item.month}`}>{monthNames[item.month - 1]}</Label>
                <div className="flex items-center">
                  <span className="mr-2">€</span>
                  <Input
                    id={`revenue-${item.month}`}
                    type="number"
                    value={item.amount}
                    onChange={(e) => handleAmountChange(item.month, e.target.value)}
                    min="0"
                    step="1"
                  />
                </div>
              </div>
            ))}
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Opslaan...' : 'Definitieve omzet opslaan'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

/**
 * PreviousYearBudgetForm Component
 *
 * Deze component toont een formulier voor het bewerken van budget vorig jaar.
 */
const PreviousYearBudgetForm: React.FC = () => {
  const { selectedYear, revenueData } = useIris();
  const [searchTerm, setSearchTerm] = useState('');
  const [projectData, setProjectData] = useState<Array<{
    projectId: number;
    projectName: string;
    clientName: string;
    consumptionAmount: string;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  // Haal projecten op bij het laden van de component
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Haal projecten op uit de revenue data
        const uniqueProjects = new Map();

        if (revenueData && revenueData.length > 0) {
          revenueData.forEach(item => {
            // Alleen vaste prijs projecten toevoegen
            if (!uniqueProjects.has(item.projectId) && item.projectType === 'Vaste Prijs') {
              uniqueProjects.set(item.projectId, {
                projectId: item.projectId,
                projectName: item.projectName,
                clientName: item.clientName,
                projectType: item.projectType,
                projectBudget: item.projectBudget
              });
            }
          });
        }

        // Haal "Budget Vorig Jaar" gegevens op
        const response = await fetch(`${API_BASE_URL}/api/v1/iris/projects/previous-consumption?year=${selectedYear}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch previous consumption data: ${response.statusText}`);
        }

        const result = await response.json();

        // Maak een map van project_id naar consumptionAmount
        const consumptionMap = new Map();

        if (result.success && result.data && Array.isArray(result.data.data)) {
          result.data.data.forEach(item => {
            consumptionMap.set(item.projectId, item.consumptionAmount);
          });
        }

        // Combineer de data
        const combinedData = Array.from(uniqueProjects.values()).map(project => ({
          projectId: project.projectId,
          projectName: project.projectName,
          clientName: project.clientName,
          consumptionAmount: (consumptionMap.get(project.projectId) || '0').toString()
        }));

        // Sorteer op projectnaam
        combinedData.sort((a, b) => a.projectName.localeCompare(b.projectName));

        setProjectData(combinedData);
      } catch (error) {
        console.error('Error fetching project data:', error);
        setMessage('Er is een fout opgetreden bij het ophalen van de projectgegevens.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedYear, revenueData]);

  // Update een project
  const handleConsumptionChange = (projectId: number, value: string) => {
    setProjectData(prev =>
      prev.map(project =>
        project.projectId === projectId ? { ...project, consumptionAmount: value } : project
      )
    );
  };

  // Sla budget vorig jaar op voor een project
  const handleSaveProject = async (projectId: number) => {
    try {
      const project = projectData.find(p => p.projectId === projectId);

      if (!project) {
        throw new Error('Project niet gevonden');
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/iris/project/previous-budget`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          previousYearBudgetUsed: parseFloat(project.consumptionAmount) || 0
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save previous consumption data: ${response.statusText}`);
      }

      toast({
        title: 'Budget opgeslagen',
        description: `Budget vorig jaar voor ${project.projectName} is succesvol opgeslagen.`,
      });
    } catch (error) {
      console.error('Error saving project budget:', error);
      toast({
        title: 'Fout bij opslaan',
        description: 'Er is een fout opgetreden bij het opslaan van het budget.',
        variant: 'destructive'
      });
    }
  };

  // Filter projecten op basis van zoekterm
  const filteredProjects = projectData.filter(project =>
    project.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Budget Vorig Jaar Vaste Prijs Projecten {selectedYear}</CardTitle>
      </CardHeader>
      <CardContent className="pt-2 px-3">
        {message && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
            {message}
          </div>
        )}

        <div className="mb-3">
          <div className="flex items-center gap-2">
            <Input
              id="search-projects"
              placeholder="Zoek op projectnaam of klant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="text-sm h-8"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-4">Projecten laden...</div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            {filteredProjects.length === 0 ? (
              <div className="text-center py-4">Geen vaste prijs projecten gevonden</div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {filteredProjects.map(project => (
                  <div key={project.projectId} className="border rounded-md p-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{project.projectName}</div>
                        <div className="text-xs text-gray-500">{project.clientName}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs">€</span>
                        <Input
                          type="number"
                          value={project.consumptionAmount}
                          onChange={(e) => handleConsumptionChange(project.projectId, e.target.value)}
                          min="0"
                          step="0.01"
                          className="w-28 h-8 text-sm"
                        />
                        <Button
                          size="sm"
                          className="h-8 px-2 py-0 text-xs"
                          onClick={() => handleSaveProject(project.projectId)}
                        >
                          Opslaan
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};