import React, { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { useIris, ViewMode, CalculationMode } from '../../contexts/IrisContext';
import { formatCurrency } from '../../utils/formatters';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Search, ArrowUpDown, DollarSign, Clock, Info, Eye, EyeOff, Archive, RefreshCw } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { API_BASE_URL } from '../../config/api';
import NonBillableHoursIndicator from './NonBillableHoursIndicator';

// Geen centrale configuratie voor projectcorrecties meer
// We gebruiken nu de data uit de backend

/**
 * IRIS Revenue Table Component
 *
 * Deze component toont een tabel met revenue data voor IRIS.
 */
export const RevenueTable: React.FC = () => {
  const {
    revenueData,
    correctedRevenueData,
    selectedYear,
    viewMode,
    setViewMode,
    calculationMode,
    setCalculationMode,
    excludedProjects,
    setExcludedProjects
  } = useIris();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showBudgetColumns, setShowBudgetColumns] = useState(false);
  const [showArchived, setShowArchived] = useState(true);
  const [digitalPlatformNonBillableHours, setDigitalPlatformNonBillableHours] = useState<any>(null);

  // We gebruiken geen aparte API call meer voor niet-doorbelastbare uren
  // In plaats daarvan verwerken we deze direct in de berekening

  // Functie om client naam te parsen uit JSON string
  const parseClientName = (clientNameStr: string, isQuote: boolean = false, projectName: string = '', offerProjectBase: any = null): string => {
    if (!clientNameStr) return 'Onbekend';

    // Als we offerProjectBase informatie hebben, gebruik die
    if (offerProjectBase && offerProjectBase.company && offerProjectBase.company.searchname) {
      return offerProjectBase.company.searchname;
    }

    // Specifieke mappings voor bekende offertes
    if (isQuote) {
      if (projectName.includes('Lektor Platform') || clientNameStr === 'Technical Direction') {
        return 'Lektor Platform';
      }

      // Voeg hier meer specifieke mappings toe voor andere offertes indien nodig
    }

    try {
      // Probeer de JSON string te parsen
      const clientData = JSON.parse(clientNameStr);
      if (clientData && clientData.searchname) {
        return clientData.searchname;
      }
      if (clientData && clientData.name) {
        return clientData.name;
      }

      // Voor JSON-RPC formaat (nieuwe structuur)
      if (clientData && clientData.id) {
        // Als het een object is met een id maar geen searchname, probeer andere velden
        if (clientData.company && clientData.company.searchname) {
          return clientData.company.searchname;
        }
      }
    } catch (e) {
      // Als het geen geldige JSON is, gebruik de string zelf
      return clientNameStr;
    }

    return 'Onbekend';
  };

  // Functie om project status te parsen uit JSON string
  const parseProjectStatus = (statusStr: string): string => {
    if (!statusStr) return 'Onbekend';

    try {
      // Probeer de JSON string te parsen
      const statusData = JSON.parse(statusStr);
      if (statusData && statusData.searchname) {
        return statusData.searchname;
      }
    } catch (e) {
      // Als het geen geldige JSON is, gebruik de string zelf
      return statusStr;
    }

    return 'Onbekend';
  };

  // Groepeer data per project
  const projectsData = React.useMemo(() => {
    const projects: Record<number, any> = {};

    // Gebruik dezelfde data als in KpiOverview voor consistentie
    const dataToUse = correctedRevenueData.length > 0 ? correctedRevenueData : revenueData;

    // Controleer of dataToUse een array is
    if (!dataToUse || !Array.isArray(dataToUse)) {
      console.error('revenueData is not an array:', dataToUse);
      return [];
    }

    console.log('Aantal revenue records:', dataToUse.length);
    if (dataToUse.length > 0) {
      console.log('Voorbeeld revenue record:', dataToUse[0]);
    }

    // Log de binnenkomende data
    console.log('Binnenkomende revenue data (eerste 5 items):', dataToUse.slice(0, 5));

    // Stap 1: Verzamel alle unieke projecten en initialiseer hun structuur
    dataToUse.forEach(item => {
      if (!projects[item.projectId]) {
        // Controleer of het een offerte is op basis van de discr veld, offerprojectbase of offerprojectbase_discr
        const isQuote =
          // Controleer op offerprojectbase_discr veld (primaire methode)
          (item.offerprojectbase_discr && (
            item.offerprojectbase_discr === 'offerte' ||
            item.offerprojectbase_discr === 'offer' ||
            item.offerprojectbase_discr.includes('offerte') ||
            item.offerprojectbase_discr.includes('offer')
          )) ||

          // Controleer op discr veld
          (item.discr && (
            item.discr === 'offer' ||
            item.discr === 'offerte' ||
            item.discr.includes('offerte') ||
            item.discr.includes('offer')
          )) ||

          // Controleer op offerprojectbase object
          (item.offerprojectbase && (
            item.offerprojectbase.discr === 'offer' ||
            item.offerprojectbase.discr === 'offerte' ||
            (item.offerprojectbase.discr && (
              item.offerprojectbase.discr.includes('offerte') ||
              item.offerprojectbase.discr.includes('offer')
            ))
          )) ||

          // Controleer op projectnaam als fallback
          (item.projectName && (
            item.projectName.toLowerCase().includes('offerte')
          ));

        // Standaard initialisatie voor alle projecten
        let projectType = isQuote ? 'Offerte' : (item.projectType || 'Incorrecte tags');

        // Functie om het juiste projecttype te bepalen
        const getCorrectProjectType = (projectId: number, projectName: string, originalType: string): string => {
          // Algemene regels op basis van naam
          if (projectName) {
            const nameLower = projectName.toLowerCase();
            if (nameLower.includes('intern') || nameLower.includes('internal')) {
              console.log(`Project ${projectId} (${projectName}) is gemarkeerd als Intern op basis van naam`);
              return 'Intern';
            }
          }

          // Als geen specifieke fix is gevonden, gebruik het originele type
          return originalType;
        };

        // Pas het projecttype aan
        projectType = getCorrectProjectType(item.projectId, item.projectName, projectType);

        // Bepaal het budget voor het project
        let projectBudget = item.projectBudget || 0;

        // We gebruiken alleen de exacte data uit Gripp, geen berekeningen of fallbacks
        // De backend heeft al het budget bepaald, dus we gebruiken dat
        if (projectType === 'Vaste Prijs' && (!projectBudget || projectBudget === 0 || projectBudget === '0')) {
          console.warn(`FRONTEND WARNING: Fixed price project ${item.projectId} (${item.projectName}) has no budget in Gripp data.`);
        }

        // Parse archivedon als het een string is
        let archivedon = item.archivedon;
        if (archivedon && typeof archivedon === 'string') {
          try {
            // Probeer de JSON string te parsen
            const archivedonData = JSON.parse(archivedon);
            if (archivedonData && archivedonData.date) {
              archivedon = archivedonData.date;
            }
          } catch (e) {
            // Als het geen geldige JSON is, gebruik de string zelf
            console.log('Fout bij parsen van archivedon:', e);
          }
        }

        projects[item.projectId] = {
          id: item.projectId,
          name: item.projectName,
          clientName: parseClientName(item.clientName, isQuote, item.projectName, item.offerprojectbase),
          projectType: projectType,
          projectTags: item.projectTags || [],
          projectBudget: projectBudget,
          previousYearBudgetUsed: item.previousYearBudgetUsed || 0,
          remainingBudget: item.previousYearBudgetUsed
            ? (projectBudget - (item.previousYearBudgetUsed || 0))
            : projectBudget,
          months: Array(12).fill(0),
          monthlyHours: Array(12).fill(0),
          monthlyOverBudget: Array(12).fill(false), // Houdt bij welke maanden over budget zijn
          total: 0,
          hours: 0,
          isOverBudget: false,
          totalOverspend: 0, // Totale overspend in euro's
          isQuote: isQuote, // Indicator of het een offerte is
          offerprojectbase: item.offerprojectbase, // Bewaar de offerprojectbase informatie
          archived: item.archived || false, // Voeg archived veld toe
          archivedon: archivedon // Voeg archivedon veld toe
        };
      }

      // Maand is 1-indexed in de data, maar 0-indexed in de array
      const monthIndex = item.month - 1;

      // Standaard verwerking voor alle projecten
      // Afhankelijk van de viewMode, sla revenue of hours op
      if (viewMode === 'revenue') {
        // Als het project projectMaxRevenue en lineMaxRevenue heeft, gebruik die
        if (item.projectMaxRevenue && item.lineMaxRevenue && projects[item.projectId].projectType === 'Vaste Prijs') {
          // Sla de berekende revenue op in het project
          if (!projects[item.projectId].projectMaxRevenue) {
            projects[item.projectId].projectMaxRevenue = item.projectMaxRevenue;
          }
          if (!projects[item.projectId].lineMaxRevenue) {
            projects[item.projectId].lineMaxRevenue = item.lineMaxRevenue;
          }

          // Gebruik de juiste berekening op basis van de calculationMode
          if (calculationMode === 'projectMax') {
            // Gebruik de projectMaxRevenue
            if (monthIndex === 0) { // Alleen bij de eerste maand
              // Kopieer de maandelijkse revenue
              for (let i = 0; i < 12; i++) {
                projects[item.projectId].months[i] = item.projectMaxRevenue.monthlyRevenue[i];
              }
              // Kopieer de totale revenue
              projects[item.projectId].total = item.projectMaxRevenue.totalRevenue;
              // Kopieer de over-budget status
              projects[item.projectId].isOverBudget = item.projectMaxRevenue.isOverBudget;
              // Kopieer de maandelijkse over-budget status
              projects[item.projectId].monthlyOverBudget = item.projectMaxRevenue.monthlyOverBudget;
            }
          } else {
            // Gebruik de lineMaxRevenue
            if (monthIndex === 0) { // Alleen bij de eerste maand
              // Kopieer de maandelijkse revenue
              for (let i = 0; i < 12; i++) {
                projects[item.projectId].months[i] = item.lineMaxRevenue.monthlyRevenue[i];
              }
              // Kopieer de totale revenue
              projects[item.projectId].total = item.lineMaxRevenue.totalRevenue;
              // Kopieer de over-budget status
              projects[item.projectId].isOverBudget = item.lineMaxRevenue.isOverBudget;
              // Kopieer de maandelijkse over-budget status
              projects[item.projectId].monthlyOverBudget = item.lineMaxRevenue.monthlyOverBudget;
            }
          }
        } else {
          // Gebruik de standaard revenue
          projects[item.projectId].months[monthIndex] += item.revenue;
          projects[item.projectId].total += item.revenue;
        }
      } else {
        // Voor uren weergave
        projects[item.projectId].months[monthIndex] += item.hours;
        projects[item.projectId].total += item.hours;
      }

      // Sla uren altijd op voor berekeningen
      projects[item.projectId].monthlyHours[monthIndex] += item.hours;
      projects[item.projectId].hours += item.hours;

      // Markeer over-budget maanden en bereken overspend als we geen projectMaxRevenue of lineMaxRevenue hebben
      if (!item.projectMaxRevenue && !item.lineMaxRevenue && item.isOverBudget) {
        projects[item.projectId].monthlyOverBudget[monthIndex] = true;
        projects[item.projectId].isOverBudget = true;

        // Bereken overspend als het verschil tussen wat er had moeten zijn en wat er is
        if (item.adjustedDueToMaxBudget) {
          const originalRevenue = item.hours * item.hourlyRate;
          const overspend = originalRevenue - item.revenue;
          projects[item.projectId].totalOverspend += overspend;
        }
      }
    });

    // Stap 2: Filter op zoekterm en archiefstatus
    let filteredProjects = Object.values(projects);

    // Filter op zoekterm
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filteredProjects = filteredProjects.filter((project: any) =>
        project.name.toLowerCase().includes(lowerSearchTerm) ||
        project.clientName.toLowerCase().includes(lowerSearchTerm) ||
        project.projectType.toLowerCase().includes(lowerSearchTerm)
      );
    }

    // Filter op archiefstatus
    if (!showArchived) {
      filteredProjects = filteredProjects.filter((project: any) => !project.archived);
    }

    // Log een aantal voorbeelden van gegroepeerde projecten
    console.log('Aantal projecten na groepering:', filteredProjects.length);
    if (filteredProjects.length > 0) {
      console.log('Voorbeeld project na groepering:', filteredProjects[0]);
    }

    // Stap 3: Sorteer de projecten
    filteredProjects.sort((a: any, b: any) => {
      let valueA, valueB;

      // Check of we op een maand sorteren (month_0 t/m month_11)
      if (sortField.startsWith('month_')) {
        const monthIndex = parseInt(sortField.split('_')[1]);
        valueA = a.months[monthIndex] || 0;
        valueB = b.months[monthIndex] || 0;
      } else {
        switch (sortField) {
          case 'client':
            valueA = a.clientName.toLowerCase();
            valueB = b.clientName.toLowerCase();
            break;
          case 'type':
            valueA = a.projectType.toLowerCase();
            valueB = b.projectType.toLowerCase();
            break;
          case 'total':
            valueA = a.total;
            valueB = b.total;
            break;
          case 'hours':
            valueA = a.hours;
            valueB = b.hours;
            break;
          case 'name':
          default:
            valueA = a.name.toLowerCase();
            valueB = b.name.toLowerCase();
        }
      }

      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filteredProjects;
  }, [revenueData, correctedRevenueData, calculationMode, viewMode, searchTerm, sortField, sortDirection, showArchived]);

  // Bereken totalen per maand op basis van de data in KpiOverview
  const monthlyTotals = React.useMemo(() => {
    const totals = Array(12).fill(0);
    const hoursPerMonth = Array(12).fill(0);

    // Gebruik dezelfde data als in KpiOverview voor consistentie
    const dataToUse = correctedRevenueData.length > 0 ? correctedRevenueData : revenueData;

    // Loop door alle items in de data
    dataToUse.forEach(item => {
      // Sla uitgesloten projecten over
      if (excludedProjects.includes(item.projectId)) {
        return;
      }

      // Voeg revenue en hours toe aan de juiste maand
      const monthIndex = item.month - 1;
      if (monthIndex >= 0 && monthIndex < 12) {
        if (viewMode === 'revenue') {
          totals[monthIndex] += item.revenue;
        }
        hoursPerMonth[monthIndex] += item.hours;
      }
    });

    return { totals, hoursPerMonth };
  }, [excludedProjects, viewMode, calculationMode, correctedRevenueData, revenueData]);

  // Bereken jaartotaal
  const yearTotal = React.useMemo(() => {
    return monthlyTotals.totals.reduce((sum, value) => sum + value, 0);
  }, [monthlyTotals]);

  // Bereken totaal uren
  const yearTotalHours = React.useMemo(() => {
    return monthlyTotals.hoursPerMonth.reduce((sum, value) => sum + value, 0);
  }, [monthlyTotals]);

  // Maandnamen
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'
  ];

  // Functie om te sorteren
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Functie om cel klasse te bepalen op basis van over-budget status
  const getCellClass = (project: any, monthIndex: number) => {
    if (viewMode === 'revenue' && project.monthlyOverBudget[monthIndex]) {
      return "text-right bg-red-100 relative";
    }
    return "text-right";
  };

  // Functie om te bepalen of een cel een over-budget indicator moet tonen
  const shouldShowOverBudgetIndicator = (project: any, monthIndex: number) => {
    return viewMode === 'revenue' &&
           calculationMode === 'projectMax' &&
           project.monthlyOverBudget[monthIndex];
  };

  // Berekeningswijze uitleg
  const calculationExplanation = {
    projectMax: "Alle uren worden vermenigvuldigd met het uurtarief, ongeacht of de projectregel over budget is.",
    lineMax: "Uren worden berekend tot de max van elke projectregel. Overspend uren leveren €0 op."
  };

  return (
    <div className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-md">
        <h2 className="text-xl font-bold mb-2">IRIS Revenue Overzicht {selectedYear}</h2>

        <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Weergave:</span>
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(value) => value && setViewMode(value as ViewMode)}
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="revenue" aria-label="Toon omzet">
                  <DollarSign className="h-4 w-4 mr-1" />
                  <span>Omzet</span>
                </ToggleGroupItem>
                <ToggleGroupItem value="hours" aria-label="Toon uren">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>Uren</span>
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {viewMode === 'revenue' && (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">Berekening:</span>
                <ToggleGroup
                  type="single"
                  value={calculationMode}
                  onValueChange={(value) => value && setCalculationMode(value as CalculationMode)}
                  variant="outline"
                  size="sm"
                >
                  <ToggleGroupItem value="projectMax" aria-label="Project Max">
                    <span>Project</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="lineMax" aria-label="Line Max">
                    <span>Projectregel</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            )}

            {viewMode === 'revenue' && (
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBudgetColumns(!showBudgetColumns)}
                  className={showBudgetColumns ? "bg-blue-50" : ""}
                >
                  <Info className="h-4 w-4 mr-1" />
                  <span>{showBudgetColumns ? "Verberg budget" : "Toon budget"}</span>
                </Button>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
                className={showArchived ? "bg-blue-50" : ""}
              >
                <Archive className="h-4 w-4 mr-1" />
                <span>{showArchived ? "Verberg gearchiveerd" : "Toon gearchiveerd"}</span>
              </Button>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Maak de cache leeg
                  fetch('/api/v1/cache/clear', { method: 'POST' })
                    .then(response => response.json())
                    .then(data => {
                      if (data.success) {
                        // Herlaad de pagina
                        window.location.reload();
                      } else {
                        console.error('Fout bij het leegmaken van de cache:', data.error);
                      }
                    })
                    .catch(error => {
                      console.error('Fout bij het leegmaken van de cache:', error);
                    });
                }}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                <span>Ververs cache</span>
              </Button>
            </div>
          </div>

          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op project of klant..."
              className="pl-8 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[12%]">
                <Button variant="ghost" size="sm" onClick={() => handleSort('name')} className="flex items-center">
                  Project
                  {sortField === 'name' && (
                    <ArrowUpDown className={`ml-1 h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                  )}
                </Button>
              </TableHead>
              <TableHead className="w-[8%]">
                <Button variant="ghost" size="sm" onClick={() => handleSort('client')} className="flex items-center">
                  Klant
                  {sortField === 'client' && (
                    <ArrowUpDown className={`ml-1 h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                  )}
                </Button>
              </TableHead>
              <TableHead className="w-[8%]">
                <Button variant="ghost" size="sm" onClick={() => handleSort('type')} className="flex items-center">
                  Type
                  {sortField === 'type' && (
                    <ArrowUpDown className={`ml-1 h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                  )}
                </Button>
              </TableHead>
              {showBudgetColumns && viewMode === 'revenue' && (
                <>
                  <TableHead className="w-[8%] text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('projectBudget')} className="flex items-center justify-end w-full">
                      Budget
                      {sortField === 'projectBudget' && (
                        <ArrowUpDown className={`ml-1 h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead className="w-[8%] text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('previousYearBudgetUsed')} className="flex items-center justify-end w-full">
                      Vorig jaar
                      {sortField === 'previousYearBudgetUsed' && (
                        <ArrowUpDown className={`ml-1 h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead className="w-[8%] text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('remainingBudget')} className="flex items-center justify-end w-full">
                      Beschikbaar
                      {sortField === 'remainingBudget' && (
                        <ArrowUpDown className={`ml-1 h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                      )}
                    </Button>
                  </TableHead>
                </>
              )}
              {monthNames.map((month, index) => (
                <TableHead key={index} className="text-right w-[5%]">
                  <Button variant="ghost" size="sm" onClick={() => handleSort(`month_${index}`)} className="flex items-center justify-end w-full">
                    {month}
                    {sortField === `month_${index}` && (
                      <ArrowUpDown className={`ml-1 h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                    )}
                  </Button>
                </TableHead>
              ))}
              <TableHead className="text-right w-[10%]">
                <Button variant="ghost" size="sm" onClick={() => handleSort(viewMode === 'revenue' ? 'total' : 'hours')} className="flex items-center justify-end w-full">
                  Totaal
                  {sortField === (viewMode === 'revenue' ? 'total' : 'hours') && (
                    <ArrowUpDown className={`ml-1 h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                  )}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
            <TableBody>
              {projectsData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15} className="text-center py-4">
                    Geen revenue data beschikbaar voor {selectedYear}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {projectsData.map(project => {
                    // CHRONOLOGISCHE BEREKENING VOOR ALLE VASTE PRIJS PROJECTEN
                    if (project.projectType === 'Vaste Prijs' && viewMode === 'revenue') {
                      // Gebruik de projectwaarden
                      const projectBudget = project.projectBudget;
                      const previousYearBudgetUsed = project.previousYearBudgetUsed;
                      const availableBudget = Math.max(0, projectBudget - previousYearBudgetUsed);

                      // Gebruik de juiste data bron
                      const dataToUse = calculationMode === 'lineMax' && correctedRevenueData.length > 0
                        ? correctedRevenueData
                        : revenueData;

                      // Bereken de totale potentiële omzet voor dit project
                      let totalPotentialRevenue = 0;
                      let monthlyPotentialRevenue: number[] = Array(12).fill(0);

                      // Filter project items
                      const projectItems = dataToUse.filter(item => item.projectId === project.id);

                      // Debug logging voor Digital platform project
                      if (project.id === 5592) {
                        console.log(`DEBUG Digital platform (${project.id}): Aantal items: ${projectItems.length}`);
                        console.log(`DEBUG Digital platform (${project.id}): Items:`, projectItems);
                      }

                      // Bereken potentiële omzet per maand
                      console.log(`REVENUE DEBUG: Project ${project.id} (${project.name}) heeft ${projectItems.length} items`);

                      // Toon alle items voor Digital Platform project
                      if (project.id === 5592) {
                        console.log(`REVENUE DEBUG: Alle items voor Digital Platform project:`, projectItems);
                      }

                      // Bereken eerst de totale uren per maand (inclusief niet-doorbelastbare uren)
                      const totalHoursPerMonth = Array(12).fill(0);
                      const nonBillableHoursPerMonth = Array(12).fill(0);
                      const billableHoursPerMonth = Array(12).fill(0);

                      // ZEER BELANGRIJKE FIX: Zorg ervoor dat niet-doorbelastbare uren NOOIT omzet genereren
                      // Pas de projectItems aan zodat niet-doorbelastbare uren altijd revenue 0 hebben
                      const fixedProjectItems = projectItems.map(item => {
                        if (item.invoiceBasisId === 4) { // Niet doorbelastbaar
                          console.log(`REVENUE FINAL FIX: Project ${project.id} (${project.name}): Niet-doorbelastbare uren krijgen revenue 0:`, {
                            projectLineId: item.projectLineId,
                            projectLineName: item.projectLineName,
                            hours: item.hours,
                            month: item.month,
                            invoiceBasisId: item.invoiceBasisId,
                            invoiceBasisName: item.invoiceBasisName,
                            originalRevenue: item.revenue,
                            newRevenue: 0
                          });

                          return {
                            ...item,
                            revenue: 0 // Zet revenue altijd op 0 voor niet-doorbelastbare uren
                          };
                        }
                        return item;
                      });

                      fixedProjectItems.forEach(item => {
                        const monthIndex = item.month - 1;
                        // Tel alle uren mee in de totale uren
                        totalHoursPerMonth[monthIndex] += item.hours;

                        // Tel niet-doorbelastbare uren apart
                        if (item.invoiceBasisId === 4) { // Niet doorbelastbaar
                          nonBillableHoursPerMonth[monthIndex] += item.hours;

                          // Debug logging voor niet-doorbelastbare uren
                          console.log(`REVENUE DEBUG: Project ${project.id} (${project.name}): Niet-doorbelastbare uren in maand ${monthIndex + 1}:`, {
                            projectLineId: item.projectLineId,
                            projectLineName: item.projectLineName,
                            hours: item.hours,
                            invoiceBasisId: item.invoiceBasisId,
                            invoiceBasisName: item.invoiceBasisName,
                            revenue: item.revenue // Moet nu 0 zijn
                          });
                        } else {
                          // Tel doorbelastbare uren apart
                          billableHoursPerMonth[monthIndex] += item.hours;
                        }
                      });

                      // Log de totale uren en niet-doorbelastbare uren voor Digital Platform project
                      if (project.id === 5592) {
                        console.log(`REVENUE DEBUG: Digital Platform - Totale uren per maand:`, totalHoursPerMonth);
                        console.log(`REVENUE DEBUG: Digital Platform - Niet-doorbelastbare uren per maand:`, nonBillableHoursPerMonth);
                      }

                      fixedProjectItems.forEach(item => {
                        const monthIndex = item.month - 1;

                        // Debug logging voor Digital platform project
                        if (project.id === 5592 && item.month === 3) {
                          console.log(`REVENUE DEBUG: Digital platform (${project.id}): Item in maand 3:`, {
                            projectLineId: item.projectLineId,
                            projectLineName: item.projectLineName,
                            hours: item.hours,
                            hourlyRate: item.hourlyRate,
                            invoiceBasisId: item.invoiceBasisId,
                            invoiceBasisName: item.invoiceBasisName,
                            potentialRevenue: item.invoiceBasisId === 4 ? 0 : item.hours * item.hourlyRate
                          });
                        }

                        // Skip niet-doorbelastbare uren (invoiceBasisId === 4) voor omzetberekening
                        if (item.invoiceBasisId === 4) {
                          // Niet-doorbelastbare uren genereren geen omzet
                          console.log(`REVENUE DEBUG FIXED: Project ${project.id} (${project.name}): Niet-doorbelastbare uren in omzetberekening:`, {
                            projectLineId: item.projectLineId,
                            projectLineName: item.projectLineName,
                            hours: item.hours,
                            month: item.month,
                            invoiceBasisId: item.invoiceBasisId,
                            invoiceBasisName: item.invoiceBasisName
                          });
                          return;
                        }

                        const potentialRevenue = item.hours * item.hourlyRate;
                        totalPotentialRevenue += potentialRevenue;
                        monthlyPotentialRevenue[monthIndex] += potentialRevenue;

                        // Debug logging voor Digital platform project
                        if (project.id === 5592 && item.month === 3) {
                          console.log(`REVENUE DEBUG: Digital platform (${project.id}): Added to potential revenue:`, {
                            projectLineId: item.projectLineId,
                            projectLineName: item.projectLineName,
                            hours: item.hours,
                            hourlyRate: item.hourlyRate,
                            potentialRevenue: potentialRevenue,
                            totalPotentialRevenue: totalPotentialRevenue,
                            monthlyPotentialRevenue: monthlyPotentialRevenue[monthIndex]
                          });
                        }
                      });

                      // Bereken de totale overspend
                      const totalOverspend = Math.max(0, totalPotentialRevenue - availableBudget);

                      console.log(`Project ${project.name} (${project.id}): Totale potentiële omzet €${totalPotentialRevenue}, Overspend €${totalOverspend}`);

                      // Debug logging voor Digital platform project
                      if (project.id === 5592) {
                        console.log(`DEBUG Digital platform (${project.id}): Final calculation:`, {
                          totalPotentialRevenue,
                          availableBudget,
                          totalOverspend,
                          monthlyPotentialRevenue
                        });
                      }

                      // Bereken de maandelijkse omzet (chronologisch)
                      const projectMonths = Array(12).fill(0);
                      let remainingBudget = availableBudget;

                      // Wijs budget toe aan maanden in chronologische volgorde
                      for (let i = 0; i < 12; i++) {
                        if (remainingBudget <= 0) {
                          // Geen budget meer over
                          projectMonths[i] = 0;
                        } else if (monthlyPotentialRevenue[i] <= remainingBudget) {
                          // Genoeg budget voor deze maand
                          projectMonths[i] = monthlyPotentialRevenue[i];
                          remainingBudget -= monthlyPotentialRevenue[i];
                        } else {
                          // Niet genoeg budget voor deze maand
                          projectMonths[i] = remainingBudget;
                          remainingBudget = 0;
                        }

                        // Debug logging voor Digital platform project
                        if (project.id === 5592) {
                          console.log(`DEBUG Digital platform (${project.id}): Month ${i + 1} calculation:`, {
                            monthIndex: i,
                            monthlyPotentialRevenue: monthlyPotentialRevenue[i],
                            totalHours: totalHoursPerMonth[i],
                            nonBillableHours: nonBillableHoursPerMonth[i],
                            billableHours: totalHoursPerMonth[i] - nonBillableHoursPerMonth[i],
                            remainingBudget,
                            projectMonthValue: projectMonths[i]
                          });
                        }
                      }

                      return (
                        <TableRow
                          key={project.id}
                          className={
                            excludedProjects.includes(project.id)
                              ? 'bg-gray-200 hover:bg-gray-300 opacity-60'
                              : totalOverspend > 0
                                ? "bg-red-50 hover:bg-red-100"
                                : project.archived
                                  ? 'bg-gray-100 hover:bg-gray-200'
                                  : "hover:bg-gray-50"
                          }
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-1">
                                  {project.name}
                                  {project.archived && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex items-center justify-center rounded-full bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-800 ml-1">
                                            Gearchiveerd
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Gearchiveerd op: {project.archivedon ? (typeof project.archivedon === 'string' && project.archivedon.includes('{') ? new Date(JSON.parse(project.archivedon).date).toLocaleDateString('nl-NL') : new Date(project.archivedon).toLocaleDateString('nl-NL')) : 'Onbekend'}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>
                                {totalOverspend > 0 && (
                                  <div className="text-xs text-red-600 font-normal mt-1">
                                    Overspend: {formatCurrency(totalOverspend)}
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 ml-2"
                                onClick={() => {
                                  if (excludedProjects.includes(project.id)) {
                                    setExcludedProjects(excludedProjects.filter(id => id !== project.id));
                                  } else {
                                    setExcludedProjects([...excludedProjects, project.id]);
                                  }
                                }}
                                title={excludedProjects.includes(project.id) ? "Toevoegen aan totalen" : "Uitsluiten van totalen"}
                              >
                                {excludedProjects.includes(project.id) ? (
                                  <EyeOff className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <Eye className="h-4 w-4 text-gray-400" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>{project.clientName}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              Vaste Prijs
                            </span>
                          </TableCell>
                          {showBudgetColumns && (
                            <>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end">
                                  {formatCurrency(projectBudget)}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(previousYearBudgetUsed)}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(availableBudget)}
                              </TableCell>
                            </>
                          )}
                          {projectMonths.map((value, index) => {
                            // Bepaal of deze maand over budget is
                            const isOverBudget = monthlyPotentialRevenue[index] > 0 && value < monthlyPotentialRevenue[index];
                            // Bepaal of er niet-doorbelastbare uren zijn in deze maand
                            const hasNonBillableHours = nonBillableHoursPerMonth[index] > 0;

                            return (
                              <TableCell
                                key={index}
                                className={isOverBudget ? "text-right bg-red-100 relative" : "text-right relative"}
                              >
                                {viewMode === 'revenue' ? (
                                  // Omzet weergave - toon alleen de omzet van doorbelastbare uren
                                  value > 0 ? formatCurrency(value) : '-'
                                ) : (
                                  // Uren weergave - toon alle uren (inclusief niet-doorbelastbare)
                                  totalHoursPerMonth[index] > 0 ? (
                                    <>
                                      {totalHoursPerMonth[index].toFixed(1)}
                                      {nonBillableHoursPerMonth[index] > 0 && (
                                        <span className="text-gray-500 text-xs ml-1">
                                          ({(totalHoursPerMonth[index] - nonBillableHoursPerMonth[index]).toFixed(1)} doorbelastbaar)
                                        </span>
                                      )}
                                    </>
                                  ) : '-'
                                )}

                                {/* Toon indicator voor over budget */}
                                {isOverBudget && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Deze projectregel is over budget gegaan</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}

                                {/* Toon indicator voor niet-doorbelastbare uren */}
                                {hasNonBillableHours && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="absolute top-1 right-4 w-2 h-2 rounded-full bg-blue-500" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <div className="space-y-1">
                                          <p className="font-semibold">Niet-doorbelastbare uren</p>
                                          <p>Deze maand bevat {nonBillableHoursPerMonth[index].toFixed(1)} niet-doorbelastbare uren</p>
                                          <p>Totaal uren: {totalHoursPerMonth[index].toFixed(1)}</p>
                                          <p>Doorbelastbare uren: {(totalHoursPerMonth[index] - nonBillableHoursPerMonth[index]).toFixed(1)}</p>
                                          <p className="text-xs text-gray-500 mt-1">Niet-doorbelastbare uren genereren geen omzet</p>
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-right font-semibold">
                            {viewMode === 'revenue' ? (
                              formatCurrency(projectMonths.reduce((sum, value) => sum + value, 0))
                            ) : (
                              totalHoursPerMonth.reduce((sum, value) => sum + value, 0).toFixed(1)
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    }

                    // Standaard weergave voor andere projecten
                    return (
                      <TableRow
                        key={project.id}
                        className={
                          excludedProjects.includes(project.id)
                            ? 'bg-gray-200 hover:bg-gray-300 opacity-60'
                            : project.isOverBudget
                              ? 'bg-red-50 hover:bg-red-100'
                              : project.archived
                                ? 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                                : 'hover:bg-gray-50'
                        }>
                        <TableCell className="font-medium">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-1">
                                {project.name}
                                {project.archived && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center justify-center rounded-full bg-gray-300 px-1.5 py-0.5 text-xs font-medium text-gray-800 ml-1">
                                          <Archive className="h-3 w-3 mr-1" /> Gearchiveerd
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Gearchiveerd op: {project.archivedon ? (typeof project.archivedon === 'string' && project.archivedon.includes('{') ? new Date(JSON.parse(project.archivedon).date).toLocaleDateString('nl-NL') : new Date(project.archivedon).toLocaleDateString('nl-NL')) : 'Onbekend'}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                              {/* We tonen geen aparte indicator meer voor niet-doorbelastbare uren */}
                              {project.isOverBudget && viewMode === 'revenue' && (
                                <div className="text-xs text-red-600 font-normal mt-1">
                                  Overspend: {formatCurrency(project.totalOverspend)}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 ml-2"
                              onClick={() => {
                                if (excludedProjects.includes(project.id)) {
                                  setExcludedProjects(excludedProjects.filter(id => id !== project.id));
                                } else {
                                  setExcludedProjects([...excludedProjects, project.id]);
                                }
                              }}
                              title={excludedProjects.includes(project.id) ? "Toevoegen aan totalen" : "Uitsluiten van totalen"}
                            >
                              {excludedProjects.includes(project.id) ? (
                                <EyeOff className="h-4 w-4 text-gray-400" />
                              ) : (
                                <Eye className="h-4 w-4 text-gray-400" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>{project.clientName}</TableCell>
                        <TableCell>
                      {(() => {
                        // Functie om de juiste kleur te bepalen op basis van projectType
                        const getTagColorClasses = (type: string) => {
                          switch (type) {
                            case 'Vaste Prijs':
                              return "bg-blue-100 text-blue-800";
                            case 'Nacalculatie':
                              return "bg-green-100 text-green-800";
                            case 'Intern':
                              return "bg-gray-100 text-gray-800";
                            case 'Contract':
                              return "bg-yellow-100 text-yellow-800";
                            case 'Offerte':
                              return "bg-purple-100 text-purple-800";
                            case 'Verkeerde tag':
                              return "bg-red-100 text-red-800";
                            default:
                              return "bg-red-100 text-red-800";
                          }
                        };

                        // Bepaal de tag die we moeten weergeven
                        let tagToShow = project.projectType;
                        let colorClasses = getTagColorClasses(tagToShow);

                        // Als het een offerte is, toon 'Offerte' tag
                        if (project.isQuote) {
                          tagToShow = 'Offerte';
                          colorClasses = getTagColorClasses('Offerte');
                        }

                        return (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClasses}`}>
                            {tagToShow}
                          </span>
                        );
                      })()}
                    </TableCell>
                    {showBudgetColumns && viewMode === 'revenue' && (
                      <>
                        <TableCell className="text-right">
                          {project.projectBudget > 0 ? (
                            <div className="flex items-center justify-end">
                              {formatCurrency(project.projectBudget)}
                              {/* Toon een waarschuwingsicoon als het een vaste prijs project is met een default budget */}

                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {project.previousYearBudgetUsed > 0 ? formatCurrency(project.previousYearBudgetUsed) : '-'}
                        </TableCell>
                        <TableCell className={`text-right ${project.remainingBudget < 0 ? 'text-red-600' : ''}`}>
                          {project.remainingBudget !== 0 ? formatCurrency(project.remainingBudget) : '-'}
                        </TableCell>
                      </>
                    )}
                        {project.months.map((value: number, index: number) => (
                          <TableCell key={index} className={`${getCellClass(project, index)}`}>
                            {value > 0 ? (viewMode === 'revenue' ?
                              formatCurrency(value) :
                              value.toFixed(1)) : '-'}
                            {shouldShowOverBudgetIndicator(project, index) && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Deze projectregel is over budget gegaan</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-semibold">
                          {viewMode === 'revenue' ?
                            formatCurrency(project.total) :
                            project.total.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* Totalen rij */}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={showBudgetColumns && viewMode === 'revenue' ? 6 : 3} className="font-semibold">
                      Totaal ({projectsData.filter(p => !excludedProjects.includes(p.id)).length} projecten)
                    </TableCell>
                    {viewMode === 'revenue'
                      ? monthlyTotals.totals.map((total, index) => (
                          <TableCell key={index} className="text-right font-semibold">
                            {total > 0 ? formatCurrency(total, true) : '-'}
                          </TableCell>
                        ))
                      : monthlyTotals.hoursPerMonth.map((hours, index) => (
                          <TableCell key={index} className="text-right font-semibold">
                            {hours > 0 ? hours.toFixed(1) : '-'}
                          </TableCell>
                        ))
                    }
                    <TableCell className="text-right font-bold">
                      {viewMode === 'revenue'
                        ? formatCurrency(yearTotal, true)
                        : yearTotalHours.toFixed(1)
                      }
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
  );
};
