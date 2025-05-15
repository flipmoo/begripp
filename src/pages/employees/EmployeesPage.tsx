/**
 * EmployeesPage Component
 * 
 * This component displays a list of employees with their details.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { ForceRefreshButton } from '../../components/ui/force-refresh-button';
import { getEmployees, clearEmployeeCache } from '../../services/employee.service';
import { Employee } from '../../types/gripp';

const EmployeesPage: React.FC = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployees = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch (err) {
      setError('Failed to load employees');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await clearEmployeeCache();
    await fetchEmployees();
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Employees</h1>
        <div className="flex gap-2">
          <ForceRefreshButton onRefresh={handleRefresh} tooltipText="Refresh employee data" />
          <Button onClick={() => navigate('/employees/cards')}>
            View as Cards
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md" role="alert">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {employees.map((employee) => (
            <Card key={employee.id}>
              <CardHeader className="pb-2">
                <CardTitle>{employee.firstname} {employee.lastname}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p>{employee.email || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p>{employee.phone || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Function</p>
                    <p>{employee.function || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p>{employee.active ? 'Active' : 'Inactive'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeesPage;
