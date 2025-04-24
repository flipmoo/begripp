/**
 * Invoice Routes
 * 
 * Dit bestand bevat routes voor het werken met facturen.
 */
import express, { Request, Response, NextFunction } from 'express';
import { invoiceService } from '../gripp/services/invoice';
import { successResponse } from '../utils/response';

const router = express.Router();

/**
 * GET /api/v1/invoices
 * 
 * Haal alle facturen op
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Fetching invoices');
    
    // Parse jaar parameter
    const year = req.query.year ? parseInt(req.query.year as string) : 0;
    
    // Bouw filters
    const filters = [];
    
    // Alleen jaar filter toepassen als een specifiek jaar is opgegeven
    if (year > 0) {
      const startDate = `${year}-01-01`;
      const endDate = `${year + 1}-01-01`;
      
      filters.push({
        field: 'invoice.date',
        operator: 'greaterequals',
        value: startDate
      });
      
      filters.push({
        field: 'invoice.date',
        operator: 'less',
        value: endDate
      });
    } else {
      // Als geen specifiek jaar, haal alle facturen vanaf 2024
      filters.push({
        field: 'invoice.date',
        operator: 'greaterequals',
        value: '2024-01-01'
      });
    }
    
    // Haal facturen op
    const response = await invoiceService.get({
      filters: filters,
      options: {
        orderings: [
          {
            field: 'invoice.date',
            direction: 'desc',
          },
        ],
      }
    });
    
    // Stuur response
    res.json(successResponse(response.result));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/invoices/unpaid
 * 
 * Haal onbetaalde facturen op
 */
router.get('/unpaid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Fetching unpaid invoices');
    
    // Parse jaar parameter
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    
    // Haal onbetaalde facturen op
    const response = await invoiceService.getUnpaid(year);
    
    // Stuur response
    res.json(successResponse(response.result));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/invoices/overdue
 * 
 * Haal achterstallige facturen op
 */
router.get('/overdue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Fetching overdue invoices');
    
    // Parse jaar parameter
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    
    // Haal achterstallige facturen op
    const response = await invoiceService.getOverdue(year);
    
    // Stuur response
    res.json(successResponse(response.result));
  } catch (error) {
    next(error);
  }
});

export default router;
