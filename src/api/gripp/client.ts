import axios from 'axios';
import { GRIPP_API_HEADERS, GRIPP_API_KEY } from './config';

// Create axios instance with base configuration
const client = axios.create({
  baseURL: '/api',  // This will be rewritten by the proxy
  headers: {
    ...GRIPP_API_HEADERS,
    'Authorization': `Bearer ${GRIPP_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 60000, // 60 second timeout
  validateStatus: (status) => {
    return status >= 200 && status < 300; // Only treat 2xx as success
  },
});

// Request queue for rate limiting
const requestQueue: Array<() => Promise<unknown>> = [];
let isProcessingQueue = false;
const currentRequests = new Set<string>();

const processQueue = async () => {
  if (isProcessingQueue || requestQueue.length === 0) return;
  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    if (request) {
      try {
        await request();
        // Wait 200ms between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error('Queue processing error:', error);
      }
    }
  }

  isProcessingQueue = false;
};

// Request interceptor
client.interceptors.request.use(
  (config) => {
    // Create request identifier
    const requestId = `${config.method}-${config.url}-${JSON.stringify(config.data)}`;
    
    // Log request details
    console.log('Outgoing request:', {
      id: requestId,
      method: config.method,
      url: config.url,
      baseURL: config.baseURL,
      headers: config.headers,
      data: config.data
    });
    
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
client.interceptors.response.use(
  (response) => {
    console.log('Response received:', {
      status: response.status,
      url: response.config.url,
      data: response.data
    });
    return response;
  },
  (error) => {
    if (axios.isAxiosError(error)) {
      console.error('API Error:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL,
          headers: error.config?.headers
        }
      });
    }
    return Promise.reject(error);
  }
);

export type GrippRequest = {
  method: string;
  params: [Record<string, unknown>[], Record<string, unknown>];
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
  filters: Record<string, unknown>[] = [],
  options: Record<string, unknown> = {}
): GrippRequest => ({
  method,
  params: [filters, options],
  id: Date.now(),
});

export const executeRequest = async <T>(request: GrippRequest): Promise<GrippResponse<T>> => {
  return new Promise((resolve, reject) => {
    const execute = async () => {
      try {
        console.log('Executing request:', {
          method: request.method,
          params: request.params,
          id: request.id
        });

        const response = await client.post('/public/api3.php', [request]);
        
        console.log('Raw API Response:', response.data);

        // Check if we got a valid response
        if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
          console.error('Invalid response format:', response.data);
          reject(new Error('Invalid response format from API'));
          return;
        }

        const result = response.data[0];
        
        // Check for API error response
        if (result.error) {
          console.error('API error:', result.error);
          reject(new Error(result.error.message || 'Unknown API error'));
          return;
        }

        // Validate result format
        if (!result.result || typeof result.result !== 'object') {
          console.error('Invalid result format:', result);
          reject(new Error('Invalid result format from API'));
          return;
        }

        console.log('Request successful:', {
          id: result.id,
          method: request.method,
          resultCount: result.result.count,
          rowsCount: result.result.rows?.length
        });

        resolve(result);
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.error('API Request failed:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            config: {
              url: error.config?.url,
              method: error.config?.method,
              baseURL: error.config?.baseURL,
              headers: error.config?.headers,
              data: error.config?.data
            }
          });
        }
        reject(error);
      }
    };

    requestQueue.push(execute as () => Promise<unknown>);
    void processQueue();
  });
};

export default client; 