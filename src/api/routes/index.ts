/**
 * API Routes
 *
 * Dit bestand exporteert alle API routes voor de applicatie.
 * Het gebruikt een consistente structuur voor alle endpoints.
 */
import express, { Router } from 'express';
import projectRoutes from './projects';
import employeeRoutes from './employees';
import invoiceRoutes from './invoices';
import dbInvoiceRoutes from './db-invoices';
import syncRoutes from './sync';
import healthRoutes from './health';
import cacheRoutes from './cache';
import debugRoutes from './debug';
import dashboardRoutes from './dashboard';
import irisRoutes from './iris';
import simpleTargetsRoutes from './simple-targets';
import directFixRoutes from './direct-fix';
// Geen olm-fix routes meer

// Authentication routes
import authRoutes from './auth';
import userRoutes from './users';
import roleRoutes from './roles';
import permissionRoutes from './permissions';

/**
 * Creëer een router voor alle API routes
 */
const router = express.Router();

/**
 * Standaard response voor de API root
 */
router.get('/', (req, res) => {
  res.json({
    name: 'Het Nieuwe Werken API',
    version: '1.0.0',
    endpoints: [
      '/api/v1/projects',
      '/api/v1/employees',
      '/api/v1/invoices',
      '/api/v1/db-invoices',
      '/api/v1/sync',
      '/api/v1/health',
      '/api/v1/cache',
      '/api/v1/debug',
      '/api/v1/dashboard',
      '/api/v1/iris',
      '/api/v1/direct-fix',
      // Geen olm-fix routes meer
      '/api/v1/auth',
      '/api/v1/users',
      '/api/v1/roles',
      '/api/v1/permissions'
    ]
  });
});

/**
 * Mount alle route modules
 */
router.use('/v1/projects', projectRoutes);
router.use('/v1/employees', employeeRoutes);
router.use('/v1/invoices', invoiceRoutes);
router.use('/v1/db-invoices', dbInvoiceRoutes);
router.use('/v1/sync', syncRoutes);
router.use('/v1/health', healthRoutes);
router.use('/v1/cache', cacheRoutes);
router.use('/v1/debug', debugRoutes);
router.use('/v1/dashboard', dashboardRoutes);
router.use('/v1/iris', irisRoutes);
router.use('/v1/simple-targets', simpleTargetsRoutes);
router.use('/v1/direct-fix', directFixRoutes);
// Geen olm-fix routes meer

// Authentication routes
router.use('/v1/auth', authRoutes);
router.use('/v1/users', userRoutes);
router.use('/v1/roles', roleRoutes);
router.use('/v1/permissions', permissionRoutes);

/**
 * Exporteer de router
 */
export default router;
