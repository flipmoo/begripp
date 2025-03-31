import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { TooltipProvider } from './components/ui/tooltip';
import EmployeesPage from './pages/employees';
import EmployeeCardsPage from './pages/employees/cards';
import TeamDashboardPage from './pages/dashboard';
import PMDashboardPage from './pages/pm-dash';
import ProjectsPage from './pages/projects';
import InvoicesPage from './pages/invoices';
import RevenuePage from './pages/revenue';
import { Layout } from './components/common/Layout';
import { Toaster } from './components/ui/toaster';
import { getEmployeeStats } from './services/employee.service';
import { getWeekNumber } from './utils/date-utils';
import './App.css';

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
  // Preload employee data when app loads
  useEffect(() => {
    const preloadEmployeeData = async () => {
      try {
        const currentYear = new Date().getFullYear();
        const currentWeek = getWeekNumber(new Date());
        
        console.log('Preloading employee data for current period...');
        // Fetch data in the background without showing loading state
        await getEmployeeStats(currentYear, currentWeek, undefined, 0);
        console.log('Employee data preloaded successfully');
      } catch (error) {
        // Silently fail - this is just a preload
        console.error('Error preloading employee data:', error);
      }
    };
    
    // Use a small delay to not block initial render
    const timer = setTimeout(preloadEmployeeData, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router>
          <Layout>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<TeamDashboardPage />} />
              <Route path="/pm-dash" element={<PMDashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/employees" element={<EmployeesPage />} />
              <Route path="/employees/cards" element={<EmployeeCardsPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/revenue" element={<RevenuePage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Layout>
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App; 
