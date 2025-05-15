import React, { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TooltipProvider } from './components/ui/tooltip';
import EmployeeHoursOverviewPage from './pages/employees/EmployeeHoursOverviewPage';
import EmployeeCardsPage from './pages/employees/cards';
import DashboardPage from './pages/dashboard';
import ProjectsPage from './pages/projects';
import InvoicesPage from './pages/invoices';
import IrisPage from './pages/iris';
import DigitalPlatformFix from './pages/DigitalPlatformFix';
import { Layout } from './components/common/Layout';
import { Toaster } from './components/ui/toaster';
import ErrorBoundary from './components/common/ErrorBoundary';
import { OfflineProvider } from './context/OfflineContext';
import { Loader2 } from 'lucide-react';
import './App.css';

// Auth components
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './pages/auth/LoginPage';
import UnauthorizedPage from './pages/auth/UnauthorizedPage';
import PermissionsDebug from './pages/debug/PermissionsDebug';
import UsersPage from './pages/admin/UsersPage';
import RolesPage from './pages/admin/RolesPage';
import PermissionsPage from './pages/admin/PermissionsPage';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  // DISABLED: Preload employee data when app loads
  // This was causing the "Failed to load employee data: Employee with ID NaN not found" error
  // We've completely disabled it to prevent the error
  /*
  useEffect(() => {
    const preloadEmployeeData = async () => {
      try {
        console.log('Preload completely disabled to avoid API errors');
      } catch (error) {
        console.error('Error preloading employee data:', error);
      }
    };

    const timer = setTimeout(preloadEmployeeData, 1000);
    return () => clearTimeout(timer);
  }, []);
  */

  // Loading fallback component
  const LoadingFallback = () => (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
        <p className="text-gray-600">Pagina laden...</p>
      </div>
    </div>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <OfflineProvider checkInterval={60000}>
          <AuthProvider>
            <BrowserRouter>
              <Layout>
                <ErrorBoundary>
                  <Suspense fallback={<LoadingFallback />}>
                    <Routes>
                      {/* Auth routes */}
                      <Route path="/login" element={
                        <ErrorBoundary>
                          <LoginPage />
                        </ErrorBoundary>
                      } />
                      <Route path="/unauthorized" element={
                        <ErrorBoundary>
                          <UnauthorizedPage />
                        </ErrorBoundary>
                      } />

                      {/* Protected routes */}
                      <Route path="/" element={
                        <ErrorBoundary>
                          <ProtectedRoute requiredPermission="view_dashboard">
                            <DashboardPage />
                          </ProtectedRoute>
                        </ErrorBoundary>
                      } />
                      <Route path="/projects" element={
                        <ErrorBoundary>
                          <ProtectedRoute requiredPermission="view_projects">
                            <ProjectsPage />
                          </ProtectedRoute>
                        </ErrorBoundary>
                      } />
                      <Route path="/employees" element={
                        <ErrorBoundary>
                          <ProtectedRoute requiredPermission="view_employees">
                            <EmployeeHoursOverviewPage />
                          </ProtectedRoute>
                        </ErrorBoundary>
                      } />
                      <Route path="/employees/cards" element={
                        <ErrorBoundary>
                          <ProtectedRoute requiredPermission="view_employees">
                            <EmployeeCardsPage />
                          </ProtectedRoute>
                        </ErrorBoundary>
                      } />
                      <Route path="/invoices" element={
                        <ErrorBoundary>
                          <ProtectedRoute requiredPermission="view_invoices">
                            <InvoicesPage />
                          </ProtectedRoute>
                        </ErrorBoundary>
                      } />
                      <Route path="/iris" element={
                        <ErrorBoundary>
                          <ProtectedRoute requiredPermission="view_iris">
                            <IrisPage />
                          </ProtectedRoute>
                        </ErrorBoundary>
                      } />
                      {/* Admin routes */}
                      <Route path="/admin/users" element={
                        <ErrorBoundary>
                          <ProtectedRoute adminOnly={true}>
                            <UsersPage />
                          </ProtectedRoute>
                        </ErrorBoundary>
                      } />
                      <Route path="/admin/roles" element={
                        <ErrorBoundary>
                          <ProtectedRoute adminOnly={true}>
                            <RolesPage />
                          </ProtectedRoute>
                        </ErrorBoundary>
                      } />
                      <Route path="/admin/permissions" element={
                        <ErrorBoundary>
                          <ProtectedRoute adminOnly={true}>
                            <PermissionsPage />
                          </ProtectedRoute>
                        </ErrorBoundary>
                      } />
                      {/* Debug route */}
                      <Route path="/debug/permissions" element={
                        <ErrorBoundary>
                          <ProtectedRoute requiredPermission="view_dashboard">
                            <PermissionsDebug />
                          </ProtectedRoute>
                        </ErrorBoundary>
                      } />

                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </Layout>
            </BrowserRouter>
          </AuthProvider>
          <Toaster />
        </OfflineProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
