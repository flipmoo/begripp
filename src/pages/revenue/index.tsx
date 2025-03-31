import React, { useState, useEffect } from 'react';
import { Table } from '../../components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { getRevenueHours, ProjectRevenue, clearRevenueCache } from '../../services/revenue.service';
import { Button } from '../../components/ui/button';
import { ReloadIcon } from '@radix-ui/react-icons';
import { toast } from 'sonner';

const monthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const Revenue: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectRevenue[]>([]);
  const [year, setYear] = useState(2024);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getRevenueHours(year);
      setProjects(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching revenue data:', err);
      setError('Failed to load revenue data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [year]);

  const handleSync = async () => {
    try {
      setIsSyncing(true);
      toast.info('Bezig met synchroniseren van omzetgegevens...');
      
      // First sync the data with Gripp
      const syncResponse = await fetch(`http://localhost:3002/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: `${year}-01-01`,
          endDate: `${year}-12-31`,
        }),
      });
      
      if (!syncResponse.ok) {
        throw new Error('Failed to sync data with Gripp');
      }
      
      toast.info('Data gesynchroniseerd, cache wordt geleegd...');
      
      // Wait a moment for sync to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Clear the cache
      await fetch('http://localhost:3002/api/cache/clear', {
        method: 'POST',
      });
      
      // Clear client-side cache
      clearRevenueCache();
      
      toast.success('Data succesvol gesynchroniseerd!');
      
      // Refetch the data
      await fetchData();
    } catch (error) {
      console.error('Error syncing data:', error);
      toast.error('Er is een fout opgetreden bij het synchroniseren van de data.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Calculate totals per month across all projects
  const monthlyTotals = Array(12).fill(0);
  projects.forEach(project => {
    project.months.forEach((hours, idx) => {
      monthlyTotals[idx] += hours;
    });
  });

  // Calculate yearly total per project
  const projectTotals = projects.map(project => {
    return project.months.reduce((sum, hours) => sum + hours, 0);
  });

  // Calculate grand total
  const grandTotal = monthlyTotals.reduce((sum, hours) => sum + hours, 0);

  return (
    <div className="container py-8">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-2xl">Revenue Overview - Written Hours {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between mb-4">
            <Button 
              variant="outline" 
              onClick={handleSync} 
              disabled={isSyncing}
              className="flex items-center"
            >
              {isSyncing ? (
                <>
                  <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                  Synchroniseren...
                </>
              ) : (
                <>
                  <ReloadIcon className="mr-2 h-4 w-4" />
                  Synchroniseren
                </>
              )}
            </Button>
            <select 
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="border rounded p-2"
            >
              <option value="2024">2024</option>
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64">
              <p className="text-lg">Loading revenue data...</p>
            </div>
          ) : error ? (
            <div className="text-red-500 p-4 border border-red-200 rounded">
              {error}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left p-2 sticky left-0 bg-gray-100 min-w-[200px]">Project</th>
                    {monthNames.map((month) => (
                      <th key={month} className="text-right p-2 min-w-[80px]">{month}</th>
                    ))}
                    <th className="text-right p-2 bg-gray-200 font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project, idx) => (
                    <tr key={project.projectId} className="border-t hover:bg-gray-50">
                      <td className="p-2 sticky left-0 bg-white hover:bg-gray-50">{project.projectName}</td>
                      {project.months.map((hours, monthIdx) => (
                        <td key={monthIdx} className="text-right p-2">
                          {hours > 0 ? hours.toFixed(1) : ''}
                        </td>
                      ))}
                      <td className="text-right p-2 font-semibold bg-gray-100">
                        {projectTotals[idx].toFixed(1)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t bg-gray-100 font-bold">
                    <td className="p-2 sticky left-0 bg-gray-100">Total</td>
                    {monthlyTotals.map((total, idx) => (
                      <td key={idx} className="text-right p-2">
                        {total > 0 ? total.toFixed(1) : ''}
                      </td>
                    ))}
                    <td className="text-right p-2 bg-gray-200">
                      {grandTotal.toFixed(1)}
                    </td>
                  </tr>
                </tbody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Revenue; 