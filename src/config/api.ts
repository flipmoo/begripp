/**
 * API Configuration
 *
 * Centrale configuratie voor API endpoints
 * Gebruikt de uniforme datastructuur API endpoints
 */

// Import port configuration
import { API_PORT } from './ports';

// API base URL
// Use the API_PORT from the central configuration
// Determine if we're in a browser or Node.js environment
const isNodeEnv = typeof window === 'undefined';

// In browser, use relative URL to ensure it works on any host
// In Node.js (server), use the actual IP address or localhost
export const API_BASE_URL = isNodeEnv
  ? `http://localhost:${API_PORT}`
  : ``; // Empty string to avoid double /api prefix

console.log('API_BASE_URL:', API_BASE_URL);

// API endpoints
export const API_ENDPOINTS = {
  // Dashboard endpoints
  DASHBOARD: {
    PROJECTS: `${API_BASE_URL}/api/v1/projects?showAll=true`,
    ACTIVE_PROJECTS: `${API_BASE_URL}/api/v1/projects?status=active`,
    PROJECT_DETAILS: (id: number) => `${API_BASE_URL}/api/v1/projects/${id}`,
    STATISTICS: `${API_BASE_URL}/api/v1/dashboard/statistics`,
    OVER_BUDGET_PROJECTS: `${API_BASE_URL}/api/v1/projects/over-budget`,
    RULES_OVER_BUDGET: `${API_BASE_URL}/api/v1/projects/rules-over-budget`,
    EMPLOYEES_UNWRITTEN_HOURS: `${API_BASE_URL}/api/v1/employees/unwritten-hours`,
    INVOICE_STATISTICS: `${API_BASE_URL}/api/v1/invoices/statistics`,
    OVERDUE_INVOICES: `${API_BASE_URL}/api/v1/db-invoices?status=overdue`,
  },

  // Sync endpoints
  SYNC: {
    ALL: `${API_BASE_URL}/api/v1/sync`,
    PROJECTS: `${API_BASE_URL}/api/v1/sync/projects`,
    PROJECT_BY_ID: (id: number) => `${API_BASE_URL}/api/v1/sync/projects/${id}`,
    EMPLOYEES: `${API_BASE_URL}/api/v1/sync/employees`,
    HOURS: `${API_BASE_URL}/api/v1/sync/hours`,
    INVOICES: `${API_BASE_URL}/api/v1/sync/invoices`,
    ABSENCE: `${API_BASE_URL}/api/v1/sync/absence`,
  },

  // Employee endpoints
  EMPLOYEES: {
    ALL: `${API_BASE_URL}/api/v1/employees`,
    MONTH_STATS: `${API_BASE_URL}/api/v1/employees/month-stats`,
    EMPLOYEE_DETAILS: (id: number) => `${API_BASE_URL}/api/v1/employees/${id}`,
    EMPLOYEE_HOURS: (id: number) => `${API_BASE_URL}/api/v1/employees/${id}/hours`,
  },

  // Invoice endpoints
  INVOICES: {
    GET_ALL: `${API_BASE_URL}/api/v1/db-invoices`,
    OVERDUE: `${API_BASE_URL}/api/v1/db-invoices?status=overdue`,
    UNPAID: `${API_BASE_URL}/api/v1/db-invoices?status=unpaid`,
    INVOICE_DETAILS: (id: number) => `${API_BASE_URL}/api/v1/db-invoices/${id}`,
    INVOICE_LINES: (id: number) => `${API_BASE_URL}/api/v1/db-invoices/${id}/lines`,

    // Legacy endpoints (direct from Gripp)
    GRIPP_GET_ALL: `${API_BASE_URL}/api/v1/invoices`,
    GRIPP_OVERDUE: `${API_BASE_URL}/api/v1/invoices/overdue`,
    GRIPP_UNPAID: `${API_BASE_URL}/api/v1/invoices/unpaid`,
  },

  // Hours endpoints
  HOURS: {
    ALL: `${API_BASE_URL}/api/v1/hours`,
    INCOMPLETE: `${API_BASE_URL}/api/v1/hours?status=incomplete`,
    HOUR_DETAILS: (id: number) => `${API_BASE_URL}/api/v1/hours/${id}`,
  },

  // Cache endpoints
  CACHE: {
    CLEAR: `${API_BASE_URL}/api/v1/cache/clear`,
    CLEAR_ENTITY: (entity: string) => `${API_BASE_URL}/api/v1/cache/clear/${entity}`,
  },

  // Health endpoints
  HEALTH: {
    CHECK: `${API_BASE_URL}/api/v1/health`,
  },
};

// Axios configuration
export const AXIOS_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds
  headers: {
    'Content-Type': 'application/json',
  },
};
