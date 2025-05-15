/**
 * Use Permission Hook
 * 
 * Deze hook controleert of de huidige gebruiker een bepaalde permissie heeft.
 */
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook om te controleren of de gebruiker een bepaalde permissie heeft
 * 
 * @param permission De permissie om te controleren
 * @returns true als de gebruiker de permissie heeft, anders false
 */
export function usePermission(permission: string): boolean {
  const { user, isAuthenticated } = useAuth();
  
  // Als de gebruiker niet is ingelogd, heeft hij geen permissies
  if (!isAuthenticated || !user) {
    return false;
  }
  
  // Admin gebruikers hebben altijd alle permissies
  if (user.is_admin) {
    return true;
  }
  
  // Controleer of de gebruiker de permissie heeft via zijn rollen
  return user.roles?.some(role => 
    role.permissions?.some(p => p.name === permission)
  ) || false;
}

/**
 * Hook om te controleren of de gebruiker een van de opgegeven permissies heeft
 * 
 * @param permissions De permissies om te controleren
 * @returns true als de gebruiker een van de permissies heeft, anders false
 */
export function useHasAnyPermission(permissions: string[]): boolean {
  const { user, isAuthenticated } = useAuth();
  
  // Als de gebruiker niet is ingelogd, heeft hij geen permissies
  if (!isAuthenticated || !user) {
    return false;
  }
  
  // Admin gebruikers hebben altijd alle permissies
  if (user.is_admin) {
    return true;
  }
  
  // Controleer of de gebruiker een van de permissies heeft via zijn rollen
  return user.roles?.some(role => 
    role.permissions?.some(p => permissions.includes(p.name))
  ) || false;
}

/**
 * Hook om te controleren of de gebruiker alle opgegeven permissies heeft
 * 
 * @param permissions De permissies om te controleren
 * @returns true als de gebruiker alle permissies heeft, anders false
 */
export function useHasAllPermissions(permissions: string[]): boolean {
  const { user, isAuthenticated } = useAuth();
  
  // Als de gebruiker niet is ingelogd, heeft hij geen permissies
  if (!isAuthenticated || !user) {
    return false;
  }
  
  // Admin gebruikers hebben altijd alle permissies
  if (user.is_admin) {
    return true;
  }
  
  // Verzamel alle permissies van de gebruiker
  const userPermissions = new Set<string>();
  
  user.roles?.forEach(role => {
    role.permissions?.forEach(p => {
      userPermissions.add(p.name);
    });
  });
  
  // Controleer of de gebruiker alle opgegeven permissies heeft
  return permissions.every(p => userPermissions.has(p));
}
