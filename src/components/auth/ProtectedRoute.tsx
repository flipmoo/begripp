/**
 * Protected Route Component
 * 
 * Dit component beschermt routes tegen niet-geauthenticeerde gebruikers.
 * Het controleert of de gebruiker is ingelogd en heeft de juiste permissies.
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  adminOnly?: boolean;
}

/**
 * Protected Route Component
 * 
 * @param children De componenten die beschermd moeten worden
 * @param requiredPermission De vereiste permissie (optioneel)
 * @param adminOnly Of alleen admins toegang hebben (optioneel)
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredPermission,
  adminOnly = false
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Als de authenticatie nog aan het laden is, toon een laadscherm
  if (isLoading) {
    return <div>Loading...</div>;
  }

  // Als de gebruiker niet is ingelogd, redirect naar de login pagina
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Als adminOnly is ingesteld, controleer of de gebruiker een admin is
  if (adminOnly && !user?.is_admin) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Als er een vereiste permissie is, controleer of de gebruiker deze heeft
  if (requiredPermission && user) {
    // Admin gebruikers hebben altijd alle permissies
    if (user.is_admin) {
      return <>{children}</>;
    }

    // Controleer of de gebruiker de vereiste permissie heeft
    const hasPermission = user.roles?.some(role => 
      role.permissions?.some(permission => permission.name === requiredPermission)
    );

    if (!hasPermission) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // Als de gebruiker is ingelogd en aan alle voorwaarden voldoet, toon de beschermde content
  return <>{children}</>;
};

export default ProtectedRoute;
