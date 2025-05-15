/**
 * Authentication Configuration
 * 
 * Dit bestand bevat configuratie voor het authenticatiesysteem.
 * Het gebruikt feature flags om authenticatie geleidelijk in te schakelen.
 */

// JWT configuratie
export const JWT_CONFIG = {
  SECRET: process.env.JWT_SECRET || 'development-jwt-secret-key-change-in-production',
  EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
};

// Bcrypt configuratie
export const BCRYPT_CONFIG = {
  SALT_ROUNDS: parseInt(process.env.BCRYPT_SALT_ROUNDS || '10'),
};

// Authenticatie feature flags
export const AUTH_FEATURE_FLAGS = {
  // Globale flag om authenticatie in/uit te schakelen
  REQUIRE_AUTH: process.env.REQUIRE_AUTH === 'true' || false,
  
  // Bypass token voor noodgevallen (alleen voor ontwikkeling)
  AUTH_BYPASS_TOKEN: process.env.AUTH_BYPASS_TOKEN || 'development-only-bypass-token',
  
  // Endpoint-specifieke flags
  ENDPOINTS: {
    // Dashboard endpoints
    '/api/v1/dashboard': process.env.REQUIRE_AUTH_DASHBOARD === 'true' || false,
    
    // Project endpoints
    '/api/v1/projects': process.env.REQUIRE_AUTH_PROJECTS === 'true' || false,
    
    // Employee endpoints
    '/api/v1/employees': process.env.REQUIRE_AUTH_EMPLOYEES === 'true' || false,
    
    // Invoice endpoints
    '/api/v1/invoices': process.env.REQUIRE_AUTH_INVOICES === 'true' || false,
    '/api/v1/db-invoices': process.env.REQUIRE_AUTH_DB_INVOICES === 'true' || false,
    
    // Sync endpoints (kritiek, voorzichtig mee zijn)
    '/api/v1/sync': process.env.REQUIRE_AUTH_SYNC === 'true' || false,
    
    // Cache endpoints
    '/api/v1/cache': process.env.REQUIRE_AUTH_CACHE === 'true' || false,
    
    // Debug endpoints
    '/api/v1/debug': process.env.REQUIRE_AUTH_DEBUG === 'true' || true, // Debug standaard beveiligd
    
    // Iris endpoints
    '/api/v1/iris': process.env.REQUIRE_AUTH_IRIS === 'true' || false,
  },
};

// Kritieke workflows die speciale aandacht nodig hebben bij authenticatie
export const CRITICAL_WORKFLOWS = [
  {
    name: 'Full Data Sync',
    endpoint: '/api/v1/sync',
    description: 'Synchroniseert alle data met Gripp API',
    risk: 'high',
    dependencies: [
      '/api/v1/sync/employees',
      '/api/v1/sync/projects',
      '/api/v1/sync/invoices',
      '/api/v1/sync/hours',
      '/api/v1/sync/absence',
    ],
  },
  {
    name: 'Dashboard Data Loading',
    endpoint: '/api/v1/dashboard',
    description: 'Laadt data voor het dashboard',
    risk: 'medium',
    dependencies: [
      '/api/v1/projects',
      '/api/v1/employees',
      '/api/v1/invoices',
    ],
  },
  {
    name: 'Cache Management',
    endpoint: '/api/v1/cache',
    description: 'Beheert de API cache',
    risk: 'medium',
    dependencies: [],
  },
];

// Functie om te controleren of authenticatie vereist is voor een endpoint
export function isAuthRequiredForEndpoint(endpoint: string): boolean {
  // Check eerst voor exacte matches
  if (AUTH_FEATURE_FLAGS.ENDPOINTS[endpoint] !== undefined) {
    return AUTH_FEATURE_FLAGS.ENDPOINTS[endpoint];
  }
  
  // Check voor prefix matches
  for (const configuredEndpoint in AUTH_FEATURE_FLAGS.ENDPOINTS) {
    if (endpoint.startsWith(configuredEndpoint)) {
      return AUTH_FEATURE_FLAGS.ENDPOINTS[configuredEndpoint];
    }
  }
  
  // Fallback naar globale instelling
  return AUTH_FEATURE_FLAGS.REQUIRE_AUTH;
}
