/**
 * Authentication Service
 *
 * Deze service bevat functies voor het uitvoeren van authenticatie-gerelateerde API calls.
 */

import { API_BASE_URL } from '../config/api';

// Interfaces
interface LoginCredentials {
  username: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

interface AuthResponse {
  success: boolean;
  data?: {
    user: any;
    token: string;
  };
  error?: {
    message: string;
    code: number;
  };
}

/**
 * Authenticatie service
 */
class AuthService {
  /**
   * Login functie
   * @param credentials Login gegevens
   * @returns Promise met de response
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          code: 500,
        },
      };
    }
  }

  /**
   * Registratie functie
   * @param userData Gebruikersgegevens voor registratie
   * @returns Promise met de response
   */
  async register(userData: RegisterData): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          code: 500,
        },
      };
    }
  }

  /**
   * Haal de huidige gebruiker op
   * @param token JWT token
   * @returns Promise met de response
   */
  async getCurrentUser(token: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Get current user error:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          code: 500,
        },
      };
    }
  }

  /**
   * Vernieuw het token
   * @param refreshToken Refresh token
   * @returns Promise met de response
   */
  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Refresh token error:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          code: 500,
        },
      };
    }
  }

  /**
   * Logout functie
   * @param token JWT token
   * @returns Promise met de response
   */
  async logout(token: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          code: 500,
        },
      };
    }
  }

  /**
   * Wijzig wachtwoord
   * @param token JWT token
   * @param currentPassword Huidig wachtwoord
   * @param newPassword Nieuw wachtwoord
   * @returns Promise met de response
   */
  async changePassword(token: string, currentPassword: string, newPassword: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          code: 500,
        },
      };
    }
  }
}

// Exporteer een singleton instantie van de service
export const authService = new AuthService();
