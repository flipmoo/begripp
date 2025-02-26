// Get API key from environment variables
const getApiKey = () => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.VITE_GRIPP_API_KEY;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.VITE_GRIPP_API_KEY;
  }
  return undefined;
};

export const GRIPP_API_KEY = getApiKey();

// Common headers for all requests
export const GRIPP_API_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// Headers are handled by the proxy server
export const API_CONFIG = {};

export const config = {
  apiUrl: 'https://api.gripp.com/public/api3.php',
  apiKey: GRIPP_API_KEY,
};

// Only throw error if we're in Node.js environment and key is missing
if (typeof process !== 'undefined' && process.env && !GRIPP_API_KEY) {
  throw new Error('VITE_GRIPP_API_KEY is required but not set in environment variables');
} 
