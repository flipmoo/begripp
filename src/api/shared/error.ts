import { Response } from 'express';

/**
 * Gestandaardiseerde error handling voor API endpoints
 */
export const handleError = (res: Response, error: Error, endpoint?: string) => {
  if (endpoint) {
    console.error(`Error in ${endpoint}:`, error);
  } else {
    console.error('API error:', error);
  }
  
  return res.status(500).json({ 
    error: 'API request failed', 
    details: error.message 
  });
}; 