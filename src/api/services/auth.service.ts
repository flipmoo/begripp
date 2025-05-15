/**
 * Authentication Service
 *
 * Dit bestand bevat de authenticatie service voor de applicatie.
 * Het biedt functies voor het authenticeren van gebruikers, registreren, etc.
 */
import { Database } from 'sqlite';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, UserWithRoles, UserResponse, toUserResponse } from '../../db/unified/models/user';
import { Role, Permission } from '../../db/unified/models/role';
import { UnauthorizedError, ForbiddenError } from '../middleware/error-handler';
import { JWT_CONFIG, BCRYPT_CONFIG } from '../../config/auth.config';

/**
 * Authenticatie service
 */
export const authService = {
  /**
   * Gebruiker authenticeren
   *
   * @param db Database connectie
   * @param username Gebruikersnaam
   * @param password Wachtwoord
   * @returns Geauthenticeerde gebruiker met token
   */
  async authenticate(db: Database, username: string, password: string): Promise<{ user: UserResponse, token: string, refreshToken: string }> {
    // Haal gebruiker op
    const user = await db.get<User>(`
      SELECT * FROM users
      WHERE username = ? AND is_active = 1
    `, [username]);

    // Controleer of gebruiker bestaat
    if (!user) {
      throw new UnauthorizedError('Invalid username or password');
    }

    // Controleer wachtwoord
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      throw new UnauthorizedError('Invalid username or password');
    }

    // Haal rollen en permissies op
    const userWithRoles = await this.getUserWithRoles(db, user.id!);

    // Genereer JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        isAdmin: user.is_admin
      },
      JWT_CONFIG.SECRET,
      { expiresIn: JWT_CONFIG.EXPIRES_IN }
    );

    // Genereer refresh token
    const refreshToken = jwt.sign(
      {
        userId: user.id,
        tokenType: 'refresh'
      },
      JWT_CONFIG.SECRET,
      { expiresIn: JWT_CONFIG.REFRESH_EXPIRES_IN }
    );

    // Update last login
    await db.run(`
      UPDATE users
      SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [user.id]);

    return {
      user: toUserResponse(userWithRoles, true),
      token,
      refreshToken
    };
  },

  /**
   * Gebruiker registreren
   *
   * @param db Database connectie
   * @param userData Gebruikersgegevens
   * @returns Geregistreerde gebruiker
   */
  async registerUser(db: Database, userData: { username: string, email: string, password: string, first_name?: string, last_name?: string }): Promise<UserResponse> {
    // Hash wachtwoord
    const passwordHash = await bcrypt.hash(userData.password, BCRYPT_CONFIG.SALT_ROUNDS);

    // Controleer of gebruikersnaam of email al bestaat
    const existingUser = await db.get<User>(`
      SELECT * FROM users
      WHERE username = ? OR email = ?
    `, [userData.username, userData.email]);

    if (existingUser) {
      throw new Error('Username or email already exists');
    }

    // Voeg gebruiker toe
    const result = await db.run(`
      INSERT INTO users (username, email, password_hash, first_name, last_name, is_active, is_admin)
      VALUES (?, ?, ?, ?, ?, 1, 0)
    `, [userData.username, userData.email, passwordHash, userData.first_name || null, userData.last_name || null]);

    // Haal nieuwe gebruiker op
    const newUser = await db.get<User>(`SELECT * FROM users WHERE id = ?`, [result.lastID]);

    if (!newUser) {
      throw new Error('Failed to create user');
    }

    // Koppel gebruiker aan standaard rol (user)
    await db.run(`
      INSERT INTO user_roles (user_id, role_id)
      VALUES (?, 3)
    `, [newUser.id]);

    return toUserResponse(newUser);
  },

  /**
   * Gebruiker met rollen ophalen
   *
   * @param db Database connectie
   * @param userId Gebruikers ID
   * @returns Gebruiker met rollen en permissies
   */
  async getUserWithRoles(db: Database, userId: number): Promise<UserWithRoles> {
    // Haal gebruiker op
    const user = await db.get<User>(`SELECT * FROM users WHERE id = ?`, [userId]);

    if (!user) {
      throw new Error('User not found');
    }

    // Haal rollen op
    const roles = await db.all<Role[]>(`
      SELECT r.*
      FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ?
    `, [userId]);

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

    return {
      ...user,
      roles
    };
  },

  /**
   * Controleer of een gebruiker een bepaalde permissie heeft
   *
   * @param db Database connectie
   * @param userId Gebruikers ID
   * @param permissionName Naam van de permissie
   * @returns true als de gebruiker de permissie heeft, anders false
   */
  async hasPermission(db: Database, userId: number, permissionName: string): Promise<boolean> {
    // Admin gebruikers hebben altijd alle permissies
    const isAdmin = await db.get<{ is_admin: boolean }>(`
      SELECT is_admin FROM users WHERE id = ?
    `, [userId]);

    if (isAdmin?.is_admin) {
      return true;
    }

    // Controleer specifieke permissie
    const hasPermission = await db.get<{ has_permission: number }>(`
      SELECT COUNT(*) as has_permission
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN roles r ON rp.role_id = r.id
      JOIN user_roles ur ON r.id = ur.role_id
      WHERE ur.user_id = ? AND p.name = ?
    `, [userId, permissionName]);

    return hasPermission?.has_permission > 0;
  },

  /**
   * Controleer of een token geldig is
   *
   * @param token JWT token
   * @returns Decoded token payload
   */
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_CONFIG.SECRET);
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
  },

  /**
   * Vernieuw een token met een refresh token
   *
   * @param db Database connectie
   * @param refreshToken Refresh token
   * @returns Nieuw token en gebruiker
   */
  async refreshToken(db: Database, refreshToken: string): Promise<{ user: UserResponse, token: string }> {
    try {
      // Verifieer refresh token
      const decoded = jwt.verify(refreshToken, JWT_CONFIG.SECRET) as { userId: number, tokenType: string };

      // Controleer of het een refresh token is
      if (decoded.tokenType !== 'refresh') {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Haal gebruiker op
      const userWithRoles = await this.getUserWithRoles(db, decoded.userId);

      // Controleer of gebruiker actief is
      if (!userWithRoles.is_active) {
        throw new UnauthorizedError('User is inactive');
      }

      // Genereer nieuw token
      const token = jwt.sign(
        {
          userId: userWithRoles.id,
          username: userWithRoles.username,
          isAdmin: userWithRoles.is_admin
        },
        JWT_CONFIG.SECRET,
        { expiresIn: JWT_CONFIG.EXPIRES_IN }
      );

      return {
        user: toUserResponse(userWithRoles, true),
        token
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new UnauthorizedError('Invalid refresh token');
    }
  },

  /**
   * Wachtwoord wijzigen
   *
   * @param db Database connectie
   * @param userId Gebruikers ID
   * @param currentPassword Huidig wachtwoord
   * @param newPassword Nieuw wachtwoord
   * @returns true als het wachtwoord is gewijzigd
   */
  async changePassword(db: Database, userId: number, currentPassword: string, newPassword: string): Promise<boolean> {
    // Haal gebruiker op
    const user = await db.get<User>(`SELECT * FROM users WHERE id = ?`, [userId]);

    if (!user) {
      throw new Error('User not found');
    }

    // Controleer huidig wachtwoord
    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    // Hash nieuw wachtwoord
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_CONFIG.SALT_ROUNDS);

    // Update wachtwoord
    await db.run(`
      UPDATE users
      SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [newPasswordHash, userId]);

    return true;
  },

  /**
   * Alle gebruikers ophalen
   *
   * @param db Database connectie
   * @returns Lijst van gebruikers
   */
  async getAllUsers(db: Database): Promise<UserResponse[]> {
    // Haal alle gebruikers op
    const users = await db.all<User[]>(`SELECT * FROM users ORDER BY username`);

    // Haal voor elke gebruiker de rollen op
    const usersWithRoles = [];
    for (const user of users) {
      try {
        const userWithRoles = await this.getUserWithRoles(db, user.id!);
        usersWithRoles.push(toUserResponse(userWithRoles, true));
      } catch (error) {
        console.error(`Error fetching roles for user ${user.id}:`, error);
        usersWithRoles.push(toUserResponse(user));
      }
    }

    return usersWithRoles;
  },

  /**
   * Gebruiker ophalen op ID
   *
   * @param db Database connectie
   * @param userId Gebruikers ID
   * @returns Gebruiker
   */
  async getUserById(db: Database, userId: number): Promise<UserResponse> {
    const user = await this.getUserWithRoles(db, userId);
    return toUserResponse(user, true);
  },

  /**
   * Gebruiker bijwerken
   *
   * @param db Database connectie
   * @param userId Gebruikers ID
   * @param userData Gebruikersgegevens
   * @returns Bijgewerkte gebruiker
   */
  async updateUser(db: Database, userId: number, userData: { email?: string, first_name?: string, last_name?: string, is_active?: boolean, is_admin?: boolean, roles?: number[] }): Promise<UserResponse> {
    // Begin transactie
    await db.run('BEGIN TRANSACTION');

    try {
      // Update gebruiker
      const updateFields = [];
      const updateValues = [];

      if (userData.email !== undefined) {
        updateFields.push('email = ?');
        updateValues.push(userData.email);
      }

      if (userData.first_name !== undefined) {
        updateFields.push('first_name = ?');
        updateValues.push(userData.first_name);
      }

      if (userData.last_name !== undefined) {
        updateFields.push('last_name = ?');
        updateValues.push(userData.last_name);
      }

      if (userData.is_active !== undefined) {
        updateFields.push('is_active = ?');
        updateValues.push(userData.is_active ? 1 : 0);
      }

      if (userData.is_admin !== undefined) {
        updateFields.push('is_admin = ?');
        updateValues.push(userData.is_admin ? 1 : 0);
      }

      // Voeg updated_at toe
      updateFields.push('updated_at = CURRENT_TIMESTAMP');

      // Voer update uit als er velden zijn om bij te werken
      if (updateFields.length > 0) {
        await db.run(`
          UPDATE users
          SET ${updateFields.join(', ')}
          WHERE id = ?
        `, [...updateValues, userId]);
      }

      // Update rollen als deze zijn opgegeven
      if (userData.roles !== undefined) {
        // Verwijder bestaande rollen
        await db.run('DELETE FROM user_roles WHERE user_id = ?', [userId]);

        // Voeg nieuwe rollen toe
        for (const roleId of userData.roles) {
          await db.run('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
        }
      }

      // Commit transactie
      await db.run('COMMIT');

      // Haal bijgewerkte gebruiker op
      return await this.getUserById(db, userId);
    } catch (error) {
      // Rollback bij error
      await db.run('ROLLBACK');
      throw error;
    }
  },

  /**
   * Gebruiker verwijderen
   *
   * @param db Database connectie
   * @param userId Gebruikers ID
   * @returns true als de gebruiker is verwijderd
   */
  async deleteUser(db: Database, userId: number): Promise<boolean> {
    // Controleer of het niet de system of admin gebruiker is
    if (userId === 1 || userId === 2) {
      throw new ForbiddenError('Cannot delete system or admin user');
    }

    // Verwijder gebruiker
    const result = await db.run('DELETE FROM users WHERE id = ?', [userId]);
    return result.changes > 0;
  }
};
