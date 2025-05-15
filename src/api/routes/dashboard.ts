/**
 * Dashboard Routes
 *
 * Dit bestand bevat routes voor het dashboard.
 */
import express, { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../../db/database';
import { successResponse } from '../utils/response';

const router = express.Router();

/**
 * GET /api/v1/dashboard/stats
 *
 * Haal statistieken op voor het dashboard
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Haal project statistieken op
    let projectStats = { total: 0, active: 0 };

    try {
      // Controleer of de projects tabel bestaat
      const tableExists = await db.get(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='projects'
      `);

      if (tableExists) {
        projectStats = await db.get(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN archived = 0 THEN 1 ELSE 0 END) as active
          FROM projects
        `);
      }
    } catch (error) {
      console.error('Error fetching project statistics:', error);
      // Gebruik standaard waarden als er een fout optreedt
    }

    // Haal employee statistieken op
    let employeeStats = { total: 0 };

    try {
      // Controleer of de employees tabel bestaat
      const tableExists = await db.get(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='employees'
      `);

      if (tableExists) {
        employeeStats = await db.get(`
          SELECT COUNT(*) as total
          FROM employees
          WHERE active = 1
        `);
      }
    } catch (error) {
      console.error('Error fetching employee statistics:', error);
      // Gebruik standaard waarden als er een fout optreedt
    }

    // Haal invoice statistieken op
    let invoiceStats = { total: 0, paid: 0, overdue: 0 };

    try {
      // Controleer of de invoices tabel bestaat
      const tableExists = await db.get(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='invoices'
      `);

      if (tableExists) {
        // Controleer of de kolommen bestaan
        const tableInfo = await db.all(`PRAGMA table_info(invoices)`);
        const columns = tableInfo.map(col => col.name);

        if (columns.includes('is_paid') && columns.includes('is_overdue')) {
          invoiceStats = await db.get(`
            SELECT
              COUNT(*) as total,
              SUM(CASE WHEN is_paid = 1 THEN 1 ELSE 0 END) as paid,
              SUM(CASE WHEN is_overdue = 1 THEN 1 ELSE 0 END) as overdue
            FROM invoices
          `);
        } else {
          // Gebruik alleen de totale telling als de kolommen niet bestaan
          const result = await db.get(`SELECT COUNT(*) as total FROM invoices`);
          invoiceStats.total = result.total;
        }
      }
    } catch (error) {
      console.error('Error fetching invoice statistics:', error);
      // Gebruik standaard waarden als er een fout optreedt
    }

    res.json(successResponse({
      projects: projectStats,
      employees: employeeStats,
      invoices: invoiceStats
    }));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/dashboard/non-billable-percentage
 *
 * Bereken het percentage niet-doorbelastbare uren voor het huidige jaar
 */
router.get('/non-billable-percentage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db || await getDatabase();

    // Bepaal het huidige jaar
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    // Controleer eerst of de hours tabel bestaat
    const tablesResult = await db.all(`SELECT name FROM sqlite_master WHERE type='table' AND name='hours'`);

    if (!tablesResult || tablesResult.length === 0) {
      console.log('Hours table does not exist, returning default value');
      res.json(successResponse({
        year,
        totalHours: 0,
        nonBillableHours: 0,
        percentage: 25.0
      }));
      return;
    }

    // Controleer of de hours tabel de benodigde velden heeft
    const columnsResult = await db.all(`PRAGMA table_info(hours)`);
    const columns = columnsResult.map((col: any) => col.name);

    if (!columns.includes('amount') || !columns.includes('project_id') || !columns.includes('date')) {
      console.log('Hours table does not have the required columns, returning default value');
      res.json(successResponse({
        year,
        totalHours: 0,
        nonBillableHours: 0,
        percentage: 25.0
      }));
      return;
    }

    // Bereken het totaal aantal uren
    const totalHoursResult = await db.get(`
      SELECT SUM(amount) as total_hours
      FROM hours
      WHERE date LIKE '${year}-%'
    `);

    const totalHours = totalHoursResult && totalHoursResult.total_hours ? totalHoursResult.total_hours : 0;

    // Bereken het aantal niet-doorbelastbare uren
    const nonBillableHoursResult = await db.get(`
      SELECT SUM(h.amount) as non_billable_hours
      FROM hours h
      LEFT JOIN projects p ON h.project_id = p.id
      WHERE
        h.date LIKE '${year}-%' AND
        (
          -- Interne projecten
          (p.tags LIKE '%Intern%' OR p.tags LIKE '%intern%') OR

          -- Niet doorbelastbare projecten
          (p.tags LIKE '%Niet Doorbelasten%' OR p.tags LIKE '%niet doorbelasten%') OR

          -- Projecten met 'intern' in de naam
          (p.name LIKE '%intern%' OR p.name LIKE '%Intern%' OR p.name LIKE '%Internal%')
        )
    `);

    const nonBillableHours = nonBillableHoursResult && nonBillableHoursResult.non_billable_hours ? nonBillableHoursResult.non_billable_hours : 0;

    // Bereken het percentage
    const percentage = totalHours > 0 ? (nonBillableHours * 100.0 / totalHours) : 25.0;

    console.log(`Calculated non-billable hours percentage for ${year}: ${percentage.toFixed(1)}%`);
    console.log(`Total hours: ${totalHours}`);
    console.log(`Non-billable hours: ${nonBillableHours}`);

    res.json(successResponse({
      year,
      totalHours,
      nonBillableHours,
      percentage
    }));
  } catch (error) {
    console.error('Error calculating non-billable hours percentage:', error);
    // Bij een fout, stuur een standaardwaarde terug
    res.json(successResponse({
      year: new Date().getFullYear(),
      totalHours: 0,
      nonBillableHours: 0,
      percentage: 25.0
    }));
  }
});

export default router;
