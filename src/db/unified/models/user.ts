/**
 * User Model
 * 
 * Dit bestand definieert de interfaces voor gebruikers en gerelateerde types.
 */
import { Role } from './role';

/**
 * Gebruiker interface
 */
export interface User {
  id?: number;
  username: string;
  email: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  is_admin: boolean;
  last_login?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Gebruiker met rollen interface
 */
export interface UserWithRoles extends User {
  roles: Role[];
}

/**
 * Gebruiker login verzoek interface
 */
export interface UserLoginRequest {
  username: string;
  password: string;
}

/**
 * Gebruiker registratie verzoek interface
 */
export interface UserRegistrationRequest {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Gebruiker update verzoek interface
 */
export interface UserUpdateRequest {
  email?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  roles?: number[];
}

/**
 * Gebruiker wachtwoord update verzoek interface
 */
export interface UserPasswordUpdateRequest {
  current_password: string;
  new_password: string;
}

/**
 * Gebruiker response interface (zonder gevoelige informatie)
 */
export interface UserResponse {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  is_admin: boolean;
  last_login?: string;
  created_at?: string;
  updated_at?: string;
  roles?: Role[];
}

/**
 * Converteer een User object naar een veilig UserResponse object
 * @param user Het User object
 * @param includeRoles Of rollen moeten worden meegenomen
 * @returns Een UserResponse object zonder gevoelige informatie
 */
export function toUserResponse(user: User | UserWithRoles, includeRoles: boolean = false): UserResponse {
  const response: UserResponse = {
    id: user.id!,
    username: user.username,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    is_active: user.is_active,
    is_admin: user.is_admin,
    last_login: user.last_login,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
  
  if (includeRoles && 'roles' in user) {
    response.roles = (user as UserWithRoles).roles;
  }
  
  return response;
}
