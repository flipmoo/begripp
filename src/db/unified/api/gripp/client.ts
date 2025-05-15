/**
 * Gripp API Client
 *
 * This file provides a client for the Gripp API.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { GrippApiClientOptions, GrippApiError, GrippApiResponse, IGrippApiClient } from './interfaces';

/**
 * Gripp API client
 */
export class GrippApiClient implements IGrippApiClient {
  /**
   * The axios instance
   */
  private axios: AxiosInstance;

  /**
   * The API key
   */
  private apiKey: string;

  /**
   * The maximum number of retries
   */
  private maxRetries: number;

  /**
   * The retry delay in milliseconds
   */
  private retryDelay: number;

  /**
   * The rate limit in milliseconds
   */
  private rateLimit: number;

  /**
   * The last request time
   */
  private lastRequestTime: number = 0;

  /**
   * Constructor
   *
   * @param options The client options
   */
  constructor(options: GrippApiClientOptions) {
    this.apiKey = options.apiKey;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.rateLimit = options.rateLimit ? 1000 / options.rateLimit : 0;

    this.axios = axios.create({
      baseURL: options.baseUrl || 'https://api.gripp.com/public/api3.php',
      timeout: options.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    // Add request interceptor for rate limiting
    this.axios.interceptors.request.use(async (config) => {
      if (this.rateLimit > 0) {
        const now = Date.now();
        const elapsed = now - this.lastRequestTime;

        if (elapsed < this.rateLimit) {
          await new Promise(resolve => setTimeout(resolve, this.rateLimit - elapsed));
        }

        this.lastRequestTime = Date.now();
      }

      return config;
    });
  }

  /**
   * Get all items
   *
   * @param endpoint The API endpoint
   * @param params The query parameters
   * @returns A promise that resolves to the API response
   */
  async getAll<T>(endpoint: string, params?: Record<string, unknown>): Promise<GrippApiResponse<T[]>> {
    return this.request<T[]>('GET', endpoint, undefined, params);
  }

  /**
   * Get an item by ID
   *
   * @param endpoint The API endpoint
   * @param id The item ID
   * @param params The query parameters
   * @returns A promise that resolves to the API response
   */
  async getById<T>(endpoint: string, id: number | string, params?: Record<string, unknown>): Promise<GrippApiResponse<T>> {
    return this.request<T>('GET', `${endpoint}/${id}`, undefined, params);
  }

  /**
   * Create a new item
   *
   * @param endpoint The API endpoint
   * @param data The item data
   * @returns A promise that resolves to the API response
   */
  async create<T>(endpoint: string, data: unknown): Promise<GrippApiResponse<T>> {
    return this.request<T>('POST', endpoint, data);
  }

  /**
   * Update an item
   *
   * @param endpoint The API endpoint
   * @param id The item ID
   * @param data The item data
   * @returns A promise that resolves to the API response
   */
  async update<T>(endpoint: string, id: number | string, data: unknown): Promise<GrippApiResponse<T>> {
    return this.request<T>('PUT', `${endpoint}/${id}`, data);
  }

  /**
   * Delete an item
   *
   * @param endpoint The API endpoint
   * @param id The item ID
   * @returns A promise that resolves to the API response
   */
  async delete(endpoint: string, id: number | string): Promise<GrippApiResponse<boolean>> {
    return this.request<boolean>('DELETE', `${endpoint}/${id}`);
  }

  /**
   * Execute a custom query
   *
   * @param endpoint The API endpoint
   * @param method The HTTP method
   * @param filters The filters to apply
   * @param options Additional options
   * @returns A promise that resolves to the API response
   */
  async query<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    filters?: unknown,
    options?: unknown
  ): Promise<GrippApiResponse<T>> {
    return this.request<T>(method, endpoint, filters, options);
  }

  /**
   * Execute a request
   *
   * @param method The HTTP method
   * @param endpoint The API endpoint
   * @param data The request data
   * @param params The query parameters
   * @returns A promise that resolves to the API response
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: unknown,
    params?: Record<string, unknown>
  ): Promise<GrippApiResponse<T>> {
    // Create a JSON-RPC request
    const rpcRequest = {
      jsonrpc: "2.0",
      method: endpoint,
      params: data || params || {},
      id: Date.now()
    };

    // Log the request for debugging
    console.log(`[API] ${method} ${endpoint}`, {
      headers: this.axios.defaults.headers,
      data: rpcRequest.params
    });

    const config: AxiosRequestConfig = {
      method: 'POST', // Always use POST for JSON-RPC
      data: rpcRequest // Send as a single JSON-RPC object
    };

    let retries = 0;
    let lastError: Error | null = null;

    while (retries <= this.maxRetries) {
      try {
        const response = await this.axios.request<any>(config);
        return this.handleResponse<T>(response);
      } catch (error) {
        lastError = error as Error;
        console.log(`[API] Response error ${(error as any).response?.status || 'unknown'} ${endpoint}:`, {
          headers: (error as any).response?.headers,
          data: (error as any).response?.data
        });

        if (this.shouldRetry(error, retries)) {
          retries++;
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * retries));
        } else {
          break;
        }
      }
    }

    throw this.handleError(lastError);
  }

  /**
   * Handle a response
   *
   * @param response The axios response
   * @returns The API response
   */
  private handleResponse<T>(response: AxiosResponse<any>): GrippApiResponse<T> {
    const rpcResponse = response.data;

    // Check for JSON-RPC error
    if (rpcResponse.error) {
      console.error('JSON-RPC error:', JSON.stringify(rpcResponse.error, null, 2));
      throw {
        message: rpcResponse.error.message || 'JSON-RPC error',
        code: rpcResponse.error.code || 'JSON_RPC_ERROR',
        details: rpcResponse.error
      };
    }

    // Handle different response formats
    let result: T[];
    let pagination = {};

    if (Array.isArray(rpcResponse.result)) {
      // Simple array result
      result = rpcResponse.result;
    } else if (rpcResponse.result && typeof rpcResponse.result === 'object') {
      if (Array.isArray(rpcResponse.result.rows)) {
        // Result with rows and pagination
        result = rpcResponse.result.rows;

        // Extract pagination info
        if (rpcResponse.result.paging) {
          pagination = {
            total: rpcResponse.result.paging.count || 0,
            page: Math.floor(rpcResponse.result.paging.firstresult / rpcResponse.result.paging.maxresults) + 1,
            limit: rpcResponse.result.paging.maxresults || 0,
            pages: Math.ceil((rpcResponse.result.paging.count || 0) / (rpcResponse.result.paging.maxresults || 1)),
            hasMore: rpcResponse.result.paging.more || false
          };
        }
      } else {
        // Single object result
        result = [rpcResponse.result] as unknown as T[];
      }
    } else {
      // Fallback for other formats
      result = (rpcResponse.result !== undefined ? [rpcResponse.result] : []) as unknown as T[];
    }

    return {
      data: result,
      meta: {
        ...pagination,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Handle an error
   *
   * @param error The error
   * @returns The API error
   */
  private handleError(error: Error | null): GrippApiError {
    if (axios.isAxiosError(error) && error.response) {
      const { data, status } = error.response;

      return {
        message: data.message || error.message,
        code: data.code || `HTTP_${status}`,
        details: data.details || { status }
      };
    }

    return {
      message: error?.message || 'Unknown error',
      code: 'UNKNOWN_ERROR'
    };
  }

  /**
   * Check if a request should be retried
   *
   * @param error The error
   * @param retries The number of retries
   * @returns Whether the request should be retried
   */
  private shouldRetry(error: unknown, retries: number): boolean {
    if (retries >= this.maxRetries) {
      return false;
    }

    if (axios.isAxiosError(error) && error.response) {
      const { status } = error.response;

      // Retry on rate limiting or server errors
      return status === 429 || (status >= 500 && status < 600);
    }

    // Retry on network errors
    return axios.isAxiosError(error) && !error.response;
  }
}
