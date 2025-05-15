/**
 * Invoice Routes
 *
 * Dit bestand bevat routes voor het werken met facturen.
 *
 * BELANGRIJK: Deze routes gebruiken nu de lokale database in plaats van directe API calls naar Gripp.
 * Dit voorkomt onnodige API calls en verbetert de performance.
 *
 * Alle routes redirecten naar de overeenkomstige db-invoices routes.
 */
import express, { Request, Response, NextFunction } from 'express';
import { successResponse } from '../utils/response';

const router = express.Router();

/**
 * GET /api/v1/invoices
 *
 * Haal alle facturen op uit de lokale database
 *
 * Deze route redirectt naar de db-invoices route om dubbele code te voorkomen
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Redirecting to db-invoices endpoint');

    // Redirect naar de db-invoices route met dezelfde query parameters
    const redirectUrl = `/api/v1/db-invoices${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`;
    console.log(`Redirecting to: ${redirectUrl}`);

    res.redirect(redirectUrl);
  } catch (error: any) {
    console.error('Error redirecting to db-invoices:', error);
    next(error);
  }
});

/**
 * GET /api/v1/invoices/unpaid
 *
 * Haal onbetaalde facturen op uit de lokale database
 *
 * Deze route redirectt naar de db-invoices route met status=unpaid
 */
router.get('/unpaid', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Redirecting to db-invoices endpoint with status=unpaid');

    // Bouw de query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('status', 'unpaid');

    // Voeg jaar toe als die is opgegeven
    if (req.query.year) {
      queryParams.append('year', req.query.year as string);
    }

    // Voeg andere query parameters toe
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'status' && key !== 'year') {
        queryParams.append(key, value as string);
      }
    });

    // Bouw de redirect URL
    const redirectUrl = `/api/v1/db-invoices?${queryParams.toString()}`;
    console.log(`Redirecting to: ${redirectUrl}`);

    res.redirect(redirectUrl);
  } catch (error: any) {
    console.error('Error redirecting to db-invoices:', error);
    next(error);
  }
});

/**
 * GET /api/v1/invoices/overdue
 *
 * Haal achterstallige facturen op uit de lokale database
 *
 * Deze route redirectt naar de db-invoices route met status=overdue
 */
router.get('/overdue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Redirecting to db-invoices endpoint with status=overdue');

    // Bouw de query parameters
    const queryParams = new URLSearchParams();
    queryParams.append('status', 'overdue');

    // Voeg jaar toe als die is opgegeven
    if (req.query.year) {
      queryParams.append('year', req.query.year as string);
    }

    // Voeg andere query parameters toe
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'status' && key !== 'year') {
        queryParams.append(key, value as string);
      }
    });

    // Bouw de redirect URL
    const redirectUrl = `/api/v1/db-invoices?${queryParams.toString()}`;
    console.log(`Redirecting to: ${redirectUrl}`);

    res.redirect(redirectUrl);
  } catch (error: any) {
    console.error('Error redirecting to db-invoices:', error);
    next(error);
  }
});

export default router;
