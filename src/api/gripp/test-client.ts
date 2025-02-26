import type { GrippRequest, GrippResponse } from './client';
import { config } from './config';

export async function executeTestRequest<T>(requests: GrippRequest[]): Promise<GrippResponse<T>[]> {
  console.log('Making request to:', config.apiUrl);
  console.log('Request body:', JSON.stringify(requests, null, 2));
  
  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(requests),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
    }

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
} 
