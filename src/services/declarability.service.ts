import { format } from 'date-fns';
import { API_BASE, fetchWithRetry } from './api';

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