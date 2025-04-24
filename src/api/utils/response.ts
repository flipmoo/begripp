/**
 * API Response Utilities
 * 
 * Dit bestand bevat utilities voor het standaardiseren van API responses.
 */

/**
 * Interface voor een standaard API response
 */
export interface ApiResponse<T> {
  /** Geeft aan of de request succesvol was */
  success: boolean;
  
  /** De data van de response (alleen aanwezig als success true is) */
  data?: T;
  
  /** De error van de response (alleen aanwezig als success false is) */
  error?: {
    /** De error message */
    message: string;
    
    /** De error code */
    code?: string;
    
    /** Extra details over de error */
    details?: unknown;
  };
  
  /** Metadata over de response */
  meta?: {
    /** Timestamp van de response */
    timestamp: string;
    
    /** Paginering informatie */
    pagination?: {
      /** Totaal aantal items */
      total: number;
      
      /** Aantal items per pagina */
      limit: number;
      
      /** Huidige pagina */
      page: number;
      
      /** Totaal aantal pagina's */
      pages: number;
    };
    
    /** Geeft aan of de response uit de cache komt */
    fromCache?: boolean;
    
    /** Extra metadata */
    [key: string]: unknown;
  };
}

/**
 * Creëer een succesvolle response
 * 
 * @param data De data van de response
 * @param meta Extra metadata voor de response
 * @returns Een gestandaardiseerde succesvolle response
 */
export function successResponse<T>(data: T, meta?: Omit<ApiResponse<T>['meta'], 'timestamp'>): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Creëer een error response
 * 
 * @param message De error message
 * @param code De error code
 * @param details Extra details over de error
 * @returns Een gestandaardiseerde error response
 */
export function errorResponse(
  message: string,
  code?: string,
  details?: unknown
): ApiResponse<never> {
  return {
    success: false,
    error: {
      message,
      ...(code ? { code } : {}),
      ...(details ? { details } : {})
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Error codes voor API responses
 */
export const ErrorCodes = {
  /** Algemene error code voor interne server errors */
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  
  /** Error code voor wanneer een resource niet is gevonden */
  NOT_FOUND: 'NOT_FOUND',
  
  /** Error code voor wanneer een request parameter ontbreekt of ongeldig is */
  INVALID_REQUEST: 'INVALID_REQUEST',
  
  /** Error code voor wanneer de database niet beschikbaar is */
  DATABASE_ERROR: 'DATABASE_ERROR',
  
  /** Error code voor wanneer de Gripp API niet beschikbaar is */
  GRIPP_API_ERROR: 'GRIPP_API_ERROR',
  
  /** Error code voor wanneer een gebruiker niet geautoriseerd is */
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  /** Error code voor wanneer een gebruiker geen toegang heeft tot een resource */
  FORBIDDEN: 'FORBIDDEN',
  
  /** Error code voor wanneer een request te veel requests heeft gedaan */
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED'
};
