/**
 * Hour Adapter
 *
 * This class provides an adapter for the hour API.
 */

import { Request, Response } from 'express';
import { IUnitOfWork, Hour } from '../../interfaces';
import { BaseApiAdapter } from './base-adapter';

/**
 * Hour adapter
 */
export class HourAdapter extends BaseApiAdapter {
  /**
   * The entity name
   */
  protected entityName = 'hour';

  /**
   * Constructor
   *
   * @param unitOfWork The unit of work
   */
  constructor(unitOfWork: IUnitOfWork) {
    super(unitOfWork);
  }

  /**
   * Get all hours
   *
   * @param query The query parameters
   * @returns A promise that resolves to the API response
   */
  async getAll(query?: Record<string, unknown>): Promise<any> {
    try {
      console.log('Getting all hours with query:', query);

      // Parse query parameters
      const parsedQuery = this.parseQuery(query);

      // Prepare filters
      const filters: Record<string, unknown> = {};

      // Add status filter
      if (parsedQuery.status) {
        filters.status = parsedQuery.status;
      }

      // Add employee filter
      if (parsedQuery.employee) {
        filters.employee = parsedQuery.employee;
      }

      // Add project filter
      if (parsedQuery.project) {
        filters.project = parsedQuery.project;
      }

      // Add date range filter
      if (parsedQuery.startDate) {
        filters.startDate = parsedQuery.startDate;
      }

      if (parsedQuery.endDate) {
        filters.endDate = parsedQuery.endDate;
      }

      // Prepare pagination options
      const page = Number(parsedQuery.page) || 1;
      const limit = Number(parsedQuery.limit) || 50; // Default to 50 hours per page

      // Get hours from repository
      const { hours, total } = await this.unitOfWork.hourRepository.getAll(filters, page, limit);

      // Map hours to a consistent format
      const mappedHours = hours.map(hour => {
        // Create a consistent hour object with all required fields
        return {
          id: hour.id,
          grippId: hour.grippId,
          employee: hour.employee,
          employeeId: hour.employeeId || hour.employee_id,
          employeeName: hour.employeeName || hour.employee_name,
          project: hour.project,
          projectId: hour.projectId || hour.project_id,
          projectName: hour.projectName || hour.project_name,
          date: hour.date,
          hours: hour.hours,
          description: hour.description || '',
          status: hour.status || 'approved',
          billable: hour.billable || true,
          createdAt: hour.createdAt || hour.created_at,
          updatedAt: hour.updatedAt || hour.updated_at
        };
      });

      // Create response
      const response = {
        success: true,
        data: mappedHours,
        meta: {
          timestamp: new Date().toISOString(),
          total: total,
          page: page,
          limit: limit,
          pages: Math.ceil(total / limit)
        }
      };

      console.log(`Returning ${mappedHours.length} hours from database`);
      return response;
    } catch (error) {
      console.error('Error getting hours:', error);
      throw error;
    }
  }

  /**
   * Get an hour by ID
   *
   * @param id The hour ID
   * @param query The query parameters
   * @returns A promise that resolves to the API response
   */
  async getById(id: string | number, query?: Record<string, unknown>): Promise<any> {
    try {
      console.log(`Getting hour ${id} with query:`, query);

      // Parse query parameters
      const parsedQuery = this.parseQuery(query);

      // Get hour from repository
      const hourId = Number(id);
      const hour = await this.unitOfWork.hourRepository.getById(hourId);

      if (!hour) {
        return this.createErrorResponse(`Hour ${id} not found`, 'NOT_FOUND');
      }

      console.log(`Found hour ${hourId}`);

      // Create a simplified hour object
      const mappedHour = {
        id: hour.id,
        grippId: hour.grippId,
        employee: hour.employee,
        employeeId: hour.employeeId || hour.employee_id,
        employeeName: hour.employeeName || hour.employee_name,
        project: hour.project,
        projectId: hour.projectId || hour.project_id,
        projectName: hour.projectName || hour.project_name,
        date: hour.date,
        hours: hour.hours,
        description: hour.description || '',
        status: hour.status || 'approved',
        billable: hour.billable || true,
        createdAt: hour.createdAt || hour.created_at,
        updatedAt: hour.updatedAt || hour.updated_at
      };

      // Create response
      const response = {
        success: true,
        data: mappedHour,
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      return response;
    } catch (error) {
      console.error(`Error getting hour ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new hour
   *
   * @param data The hour data
   * @returns A promise that resolves to the API response
   */
  async create(data: unknown): Promise<any> {
    try {
      const hour = await this.unitOfWork.hourRepository.create(data as Hour);
      return this.createSuccessResponse(hour);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Update an hour
   *
   * @param id The hour ID
   * @param data The hour data
   * @returns A promise that resolves to the API response
   */
  async update(id: number | string, data: unknown): Promise<any> {
    try {
      const hour = await this.unitOfWork.hourRepository.updateEntity({
        ...(data as Hour),
        id: Number(id)
      });
      return this.createSuccessResponse(hour);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Delete an hour
   *
   * @param id The hour ID
   * @returns A promise that resolves to the API response
   */
  async delete(id: number | string): Promise<any> {
    try {
      const deleted = await this.unitOfWork.hourRepository.delete(Number(id));
      return this.createSuccessResponse(deleted);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Synchronize hours
   *
   * @param query The query parameters
   * @returns A promise that resolves to the API response
   */
  async sync(query?: Record<string, unknown>): Promise<any> {
    try {
      console.log('Syncing hours...');

      // Call the sync service
      const syncService = this.unitOfWork.syncService;
      const result = await syncService.syncHours();

      return this.createSuccessResponse(result);
    } catch (error) {
      console.error('Error syncing hours:', error);
      return this.handleError(error);
    }
  }
}
