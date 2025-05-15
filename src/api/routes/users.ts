/**
 * User Management Routes
 *
 * Dit bestand bevat routes voor gebruikersbeheer, zoals het ophalen, bijwerken en verwijderen van gebruikers.
 */
import express, { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { successResponse } from '../utils/response';
import { BadRequestError, NotFoundError } from '../middleware/error-handler';
import { getDatabase } from '../../db/unified/database';
import { flexibleAuthMiddleware, requireAdmin, requirePermission } from '../middleware/auth.middleware';

const router = express.Router();

/**
 * GET /api/v1/users
 *
 * Alle gebruikers ophalen
 */
router.get('/', flexibleAuthMiddleware, requirePermission('manage_users'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Haal database op
    const db = await getDatabase();

    // Haal gebruikers op
    const users = await authService.getAllUsers(db);

    // Stuur response
    res.json(successResponse(users));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/users
 *
 * Nieuwe gebruiker aanmaken
 */
router.post('/', flexibleAuthMiddleware, requirePermission('manage_users'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, email, password, firstName, lastName, isActive, isAdmin, roles } = req.body;

    // Valideer input
    if (!username || !email || !password) {
      throw new BadRequestError('Username, email and password are required');
    }

    // Haal database op
    const db = await getDatabase();

    try {
      // Registreer gebruiker
      const user = await authService.registerUser(db, {
        username,
        email,
        password,
        first_name: firstName,
        last_name: lastName
      });

      // Als de gebruiker succesvol is aangemaakt, update dan de extra velden
      if (user && user.id) {
        // Update de gebruiker met de extra velden
        const updatedUser = await authService.updateUser(db, user.id, {
          is_active: isActive !== undefined ? isActive : true,
          is_admin: isAdmin || false,
          roles: roles || []
        });

        // Stuur response
        res.status(201).json(successResponse(updatedUser));
      } else {
        // Stuur response met de originele gebruiker
        res.status(201).json(successResponse(user));
      }
    } catch (error) {
      throw new BadRequestError(error.message || 'Failed to create user');
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/users/:id
 *
 * Specifieke gebruiker ophalen
 */
router.get('/:id', flexibleAuthMiddleware, requirePermission('manage_users'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse gebruikers ID
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      throw new BadRequestError('Invalid user ID');
    }

    // Haal database op
    const db = await getDatabase();

    try {
      // Haal gebruiker op
      const user = await authService.getUserById(db, userId);

      // Stuur response
      res.json(successResponse(user));
    } catch (error) {
      throw new NotFoundError(`User with ID ${userId} not found`);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/users/:id
 *
 * Gebruiker bijwerken
 */
router.put('/:id', flexibleAuthMiddleware, requirePermission('manage_users'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse gebruikers ID
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      throw new BadRequestError('Invalid user ID');
    }

    const { email, first_name, last_name, is_active, roles } = req.body;

    // Haal database op
    const db = await getDatabase();

    try {
      // Bijwerk gebruiker
      const user = await authService.updateUser(db, userId, {
        email,
        first_name,
        last_name,
        is_active,
        roles
      });

      // Stuur response
      res.json(successResponse(user));
    } catch (error) {
      throw new NotFoundError(`User with ID ${userId} not found`);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/users/:id
 *
 * Gebruiker verwijderen
 */
router.delete('/:id', flexibleAuthMiddleware, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse gebruikers ID
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      throw new BadRequestError('Invalid user ID');
    }

    // Haal database op
    const db = await getDatabase();

    try {
      // Verwijder gebruiker
      const success = await authService.deleteUser(db, userId);

      if (!success) {
        throw new NotFoundError(`User with ID ${userId} not found`);
      }

      // Stuur response
      res.json(successResponse({
        message: `User with ID ${userId} deleted successfully`
      }));
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new BadRequestError(error.message);
    }
  } catch (error) {
    next(error);
  }
});

export default router;
