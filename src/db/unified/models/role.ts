/**
 * Role Model
 * 
 * Dit bestand definieert de interfaces voor rollen en permissies.
 */

/**
 * Rol interface
 */
export interface Role {
  id?: number;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  permissions?: Permission[];
}

/**
 * Permissie interface
 */
export interface Permission {
  id?: number;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Rol update verzoek interface
 */
export interface RoleUpdateRequest {
  name?: string;
  description?: string;
  permissions?: number[];
}

/**
 * Rol creatie verzoek interface
 */
export interface RoleCreationRequest {
  name: string;
  description?: string;
  permissions?: number[];
}

/**
 * Permissie update verzoek interface
 */
export interface PermissionUpdateRequest {
  name?: string;
  description?: string;
}

/**
 * Permissie creatie verzoek interface
 */
export interface PermissionCreationRequest {
  name: string;
  description?: string;
}
