/**
 * Role Management Routes
 *
 * Dit bestand bevat routes voor rollenbeheer, zoals het ophalen, bijwerken en verwijderen van rollen.
 */
import express, { Request, Response, NextFunction } from 'express';
import { successResponse } from '../utils/response';
import { BadRequestError, NotFoundError } from '../middleware/error-handler';
import { getDatabase } from '../../db/unified/database';
import { flexibleAuthMiddleware, requirePermission } from '../middleware/auth.middleware';
import { Role, Permission } from '../../db/unified/models/role';

const router = express.Router();

/**
 * GET /api/v1/roles
 *
 * Alle rollen ophalen
 */
router.get('/', flexibleAuthMiddleware, requirePermission('manage_roles'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Haal database op
    const db = await getDatabase();

    // Haal rollen op
    const roles = await db.all<Role[]>(`SELECT * FROM roles ORDER BY name`);

    // Haal permissies op voor elke rol
    for (const role of roles) {
      const permissions = await db.all<Permission[]>(`
        SELECT p.*
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = ?
      `, [role.id]);

      role.permissions = permissions;
    }

    // Stuur response
    res.json(successResponse(roles));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/roles/:id
 *
 * Specifieke rol ophalen
 */
router.get('/:id', flexibleAuthMiddleware, requirePermission('manage_roles'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse rol ID
    const roleId = parseInt(req.params.id);
    if (isNaN(roleId)) {
      throw new BadRequestError('Invalid role ID');
    }

    // Haal database op
    const db = await getDatabase();

    // Haal rol op
    const role = await db.get<Role>(`SELECT * FROM roles WHERE id = ?`, [roleId]);

    if (!role) {
      throw new NotFoundError(`Role with ID ${roleId} not found`);
    }

    // Haal permissies op voor deze rol
    const permissions = await db.all<Permission[]>(`
      SELECT p.*
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
    `, [roleId]);

    role.permissions = permissions;

    // Stuur response
    res.json(successResponse(role));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/roles
 *
 * Nieuwe rol aanmaken
 */
router.post('/', flexibleAuthMiddleware, requirePermission('manage_roles'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, permissions } = req.body;

    // Valideer input
    if (!name) {
      throw new BadRequestError('Role name is required');
    }

    // Haal database op
    const db = await getDatabase();

    // Begin transactie
    await db.run('BEGIN TRANSACTION');

    try {
      // Controleer of rol al bestaat
      const existingRole = await db.get<Role>(`SELECT * FROM roles WHERE name = ?`, [name]);

      if (existingRole) {
        throw new BadRequestError(`Role with name '${name}' already exists`);
      }

      // Maak rol aan
      const result = await db.run(`
        INSERT INTO roles (name, description, created_at, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [name, description || null]);

      const roleId = result.lastID;

      // Voeg permissies toe als deze zijn opgegeven
      if (permissions && Array.isArray(permissions) && permissions.length > 0) {
        for (const permissionId of permissions) {
          // Controleer of permissie bestaat
          const permissionExists = await db.get(`
            SELECT COUNT(*) as count FROM permissions WHERE id = ?
          `, [permissionId]);

          if (permissionExists && permissionExists.count > 0) {
            await db.run(`
              INSERT INTO role_permissions (role_id, permission_id)
              VALUES (?, ?)
            `, [roleId, permissionId]);
          }
        }
      }

      // Commit transactie
      await db.run('COMMIT');

      // Haal nieuwe rol op met permissies
      const newRole = await db.get<Role>(`SELECT * FROM roles WHERE id = ?`, [roleId]);

      if (!newRole) {
        throw new Error('Failed to create role');
      }

      // Haal permissies op voor deze rol
      const rolePermissions = await db.all<Permission[]>(`
        SELECT p.*
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = ?
      `, [roleId]);

      newRole.permissions = rolePermissions;

      // Stuur response
      res.status(201).json(successResponse(newRole));
    } catch (error) {
      // Rollback bij error
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/roles/:id
 *
 * Rol bijwerken
 */
router.put('/:id', flexibleAuthMiddleware, requirePermission('manage_roles'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse rol ID
    const roleId = parseInt(req.params.id);
    if (isNaN(roleId)) {
      throw new BadRequestError('Invalid role ID');
    }

    const { name, description, permissions } = req.body;

    // Haal database op
    const db = await getDatabase();

    // Begin transactie
    await db.run('BEGIN TRANSACTION');

    try {
      // Controleer of rol bestaat
      const role = await db.get<Role>(`SELECT * FROM roles WHERE id = ?`, [roleId]);

      if (!role) {
        throw new NotFoundError(`Role with ID ${roleId} not found`);
      }

      // Controleer of we de admin rol proberen te wijzigen
      if (roleId === 1 && name && name !== 'admin') {
        throw new BadRequestError('Cannot change the name of the admin role');
      }

      // Update rol
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
          UPDATE roles
          SET ${updateFields.join(', ')}
          WHERE id = ?
        `, [...updateValues, roleId]);
      }

      // Update permissies als deze zijn opgegeven
      if (permissions !== undefined) {
        // Verwijder bestaande permissies
        await db.run('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

        // Voeg nieuwe permissies toe
        if (Array.isArray(permissions) && permissions.length > 0) {
          for (const permissionId of permissions) {
            // Controleer of permissie bestaat
            const permissionExists = await db.get(`
              SELECT COUNT(*) as count FROM permissions WHERE id = ?
            `, [permissionId]);

            if (permissionExists && permissionExists.count > 0) {
              await db.run(`
                INSERT INTO role_permissions (role_id, permission_id)
                VALUES (?, ?)
              `, [roleId, permissionId]);
            }
          }
        }
      }

      // Commit transactie
      await db.run('COMMIT');

      // Haal bijgewerkte rol op met permissies
      const updatedRole = await db.get<Role>(`SELECT * FROM roles WHERE id = ?`, [roleId]);

      if (!updatedRole) {
        throw new Error('Failed to update role');
      }

      // Haal permissies op voor deze rol
      const rolePermissions = await db.all<Permission[]>(`
        SELECT p.*
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = ?
      `, [roleId]);

      updatedRole.permissions = rolePermissions;

      // Stuur response
      res.json(successResponse(updatedRole));
    } catch (error) {
      // Rollback bij error
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/roles/:id
 *
 * Rol verwijderen
 */
router.delete('/:id', flexibleAuthMiddleware, requirePermission('manage_roles'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse rol ID
    const roleId = parseInt(req.params.id);
    if (isNaN(roleId)) {
      throw new BadRequestError('Invalid role ID');
    }

    // Haal database op
    const db = await getDatabase();

    // Controleer of rol bestaat
    const role = await db.get<Role>(`SELECT * FROM roles WHERE id = ?`, [roleId]);

    if (!role) {
      throw new NotFoundError(`Role with ID ${roleId} not found`);
    }

    // Controleer of het een standaard rol is (admin, manager, user)
    if (roleId <= 3) {
      throw new BadRequestError('Cannot delete default roles (admin, manager, user)');
    }

    // Verwijder rol (cascade delete zal role_permissions entries verwijderen)
    await db.run('DELETE FROM roles WHERE id = ?', [roleId]);

    // Stuur response
    res.json(successResponse({
      message: `Role with ID ${roleId} deleted successfully`
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/roles/:id/permissions
 *
 * Permissies voor een specifieke rol ophalen
 */
router.get('/:id/permissions', flexibleAuthMiddleware, requirePermission('manage_roles'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Parse rol ID
    const roleId = parseInt(req.params.id);
    if (isNaN(roleId)) {
      throw new BadRequestError('Invalid role ID');
    }

    // Haal database op
    const db = await getDatabase();

    // Controleer of rol bestaat
    const role = await db.get<Role>(`SELECT * FROM roles WHERE id = ?`, [roleId]);

    if (!role) {
      throw new NotFoundError(`Role with ID ${roleId} not found`);
    }

    // Haal permissies op voor deze rol
    const permissions = await db.all<Permission[]>(`
      SELECT p.*
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = ?
    `, [roleId]);

    // Stuur response
    res.json(successResponse(permissions));
  } catch (error) {
    next(error);
  }
});

export default router;
