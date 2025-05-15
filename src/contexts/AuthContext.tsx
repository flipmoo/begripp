/**
 * Authentication Context
 *
 * Dit bestand bevat de React context voor authenticatie.
 * Het biedt functies voor inloggen, uitloggen, registreren, etc.
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserResponse } from '../db/unified/models/user';
import { authService } from '../services/auth.service';

// API URL
// Gebruik de API_BASE_URL uit de config
import { API_BASE_URL } from '../config/api';
const API_URL = `${API_BASE_URL}/api/v1`;

// Token storage keys
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const USER_KEY = 'auth_user';

// Types
interface AuthContextType {
  user: UserResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  register: (userData: RegisterData) => Promise<void>;
  refreshToken: () => Promise<boolean>;
  clearError: () => void;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

interface LoginResponse {
  success: boolean;
  data: {
    user: UserResponse;
    token: string;
    refreshToken: string;
  };
}

interface AuthProviderProps {
  children: ReactNode;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshTokenValue, setRefreshTokenValue] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load user and token from localStorage on mount
  useEffect(() => {
    const loadAuthState = async () => {
      setIsLoading(true);

      try {
        // Load token and user from localStorage
        const storedToken = localStorage.getItem(TOKEN_KEY);
        const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        const storedUser = localStorage.getItem(USER_KEY);

        if (storedToken && storedUser) {
          setToken(storedToken);
          setRefreshTokenValue(storedRefreshToken);
          setUser(JSON.parse(storedUser));
        } else {
          // If no token or user, try to refresh token
          if (storedRefreshToken) {
            const refreshed = await refreshTokenWithValue(storedRefreshToken);
            if (!refreshed) {
              // If refresh failed, clear auth state
              clearAuthState();
            }
          } else {
            // No refresh token, clear auth state
            clearAuthState();
          }
        }
      } catch (error) {
        console.error('Error loading auth state:', error);
        clearAuthState();
      } finally {
        setIsLoading(false);
      }
    };

    loadAuthState();
  }, []);

  // Clear auth state
  const clearAuthState = () => {
    setUser(null);
    setToken(null);
    setRefreshTokenValue(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  };

  // Login
  const login = async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // TIJDELIJKE FIX: Accepteer 'team' gebruiker met wachtwoord 'team'
      if (username === 'team' && password === 'team') {
        // Maak een mock user voor team
        const mockUser = {
          id: 3,
          username: 'team',
          email: 'koen@bravoure.nl',
          first_name: 'Team',
          last_name: 'Team',
          is_active: true,
          is_admin: false,
          roles: [
            {
              id: 4,
              name: 'Team',
              description: 'Team gebruiker met alleen dashboard toegang',
              permissions: [
                { id: 1, name: 'view_dashboard', description: 'Dashboard bekijken' },
                { id: 4, name: 'view_employees', description: 'Medewerkers bekijken' },
                { id: 15, name: 'view_dashboard_projects', description: 'Projecten sectie op dashboard bekijken' },
                { id: 16, name: 'view_dashboard_employees', description: 'Medewerkers sectie op dashboard bekijken' },
                { id: 19, name: 'view_dashboard_stats', description: 'Statistieken op dashboard bekijken' }
                // Team mag dashboard, statistieken, projecten en medewerkers op dashboard zien
              ]
            }
          ]
        };

        // Maak een mock token
        const mockToken = 'mock-jwt-token-for-team';
        const mockRefreshToken = 'mock-refresh-token-for-team';

        // Save user and tokens
        setUser(mockUser);
        setToken(mockToken);
        setRefreshTokenValue(mockRefreshToken);

        // Save to localStorage
        localStorage.setItem(TOKEN_KEY, mockToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, mockRefreshToken);
        localStorage.setItem(USER_KEY, JSON.stringify(mockUser));

        setIsLoading(false);
        return;
      }

      // Probeer eerst de API te gebruiken
      try {
        const response = await authService.login({ username, password });

        if (response.success && response.data) {
          const { user, token } = response.data;
          const refreshToken = response.data.refreshToken || 'mock-refresh-token';

          // Save user and tokens
          setUser(user);
          setToken(token);
          setRefreshTokenValue(refreshToken);

          // Save to localStorage
          localStorage.setItem(TOKEN_KEY, token);
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
          localStorage.setItem(USER_KEY, JSON.stringify(user));

          return;
        }
      } catch (apiError) {
        console.warn('API login failed, falling back to mock login:', apiError);
      }

      // Fallback: Simuleer een login zonder API server
      if (username === 'admin' && password === 'admin') {
        // Maak een mock user
        const mockUser = {
          id: 1,
          username: 'admin',
          email: 'admin@example.com',
          first_name: 'Admin',
          last_name: 'User',
          is_active: true,
          is_admin: true,
          roles: [
            {
              id: 1,
              name: 'admin',
              description: 'Administrator met volledige toegang',
              permissions: [
                { id: 1, name: 'view_dashboard', description: 'Dashboard bekijken' },
                { id: 2, name: 'view_projects', description: 'Projecten bekijken' },
                { id: 3, name: 'edit_projects', description: 'Projecten bewerken' },
                { id: 4, name: 'view_employees', description: 'Medewerkers bekijken' },
                { id: 5, name: 'edit_employees', description: 'Medewerkers bewerken' },
                { id: 6, name: 'view_invoices', description: 'Facturen bekijken' },
                { id: 7, name: 'edit_invoices', description: 'Facturen bewerken' },
                { id: 8, name: 'view_iris', description: 'Iris bekijken' },
                { id: 9, name: 'edit_iris', description: 'Iris bewerken' },
                { id: 10, name: 'sync_data', description: 'Data synchroniseren' },
                { id: 11, name: 'manage_cache', description: 'Cache beheren' },
                { id: 12, name: 'manage_users', description: 'Gebruikers beheren' },
                { id: 13, name: 'manage_roles', description: 'Rollen beheren' },
                { id: 14, name: 'manage_settings', description: 'Instellingen beheren' }
              ]
            }
          ]
        };

        // Maak een mock token
        const mockToken = 'mock-jwt-token-for-testing';
        const mockRefreshToken = 'mock-refresh-token-for-testing';

        // Save user and tokens
        setUser(mockUser);
        setToken(mockToken);
        setRefreshTokenValue(mockRefreshToken);

        // Save to localStorage
        localStorage.setItem(TOKEN_KEY, mockToken);
        localStorage.setItem(REFRESH_TOKEN_KEY, mockRefreshToken);
        localStorage.setItem(USER_KEY, JSON.stringify(mockUser));
      } else {
        throw new Error('Invalid username or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
      clearAuthState();
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    setIsLoading(true);

    try {
      // Simuleer een logout zonder API server
      console.log('Logging out...');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear auth state regardless of API call result
      clearAuthState();
      setIsLoading(false);
    }
  };

  // Register
  const register = async (userData: RegisterData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Simuleer een registratie zonder API server
      console.log('Registering user:', userData);

      // Simuleer een succesvolle registratie
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Registration successful, but we don't automatically log in
      // The user needs to be approved by an admin first
    } catch (error) {
      console.error('Registration error:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh token
  const refreshToken = async (): Promise<boolean> => {
    if (!refreshTokenValue) {
      return false;
    }

    return refreshTokenWithValue(refreshTokenValue);
  };

  // Refresh token with value
  const refreshTokenWithValue = async (refreshToken: string): Promise<boolean> => {
    try {
      // Simuleer een token refresh zonder API server
      console.log('Refreshing token...');

      // Simuleer een succesvolle token refresh
      await new Promise(resolve => setTimeout(resolve, 500));

      // In een echte implementatie zou hier een nieuwe token worden opgehaald
      // en de gebruiker worden bijgewerkt. Voor nu doen we niets.

      return true;
    } catch (error) {
      console.error('Refresh token error:', error);
      return false;
    }
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  // Context value
  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    error,
    login,
    logout,
    register,
    refreshToken,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook for using the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
