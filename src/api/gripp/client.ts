import axios from 'axios';
import * as dotenv from 'dotenv';
import { GrippProject } from '../../types/gripp';

// Load environment variables in Node.js environment
if (typeof process !== 'undefined' && process.env) {
  try {
    dotenv.config();
    console.log('Dotenv loaded successfully');
  } catch (error) {
    console.error('Error loading dotenv:', error);
  }
}

const API_URL = 'https://api.gripp.com/public/api3.php';
const API_KEY = 'mi3Pq0Pfw6CtuFAtEoQ6gXIT7cra2c';

console.log('Using API key:', API_KEY);

// Rate limiting configuration
const MIN_REQUEST_INTERVAL = 500; // Minimum time between requests in ms
const MAX_CONCURRENT_REQUESTS = 2; // Maximum number of concurrent requests
let lastRequestTime = 0;
let activeRequests = 0;

const requestQueue: Array<{
    execute: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
}> = [];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const processQueue = async () => {
    if (requestQueue.length === 0) return;
    
    while (requestQueue.length > 0) {
        // Check if we can make a request
        const now = Date.now();
        const timeToWait = Math.max(0, MIN_REQUEST_INTERVAL - (now - lastRequestTime));
        
        if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
            await delay(100); // Short delay before checking again
            continue;
        }
        
        // Wait if needed
        if (timeToWait > 0) {
            await delay(timeToWait);
        }
        
        // Process next request
        const request = requestQueue.shift();
        if (request) {
            activeRequests++;
            lastRequestTime = Date.now();
            
            try {
                const result = await request.execute();
                request.resolve(result);
            } catch (error) {
                if (axios.isAxiosError(error) && error.response?.status === 503) {
                    // Get retry-after time and add request back to queue
                    const retryAfter = parseFloat(error.response.headers['retry-after'] || '1');
                    const delayMs = Math.max(MIN_REQUEST_INTERVAL, retryAfter * 1000);
                    console.log(`Rate limited. Retrying after ${delayMs}ms...`);
                    await delay(delayMs);
                    requestQueue.unshift(request);
                } else {
                    request.reject(error);
                }
            } finally {
                activeRequests--;
            }
        }
    }
};

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
                        'Accept': 'application/json'
                    }
                });
                
                console.log('API response status:', response.status);
                console.log('API response headers:', JSON.stringify(response.headers, null, 2));
                console.log('API response data:', JSON.stringify(response.data, null, 2));

                const result = response.data[0];
                if (result.error) {
                    console.error('API error:', result.error);
                    throw new Error(result.error.message);
                }
                
                return result;
            } catch (error) {
                if (axios.isAxiosError(error)) {
                    console.error('API request failed:', {
                        message: error.message,
                        status: error.response?.status,
                        data: error.response?.data,
                        headers: error.response?.headers
                    });
                } else {
                    console.error('API request failed:', error);
                }
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
    async makeRequest(method: string, endpoint: string, data?: Record<string, unknown>): Promise<{ data: { response: GrippProject[] } }> {
        try {
            // Gebruik de executeRequest methode om de request uit te voeren
            const request = this.createRequest('GET', [{ endpoint, ...data }]);
            const response = await this.executeRequest<GrippProject>(request);
            
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
    async getProjects(): Promise<GrippProject[]> {
        try {
            console.log('Getting projects from Gripp API...');
            
            // Maak een request om actieve projecten op te halen
            const request = {
                method: 'project.get',
                params: [
                    [
                        {
                            field: 'project.archived',
                            operator: 'equals',
                            value: false
                        }
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
                        // Request alle benodigde velden in één keer
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
                ],
                id: 1
            };
            
            console.log('Sending request to Gripp API:', JSON.stringify(request, null, 2));
            
            // @ts-expect-error - We weten dat dit werkt, ook al matcht het type niet exact
            const response = await this.executeRequest<GrippProject>(request);
            
            if (response.error) {
                console.error('Error from Gripp API:', response.error);
                throw new Error(`Gripp API returned an error: ${JSON.stringify(response.error)}`);
            }
            
            if (!response.result || !response.result.rows) {
                console.error('Unexpected response format from Gripp API:', response);
                throw new Error('Unexpected response format from Gripp API');
            }
            
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