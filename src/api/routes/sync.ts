/**
 * Sync Routes
 *
 * Dit bestand bevat routes voor het synchroniseren van data met Gripp.
 */
import express, { Request, Response, NextFunction } from 'express';
import { syncAllData, syncAbsenceRequests, syncHours, syncHoursData, syncInvoices } from '../../services/sync.service';
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
    const { startDate, endDate, debug, employeeId } = req.body;

    // Valideer parameters
    if (!startDate || !endDate) {
      throw new BadRequestError('startDate and endDate are required');
    }

    console.log(`Syncing data for period ${startDate} to ${endDate}${debug ? ' (debug mode)' : ''}${employeeId ? ` for employee ${employeeId}` : ''}`);

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
      },
      debug: debug ? true : false,
      employeeId: employeeId || null
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

/**
 * POST /api/v1/sync/hours
 *
 * Synchroniseer uren met Gripp
 */
router.post('/hours', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Haal parameters uit request body
    const { startDate, endDate, employeeId } = req.body;

    // Valideer parameters
    if (!startDate || !endDate) {
      throw new BadRequestError('startDate and endDate are required');
    }

    console.log(`Syncing hours for period ${startDate} to ${endDate}${employeeId ? ` for employee ${employeeId}` : ''}`);

    // Clear cache
    cacheService.clearEmployeeData();

    // Synchroniseer uren en afwezigheidsverzoeken
    const success = await syncHoursData(startDate, endDate);

    // Stuur response
    res.json(successResponse({
      message: success ? 'Hours synced successfully' : 'Failed to sync hours',
      syncedPeriod: {
        startDate,
        endDate
      },
      employeeId: employeeId || null
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/sync/invoices
 *
 * Synchroniseer facturen met Gripp
 */
router.post('/invoices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Syncing invoices from Gripp API');

    // Clear any cached invoice data
    cacheService.clearCache('invoices');

    // Use the syncInvoices function from sync.service.ts
    const success = await syncInvoices();

    if (!success) {
      throw new Error('Failed to sync invoices');
    }

    // Stuur response
    res.json(successResponse({
      message: 'Invoices synced successfully',
      success: true
    }));
  } catch (error) {
    console.error('Error syncing invoices:', error);
    next(error);
  }
});

export default router;
