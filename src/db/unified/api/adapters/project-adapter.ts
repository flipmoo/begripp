/**
 * Project Adapter
 *
 * This class provides an adapter for the project API.
 */

import { Request, Response } from 'express';
import { IUnitOfWork, Project, ProjectLine } from '../../interfaces';
import { BaseApiAdapter } from './base-adapter';
import { IGrippApiClient } from '../interfaces';

/**
 * Project adapter
 */
export class ProjectAdapter extends BaseApiAdapter {
  /**
   * The entity name
   */
  protected entityName = 'project';

  /**
   * The API client
   */
  private apiClient?: IGrippApiClient | null;

  /**
   * Constructor
   *
   * @param unitOfWork The unit of work
   * @param apiClient The Gripp API client
   */
  constructor(unitOfWork: IUnitOfWork, apiClient?: IGrippApiClient | null) {
    super(unitOfWork);
    this.apiClient = apiClient;
  }

  /**
   * Get all projects
   *
   * @param query The query parameters
   * @returns A promise that resolves to the API response
   */
  async getAll(query?: Record<string, unknown>): Promise<any> {
    try {
      console.log('Getting all projects with query:', query);

      // Parse query parameters
      const parsedQuery = this.parseQuery(query);

      // Prepare pagination options
      const page = Number(parsedQuery.page) || 1;
      const limit = Number(parsedQuery.limit) || 50; // Default to 50 projects per page

      // Create mock projects data
      const mockProjects = [
        {
          id: 1,
          grippId: 1001,
          name: 'Website Redesign',
          description: 'Complete website redesign for client',
          status: 'active',
          client: 'Example Client A',
          clientId: 101,
          startDate: '2025-01-01',
          endDate: '2025-06-30',
          budget: 50000,
          spent: 25000,
          remaining: 25000,
          lines: [
            {
              id: 1,
              name: 'Design',
              budget: 20000,
              spent: 15000,
              remaining: 5000
            },
            {
              id: 2,
              name: 'Development',
              budget: 30000,
              spent: 10000,
              remaining: 20000
            }
          ]
        },
        {
          id: 2,
          grippId: 1002,
          name: 'Mobile App Development',
          description: 'New mobile app for client',
          status: 'active',
          client: 'Example Client B',
          clientId: 102,
          startDate: '2025-02-01',
          endDate: '2025-08-31',
          budget: 75000,
          spent: 30000,
          remaining: 45000,
          lines: [
            {
              id: 3,
              name: 'Design',
              budget: 25000,
              spent: 20000,
              remaining: 5000
            },
            {
              id: 4,
              name: 'Development',
              budget: 50000,
              spent: 10000,
              remaining: 40000
            }
          ]
        },
        {
          id: 3,
          grippId: 1003,
          name: 'E-commerce Platform',
          description: 'E-commerce platform development',
          status: 'active',
          client: 'Example Client C',
          clientId: 103,
          startDate: '2025-03-01',
          endDate: '2025-09-30',
          budget: 100000,
          spent: 60000,
          remaining: 40000,
          lines: [
            {
              id: 5,
              name: 'Design',
              budget: 30000,
              spent: 25000,
              remaining: 5000
            },
            {
              id: 6,
              name: 'Development',
              budget: 70000,
              spent: 35000,
              remaining: 35000
            }
          ]
        }
      ];

      // Filter projects based on status if provided
      let filteredProjects = [...mockProjects];
      if (parsedQuery.status) {
        filteredProjects = filteredProjects.filter(project => project.status === parsedQuery.status);
      }

      // Filter projects based on search if provided
      if (parsedQuery.search) {
        const searchTerm = String(parsedQuery.search).toLowerCase();
        filteredProjects = filteredProjects.filter(project =>
          project.name.toLowerCase().includes(searchTerm) ||
          project.description.toLowerCase().includes(searchTerm) ||
          project.client.toLowerCase().includes(searchTerm)
        );
      }

      // Apply pagination
      const total = filteredProjects.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedProjects = filteredProjects.slice(startIndex, endIndex);

      // Create response
      const response = {
        success: true,
        data: paginatedProjects,
        meta: {
          timestamp: new Date().toISOString(),
          total: total,
          page: page,
          limit: limit,
          pages: Math.ceil(total / limit)
        }
      };

      console.log(`Returning ${paginatedProjects.length} mock projects`);
      return response;
    } catch (error) {
      console.error('Error getting projects:', error);
      throw error;
    }
  }

  /**
   * Get a project by ID
   *
   * @param id The project ID
   * @param query The query parameters
   * @returns A promise that resolves to the API response
   */
  async getById(id: string | number, query?: Record<string, unknown>): Promise<any> {
    try {
      console.log(`Getting project ${id} with query:`, query);

      // Parse query parameters
      const parsedQuery = this.parseQuery(query);

      // Create mock projects data
      const mockProjects = [
        {
          id: 1,
          grippId: 1001,
          name: 'Website Redesign',
          description: 'Complete website redesign for client',
          status: 'active',
          client: 'Example Client A',
          clientId: 101,
          startDate: '2025-01-01',
          endDate: '2025-06-30',
          budget: 50000,
          spent: 25000,
          remaining: 25000,
          lines: [
            {
              id: 1,
              name: 'Design',
              budget: 20000,
              spent: 15000,
              remaining: 5000
            },
            {
              id: 2,
              name: 'Development',
              budget: 30000,
              spent: 10000,
              remaining: 20000
            }
          ]
        },
        {
          id: 2,
          grippId: 1002,
          name: 'Mobile App Development',
          description: 'New mobile app for client',
          status: 'active',
          client: 'Example Client B',
          clientId: 102,
          startDate: '2025-02-01',
          endDate: '2025-08-31',
          budget: 75000,
          spent: 30000,
          remaining: 45000,
          lines: [
            {
              id: 3,
              name: 'Design',
              budget: 25000,
              spent: 20000,
              remaining: 5000
            },
            {
              id: 4,
              name: 'Development',
              budget: 50000,
              spent: 10000,
              remaining: 40000
            }
          ]
        },
        {
          id: 3,
          grippId: 1003,
          name: 'E-commerce Platform',
          description: 'E-commerce platform development',
          status: 'active',
          client: 'Example Client C',
          clientId: 103,
          startDate: '2025-03-01',
          endDate: '2025-09-30',
          budget: 100000,
          spent: 60000,
          remaining: 40000,
          lines: [
            {
              id: 5,
              name: 'Design',
              budget: 30000,
              spent: 25000,
              remaining: 5000
            },
            {
              id: 6,
              name: 'Development',
              budget: 70000,
              spent: 35000,
              remaining: 35000
            }
          ]
        }
      ];

      // Find project by ID
      const projectId = Number(id);
      const project = mockProjects.find(p => p.id === projectId);

      if (!project) {
        return this.createErrorResponse(`Project ${id} not found`, 'NOT_FOUND');
      }

      console.log(`Found mock project ${projectId}: ${project.name}`);

      // Create response
      const response = {
        success: true,
        data: project,
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      return response;
    } catch (error) {
      console.error(`Error getting project ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new project
   *
   * @param data The project data
   * @returns A promise that resolves to the API response
   */
  async create(data: unknown): Promise<any> {
    try {
      const project = await this.unitOfWork.projectRepository.create(data as Project);
      return this.createSuccessResponse(project);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Update a project
   *
   * @param id The project ID
   * @param data The project data
   * @returns A promise that resolves to the API response
   */
  async update(id: number | string, data: unknown): Promise<any> {
    try {
      const project = await this.unitOfWork.projectRepository.updateEntity({
        ...(data as Project),
        id: Number(id)
      });
      return this.createSuccessResponse(project);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Delete a project
   *
   * @param id The project ID
   * @returns A promise that resolves to the API response
   */
  async delete(id: number | string): Promise<any> {
    try {
      const deleted = await this.unitOfWork.projectRepository.delete(Number(id));
      return this.createSuccessResponse(deleted);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Synchronize projects
   *
   * @param query The query parameters
   * @returns A promise that resolves to the API response
   */
  async sync(query?: Record<string, unknown>): Promise<any> {
    try {
      console.log('Syncing projects...');

      // Get the API client
      if (!this.apiClient) {
        return this.createErrorResponse('API client not available', 'API_CLIENT_NOT_AVAILABLE');
      }

      // Call the sync service
      const syncService = this.unitOfWork.syncService;
      const result = await syncService.syncProjects();

      return this.createSuccessResponse(result);
    } catch (error) {
      console.error('Error syncing projects:', error);
      return this.handleError(error);
    }
  }
}
