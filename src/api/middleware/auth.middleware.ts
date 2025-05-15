/**
 * Authentication Middleware
 * 
 * Dit bestand bevat middleware voor het controleren van authenticatie en autorisatie.
 * Het biedt flexibele middleware die kan worden geconfigureerd om authenticatie geleidelijk in te schakelen.
 */
import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { UnauthorizedError, ForbiddenError } from './error-handler';
import { AUTH_FEATURE_FLAGS, isAuthRequiredForEndpoint } from '../../config/auth.config';
import { getDatabase } from '../../db/unified/database';

/**
 * Interface voor het uitbreiden van de Request met een user property
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    username: string;
    isAdmin: boolean;
  };
}

/**
 * Middleware voor het controleren van authenticatie
 * Deze middleware kan worden geconfigureerd om authenticatie te bypassen voor bepaalde endpoints
 */
export function flexibleAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Bepaal of authenticatie vereist is voor dit endpoint
    const requireAuth = isAuthRequiredForEndpoint(req.path);
    
    // Als authenticatie niet vereist is, of als de bypass token is opgegeven, sla authenticatie over
    if (!requireAuth || req.headers['x-auth-bypass'] === AUTH_FEATURE_FLAGS.AUTH_BYPASS_TOKEN) {
      // Voeg een standaard gebruiker toe voor consistente werking
      (req as AuthenticatedRequest).user = { userId: 1, username: 'system', isAdmin: true };
      return next();
    }
    
    // Haal token op uit Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verifieer token
    const decoded = authService.verifyToken(token);
    
    // Voeg gebruiker toe aan request
    (req as AuthenticatedRequest).user = decoded;
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware voor het controleren van admin rechten
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // Controleer of gebruiker is geauthenticeerd
    if (!authReq.user) {
      throw new UnauthorizedError('Not authenticated');
    }
    
    // Controleer of gebruiker admin is
    if (!authReq.user.isAdmin) {
      throw new ForbiddenError('Admin rights required');
    }
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware voor het controleren van specifieke permissies
 * 
 * @param permission De vereiste permissie
 */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      
      // Controleer of gebruiker is geauthenticeerd
      if (!authReq.user) {
        throw new UnauthorizedError('Not authenticated');
      }
      
      // Admin gebruikers hebben altijd alle permissies
      if (authReq.user.isAdmin) {
        return next();
      }
      
      // Haal database op
      const db = await getDatabase();
      
      // Controleer of gebruiker de permissie heeft
      const hasPermission = await authService.hasPermission(db, authReq.user.userId, permission);
      
      if (!hasPermission) {
        throw new ForbiddenError(`Permission '${permission}' required`);
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware voor het controleren van eigenaarschap van een resource
 * 
 * @param getResourceOwnerId Functie die het ID van de eigenaar van de resource ophaalt
 */
export function requireOwnership(getResourceOwnerId: (req: Request) => Promise<number | null>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      
      // Controleer of gebruiker is geauthenticeerd
      if (!authReq.user) {
        throw new UnauthorizedError('Not authenticated');
      }
      
      // Admin gebruikers hebben altijd toegang
      if (authReq.user.isAdmin) {
        return next();
      }
      
      // Haal eigenaar ID op
      const ownerId = await getResourceOwnerId(req);
      
      // Als er geen eigenaar is, sta toe (resource heeft geen eigenaar)
      if (ownerId === null) {
        return next();
      }
      
      // Controleer of gebruiker de eigenaar is
      if (authReq.user.userId !== ownerId) {
        throw new ForbiddenError('You do not have permission to access this resource');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}
