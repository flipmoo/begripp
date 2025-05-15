/**
 * Gripp API Client
 *
 * This class provides an implementation of the IGrippApiClient interface.
 */

import axios, { AxiosResponse } from 'axios';
import { BaseApiClient } from './base-client';
import {
  IGrippApiClient,
  ApiRequestOptions,
  ApiResponse,
  GrippRequest,
  GrippResponse
} from './interfaces';
import { CacheManager } from '../cache';

/**
 * Gripp API client implementation
 */
export class GrippApiClient extends BaseApiClient implements IGrippApiClient {
  /**
   * The API key
   */
  private apiKey: string;

  /**
   * The request queue
   */
  private requestQueue: Array<{
    execute: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }> = [];

  /**
   * The last request time
   */
  private lastRequestTime: number = 0;

  /**
   * The number of active requests
   */
  private activeRequests: number = 0;

  /**
   * The minimum request interval in milliseconds
   */
  private minRequestInterval: number = 500;

  /**
   * The maximum number of concurrent requests
   */
  private maxConcurrentRequests: number = 2;

  /**
   * Whether the queue processor is running
   */
  private isProcessingQueue: boolean = false;

  /**
   * Constructor
   *
   * @param apiKey The API key
   * @param baseUrl The base URL
   * @param cacheManager The cache manager
   */
  constructor(
    apiKey: string,
    baseUrl: string = 'https://api.gripp.com/public/api3.php',
    cacheManager?: CacheManager
  ) {
    super(baseUrl, cacheManager);

    this.apiKey = apiKey;

    // Add default headers to all requests
    this.axios.interceptors.request.use(
      config => {
        config.headers = config.headers || {};
        config.headers['Content-Type'] = 'application/json';
        config.headers['Accept'] = 'application/json';

        // Log the headers for debugging
        console.log('[API] Request headers:', {
          'Content-Type': config.headers['Content-Type'],
          'Accept': config.headers['Accept']
        });

        return config;
      }
    );
  }

  /**
   * Create a Gripp request
   *
   * @param method The request method
   * @param params The request parameters
   * @param options The request options
   * @returns The Gripp request
   */
  createRequest(
    method: string,
    params: Record<string, unknown>[] = [],
    options: Record<string, unknown> = {}
  ): GrippRequest {
    const id = Math.floor(Math.random() * 10000000000);

    console.log(`[GrippAPI] Created request: ${JSON.stringify({
      method,
      params: [params, options],
      id
    }, null, 2)}`);

    return {
      method,
      params: [params, options],
      id
    };
  }

  /**
   * Execute a Gripp request
   *
   * @param request The Gripp request
   * @returns A promise that resolves to the Gripp response
   */
  async executeRequest<T>(request: GrippRequest): Promise<GrippResponse<T>> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        try {
          // Gripp API requires the API key to be sent in the Authorization header as a Bearer token
          console.log('[API] POST ', {
            url: this.baseUrl,
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            data: [request]
          });

          // Set the Authorization header for this specific request
          const response = await this.axios.post<GrippResponse<T>[]>('', [request], {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });

          console.log('[API] Response', response.status, ' ', {
            headers: response.headers,
            data: response.data
          });

          const result = response.data[0];

          if (result.error || result.error_code) {
            console.error('[GrippAPI] Error:', result.error || result.error_code);
            throw new Error(result.error || `Error code: ${result.error_code}`);
          }

          return result;
        } catch (error) {
          console.error('[GrippAPI] Request failed:', error);
          throw error;
        }
      };

      this.requestQueue.push({ execute, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process the request queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.requestQueue.length > 0) {
        // Check if we can make a request
        const now = Date.now();
        const timeToWait = Math.max(0, this.minRequestInterval - (now - this.lastRequestTime));

        if (this.activeRequests >= this.maxConcurrentRequests) {
          await this.delay(100); // Short delay before checking again
          continue;
        }

        // Wait if needed
        if (timeToWait > 0) {
          await this.delay(timeToWait);
        }

        // Process next request
        const request = this.requestQueue.shift();

        if (request) {
          this.activeRequests++;
          this.lastRequestTime = Date.now();

          try {
            const result = await request.execute();
            request.resolve(result);
          } catch (error) {
            if (
              axios.isAxiosError(error) &&
              error.response?.status === 503 &&
              error.response?.headers['retry-after']
            ) {
              // Get retry-after time and add request back to queue
              const retryAfter = parseFloat(error.response.headers['retry-after'] || '1');
              const delayMs = Math.max(this.minRequestInterval, retryAfter * 1000);

              console.log(`[GrippAPI] Rate limited. Retrying after ${delayMs}ms...`);

              await this.delay(delayMs);
              this.requestQueue.unshift(request);
            } else {
              request.reject(error);
            }
          } finally {
            this.activeRequests--;
          }
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Delay execution
   *
   * @param ms The delay in milliseconds
   * @returns A promise that resolves after the delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a response object
   *
   * @param response The axios response
   * @returns The API response
   */
  protected override createResponse<T>(response: AxiosResponse<T>): ApiResponse<T> {
    return {
      data: response.data,
      status: response.status,
      headers: response.headers as Record<string, string>,
      cached: false
    };
  }

  /**
   * Get projects from Gripp
   *
   * @param options Request options
   * @returns A promise that resolves to the projects
   */
  async getProjects(options?: ApiRequestOptions): Promise<ApiResponse<unknown[]>> {
    const cacheKey = options?.cacheKey || 'gripp_projects';

    // Check cache
    if (cacheKey) {
      const cachedData = await this.cacheManager.get<ApiResponse<unknown[]>>(cacheKey);

      if (cachedData) {
        console.log(`[GrippAPI] Cache hit for projects with key ${cacheKey}`);
        return {
          ...cachedData,
          cached: true
        };
      }

      console.log(`[GrippAPI] Cache miss for projects with key ${cacheKey}`);
    }

    // Create request
    const request = this.createRequest(
      'project.get',
      [
        [
          {
            field: 'project.archived',
            operator: 'equals',
            value: false
          }
        ]
      ],
      {
        paging: {
          firstresult: 0,
          maxresults: 250
        },
        orderings: [
          {
            field: 'project.updatedon',
            direction: 'desc'
          }
        ],
        fields: [
          'project.id',
          'project.name',
          'project.number',
          'project.color',
          'project.totalexclvat',
          'project.totalinclvat',
          'project.deadline',
          'project.phase',
          'project.company',
          'project.projectlines.id',
          'project.projectlines.amount',
          'project.projectlines.amountwritten',
          'project.projectlines.description',
          'project.projectlines.sellingprice',
          'project.projectlines.product',
          'project.employees_starred',
          'project.tags'
        ]
      }
    );

    // Execute request
    const response = await this.executeRequest<unknown>(request);

    // Create response
    const apiResponse: ApiResponse<unknown[]> = {
      data: response.result.rows,
      status: 200,
      headers: {},
      cached: false
    };

    // Cache response
    if (cacheKey && options?.cacheTtl) {
      await this.cacheManager.set(
        cacheKey,
        apiResponse,
        {
          ttl: options.cacheTtl
        }
      );

      console.log(`[GrippAPI] Cached projects with key ${cacheKey} and TTL ${options.cacheTtl}s`);
    }

    return apiResponse;
  }

  /**
   * Get project by ID
   *
   * @param id The project ID
   * @param options Request options
   * @returns A promise that resolves to the project
   */
  async getProjectById(id: number, options?: ApiRequestOptions): Promise<ApiResponse<unknown>> {
    const cacheKey = options?.cacheKey || `gripp_project_${id}`;

    // Check cache
    if (cacheKey) {
      const cachedData = await this.cacheManager.get<ApiResponse<unknown>>(cacheKey);

      if (cachedData) {
        console.log(`[GrippAPI] Cache hit for project ${id} with key ${cacheKey}`);
        return {
          ...cachedData,
          cached: true
        };
      }

      console.log(`[GrippAPI] Cache miss for project ${id} with key ${cacheKey}`);
    }

    // Create request
    const request = this.createRequest(
      'project.get',
      [
        [
          {
            field: 'project.id',
            operator: 'equals',
            value: id
          }
        ]
      ],
      {
        fields: [
          'project.id',
          'project.name',
          'project.number',
          'project.color',
          'project.totalexclvat',
          'project.totalinclvat',
          'project.deadline',
          'project.phase',
          'project.company',
          'project.projectlines.id',
          'project.projectlines.amount',
          'project.projectlines.amountwritten',
          'project.projectlines.description',
          'project.projectlines.sellingprice',
          'project.projectlines.product',
          'project.employees_starred',
          'project.tags'
        ]
      }
    );

    // Execute request
    const response = await this.executeRequest<unknown>(request);

    if (response.result.rows.length === 0) {
      throw new Error(`Project with ID ${id} not found`);
    }

    // Create response
    const apiResponse: ApiResponse<unknown> = {
      data: response.result.rows[0],
      status: 200,
      headers: {},
      cached: false
    };

    // Cache response
    if (cacheKey && options?.cacheTtl) {
      await this.cacheManager.set(
        cacheKey,
        apiResponse,
        {
          ttl: options.cacheTtl
        }
      );

      console.log(`[GrippAPI] Cached project ${id} with key ${cacheKey} and TTL ${options.cacheTtl}s`);
    }

    return apiResponse;
  }

  /**
   * Get employees from Gripp
   *
   * @param options Request options
   * @returns A promise that resolves to the employees
   */
  async getEmployees(options?: ApiRequestOptions): Promise<ApiResponse<unknown[]>> {
    const cacheKey = options?.cacheKey || 'gripp_employees';

    // Check cache
    if (cacheKey) {
      const cachedData = await this.cacheManager.get<ApiResponse<unknown[]>>(cacheKey);

      if (cachedData) {
        console.log(`[GrippAPI] Cache hit for employees with key ${cacheKey}`);
        return {
          ...cachedData,
          cached: true
        };
      }

      console.log(`[GrippAPI] Cache miss for employees with key ${cacheKey}`);
    }

    // Create request
    const request = this.createRequest(
      'employee.get',
      [],
      {
        fields: [
          'employee.id',
          'employee.firstname',
          'employee.lastname',
          'employee.email',
          'employee.function',
          'employee.active'
        ]
      }
    );

    // Execute request
    const response = await this.executeRequest<unknown>(request);

    // Create response
    const apiResponse: ApiResponse<unknown[]> = {
      data: response.result.rows,
      status: 200,
      headers: {},
      cached: false
    };

    // Cache response
    if (cacheKey && options?.cacheTtl) {
      await this.cacheManager.set(
        cacheKey,
        apiResponse,
        {
          ttl: options.cacheTtl
        }
      );

      console.log(`[GrippAPI] Cached employees with key ${cacheKey} and TTL ${options.cacheTtl}s`);
    }

    return apiResponse;
  }

  /**
   * Get employee by ID
   *
   * @param id The employee ID
   * @param options Request options
   * @returns A promise that resolves to the employee
   */
  async getEmployeeById(id: number, options?: ApiRequestOptions): Promise<ApiResponse<unknown>> {
    const cacheKey = options?.cacheKey || `gripp_employee_${id}`;

    // Check cache
    if (cacheKey) {
      const cachedData = await this.cacheManager.get<ApiResponse<unknown>>(cacheKey);

      if (cachedData) {
        console.log(`[GrippAPI] Cache hit for employee ${id} with key ${cacheKey}`);
        return {
          ...cachedData,
          cached: true
        };
      }

      console.log(`[GrippAPI] Cache miss for employee ${id} with key ${cacheKey}`);
    }

    // Create request
    const request = this.createRequest(
      'employee.get',
      [
        [
          {
            field: 'employee.id',
            operator: 'equals',
            value: id
          }
        ]
      ],
      {
        fields: [
          'employee.id',
          'employee.firstname',
          'employee.lastname',
          'employee.email',
          'employee.function',
          'employee.active'
        ]
      }
    );

    // Execute request
    const response = await this.executeRequest<unknown>(request);

    if (response.result.rows.length === 0) {
      throw new Error(`Employee with ID ${id} not found`);
    }

    // Create response
    const apiResponse: ApiResponse<unknown> = {
      data: response.result.rows[0],
      status: 200,
      headers: {},
      cached: false
    };

    // Cache response
    if (cacheKey && options?.cacheTtl) {
      await this.cacheManager.set(
        cacheKey,
        apiResponse,
        {
          ttl: options.cacheTtl
        }
      );

      console.log(`[GrippAPI] Cached employee ${id} with key ${cacheKey} and TTL ${options.cacheTtl}s`);
    }

    return apiResponse;
  }

  /**
   * Get hours from Gripp
   *
   * @param options Request options
   * @returns A promise that resolves to the hours
   */
  async getHours(options?: ApiRequestOptions): Promise<ApiResponse<unknown[]>> {
    const cacheKey = options?.cacheKey || 'gripp_hours';

    // Check cache
    if (cacheKey) {
      const cachedData = await this.cacheManager.get<ApiResponse<unknown[]>>(cacheKey);

      if (cachedData) {
        console.log(`[GrippAPI] Cache hit for hours with key ${cacheKey}`);
        return {
          ...cachedData,
          cached: true
        };
      }

      console.log(`[GrippAPI] Cache miss for hours with key ${cacheKey}`);
    }

    // Create request
    const request = this.createRequest(
      'hour.get',
      [],
      {
        fields: [
          'hour.id',
          'hour.employee',
          'hour.project',
          'hour.projectline',
          'hour.date',
          'hour.amount',
          'hour.description',
          'hour.status'
        ]
      }
    );

    // Execute request
    const response = await this.executeRequest<unknown>(request);

    // Create response
    const apiResponse: ApiResponse<unknown[]> = {
      data: response.result.rows,
      status: 200,
      headers: {},
      cached: false
    };

    // Cache response
    if (cacheKey && options?.cacheTtl) {
      await this.cacheManager.set(
        cacheKey,
        apiResponse,
        {
          ttl: options.cacheTtl
        }
      );

      console.log(`[GrippAPI] Cached hours with key ${cacheKey} and TTL ${options.cacheTtl}s`);
    }

    return apiResponse;
  }

  /**
   * Get hours by employee ID
   *
   * @param employeeId The employee ID
   * @param options Request options
   * @returns A promise that resolves to the hours
   */
  async getHoursByEmployeeId(employeeId: number, options?: ApiRequestOptions): Promise<ApiResponse<unknown[]>> {
    const cacheKey = options?.cacheKey || `gripp_hours_employee_${employeeId}`;

    // Check cache
    if (cacheKey) {
      const cachedData = await this.cacheManager.get<ApiResponse<unknown[]>>(cacheKey);

      if (cachedData) {
        console.log(`[GrippAPI] Cache hit for hours by employee ${employeeId} with key ${cacheKey}`);
        return {
          ...cachedData,
          cached: true
        };
      }

      console.log(`[GrippAPI] Cache miss for hours by employee ${employeeId} with key ${cacheKey}`);
    }

    // Create request
    const request = this.createRequest(
      'hour.get',
      [
        [
          {
            field: 'hour.employee',
            operator: 'equals',
            value: employeeId
          }
        ]
      ],
      {
        fields: [
          'hour.id',
          'hour.employee',
          'hour.project',
          'hour.projectline',
          'hour.date',
          'hour.amount',
          'hour.description',
          'hour.status'
        ]
      }
    );

    // Execute request
    const response = await this.executeRequest<unknown>(request);

    // Create response
    const apiResponse: ApiResponse<unknown[]> = {
      data: response.result.rows,
      status: 200,
      headers: {},
      cached: false
    };

    // Cache response
    if (cacheKey && options?.cacheTtl) {
      await this.cacheManager.set(
        cacheKey,
        apiResponse,
        {
          ttl: options.cacheTtl
        }
      );

      console.log(`[GrippAPI] Cached hours by employee ${employeeId} with key ${cacheKey} and TTL ${options.cacheTtl}s`);
    }

    return apiResponse;
  }

  /**
   * Get hours by project ID
   *
   * @param projectId The project ID
   * @param options Request options
   * @returns A promise that resolves to the hours
   */
  async getHoursByProjectId(projectId: number, options?: ApiRequestOptions): Promise<ApiResponse<unknown[]>> {
    const cacheKey = options?.cacheKey || `gripp_hours_project_${projectId}`;

    // Check cache
    if (cacheKey) {
      const cachedData = await this.cacheManager.get<ApiResponse<unknown[]>>(cacheKey);

      if (cachedData) {
        console.log(`[GrippAPI] Cache hit for hours by project ${projectId} with key ${cacheKey}`);
        return {
          ...cachedData,
          cached: true
        };
      }

      console.log(`[GrippAPI] Cache miss for hours by project ${projectId} with key ${cacheKey}`);
    }

    // Create request
    const request = this.createRequest(
      'hour.get',
      [
        [
          {
            field: 'hour.project',
            operator: 'equals',
            value: projectId
          }
        ]
      ],
      {
        fields: [
          'hour.id',
          'hour.employee',
          'hour.project',
          'hour.projectline',
          'hour.date',
          'hour.amount',
          'hour.description',
          'hour.status'
        ]
      }
    );

    // Execute request
    const response = await this.executeRequest<unknown>(request);

    // Create response
    const apiResponse: ApiResponse<unknown[]> = {
      data: response.result.rows,
      status: 200,
      headers: {},
      cached: false
    };

    // Cache response
    if (cacheKey && options?.cacheTtl) {
      await this.cacheManager.set(
        cacheKey,
        apiResponse,
        {
          ttl: options.cacheTtl
        }
      );

      console.log(`[GrippAPI] Cached hours by project ${projectId} with key ${cacheKey} and TTL ${options.cacheTtl}s`);
    }

    return apiResponse;
  }
}
