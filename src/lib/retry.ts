/**
 * Utility voor het implementeren van retry logica voor API calls
 *
 * Deze module bevat een vereenvoudigde implementatie van retry logica
 * die kan worden gebruikt voor het afhandelen van tijdelijke fouten bij API calls.
 */

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
 * Retry functie met een break statement
 * Deze functie probeert een operatie uit te voeren en stopt wanneer het lukt of
 * het maximum aantal pogingen is bereikt
 */
export async function retry<T>(
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

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;

      if (attempt >= maxAttempts || !shouldRetry(error as ApiError)) {
        break;
      }

      const delayTime = Math.min(baseDelay * Math.pow(2, attempt - 1), maxTimeout);
      await delay(delayTime);
    }
  }

  throw new Error(`Failed after ${attempt} attempts`);
}
