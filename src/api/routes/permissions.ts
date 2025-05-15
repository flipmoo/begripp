/**
 * Permission Management Routes
 * 
 * Dit bestand bevat routes voor permissiebeheer, zoals het ophalen van alle permissies.
 */
import express, { Request, Response, NextFunction } from 'express';
import { successResponse } from '../utils/response';
import { BadRequestError, NotFoundError } from '../middleware/error-handler';
import { getDatabase } from '../../db/unified/database';
import { flexibleAuthMiddleware, requirePermission } from '../middleware/auth.middleware';
import { Permission } from '../../db/unified/models/role';

const router = express.Router();

/**
 * GET /api/v1/permissions
 * 
 * Alle permissies ophalen
 */
router.get('/', flexibleAuthMiddleware, requirePermission('manage_roles'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Haal database op
    const db = await getDatabase();
    
    // Haal permissies op
    const permissions = await db.all<Permission[]>(`SELECT * FROM permissions ORDER BY name`);
    
    // Stuur response
    res.json(successResponse(permissions));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/permissions/:id
 * 
 * Specifieke permissie ophalen
 */
router.get('/:id', flexibleAuthMiddleware, requirePermission('manage_roles'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse permissie ID
    const permissionId = parseInt(req.params.id);
    if (isNaN(permissionId)) {
      throw new BadRequestError('Invalid permission ID');
    }
    
    // Haal database op
    const db = await getDatabase();
    
    // Haal permissie op
    const permission = await db.get<Permission>(`SELECT * FROM permissions WHERE id = ?`, [permissionId]);
    
    if (!permission) {
      throw new NotFoundError(`Permission with ID ${permissionId} not found`);
    }
    
    // Stuur response
    res.json(successResponse(permission));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/permissions
 * 
 * Nieuwe permissie aanmaken
 */
router.post('/', flexibleAuthMiddleware, requirePermission('manage_roles'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description } = req.body;
    
    // Valideer input
    if (!name) {
      throw new BadRequestError('Permission name is required');
    }
    
    // Haal database op
    const db = await getDatabase();
    
    // Controleer of permissie al bestaat
    const existingPermission = await db.get<Permission>(`SELECT * FROM permissions WHERE name = ?`, [name]);
    
    if (existingPermission) {
      throw new BadRequestError(`Permission with name '${name}' already exists`);
    }
    
    // Maak permissie aan
    const result = await db.run(`
      INSERT INTO permissions (name, description)
      VALUES (?, ?)
    `, [name, description || null]);
    
    // Haal nieuwe permissie op
    const newPermission = await db.get<Permission>(`SELECT * FROM permissions WHERE id = ?`, [result.lastID]);
    
    // Stuur response
    res.status(201).json(successResponse(newPermission));
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/permissions/:id
 * 
 * Permissie bijwerken
 */
router.put('/:id', flexibleAuthMiddleware, requirePermission('manage_roles'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse permissie ID
    const permissionId = parseInt(req.params.id);
    if (isNaN(permissionId)) {
      throw new BadRequestError('Invalid permission ID');
    }
    
    const { name, description } = req.body;
    
    // Haal database op
    const db = await getDatabase();
    
    // Controleer of permissie bestaat
    const permission = await db.get<Permission>(`SELECT * FROM permissions WHERE id = ?`, [permissionId]);
    
    if (!permission) {
      throw new NotFoundError(`Permission with ID ${permissionId} not found`);
    }
    
    // Controleer of we een standaard permissie proberen te wijzigen
    if (permissionId <= 15 && name && name !== permission.name) {
      throw new BadRequestError('Cannot change the name of default permissions');
    }
    
    // Update permissie
    const updateFields = [];
    const updateValues = [];
    
    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }
    
    // Voeg updated_at toe
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    
    // Voer update uit als er velden zijn om bij te werken
    if (updateFields.length > 0) {
      await db.run(`
        UPDATE permissions 
        SET ${updateFields.join(', ')} 
        WHERE id = ?
      `, [...updateValues, permissionId]);
    }
    
    // Haal bijgewerkte permissie op
    const updatedPermission = await db.get<Permission>(`SELECT * FROM permissions WHERE id = ?`, [permissionId]);
    
    // Stuur response
    res.json(successResponse(updatedPermission));
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/permissions/:id
 * 
 * Permissie verwijderen
 */
router.delete('/:id', flexibleAuthMiddleware, requirePermission('manage_roles'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse permissie ID
    const permissionId = parseInt(req.params.id);
    if (isNaN(permissionId)) {
      throw new BadRequestError('Invalid permission ID');
    }
    
    // Haal database op
    const db = await getDatabase();
    
    // Controleer of permissie bestaat
    const permission = await db.get<Permission>(`SELECT * FROM permissions WHERE id = ?`, [permissionId]);
    
    if (!permission) {
      throw new NotFoundError(`Permission with ID ${permissionId} not found`);
    }
    
    // Controleer of het een standaard permissie is
    if (permissionId <= 15) {
      throw new BadRequestError('Cannot delete default permissions');
    }
    
    // Verwijder permissie (cascade delete zal role_permissions entries verwijderen)
    await db.run('DELETE FROM permissions WHERE id = ?', [permissionId]);
    
    // Stuur response
    res.json(successResponse({
      message: `Permission with ID ${permissionId} deleted successfully`
    }));
  } catch (error) {
    next(error);
  }
});

export default router;
