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
import syncRoutes from './sync';
import healthRoutes from './health';
import cacheRoutes from './cache';

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
      '/api/v1/sync',
      '/api/v1/health',
      '/api/v1/cache'
    ]
  });
});

/**
 * Mount alle route modules
 */
router.use('/v1/projects', projectRoutes);
router.use('/v1/employees', employeeRoutes);
router.use('/v1/invoices', invoiceRoutes);
router.use('/v1/sync', syncRoutes);
router.use('/v1/health', healthRoutes);
router.use('/v1/cache', cacheRoutes);

/**
 * Exporteer de router
 */
export default router;
