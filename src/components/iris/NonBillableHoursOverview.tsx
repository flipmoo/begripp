/**
 * NonBillableHoursOverview Component
 * 
 * Deze component toont een overzicht van alle niet-doorbelastbare uren voor alle projecten.
 * Het haalt de niet-doorbelastbare uren op via de direct-fix API en toont deze in een tabel.
 */

import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Loader2, Info } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface NonBillableHoursOverviewProps {
  year: number;
}

interface NonBillableProject {
  projectId: number;
  projectName: string;
  nonBillableHours: Array<{
    project_line_id: number;
    project_line_name: string;
    invoice_basis_id: number;
    invoice_basis_name: string;
    month: string;
    hours: number;
  }>;
  monthlyTotals: number[];
}

interface NonBillableHoursData {
  year: number;
  projects: NonBillableProject[];
}

export const NonBillableHoursOverview: React.FC<NonBillableHoursOverviewProps> = ({ year }) => {
  const [data, setData] = useState<NonBillableHoursData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const fetchNonBillableHours = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${API_BASE_URL}/api/v1/direct-fix/all-non-billable-hours?year=${year}`);

        if (!response.ok) {
          throw new Error(`Failed to fetch non-billable hours: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.success && result.data) {
          setData(result.data);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        console.error('Error fetching non-billable hours:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchNonBillableHours();
  }, [year]);

  const toggleExpanded = (projectId: number) => {
    setExpanded(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Niet-doorbelastbare Uren</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin mr-2" />
          <span>Niet-doorbelastbare uren laden...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Niet-doorbelastbare Uren</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-500">
            Error: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.projects || data.projects.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Niet-doorbelastbare Uren</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-500">
            Geen niet-doorbelastbare uren gevonden voor {year}.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Bereken totalen
  const totalNonBillableHours = data.projects.reduce(
    (total, project) => total + project.monthlyTotals.reduce((sum, hours) => sum + hours, 0),
    0
  );

  // Bereken potentiële omzet die verloren gaat (uitgaande van €100 per uur)
  const potentialLostRevenue = totalNonBillableHours * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Info className="h-5 w-5 mr-2 text-blue-600" />
          Niet-doorbelastbare Uren ({year})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Totaal niet-doorbelastbare uren: </span>
            {totalNonBillableHours.toFixed(1)} uur
            <span className="ml-2 text-gray-600">
              (Potentiële omzet: {formatCurrency(potentialLostRevenue)})
            </span>
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Niet-doorbelastbare uren worden wel meegeteld in het totaal aantal uren, maar genereren geen omzet.
            Deze uren hebben invoice_basis_id = 4 in de database.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Totaal Uren</TableHead>
              <TableHead className="text-right">Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.projects.map(project => {
              const totalHours = project.monthlyTotals.reduce((sum, hours) => sum + hours, 0);
              const isExpanded = expanded[project.projectId] || false;
              
              return (
                <React.Fragment key={project.projectId}>
                  <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => toggleExpanded(project.projectId)}>
                    <TableCell className="font-medium">{project.projectName}</TableCell>
                    <TableCell className="text-right">{totalHours.toFixed(1)}</TableCell>
                    <TableCell className="text-right">
                      <button 
                        className="text-blue-600 hover:text-blue-800 text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpanded(project.projectId);
                        }}
                      >
                        {isExpanded ? 'Verbergen' : 'Tonen'}
                      </button>
                    </TableCell>
                  </TableRow>
                  
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={3} className="bg-gray-50 p-0">
                        <div className="p-3">
                          <h4 className="text-sm font-semibold mb-2">Niet-doorbelastbare projectregels:</h4>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div className="font-medium">Projectregel</div>
                            <div className="font-medium">Maand</div>
                            <div className="font-medium text-right">Uren</div>
                            
                            {project.nonBillableHours.map((item, index) => (
                              <React.Fragment key={index}>
                                <div className="truncate" title={item.project_line_name}>
                                  {item.project_line_name}
                                </div>
                                <div>{parseInt(item.month)}</div>
                                <div className="text-right">{item.hours.toFixed(1)}</div>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default NonBillableHoursOverview;
