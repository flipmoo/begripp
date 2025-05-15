/**
 * Base API Adapter
 *
 * This class provides a base adapter for the API.
 */

import { IUnitOfWork } from '../../interfaces';

/**
 * Base API adapter
 */
export class BaseApiAdapter {
  /**
   * The entity name
   */
  protected entityName = 'entity';

  /**
   * The unit of work
   */
  protected unitOfWork: IUnitOfWork;

  /**
   * Constructor
   *
   * @param unitOfWork The unit of work
   */
  constructor(unitOfWork: IUnitOfWork) {
    this.unitOfWork = unitOfWork;
  }

  /**
   * Parse query parameters
   *
   * @param query The query parameters
   * @returns The parsed query parameters
   */
  protected parseQuery(query?: Record<string, unknown>): Record<string, unknown> {
    if (!query) {
      return {};
    }

    // Convert query parameters to a consistent format
    const parsedQuery: Record<string, unknown> = {};

    // Copy all query parameters
    Object.entries(query).forEach(([key, value]) => {
      parsedQuery[key] = value;
    });

    return parsedQuery;
  }

  /**
   * Safely stringify an object
   *
   * @param obj The object to stringify
   * @returns The stringified object
   */
  protected safeStringify(obj: any): string {
    try {
      return JSON.stringify(obj);
    } catch (error) {
      console.error('Error stringifying object:', error);
      return '{}';
    }
  }

  /**
   * Create a success response
   *
   * @param data The response data
   * @param meta The response metadata
   * @returns The success response
   */
  protected createSuccessResponse(data: unknown, meta?: Record<string, unknown>): any {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
  }

  /**
   * Create an error response
   *
   * @param message The error message
   * @param code The error code
   * @param details The error details
   * @returns The error response
   */
  protected createErrorResponse(message: string, code?: string, details?: unknown): any {
    return {
      success: false,
      error: {
        message,
        code: code || 'ERROR',
        details
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Handle an error
   *
   * @param error The error
   * @returns The error response
   */
  protected handleError(error: unknown): any {
    console.error(`Error in ${this.entityName} adapter:`, error);

    if (error instanceof Error) {
      return this.createErrorResponse(error.message, error.name, error);
    }

    return this.createErrorResponse('Unknown error', 'UNKNOWN_ERROR', error);
  }

  /**
   * Clear the cache
   *
   * @returns A promise that resolves when the cache has been cleared
   */
  protected async clearCache(): Promise<void> {
    try {
      await this.unitOfWork.cacheManager.clear(this.entityName);
    } catch (error) {
      console.error(`Error clearing ${this.entityName} cache:`, error);
    }
  }
}
