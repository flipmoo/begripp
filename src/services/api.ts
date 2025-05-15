// API configuratie en utilities
import { API_BASE_URL } from '../config/api';

// API basis URL - gebruik de API_BASE_URL uit de config
export const API_BASE = `${API_BASE_URL}/api`;
// export const API_BASE = 'https://mocki.io/v1/1b7a9b7f-9b5a-4e1c-9b5a-4e1c9b5a4e1c'; // Temporary mock API

// Maximum aantal pogingen voor API-verzoeken (voor 503 fouten)
const MAX_RETRY_ATTEMPTS = 5; // Increased from 3 to 5
const RETRY_DELAY = 2000; // 2 seconden
const RATE_LIMIT_RETRY_DELAY = 3000; // 3 seconden basis voor rate limit, met exponentieel backoff

/**
 * Helper functie om API-calls te herhalen met vertraging bij fouten
 */
export async function fetchWithRetry(url: string, options: RequestInit = {}, retryCount = 0): Promise<Response> {
  try {
    // Bewaar de signal voor later gebruik
    const { signal, ...otherOptions } = options;

    // Controleer of de request is afgebroken voordat we proberen
    if (signal && signal.aborted) {
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    }

    // Haal de auth token op uit localStorage
    const token = localStorage.getItem('auth_token');

    const response = await fetch(url, {
      ...otherOptions,
      signal, // Geef het signal door aan fetch
      headers: {
        ...otherOptions.headers,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        // Voeg de auth token toe als deze bestaat
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });

    // Als we een 503 fout krijgen en het maximale aantal pogingen niet hebben bereikt,
    // probeer opnieuw na vertraging
    if (response.status === 503 && retryCount < MAX_RETRY_ATTEMPTS) {
      console.log(`Received 503 from API, retrying in ${RETRY_DELAY/1000}s (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})...`);

      // Controleer voordat we de timeout starten of de request is afgebroken
      if (signal && signal.aborted) {
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      }

      return new Promise((resolve, reject) => {
        // Gebruik een reference voor de timer zodat we hem kunnen annuleren
        const timerId = setTimeout(() => {
          // Voeg een event listener toe voor als de request wordt afgebroken tijdens timeout
          if (signal) {
            signal.removeEventListener('abort', abortHandler);
          }
          resolve(fetchWithRetry(url, options, retryCount + 1));
        }, RETRY_DELAY);

        // Voor het afbreken van de request tijdens de timeout
        const abortHandler = () => {
          clearTimeout(timerId);
          reject(new DOMException('Aborted', 'AbortError'));
        };

        // Voeg een event listener toe om de timeout te annuleren als de request wordt afgebroken
        if (signal) {
          signal.addEventListener('abort', abortHandler, { once: true });
        }
      });
    }

    // Handle 429 Too Many Requests with exponential backoff
    if (response.status === 429 && retryCount < MAX_RETRY_ATTEMPTS) {
      // Calculate exponential backoff with jitter
      const exponentialDelay = RATE_LIMIT_RETRY_DELAY * Math.pow(2, retryCount);
      const jitter = Math.random() * 1000; // Add up to 1 second of random jitter
      const backoffDelay = exponentialDelay + jitter;

      console.log(`Rate limited (429), backing off for ${Math.round(backoffDelay/1000)}s (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})...`);

      // Check if request was aborted before starting timeout
      if (signal && signal.aborted) {
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      }

      // Check for Retry-After header and use it if available
      const retryAfter = response.headers.get('Retry-After');
      const retryAfterMs = retryAfter ? (isNaN(Number(retryAfter)) ?
        new Date(retryAfter).getTime() - Date.now() : // If it's a date
        Number(retryAfter) * 1000) : // If it's seconds
        backoffDelay; // Default to our calculated backoff

      // Use the greater of our backoff or the server's Retry-After
      const finalDelay = Math.max(backoffDelay, retryAfterMs);

      return new Promise((resolve, reject) => {
        const timerId = setTimeout(() => {
          if (signal) {
            signal.removeEventListener('abort', abortHandler);
          }
          resolve(fetchWithRetry(url, options, retryCount + 1));
        }, finalDelay);

        const abortHandler = () => {
          clearTimeout(timerId);
          reject(new DOMException('Aborted', 'AbortError'));
        };

        if (signal) {
          signal.addEventListener('abort', abortHandler, { once: true });
        }
      });
    }

    return response;
  } catch (error) {
    // Geef AbortError door zonder retry
    if (error.name === 'AbortError') {
      throw error;
    }

    // Bij netwerkfout en als we het maximale aantal pogingen niet hebben bereikt,
    // probeer opnieuw na vertraging
    if (retryCount < MAX_RETRY_ATTEMPTS) {
      console.log(`Network error, retrying in ${RETRY_DELAY/1000}s (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})...`);

      // Controleer voordat we de timeout starten of de request is afgebroken
      const { signal } = options;
      if (signal && signal.aborted) {
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      }

      return new Promise((resolve, reject) => {
        // Gebruik een reference voor de timer zodat we hem kunnen annuleren
        const timerId = setTimeout(() => {
          // Voeg een event listener toe voor als de request wordt afgebroken tijdens timeout
          if (signal) {
            signal.removeEventListener('abort', abortHandler);
          }
          resolve(fetchWithRetry(url, options, retryCount + 1));
        }, RETRY_DELAY);

        // Voor het afbreken van de request tijdens de timeout
        const abortHandler = () => {
          clearTimeout(timerId);
          reject(new DOMException('Aborted', 'AbortError'));
        };

        // Voeg een event listener toe om de timeout te annuleren als de request wordt afgebroken
        if (signal) {
          signal.addEventListener('abort', abortHandler, { once: true });
        }
      });
    }
    throw error;
  }
}

/**
 * Controleer of de API-server gereed is
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    console.log('Checking API health at', `${API_BASE}/v1/health`);

    // Create an AbortController to timeout the request after 10 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    // Haal de auth token op uit localStorage
    const token = localStorage.getItem('auth_token');

    const response = await fetch(`${API_BASE}/v1/health`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0',
        // Voeg de auth token toe als deze bestaat
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      try {
        const data = await response.json();
        console.log('API health response:', data);

        // Check if the response has the expected structure (unified data structure)
        if (data.success && data.data && data.data.status === 'ok') {
          return true;
        }

        // Fallback for backward compatibility
        return data.status === 'ok' && data.database === 'connected';
      } catch (parseError) {
        console.error('API health check parse error:', parseError);
        const text = await response.text();
        console.error('API returned non-JSON response:', text.substring(0, 100));
        return false;
      }
    }
    console.error('API health check failed with status:', response.status);
    return false;
  } catch (error) {
    console.error('API health check failed:', error);
    return false;
  }
}

/**
 * Get detailed API status
 *
 * @returns A promise that resolves to an object with detailed API status information
 */
export async function getApiStatus(): Promise<{
  isOnline: boolean;
  statusCode?: number;
  statusText?: string;
  responseTime?: number;
  error?: string;
  data?: any;
}> {
  try {
    const startTime = performance.now();

    // Create an AbortController to timeout the request after 10 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${API_BASE}/v1/health`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

    clearTimeout(timeoutId);

    const endTime = performance.now();
    const responseTime = endTime - startTime;

    let data;
    try {
      data = await response.json();
    } catch (e) {
      // Ignore JSON parse errors
    }

    return {
      isOnline: response.ok,
      statusCode: response.status,
      statusText: response.statusText,
      responseTime,
      data
    };
  } catch (error) {
    return {
      isOnline: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}