// React and third-party imports
import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Component imports
import { Layout } from './components/common/Layout';
import { Toaster } from './components/ui/toaster';
import { TooltipProvider } from './components/ui/tooltip';

// Page imports
import TeamDashboardPage from './pages/dashboard';
import EmployeesPage from './pages/employees';
import EmployeeCardsPage from './pages/employees/cards';
import InvoicesPage from './pages/invoices';
import PMDashboardPage from './pages/pm-dash';
import ProjectsPage from './pages/projects';

// Service and utility imports
import { getEmployeeStats } from './services/employee.service';
import { getWeekNumber } from './utils/date-utils';

// Styles
import './App.css';

/**
 * Configure React Query client with application defaults
 * - Disable automatic refetching when window regains focus
 * - Limit retry attempts to 1 to prevent excessive API calls on failure
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  /**
   * Preload employee data when the application loads
   * This improves user experience by fetching data in the background
   * so it's ready when the user navigates to the employees page
   */
  useEffect(() => {
    const preloadEmployeeData = async () => {
      try {
        // Get current year and week for data fetching
        const currentYear = new Date().getFullYear();
        const currentWeek = getWeekNumber(new Date());

        console.log('Preloading employee data for current period...');

        // Fetch data in the background without showing loading state
        // The last parameter (0) indicates no loading state should be shown
        await getEmployeeStats(currentYear, currentWeek, undefined, 0);

        console.log('Employee data preloaded successfully');
      } catch (error) {
        // Silently fail - this is just a preload and shouldn't affect the UI
        console.error('Error preloading employee data:', error);
      }
    };

    // Use a small delay to not block initial render
    // This ensures the app UI is responsive before starting background data fetching
    const timer = setTimeout(preloadEmployeeData, 1000);

    // Clean up the timer if the component unmounts
    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* TooltipProvider enables tooltips throughout the application */}
      <TooltipProvider>
        {/* BrowserRouter enables client-side routing */}
        <BrowserRouter>
          {/* Layout component provides consistent page structure */}
          <Layout>
            <Routes>
              {/* Main application routes */}
              <Route path="/" element={<TeamDashboardPage />} />
              <Route path="/pm-dash" element={<PMDashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/employees" element={<EmployeesPage />} />
              <Route path="/employees/cards" element={<EmployeeCardsPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />

              {/* Fallback route redirects to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>

        {/* Toast notifications container */}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
