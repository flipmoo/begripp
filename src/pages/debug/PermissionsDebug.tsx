import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { usePermission } from '../../hooks/usePermission';

const PermissionsDebug: React.FC = () => {
  const { user } = useAuth();

  // Permissie checks
  // Algemene permissies
  const canViewDashboard = usePermission('view_dashboard');
  const canViewProjects = usePermission('view_projects');
  const canViewEmployees = usePermission('view_employees');
  const canViewInvoices = usePermission('view_invoices');
  const canViewIris = usePermission('view_iris');
  const canManageUsers = usePermission('manage_users');
  const canManageRoles = usePermission('manage_roles');

  // Dashboard-specifieke permissies
  const canViewDashboardProjects = usePermission('view_dashboard_projects');
  const canViewDashboardEmployees = usePermission('view_dashboard_employees');
  const canViewDashboardInvoices = usePermission('view_dashboard_invoices');
  const canViewDashboardIris = usePermission('view_dashboard_iris');
  const canViewDashboardStats = usePermission('view_dashboard_stats');

  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Permissie Debug</CardTitle>
          <CardDescription>Bekijk de permissies van de ingelogde gebruiker</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium">Gebruiker</h3>
              <pre className="bg-gray-100 p-4 rounded-md overflow-auto">
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>

            <div>
              <h3 className="text-lg font-medium">Permissies</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Algemene permissies</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>view_dashboard: {canViewDashboard ? '✅' : '❌'}</li>
                    <li>view_projects: {canViewProjects ? '✅' : '❌'}</li>
                    <li>view_employees: {canViewEmployees ? '✅' : '❌'}</li>
                    <li>view_invoices: {canViewInvoices ? '✅' : '❌'}</li>
                    <li>view_iris: {canViewIris ? '✅' : '❌'}</li>
                    <li>manage_users: {canManageUsers ? '✅' : '❌'}</li>
                    <li>manage_roles: {canManageRoles ? '✅' : '❌'}</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Dashboard-specifieke permissies</h4>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>view_dashboard_projects: {canViewDashboardProjects ? '✅' : '❌'}</li>
                    <li>view_dashboard_employees: {canViewDashboardEmployees ? '✅' : '❌'}</li>
                    <li>view_dashboard_invoices: {canViewDashboardInvoices ? '✅' : '❌'}</li>
                    <li>view_dashboard_iris: {canViewDashboardIris ? '✅' : '❌'}</li>
                    <li>view_dashboard_stats: {canViewDashboardStats ? '✅' : '❌'}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PermissionsDebug;
