import { Router, Request, Response, NextFunction } from 'express';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// Custom error class
class BadRequestError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'BadRequestError';
    this.statusCode = 400;
    this.code = 'INVALID_REQUEST';
    this.details = details;
  }
}

// Helper functie voor het maken van een succesvolle response
const successResponse = (data: any) => ({
  success: true,
  data,
  meta: {
    timestamp: new Date().toISOString()
  }
});

// Database connectie
let db: any = null;

// Get database connection
const getDatabase = async () => {
  if (db) return db;

  // Get the current directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Database path
  const dbPath = path.resolve(__dirname, '../../db/database.sqlite');
  console.log(`[SIMPLE-TARGETS] Database path: ${dbPath}`);

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  return db;
};

const router = Router();

/**
 * GET /api/v1/simple-targets
 *
 * Haal maandelijkse targets op voor een bepaald jaar
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Parse parameters
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    console.log(`[SIMPLE-TARGETS] Fetching monthly targets for year ${year}`);

    // Haal maandelijkse targets op
    const targets = await db.all(`
      SELECT
        id,
        year,
        month,
        target_amount as targetAmount
      FROM iris_manual_monthly_targets
      WHERE year = ?
      ORDER BY month
    `, [year]);

    console.log(`[SIMPLE-TARGETS] Found ${targets.length} targets for year ${year}`);

    // Als er geen targets zijn voor dit jaar, maak standaard targets aan
    if (targets.length === 0) {
      console.log(`[SIMPLE-TARGETS] No targets found for year ${year}, creating default targets`);

      // Begin een transactie
      await db.run('BEGIN TRANSACTION');

      try {
        // Maak standaard targets aan voor elke maand
        for (let month = 1; month <= 12; month++) {
          await db.run(`
            INSERT INTO iris_manual_monthly_targets (year, month, target_amount, created_at, updated_at)
            VALUES (?, ?, ?, datetime('now'), datetime('now'))
          `, [year, month, 200000]);
        }

        // Commit de transactie
        await db.run('COMMIT');

        // Haal de nieuwe targets op
        const newTargets = await db.all(`
          SELECT
            id,
            year,
            month,
            target_amount as targetAmount
          FROM iris_manual_monthly_targets
          WHERE year = ?
          ORDER BY month
        `, [year]);

        console.log(`[SIMPLE-TARGETS] Created ${newTargets.length} default targets for year ${year}`);

        res.json(successResponse({
          year,
          data: newTargets
        }));
      } catch (dbError) {
        // Rollback de transactie bij een fout
        await db.run('ROLLBACK');
        throw dbError;
      }
    } else {
      // Stuur de bestaande targets terug
      res.json(successResponse({
        year,
        data: targets
      }));
    }
  } catch (error) {
    console.error('[SIMPLE-TARGETS] Error in GET endpoint:', error);
    next(error);
  }
});

/**
 * POST /api/v1/simple-targets
 *
 * Update een specifieke target
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Valideer request body
    const { id, targetAmount } = req.body;

    if (!id || targetAmount === undefined) {
      throw new BadRequestError('ID en target bedrag zijn verplicht');
    }

    console.log(`[SIMPLE-TARGETS] Updating target ${id} to ${targetAmount}`);

    // Update de target
    await db.run(`
      UPDATE iris_manual_monthly_targets
      SET target_amount = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [targetAmount, id]);

    // Haal de bijgewerkte target op
    const updatedTarget = await db.get(`
      SELECT
        id,
        year,
        month,
        target_amount as targetAmount
      FROM iris_manual_monthly_targets
      WHERE id = ?
    `, [id]);

    console.log(`[SIMPLE-TARGETS] Target updated:`, updatedTarget);

    res.json(successResponse({
      message: 'Target succesvol bijgewerkt',
      data: updatedTarget
    }));
  } catch (error) {
    console.error('[SIMPLE-TARGETS] Error in POST endpoint:', error);
    next(error);
  }
});

export default router;
