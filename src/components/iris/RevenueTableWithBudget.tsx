import React, { useState, useEffect, useMemo } from 'react';
import { useIris } from '../../contexts/IrisContext';
import { formatCurrency } from '../../utils/formatters';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Search, ArrowUpDown, DollarSign, Clock, Info, EyeOff, Eye, Archive } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
// Definieer de types die we nodig hebben
export type ProjectType = 'Vaste Prijs' | 'Nacalculatie' | 'Intern' | 'Contract' | 'Offerte' | 'Verkeerde tag';
export interface RevenueData {
  id: number;
  projectId: number;
  projectName: string;
  clientName: string;
  projectType: string;
  month: number;
  revenue: number;
  hours: number;
}

interface RevenueTableProps {
  viewMode: 'revenue' | 'hours';
}

export function RevenueTableWithBudget({ viewMode }: RevenueTableProps) {
  const {
    revenueData,
    correctedRevenueData,
    projectsData,
    monthlyTargets,
    finalRevenue,
    calculationMode,
    setCalculationMode
  } = useIris();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showBudgetColumns, setShowBudgetColumns] = useState(false);
  const [showArchived, setShowArchived] = useState(true);
  const [excludedProjects, setExcludedProjects] = useState<number[]>([]);

  // Laad uitgesloten projecten bij component mount
  useEffect(() => {
    const storedExcludedProjects = localStorage.getItem('excludedProjects');
    if (storedExcludedProjects) {
      try {
        setExcludedProjects(JSON.parse(storedExcludedProjects));
      } catch (e) {
        console.error('Fout bij laden van uitgesloten projecten:', e);
      }
    }
  }, []);

  // Sla uitgesloten projecten op wanneer ze veranderen
  useEffect(() => {
    localStorage.setItem('excludedProjects', JSON.stringify(excludedProjects));
  }, [excludedProjects]);

  // Filter projecten op basis van zoekterm en archiefstatus
  const filteredProjects = useMemo(() => {
    return projectsData.filter(project => {
      // Filter op zoekterm
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = (
        project.name.toLowerCase().includes(searchLower) ||
        project.clientName.toLowerCase().includes(searchLower) ||
        project.projectType.toLowerCase().includes(searchLower)
      );

      // Filter op archiefstatus
      const matchesArchiveStatus = showArchived || !project.archived;

      return matchesSearch && matchesArchiveStatus;
    });
  }, [projectsData, searchTerm, showArchived]);

  // Sorteer projecten
  const sortedProjects = useMemo(() => {
    return [...filteredProjects].sort((a, b) => {
      let aValue: any = a[sortField as keyof typeof a];
      let bValue: any = b[sortField as keyof typeof b];

      // Speciale behandeling voor numerieke velden
      if (sortField === 'totalRevenue' || sortField === 'totalHours' || sortField === 'budget' || sortField === 'previousYearBudgetUsed' || sortField === 'remainingBudget') {
        aValue = Number(aValue) || 0;
        bValue = Number(bValue) || 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredProjects, sortField, sortDirection]);

  // Bereken totalen per maand
  const monthlyTotals = useMemo(() => {
    const totals = Array(12).fill(0);
    const hoursPerMonth = Array(12).fill(0);

    // Gebruik altijd de gecorrigeerde revenue data als die beschikbaar is
    const dataToUse = correctedRevenueData.length > 0 ? correctedRevenueData : revenueData;

    // Controleer of dataToUse een array is
    if (!dataToUse || !Array.isArray(dataToUse)) {
      return { totals, hoursPerMonth };
    }

    dataToUse.forEach(item => {
      // Sla items over die zijn uitgesloten
      if (excludedProjects.includes(item.projectId)) {
        return;
      }

      const monthIndex = item.month - 1;
      totals[monthIndex] += item.revenue;
      hoursPerMonth[monthIndex] += item.hours;
    });

    return { totals, hoursPerMonth };
  }, [revenueData, correctedRevenueData, excludedProjects]);

  // Bereken totalen per project type
  const projectTypeTotals = useMemo(() => {
    const totals: Record<string, { revenue: number; hours: number }> = {};

    // Gebruik altijd de gecorrigeerde revenue data als die beschikbaar is
    const dataToUse = correctedRevenueData.length > 0 ? correctedRevenueData : revenueData;

    if (!dataToUse || !Array.isArray(dataToUse)) {
      return totals;
    }

    // Initialiseer totalen voor elk project type
    const projectTypes: ProjectType[] = ['Vaste Prijs', 'Nacalculatie', 'Intern', 'Contract', 'Offerte', 'Verkeerde tag'];
    projectTypes.forEach(type => {
      totals[type] = { revenue: 0, hours: 0 };
    });

    // Bereken totalen per project type
    dataToUse.forEach(item => {
      // Sla items over die zijn uitgesloten
      if (excludedProjects.includes(item.projectId)) {
        return;
      }

      const project = projectsData.find(p => p.id === item.projectId);
      if (project) {
        const type = project.isQuote ? 'Offerte' : project.projectType;
        if (totals[type]) {
          totals[type].revenue += item.revenue;
          totals[type].hours += item.hours;
        }
      }
    });

    return totals;
  }, [revenueData, correctedRevenueData, projectsData, excludedProjects]);

  // Bereken totalen
  const totals = useMemo(() => {
    let totalRevenue = 0;
    let totalHours = 0;
    let totalBudget = 0;
    let totalPreviousYearBudgetUsed = 0;
    let totalRemainingBudget = 0;

    sortedProjects.forEach(project => {
      // Sla projecten over die zijn uitgesloten
      if (excludedProjects.includes(project.id)) {
        return;
      }

      totalRevenue += project.totalRevenue;
      totalHours += project.totalHours;
      totalBudget += project.projectBudget;
      totalPreviousYearBudgetUsed += project.previousYearBudgetUsed;
      totalRemainingBudget += project.remainingBudget;
    });

    return { totalRevenue, totalHours, totalBudget, totalPreviousYearBudgetUsed, totalRemainingBudget };
  }, [sortedProjects, excludedProjects]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-start">
        <div className="w-full md:w-1/2 space-y-4">
          <div className="flex flex-col md:flex-row gap-2 items-center">
            <div className="relative w-full md:w-auto flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek op project, klant of type..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2 w-full md:w-auto">
              <Button
                variant={calculationMode === 'projectMax' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCalculationMode('projectMax')}
                className="flex-1 md:flex-none"
              >
                <DollarSign className="h-4 w-4 mr-1" />
                <span>Project Max</span>
              </Button>
              <Button
                variant={calculationMode === 'lineMax' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCalculationMode('lineMax')}
                className="flex-1 md:flex-none"
              >
                <Clock className="h-4 w-4 mr-1" />
                <span>Regel Max</span>
              </Button>
            </div>

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
          </div>

          <div className="relative flex-1">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">
                      <Button variant="ghost" size="sm" onClick={() => handleSort('name')} className="flex items-center">
                        Project
                        {sortField === 'name' && (
                          <ArrowUpDown className={`ml-1 h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                        )}
                      </Button>
                    </TableHead>
                    <TableHead className="w-[20%]">
                      <Button variant="ghost" size="sm" onClick={() => handleSort('clientName')} className="flex items-center">
                        Klant
                        {sortField === 'clientName' && (
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

                    {showBudgetColumns && (
                      <>
                        <TableHead className="w-[8%] text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleSort('budget')} className="flex items-center justify-end w-full">
                            Budget
                            {sortField === 'budget' && (
                              <ArrowUpDown className={`ml-1 h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                            )}
                          </Button>
                        </TableHead>
                        <TableHead className="w-[8%] text-right">
                          <Button variant="ghost" size="sm" onClick={() => handleSort('previousYearBudgetUsed')} className="flex items-center justify-end w-full">
                            Besteed vorig jaar
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

                    <TableHead className="w-[12%] text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleSort(viewMode === 'revenue' ? 'totalRevenue' : 'totalHours')} className="flex items-center justify-end w-full">
                        {viewMode === 'revenue' ? 'Omzet' : 'Uren'}
                        {sortField === (viewMode === 'revenue' ? 'totalRevenue' : 'totalHours') && (
                          <ArrowUpDown className={`ml-1 h-4 w-4 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                        )}
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedProjects.map((project) => (
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
                                      <p>Gearchiveerd op: {project.archivedon ? new Date(project.archivedon).toLocaleDateString('nl-NL') : 'Onbekend'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
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

                  {showBudgetColumns && (
                    <>
                      <TableCell className="text-right">
                        {project.projectBudget > 0 ? formatCurrency(project.projectBudget) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {project.previousYearBudgetUsed > 0 ? formatCurrency(project.previousYearBudgetUsed) : '-'}
                      </TableCell>
                      <TableCell className={`text-right ${project.remainingBudget < 0 ? 'text-red-600' : ''}`}>
                        {project.remainingBudget !== 0 ? formatCurrency(project.remainingBudget) : '-'}
                      </TableCell>
                    </>
                  )}

                      <TableCell className="text-right">
                        {viewMode === 'revenue'
                          ? formatCurrency(project.totalRevenue)
                          : `${project.totalHours.toFixed(1)} uur`}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={3} className="font-semibold">
                      Totaal ({projectsData.filter(p => !excludedProjects.includes(p.id)).length} projecten)
                    </TableCell>

                    {showBudgetColumns && (
                      <>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(totals.totalBudget, true)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(totals.totalPreviousYearBudgetUsed, true)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(totals.totalRemainingBudget, true)}
                        </TableCell>
                      </>
                    )}

                    <TableCell className="text-right font-semibold">
                      {viewMode === 'revenue'
                        ? formatCurrency(totals.totalRevenue, true)
                        : `${totals.totalHours.toFixed(1)} uur`}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Verwijder de componenten die niet bestaan */}
        <div className="w-full md:w-1/2 space-y-4">
          <div className="bg-white p-4 rounded-md border">
            <h3 className="text-lg font-semibold mb-2">Grafiek en statistieken verwijderd</h3>
            <p>De grafiek en statistieken zijn verwijderd om de component eenvoudiger te maken.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
