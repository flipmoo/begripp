/**
 * Cache Routes
 * 
 * Dit bestand bevat routes voor het beheren van de cache.
 */
import express, { Request, Response, NextFunction } from 'express';
import { cacheService } from '../gripp/cache-service';
import { successResponse } from '../utils/response';

const router = express.Router();

/**
 * GET /api/v1/cache/status
 * 
 * Haal de status van de cache op
 */
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Haal cache keys op
    const keys = cacheService.keys();
    
    // Bereken statistieken
    const stats = {
      total: keys.length,
      employeeWeek: keys.filter(key => key.startsWith('employees_week_')).length,
      employeeMonth: keys.filter(key => key.startsWith('employees_month_')).length,
      projects: keys.filter(key => key.startsWith('projects_')).length,
      invoices: keys.filter(key => key.startsWith('invoices_')).length,
      keys: keys
    };
    
    // Stuur response
    res.json(successResponse(stats));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/cache/clear
 * 
 * Leeg de hele cache
 */
router.post('/clear', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Leeg de cache
    cacheService.clear();
    
    // Stuur response
    res.json(successResponse({
      message: 'Cache cleared successfully'
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/cache/clear/employees
 * 
 * Leeg de employee cache
 */
router.post('/clear/employees', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Leeg de employee cache
    cacheService.clearEmployeeData();
    
    // Stuur response
    res.json(successResponse({
      message: 'Employee cache cleared successfully'
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/cache/clear/projects
 * 
 * Leeg de project cache
 */
router.post('/clear/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Leeg de project cache
    cacheService.clearProjectData();
    
    // Stuur response
    res.json(successResponse({
      message: 'Project cache cleared successfully'
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/cache/clear/invoices
 * 
 * Leeg de invoice cache
 */
router.post('/clear/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Leeg de invoice cache
    cacheService.clearInvoiceData();
    
    // Stuur response
    res.json(successResponse({
      message: 'Invoice cache cleared successfully'
    }));
  } catch (error) {
    next(error);
  }
});

export default router;
