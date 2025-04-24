/**
 * Sync Routes
 * 
 * Dit bestand bevat routes voor het synchroniseren van data met Gripp.
 */
import express, { Request, Response, NextFunction } from 'express';
import { syncAllData, syncAbsenceRequests } from '../../services/sync.service';
import { cacheService } from '../gripp/cache-service';
import { successResponse } from '../utils/response';
import { BadRequestError } from '../middleware/error-handler';

const router = express.Router();

/**
 * POST /api/v1/sync
 * 
 * Synchroniseer alle data met Gripp
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Haal parameters uit request body
    const { startDate, endDate } = req.body;
    
    // Valideer parameters
    if (!startDate || !endDate) {
      throw new BadRequestError('startDate and endDate are required');
    }
    
    console.log(`Syncing data for period ${startDate} to ${endDate}`);
    
    // Clear cache
    cacheService.clearEmployeeData();
    
    // Synchroniseer data
    const success = await syncAllData(startDate, endDate);
    
    // Stuur response
    res.json(successResponse({
      message: success ? 'Data synced successfully' : 'Failed to sync data',
      syncedPeriod: {
        startDate,
        endDate
      }
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/sync/absence
 * 
 * Synchroniseer afwezigheidsverzoeken met Gripp
 */
router.post('/absence', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Haal parameters uit request body
    const { startDate, endDate } = req.body;
    
    // Valideer parameters
    if (!startDate || !endDate) {
      throw new BadRequestError('startDate and endDate are required');
    }
    
    console.log(`Syncing absence data for period ${startDate} to ${endDate}`);
    
    // Synchroniseer afwezigheidsverzoeken
    await syncAbsenceRequests(startDate, endDate);
    
    // Stuur response
    res.json(successResponse({
      message: 'Absence data synced successfully',
      syncedPeriod: {
        startDate,
        endDate
      }
    }));
  } catch (error) {
    next(error);
  }
});

export default router;
