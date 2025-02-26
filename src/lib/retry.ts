/**
 * Type voor een functie die we willen retrying
 */
type RetryableFunction<T> = () => Promise<T>;

/**
 * Type voor API error responses
 */
interface ApiErrorResponse {
  status?: number;
  headers?: {
    'retry-after'?: string;
  };
  data?: {
    message?: string;
  };
}

/**
 * Type voor API errors
 */
interface ApiError extends Error {
  response?: ApiErrorResponse;
}

/**
 * Opties voor de retry functie
 */
interface RetryOptions {
  maxAttempts?: number;
  maxTimeout?: number;
  baseDelay?: number;
  shouldRetry?: (error: ApiError) => boolean;
}

/**
 * Promise-based delay functie voor de browser
 */
const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Voorbeeld 1: Loop met een break statement
 * Deze functie probeert een operatie uit te voeren en stopt wanneer het lukt of
 * het maximum aantal pogingen is bereikt
 */
export async function retryWithBreak<T>(
  fn: RetryableFunction<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxTimeout = 8000,
    shouldRetry = () => true
  } = options;

  let attempt = 0;
  
  while (true) { // Oneindige loop die we controleren met break
    try {
      return await fn(); // Direct return bij succes
    } catch (error) {
      attempt++;
      
      // Break de loop als we het maximum hebben bereikt of niet meer moeten retrying
      if (attempt >= maxAttempts || !shouldRetry(error as ApiError)) {
        break;
      }

      // Exponentiële backoff met een maximum
      const delayTime = Math.min(baseDelay * Math.pow(2, attempt - 1), maxTimeout);
      await delay(delayTime);
    }
  }
  
  throw new Error(`Failed after ${attempt} attempts`);
}

/**
 * Voorbeeld 2: Loop met een condition in de while statement
 * Deze implementatie gebruikt een expliciete conditie in de while loop
 */
export async function retryWithCondition<T>(
  fn: RetryableFunction<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxTimeout = 8000,
    shouldRetry = () => true
  } = options;

  let attempt = 0;
  let lastError: ApiError | null = null;

  // Loop conditie checkt direct het aantal pogingen
  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as ApiError;
      
      if (!shouldRetry(lastError)) {
        attempt = maxAttempts; // Forceer loop te stoppen
        break;
      }

      attempt++;
      if (attempt < maxAttempts) {
        const delayTime = Math.min(baseDelay * Math.pow(2, attempt - 1), maxTimeout);
        await delay(delayTime);
      }
    }
  }

  throw lastError || new Error(`Failed after ${attempt} attempts`);
}

/**
 * Voorbeeld 3: Loop met een return in een recursieve functie
 * Deze implementatie gebruikt recursie in plaats van een expliciete loop
 */
export async function retryWithRecursion<T>(
  fn: RetryableFunction<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxTimeout = 8000,
    shouldRetry = () => true
  } = options;

  // Interne recursieve functie
  async function attempt(attemptsLeft: number, lastError: ApiError | null = null): Promise<T> {
    // Base case: geen pogingen meer over
    if (attemptsLeft <= 0) {
      throw lastError || new Error('Maximum attempts reached');
    }

    try {
      return await fn(); // Success case: direct return
    } catch (error) {
      const apiError = error as ApiError;
      if (!shouldRetry(apiError)) {
        throw apiError; // Direct throw als we niet moeten retrying
      }

      const delayTime = Math.min(
        baseDelay * Math.pow(2, maxAttempts - attemptsLeft),
        maxTimeout
      );
      await delay(delayTime);

      // Recursieve call met één poging minder
      return attempt(attemptsLeft - 1, apiError);
    }
  }

  return attempt(maxAttempts);
}

/**
 * Helper functie om te bepalen of we moeten retrying op basis van de error
 */
export function isRetryableError(error: ApiError): boolean {
  // Retry op netwerk errors of 503 status
  return !error.response || error.response.status === 503;
}

/**
 * Helper functie om retry delay te berekenen op basis van headers of fallback
 */
export function calculateRetryDelay(error: ApiError, attempt: number, baseDelay: number = 1000): number {
  // Gebruik retry-after header als die er is
  const retryAfter = error?.response?.headers?.['retry-after'];
  if (retryAfter) {
    return Math.min(parseFloat(retryAfter) * 1000, 8000);
  }

  // Anders exponentiële backoff met jitter
  const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 1000;
  return Math.min(exponentialDelay + jitter, 8000);
} 
