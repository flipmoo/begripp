/**
 * Debug Routes
 *
 * Dit bestand bevat routes voor debugging doeleinden.
 */
import express, { Request, Response } from 'express';
import { getDatabase } from '../../db/database';
import { successResponse } from '../utils/response';

const router = express.Router();

/**
 * GET /api/v1/debug/health
 * 
 * Health check endpoint voor debugging
 */
router.get('/health', async (_req: Request, res: Response) => {
  res.json(successResponse({ status: 'ok', message: 'Debug API is running' }));
});

/**
 * GET /api/v1/debug/database
 * 
 * Database check endpoint voor debugging
 */
router.get('/database', async (_req: Request, res: Response) => {
  try {
    const db = await getDatabase();
    const tables = await db.all(`
      SELECT name FROM sqlite_master WHERE type='table'
    `);
    
    res.json(successResponse({
      status: 'ok',
      message: 'Database connection successful',
      tables: tables.map((table: { name: string }) => table.name)
    }));
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
