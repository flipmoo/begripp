/**
 * Authentication Routes
 * 
 * Dit bestand bevat routes voor authenticatie, zoals login, registratie, etc.
 */
import express, { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { successResponse } from '../utils/response';
import { BadRequestError, UnauthorizedError } from '../middleware/error-handler';
import { getDatabase } from '../../db/unified/database';
import { flexibleAuthMiddleware, requireAdmin, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = express.Router();

/**
 * POST /api/v1/auth/login
 * 
 * Gebruiker inloggen
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    
    // Valideer input
    if (!username || !password) {
      throw new BadRequestError('Username and password are required');
    }
    
    // Haal database op
    const db = await getDatabase();
    
    // Authenticeer gebruiker
    const { user, token, refreshToken } = await authService.authenticate(db, username, password);
    
    // Stuur response
    res.json(successResponse({
      user,
      token,
      refreshToken
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/register
 * 
 * Nieuwe gebruiker registreren (alleen voor admins)
 */
router.post('/register', flexibleAuthMiddleware, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, email, password, first_name, last_name } = req.body;
    
    // Valideer input
    if (!username || !email || !password) {
      throw new BadRequestError('Username, email and password are required');
    }
    
    // Haal database op
    const db = await getDatabase();
    
    // Registreer gebruiker
    const user = await authService.registerUser(db, {
      username,
      email,
      password,
      first_name,
      last_name
    });
    
    // Stuur response
    res.status(201).json(successResponse(user));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 * 
 * Huidige gebruiker ophalen
 */
router.get('/me', flexibleAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // Controleer of gebruiker is geauthenticeerd
    if (!authReq.user) {
      throw new UnauthorizedError('Not authenticated');
    }
    
    // Haal database op
    const db = await getDatabase();
    
    // Haal gebruiker op
    const user = await authService.getUserById(db, authReq.user.userId);
    
    // Stuur response
    res.json(successResponse(user));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/refresh-token
 * 
 * Token vernieuwen met refresh token
 */
router.post('/refresh-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    
    // Valideer input
    if (!refreshToken) {
      throw new BadRequestError('Refresh token is required');
    }
    
    // Haal database op
    const db = await getDatabase();
    
    // Vernieuw token
    const { user, token } = await authService.refreshToken(db, refreshToken);
    
    // Stuur response
    res.json(successResponse({
      user,
      token
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/change-password
 * 
 * Wachtwoord wijzigen
 */
router.post('/change-password', flexibleAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // Controleer of gebruiker is geauthenticeerd
    if (!authReq.user) {
      throw new UnauthorizedError('Not authenticated');
    }
    
    const { current_password, new_password } = req.body;
    
    // Valideer input
    if (!current_password || !new_password) {
      throw new BadRequestError('Current password and new password are required');
    }
    
    // Haal database op
    const db = await getDatabase();
    
    // Wijzig wachtwoord
    await authService.changePassword(db, authReq.user.userId, current_password, new_password);
    
    // Stuur response
    res.json(successResponse({
      message: 'Password changed successfully'
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout
 * 
 * Gebruiker uitloggen (client-side)
 */
router.post('/logout', (req: Request, res: Response) => {
  // Logout is client-side (verwijder token), maar we sturen een success response
  res.json(successResponse({
    message: 'Logged out successfully'
  }));
});

export default router;
