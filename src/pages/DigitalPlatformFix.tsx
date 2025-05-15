/**
 * DigitalPlatformFix.tsx
 * 
 * Een directe fix voor het probleem met niet-doorbelastbare uren in het Digital Platform project.
 * Deze pagina toont een eenvoudige tabel met de uren per maand, opgesplitst in doorbelastbare en niet-doorbelastbare uren.
 */

import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/api';
import { formatCurrency } from '../utils/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProjectHour {
  id: number;
  employeeId: number;
  date: string;
  month: string;
  hours: number;
  description: string;
  status_id: number;
  status_name: string;
  projectId: number;
  project_name: string;
  project_line_id: number;
  project_line_name: string;
  offerprojectbase_discr: string | null;
}

interface ProjectLine {
  id: number;
  project_id: number;
  searchname: string;
  invoice_basis_id: number;
  invoice_basis_name: string;
}

const DigitalPlatformFix: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [hours, setHours] = useState<ProjectHour[]>([]);
  const [projectLines, setProjectLines] = useState<ProjectLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Constanten
  const DIGITAL_PLATFORM_ID = 5592;
  const YEAR = 2025;
  const MONTHS = ['Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'];

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Haal uren op voor Digital Platform project
        const hoursResponse = await fetch(`${API_BASE_URL}/api/v1/hours?projectId=${DIGITAL_PLATFORM_ID}&year=${YEAR}`);
        if (!hoursResponse.ok) {
          throw new Error(`Failed to fetch hours: ${hoursResponse.statusText}`);
        }
        const hoursData = await hoursResponse.json();
        
        // Haal projectregels op voor Digital Platform project
        const projectLinesResponse = await fetch(`${API_BASE_URL}/api/v1/project-lines?projectId=${DIGITAL_PLATFORM_ID}`);
        if (!projectLinesResponse.ok) {
          throw new Error(`Failed to fetch project lines: ${projectLinesResponse.statusText}`);
        }
        const projectLinesData = await projectLinesResponse.json();
        
        setHours(hoursData.data || []);
        setProjectLines(projectLinesData.data || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Bereken uren per maand
  const calculateHoursPerMonth = () => {
    const totalHoursPerMonth = Array(12).fill(0);
    const billableHoursPerMonth = Array(12).fill(0);
    const nonBillableHoursPerMonth = Array(12).fill(0);
    
    hours.forEach(hour => {
      const monthIndex = parseInt(hour.month) - 1;
      const isNonBillable = projectLines.some(line => 
        line.id === hour.project_line_id && line.invoice_basis_id === 4
      );
      
      totalHoursPerMonth[monthIndex] += hour.hours;
      
      if (isNonBillable) {
        nonBillableHoursPerMonth[monthIndex] += hour.hours;
      } else {
        billableHoursPerMonth[monthIndex] += hour.hours;
      }
    });
    
    return {
      totalHoursPerMonth,
      billableHoursPerMonth,
      nonBillableHoursPerMonth
    };
  };

  // Bereken potentiële omzet per maand
  const calculatePotentialRevenuePerMonth = () => {
    const potentialRevenuePerMonth = Array(12).fill(0);
    
    hours.forEach(hour => {
      const monthIndex = parseInt(hour.month) - 1;
      const isNonBillable = projectLines.some(line => 
        line.id === hour.project_line_id && line.invoice_basis_id === 4
      );
      
      if (!isNonBillable) {
        // Gebruik een standaard uurtarief van €120 als fallback
        const hourlyRate = 120;
        potentialRevenuePerMonth[monthIndex] += hour.hours * hourlyRate;
      }
    });
    
    return potentialRevenuePerMonth;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Laden...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-screen text-red-500">Error: {error}</div>;
  }

  const { totalHoursPerMonth, billableHoursPerMonth, nonBillableHoursPerMonth } = calculateHoursPerMonth();
  const potentialRevenuePerMonth = calculatePotentialRevenuePerMonth();

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4">
        <Link to="/iris">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Terug naar IRIS
          </Button>
        </Link>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Digital Platform (5592) - Uren en Omzet Analyse</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4">
            Deze pagina toont een analyse van de uren en potentiële omzet voor het Digital Platform project,
            met een duidelijke uitsplitsing tussen doorbelastbare en niet-doorbelastbare uren.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Project Informatie</h3>
              <p><strong>Project ID:</strong> {DIGITAL_PLATFORM_ID}</p>
              <p><strong>Project Naam:</strong> Digital Platform</p>
              <p><strong>Jaar:</strong> {YEAR}</p>
              <p><strong>Totaal aantal uren:</strong> {totalHoursPerMonth.reduce((a, b) => a + b, 0).toFixed(1)}</p>
              <p><strong>Doorbelastbare uren:</strong> {billableHoursPerMonth.reduce((a, b) => a + b, 0).toFixed(1)}</p>
              <p><strong>Niet-doorbelastbare uren:</strong> {nonBillableHoursPerMonth.reduce((a, b) => a + b, 0).toFixed(1)}</p>
              <p><strong>Potentiële omzet:</strong> {formatCurrency(potentialRevenuePerMonth.reduce((a, b) => a + b, 0))}</p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-2">Niet-doorbelastbare Projectregels</h3>
              <ul className="list-disc pl-5">
                {projectLines
                  .filter(line => line.invoice_basis_id === 4)
                  .map(line => (
                    <li key={line.id}>{line.searchname}</li>
                  ))}
              </ul>
            </div>
          </div>
          
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Maand</TableHead>
                <TableHead className="text-right">Totaal Uren</TableHead>
                <TableHead className="text-right">Doorbelastbare Uren</TableHead>
                <TableHead className="text-right">Niet-doorbelastbare Uren</TableHead>
                <TableHead className="text-right">Potentiële Omzet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MONTHS.map((month, index) => (
                <TableRow key={index}>
                  <TableCell>{month}</TableCell>
                  <TableCell className="text-right">{totalHoursPerMonth[index].toFixed(1)}</TableCell>
                  <TableCell className="text-right">{billableHoursPerMonth[index].toFixed(1)}</TableCell>
                  <TableCell className="text-right">{nonBillableHoursPerMonth[index].toFixed(1)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(potentialRevenuePerMonth[index])}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold">
                <TableCell>Totaal</TableCell>
                <TableCell className="text-right">{totalHoursPerMonth.reduce((a, b) => a + b, 0).toFixed(1)}</TableCell>
                <TableCell className="text-right">{billableHoursPerMonth.reduce((a, b) => a + b, 0).toFixed(1)}</TableCell>
                <TableCell className="text-right">{nonBillableHoursPerMonth.reduce((a, b) => a + b, 0).toFixed(1)}</TableCell>
                <TableCell className="text-right">{formatCurrency(potentialRevenuePerMonth.reduce((a, b) => a + b, 0))}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default DigitalPlatformFix;
