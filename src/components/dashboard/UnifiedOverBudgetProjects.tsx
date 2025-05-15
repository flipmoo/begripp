/**
 * UnifiedOverBudgetProjects Component
 *
 * This component serves as a wrapper around the existing OverBudgetProjects component
 * to maintain compatibility with the unified data structure approach.
 */

import React, { useState, useEffect } from 'react';
import OverBudgetProjects from './OverBudgetProjects';
import axios from 'axios';
import { API_ENDPOINTS, AXIOS_CONFIG } from '../../config/api';
import { GrippProject } from '../../types/gripp';

// Configureer axios instance
const apiClient = axios.create(AXIOS_CONFIG);

const UnifiedOverBudgetProjects: React.FC = () => {
  const [projects, setProjects] = useState<GrippProject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch projects
  const fetchProjects = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(API_ENDPOINTS.DASHBOARD.PROJECTS);

      let projectsData: GrippProject[] = [];

      // Check for unified data structure response
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        projectsData = response.data.data;
      } else if (Array.isArray(response.data)) {
        // Fallback for backward compatibility
        projectsData = response.data;
      } else {
        throw new Error('Unexpected response format from projects API');
      }

      setProjects(projectsData);
      setError(null);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchProjects();

    // Set up event listener for dashboard refresh
    const handleRefresh = () => {
      fetchProjects();
    };

    window.addEventListener('refresh-dashboard-data', handleRefresh);

    // Clean up event listener
    return () => {
      window.removeEventListener('refresh-dashboard-data', handleRefresh);
    };
  }, []);

  return <OverBudgetProjects projects={projects} />;
};

export default UnifiedOverBudgetProjects;
