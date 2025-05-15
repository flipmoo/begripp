import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { getEmployeeStats, EmployeeWithStats, clearEmployeeCache } from '../../services/employee.service';
import { useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

interface EmployeeWithPercentage extends EmployeeWithStats {
  percentage: number;
}

// Add a function to sync hours data
const syncHoursData = async (startDate: string, endDate: string) => {
  try {
    // Sync the data
    const syncResponse = await fetch(`/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ startDate, endDate }),
    });

    if (!syncResponse.ok) {
      throw new Error('Failed to sync data');
    }

    // Clear the cache
    const cacheResponse = await fetch('/api/cache/clear', {
      method: 'POST',
    });

    if (!cacheResponse.ok) {
      throw new Error('Failed to clear cache');
    }

    // Clear local cache
    clearEmployeeCache();

    return true;
  } catch (error) {
    console.error('Error syncing hours data:', error);
    return false;
  }
};

const EmployeeHoursStatus: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<EmployeeWithPercentage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [syncingData, setSyncingData] = useState(false);

  // Get the current month start and end dates
  const getCurrentMonthDates = (): { startDate: string, endDate: string } => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // JavaScript months are 0-indexed

    // First day of current month
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;

    // Last day of current month
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

    return { startDate, endDate };
  };

  useEffect(() => {
    const fetchEmployeeHours = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get current date
        const now = new Date();
        const currentYear = now.getFullYear();

        // Calculate current week number using the proper function
        const getWeekNumber = (date: Date): number => {
          const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
          const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
          return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
        };

        // Get previous week (we want data up until the previous week)
        const currentWeek = getWeekNumber(now);
        const prevWeek = currentWeek > 1 ? currentWeek - 1 : 52; // Go to last week of previous year if we're in week 1

        // Always force refresh for dashboard components to make them more responsive
        const forceRefresh = true;

        // Create a custom callback that will handle dashboard-specific processing
        const dashboardCallback = (data: EmployeeWithStats[]) => {
          // Filter and process data specifically for the dashboard view
          const incompleteEmployees = data
            .filter(employee => employee.active !== false)
            .filter(employee => {
              const percentage = employee.expectedHours > 0 ?
                (employee.writtenHours / employee.expectedHours) * 100 : 100;
              return percentage < 100;
            })
            .map(employee => ({
              ...employee,
              percentage: employee.expectedHours > 0 ?
                (employee.writtenHours / employee.expectedHours) * 100 : 100
            }))
            .sort((a, b) => a.percentage - b.percentage);

          setEmployees(incompleteEmployees);
        };

        // Fetch employee data for the current year and previous week
        await getEmployeeStats(
          currentYear,
          prevWeek,
          dashboardCallback,
          forceRefresh,
          false, // Not preloading
          true   // Is dashboard request
        );

        // Reset retry count after successful fetch
        if (retryCount > 0) {
          setRetryCount(0);
        }
      } catch (err) {
        console.error('Error fetching employee hours:', err);
        setError('Er is een fout opgetreden bij het laden van de medewerker uren. Controleer of de API-server draait.');

        // Retry after 5 seconds if the API server might be starting up
        if (retryCount < 3) {
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 5000);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeeHours();
  }, [retryCount]);

  const handleEmployeeClick = (employeeId: number) => {
    navigate(`/employees/${employeeId}`);
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const handleSyncData = async () => {
    setSyncingData(true);
    try {
      const { startDate, endDate } = getCurrentMonthDates();
      const success = await syncHoursData(startDate, endDate);

      if (success) {
        // Trigger a refetch after successful sync
        setRetryCount(prev => prev + 1);
      } else {
        setError('Synchronisatie van uren is mislukt. Probeer het later opnieuw.');
      }
    } catch (err) {
      console.error('Error syncing data:', err);
      setError('Synchronisatie van uren is mislukt. Probeer het later opnieuw.');
    } finally {
      setSyncingData(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Medewerkers met Onvolledige Uren</CardTitle>
        <button
          onClick={handleSyncData}
          disabled={syncingData}
          className="p-1 text-gray-500 hover:text-blue-500 focus:outline-none"
          title="Refresh data from Gripp"
        >
          <RefreshCw className={`h-5 w-5 ${syncingData ? 'animate-spin text-blue-500' : ''}`} />
        </button>
      </CardHeader>
      <CardContent>
        {loading || syncingData ? (
          <div className="text-center py-4 text-gray-500">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            {syncingData ? 'Gegevens worden gesynchroniseerd...' : 'Medewerker gegevens laden...'}
          </div>
        ) : error ? (
          <div className="text-center py-4">
            <p className="text-red-500 mb-2">{error}</p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center mx-auto"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Opnieuw proberen
            </button>
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            Alle medewerkers hebben hun uren volledig geschreven
          </div>
        ) : (
          <div className="space-y-4">
            {employees.slice(0, 10).map(employee => (
              <div
                key={employee.id}
                className="space-y-1 cursor-pointer hover:bg-gray-50 p-2 rounded-md"
                onClick={() => handleEmployeeClick(employee.id)}
              >
                <div className="flex justify-between">
                  <span className="font-medium">{employee.name}</span>
                  <span className={employee.percentage < 75 ? "text-red-500 font-medium" : "text-yellow-500 font-medium"}>
                    {Math.round(employee.percentage)}%
                  </span>
                </div>
                <Progress
                  value={employee.percentage}
                  className={`h-2 ${employee.percentage < 75 ? "bg-red-100" : "bg-yellow-100"}`}
                />
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Geschreven: {employee.writtenHours.toFixed(1)} uur</span>
                  <span>Verwacht: {employee.expectedHours.toFixed(1)} uur</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EmployeeHoursStatus;