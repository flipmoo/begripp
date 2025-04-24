/**
 * Health Routes
 * 
 * Dit bestand bevat routes voor het controleren van de gezondheid van de API.
 */
import express, { Request, Response, NextFunction } from 'express';
import { successResponse } from '../utils/response';

const router = express.Router();

// Server start timestamp
const serverStartTime = Date.now();

/**
 * GET /api/v1/health
 * 
 * Controleer de gezondheid van de API
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Bereken uptime in seconden
    const uptime = Math.floor((Date.now() - serverStartTime) / 1000);
    
    // Controleer database connectie
    const db = (req as any).db;
    const dbConnected = !!db;
    
    // Stuur response
    res.json(successResponse({
      status: 'ok',
      database: dbConnected ? 'connected' : 'disconnected',
      uptime
    }));
  } catch (error) {
    next(error);
  }
});

export default router;
