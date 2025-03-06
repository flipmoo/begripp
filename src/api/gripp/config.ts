// Get API key from environment variables
export const getApiKey = () => {
  let apiKey = '';
  
  // Browser environment
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    apiKey = import.meta.env.VITE_GRIPP_API_KEY;
  }
  
  // Node.js environment
  if (typeof process !== 'undefined' && process.env) {
    apiKey = process.env.VITE_GRIPP_API_KEY;
  }
  
  if (!apiKey) {
    console.error('No API key found in environment variables');
    throw new Error('API key is required');
  }
  
  return apiKey;
};

export const GRIPP_API_KEY = getApiKey();

// Common headers for all requests
export const GRIPP_API_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// Headers are handled by the proxy server
export const API_CONFIG = {
  baseUrl: '/api'
};

export const config = {
  apiKey: getApiKey(),
  apiUrl: 'https://api.gripp.com/public/api3.php',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
};

// Only throw error if we're in Node.js environment and key is missing
if (typeof process !== 'undefined' && process.env && !config.apiKey) {
  console.warn('Warning: VITE_GRIPP_API_KEY is not set in environment variables, using fallback value');
} 
