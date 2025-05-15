/**
 * API Service for Dashboard
 * Provides methods to interact with the API for dashboard data
 */

import axios from 'axios';
import { AXIOS_CONFIG, API_ENDPOINTS, API_BASE_URL } from '../../config/api';
import { GrippProject } from '../../types/gripp';

// Create axios instance with configuration
// Update the base URL to include the API_BASE_URL
const apiClient = axios.create({
  ...AXIOS_CONFIG,
  baseURL: API_BASE_URL
});

/**
 * API Service for dashboard data
 */
export const apiService = {
  /**
   * Get all projects from the API
   * @returns Promise with array of projects
   */
  getAllProjects: async (): Promise<GrippProject[]> => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.DASHBOARD.PROJECTS);

      // Check for unified data structure response
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        return response.data.data;
      }

      // Fallback for backward compatibility
      if (Array.isArray(response.data)) {
        return response.data;
      }

      console.error('Unexpected response format from projects API:', response.data);
      return [];
    } catch (error) {
      console.error('Error fetching projects:', error);
      throw error;
    }
  },

  /**
   * Get project details by ID
   * @param id Project ID
   * @returns Promise with project details
   */
  getProjectById: async (id: string | number): Promise<GrippProject | null> => {
    try {
      const endpoint = API_ENDPOINTS.DASHBOARD.PROJECT_DETAILS(Number(id));
      const response = await apiClient.get(endpoint);

      // Check for unified data structure response
      if (response.data && response.data.success && response.data.data) {
        return response.data.data;
      }

      // Fallback for backward compatibility
      if (response.data && !response.data.success) {
        return response.data;
      }

      console.error('Unexpected response format from project details API:', response.data);
      return null;
    } catch (error) {
      console.error(`Error fetching project ${id}:`, error);
      return null;
    }
  },

  /**
   * Get all invoices from the API
   * @returns Promise with array of invoices
   */
  getAllInvoices: async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.INVOICES.GET_ALL);

      // Check for unified data structure response
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        return response.data.data;
      }

      // Fallback for backward compatibility
      if (Array.isArray(response.data)) {
        return response.data;
      }

      console.error('Unexpected response format from invoices API:', response.data);
      return [];
    } catch (error) {
      console.error('Error fetching invoices:', error);
      throw error;
    }
  },

  /**
   * Get overdue invoices from the API
   * @returns Promise with array of overdue invoices
   */
  getOverdueInvoices: async () => {
    try {
      const response = await apiClient.get(API_ENDPOINTS.INVOICES.OVERDUE);

      // Check for unified data structure response
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        return response.data.data;
      }

      // Fallback for backward compatibility
      if (Array.isArray(response.data)) {
        return response.data;
      }

      console.error('Unexpected response format from overdue invoices API:', response.data);
      return [];
    } catch (error) {
      console.error('Error fetching overdue invoices:', error);
      throw error;
    }
  },

  /**
   * Synchronize projects with Gripp
   * @returns Promise with sync result
   */
  syncProjects: async (): Promise<boolean> => {
    try {
      console.log('Syncing projects with Gripp...');
      const response = await apiClient.post(API_ENDPOINTS.SYNC.PROJECTS);

      // Check for unified data structure response
      if (response.data && response.data.success) {
        console.log('Projects sync successful:', response.data);
        return true;
      }

      console.error('Unexpected response format from projects sync API:', response.data);
      return false;
    } catch (error) {
      console.error('Error syncing projects:', error);
      return false;
    }
  },

  /**
   * Synchronize a specific project by ID
   * @param id Project ID
   * @returns Promise with the updated project
   */
  syncProjectById: async (id: number): Promise<GrippProject | null> => {
    try {
      console.log(`Syncing project ${id} with Gripp...`);
      const endpoint = API_ENDPOINTS.SYNC.PROJECT_BY_ID(id);
      const response = await apiClient.post(endpoint);

      // Check for unified data structure response
      if (response.data && response.data.success && response.data.data) {
        console.log('Project sync successful:', response.data);
        return response.data.data;
      }

      // Fallback for backward compatibility
      if (response.data && !response.data.success) {
        return response.data;
      }

      console.error('Unexpected response format from project sync API:', response.data);
      return null;
    } catch (error) {
      console.error(`Error syncing project ${id}:`, error);
      return null;
    }
  },

  /**
   * Get project details by ID
   * @param id Project ID
   * @returns Promise with project details
   */
  getProjectDetails: async (id: number): Promise<GrippProject | null> => {
    try {
      const endpoint = API_ENDPOINTS.DASHBOARD.PROJECT_DETAILS(id);
      const response = await apiClient.get(endpoint);

      // Check for unified data structure response
      if (response.data && response.data.success && response.data.data) {
        return response.data.data;
      }

      // Fallback for backward compatibility
      if (response.data && !response.data.success) {
        return response.data;
      }

      console.error('Unexpected response format from project details API:', response.data);
      return null;
    } catch (error) {
      console.error(`Error fetching project ${id}:`, error);
      return null;
    }
  }
};
