/**
 * Error Handler Middleware
 * 
 * Dit bestand bevat middleware voor het afhandelen van errors in de API.
 */
import { Request, Response, NextFunction } from 'express';
import { errorResponse, ErrorCodes } from '../utils/response';

/**
 * Interface voor API errors
 */
export class ApiError extends Error {
  /** HTTP status code */
  statusCode: number;
  
  /** Error code */
  code: string;
  
  /** Extra details over de error */
  details?: unknown;
  
  /**
   * Constructor
   * 
   * @param message De error message
   * @param statusCode De HTTP status code
   * @param code De error code
   * @param details Extra details over de error
   */
  constructor(message: string, statusCode = 500, code = ErrorCodes.INTERNAL_SERVER_ERROR, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Not Found Error
 */
export class NotFoundError extends ApiError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, 404, ErrorCodes.NOT_FOUND, details);
  }
}

/**
 * Bad Request Error
 */
export class BadRequestError extends ApiError {
  constructor(message = 'Invalid request', details?: unknown) {
    super(message, 400, ErrorCodes.INVALID_REQUEST, details);
  }
}

/**
 * Database Error
 */
export class DatabaseError extends ApiError {
  constructor(message = 'Database error', details?: unknown) {
    super(message, 503, ErrorCodes.DATABASE_ERROR, details);
  }
}

/**
 * Gripp API Error
 */
export class GrippApiError extends ApiError {
  constructor(message = 'Gripp API error', details?: unknown) {
    super(message, 502, ErrorCodes.GRIPP_API_ERROR, details);
  }
}

/**
 * Unauthorized Error
 */
export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(message, 401, ErrorCodes.UNAUTHORIZED, details);
  }
}

/**
 * Forbidden Error
 */
export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(message, 403, ErrorCodes.FORBIDDEN, details);
  }
}

/**
 * Rate Limit Exceeded Error
 */
export class RateLimitExceededError extends ApiError {
  constructor(message = 'Rate limit exceeded', details?: unknown) {
    super(message, 429, ErrorCodes.RATE_LIMIT_EXCEEDED, details);
  }
}

/**
 * Error handler middleware
 * 
 * @param err De error
 * @param req De request
 * @param res De response
 * @param next De next functie
 */
export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  console.error('API Error:', err);
  
  // Als het een ApiError is, gebruik de statusCode en code
  if (err instanceof ApiError) {
    res.status(err.statusCode).json(
      errorResponse(err.message, err.code, err.details)
    );
    return;
  }
  
  // Anders, gebruik een generieke 500 error
  res.status(500).json(
    errorResponse(
      'Internal server error',
      ErrorCodes.INTERNAL_SERVER_ERROR,
      process.env.NODE_ENV === 'development' ? err.message : undefined
    )
  );
}

/**
 * Not found middleware
 * 
 * @param req De request
 * @param res De response
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(
    errorResponse(
      `Route not found: ${req.method} ${req.originalUrl}`,
      ErrorCodes.NOT_FOUND
    )
  );
}
