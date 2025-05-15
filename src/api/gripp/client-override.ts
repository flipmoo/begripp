/**
 * Gripp API Client Override
 *
 * Dit bestand overschrijft de Gripp API client om de lokale proxy te gebruiken
 * in plaats van de echte Gripp API. Dit voorkomt CORS-problemen.
 */
import axios from 'axios';
import { API_PORT } from '../../config/ports';

// Gebruik de lokale proxy in plaats van de echte Gripp API
const API_URL = `http://localhost:${API_PORT}/api/v1/gripp-proxy`;
const API_KEY = 'mock-api-key-for-testing';

console.log('Using Gripp API proxy server:', API_URL);

// Rate limiting configuration
const MIN_REQUEST_INTERVAL = 0; // Geen rate limiting voor de lokale proxy
const MAX_CONCURRENT_REQUESTS = 10; // Meer concurrent requests toestaan
let lastRequestTime = 0;
let activeRequests = 0;

const requestQueue: Array<{
  execute: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}> = [];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function processQueue() {
  if (requestQueue.length === 0 || activeRequests >= MAX_CONCURRENT_REQUESTS) {
    return;
  }

  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
  }

  const { execute, resolve, reject } = requestQueue.shift()!;
  activeRequests++;
  lastRequestTime = Date.now();

  try {
    const result = await execute();
    resolve(result);
  } catch (error) {
    reject(error);
  } finally {
    activeRequests--;
    processQueue().catch(console.error);
  }
}

export type GrippRequest = {
  method: string;
  params: any; // Verander naar any om flexibeler te zijn met verschillende API-calls
  id: number;
};

export type GrippResponse<T> = {
  id: number;
  thread: string;
  result: {
    rows: T[];
    count: number;
    start: number;
    limit: number;
    next_start: number;
    more_items_in_collection: boolean;
  };
  error: null | {
    code: number;
    message: string;
  };
};

export const createRequest = (
  method: string,
  params: Record<string, unknown>[] = [],
  options: Record<string, unknown> = {}
): GrippRequest => {
  const id = Math.floor(Math.random() * 10000000000);

  console.log(`Created Gripp request: ${JSON.stringify({
    method,
    params: [params, options],
    id
  }, null, 2)}`);

  return {
    method,
    params: [params, options],
    id
  };
};

export const executeRequest = async <T>(request: GrippRequest): Promise<GrippResponse<T>> => {
  return new Promise((resolve, reject) => {
    const execute = async () => {
      try {
        console.log('Making API request to:', API_URL);
        console.log('Request headers:', {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        });
        console.log('Request body:', JSON.stringify([request], null, 2));

        const response = await axios.post(API_URL, [request], {
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          timeout: 30000 // 30 seconds timeout
        });

        console.log('API response status:', response.status);
        console.log('API response data:', JSON.stringify(response.data, null, 2));

        if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
          throw new Error('Invalid response format');
        }

        const responseData = response.data[0];

        if (responseData.error) {
          throw new Error(`API error: ${responseData.error.message}`);
        }

        return responseData;
      } catch (error) {
        console.error('API request error:', error);
        throw error;
      }
    };

    // @ts-ignore - Negeer de type error voor nu, dit is een complexe type issue die later opgelost kan worden
    requestQueue.push({ execute, resolve, reject });
    processQueue().catch(error => {
      console.error('Queue processing error:', error);
      reject(error);
    });
  });
};

export class GrippClient {
  async executeRequest<T>(request: GrippRequest): Promise<GrippResponse<T>> {
    return executeRequest<T>(request);
  }

  createRequest(
    method: string,
    params: Record<string, unknown>[] = [],
    options: Record<string, unknown> = {}
  ): GrippRequest {
    return createRequest(method, params, options);
  }

  /**
   * Maak een HTTP request naar de Gripp API
   */
  async makeRequest(method: string, endpoint: string, data?: Record<string, unknown>): Promise<{ data: { response: any[] } }> {
    try {
      // Gebruik de executeRequest methode om de request uit te voeren
      const request = this.createRequest('GET', [{ endpoint, ...data }]);
      const response = await this.executeRequest<any>(request);

      return {
        data: {
          response: response.result.rows
        }
      };
    } catch (error) {
      console.error(`Error making request to ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Haal projecten op van Gripp
   */
  async getProjects(): Promise<any[]> {
    try {
      console.log('Getting projects from Gripp API...');

      const request = this.createRequest('project.get', [], {
        paging: {
          firstresult: 0,
          maxresults: 1000
        },
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
          'project.tags',
          'project.archived',
          'project.archivedon',
          'project.createdon',
          'project.updatedon',
          'project.offerprojectbase_id',
          'project.offerprojectbase_discr'
        ]
      });

      console.log('Sending request to Gripp API:', JSON.stringify(request, null, 2));
      const response = await this.executeRequest<any>(request);

      console.log(`Received ${response.result.rows.length} projects from Gripp API`);
      return response.result.rows;
    } catch (error) {
      console.error('Error fetching projects from Gripp:', error);
      // Throw the error instead of returning an empty array
      throw error;
    }
  }
}

export const grippClient = new GrippClient();
