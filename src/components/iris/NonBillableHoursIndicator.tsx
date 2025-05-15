/**
 * NonBillableHoursIndicator Component
 * 
 * Deze component toont een indicator voor niet-doorbelastbare uren in een project.
 * Het haalt de niet-doorbelastbare uren op via de direct-fix API en toont deze in een tooltip.
 */

import React, { useState, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { API_BASE_URL } from '../../config/api';
import { Info } from 'lucide-react';

interface NonBillableHoursIndicatorProps {
  projectId: number;
  year: number;
}

interface NonBillableHoursData {
  projectId: number;
  year: number;
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

export const NonBillableHoursIndicator: React.FC<NonBillableHoursIndicatorProps> = ({ projectId, year }) => {
  const [data, setData] = useState<NonBillableHoursData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNonBillableHours = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${API_BASE_URL}/api/v1/direct-fix/non-billable-hours?projectId=${projectId}&year=${year}`);

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

    if (projectId && year) {
      fetchNonBillableHours();
    }
  }, [projectId, year]);

  if (loading) {
    return <span className="text-gray-400">Loading...</span>;
  }

  if (error) {
    return <span className="text-red-500" title={error}>Error</span>;
  }

  if (!data || data.monthlyTotals.every(hours => hours === 0)) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center text-blue-500 cursor-help">
            <Info className="h-4 w-4 mr-1" />
            <span>Niet-doorbelastbare uren</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="w-80">
          <div className="space-y-2">
            <h4 className="font-semibold">Niet-doorbelastbare uren voor project {projectId}</h4>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="font-semibold">Maand</div>
              <div className="font-semibold">Uren</div>
              <div className="font-semibold">Project regel</div>
              <div className="font-semibold">Type</div>
              
              {data.nonBillableHours.map((item, index) => (
                <React.Fragment key={index}>
                  <div>{parseInt(item.month)}</div>
                  <div>{item.hours.toFixed(1)}</div>
                  <div>{item.project_line_name}</div>
                  <div>{item.invoice_basis_name}</div>
                </React.Fragment>
              ))}
            </div>
            
            <div className="mt-2 pt-2 border-t border-gray-200">
              <div className="font-semibold">Totaal niet-doorbelastbare uren: {data.monthlyTotals.reduce((sum, hours) => sum + hours, 0).toFixed(1)}</div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default NonBillableHoursIndicator;
