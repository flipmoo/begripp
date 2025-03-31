import { format } from 'date-fns';

// Update API base URL to use port 3002
const API_BASE = 'http://localhost:3002/api';

// Define interfaces
export interface DepartmentDeclarability {
  departmentId: number;
  departmentName: string;
  totalHours: number;
  declarableHours: number;
  nonDeclarableHours: number;
  declarabilityPercentage: number;
}

export interface DeclarabilityPeriod {
  startDate: string;
  endDate: string;
  departments: DepartmentDeclarability[];
}

// Helper function for API requests with retry logic
async function fetchWithRetry(url: string, options: RequestInit = {}, retryCount = 0): Promise<Response> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (response.status === 503 && retryCount < MAX_RETRIES) {
      console.log(`Received 503 from API, retrying in ${RETRY_DELAY/1000}s (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(fetchWithRetry(url, options, retryCount + 1));
        }, RETRY_DELAY);
      });
    }
    
    return response;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.log(`Network error, retrying in ${RETRY_DELAY/1000}s (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      return new Promise(resolve => {
        setTimeout(() => {
          resolve(fetchWithRetry(url, options, retryCount + 1));
        }, RETRY_DELAY);
      });
    }
    throw error;
  }
}

/**
 * Get declarability data by period (week or month)
 */
export async function getDeclarabilityByPeriod(
  year: number,
  period: 'week' | 'month',
  periodNumber: number
): Promise<DeclarabilityPeriod | null> {
  try {
    console.log(`Fetching declarability data for ${period} ${periodNumber} of ${year}`);
    
    // Format the query based on period type
    const periodQuery = period === 'week' ? `week=${periodNumber}` : `month=${periodNumber}`;
    const url = `${API_BASE}/dashboard/declarability?year=${year}&${periodQuery}`;
    
    const response = await fetchWithRetry(url);
    
    if (!response.ok) {
      console.error(`API error (${response.status}): Failed to fetch declarability data`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching declarability data:', error);
    return null;
  }
}

/**
 * Get employee departments with active count
 */
export async function getEmployeeDepartments(): Promise<{ id: number, name: string, employeeCount: number }[]> {
  try {
    const response = await fetchWithRetry(`${API_BASE}/dashboard/departments`);
    
    if (!response.ok) {
      console.error(`API error (${response.status}): Failed to fetch department data`);
      return [];
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching department data:', error);
    return [];
  }
} 