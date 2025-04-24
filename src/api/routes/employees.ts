/**
 * Employee Routes
 * 
 * Dit bestand bevat routes voor het werken met medewerkers.
 */
import express, { Request, Response, NextFunction } from 'express';
import { cacheService, CACHE_KEYS } from '../gripp/cache-service';
import { getWeekDates } from '../../utils/date-utils';
import { successResponse } from '../utils/response';
import { BadRequestError } from '../middleware/error-handler';

const router = express.Router();

/**
 * GET /api/v1/employees
 * 
 * Haal alle medewerkers op
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db;
    
    // Haal medewerkers op uit de database
    const employees = await db.all(`
      SELECT
        id, firstname, lastname, email, function, department_id, department_name
      FROM
        employees
      WHERE
        active = 1
      ORDER BY
        firstname, lastname
    `);
    
    // Stuur response
    res.json(successResponse(employees));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/employees/week
 * 
 * Haal medewerkers op voor een specifieke week
 */
router.get('/week', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db;
    
    // Parse parameters
    const { year, week } = req.query;
    
    // Valideer parameters
    if (!year || !week) {
      throw new BadRequestError('Year and week parameters are required');
    }
    
    const yearNum = parseInt(year as string);
    const weekNum = parseInt(week as string);
    
    if (isNaN(yearNum) || isNaN(weekNum)) {
      throw new BadRequestError('Year and week must be valid numbers');
    }
    
    // Check cache
    const cacheKey = CACHE_KEYS.EMPLOYEES_WEEK(yearNum, weekNum);
    const cachedData = cacheService.get(cacheKey);
    
    if (cachedData) {
      console.log(`Using cached data for year=${yearNum}, week=${weekNum}`);
      return res.json(successResponse(cachedData, { fromCache: true }));
    }
    
    // Bereken week data
    const { startDate, endDate } = getWeekDates(yearNum, weekNum);
    console.log(`Fetching employee data for week ${weekNum} of ${yearNum} (${startDate} to ${endDate})`);
    
    // Haal medewerkers op
    const employees = await db.all(`
      SELECT
        id, firstname, lastname, email, function, department_id, department_name
      FROM
        employees
      WHERE
        active = 1
      ORDER BY
        firstname, lastname
    `);
    
    // Haal uren op
    const hours = await db.all(`
      SELECT
        employee_id, date, hours, project_id, project_name, billable
      FROM
        hours
      WHERE
        date BETWEEN ? AND ?
    `, [startDate, endDate]);
    
    // Haal afwezigheid op
    const absences = await db.all(`
      SELECT
        arl.id,
        ar.employee_id,
        arl.date as startdate,
        arl.date as enddate,
        arl.amount as hours_per_day,
        ar.absencetype_searchname as type_name,
        arl.description,
        arl.status_id,
        arl.status_name
      FROM
        absence_request_lines arl
      JOIN
        absence_requests ar ON arl.absencerequest_id = ar.id
      WHERE
        arl.date BETWEEN ? AND ?
        AND (arl.status_id = 2 OR arl.status_id = 1)
    `, [startDate, endDate]);
    
    // Combineer data
    const result = {
      employees,
      hours,
      absences,
      period: {
        year: yearNum,
        week: weekNum,
        startDate,
        endDate
      }
    };
    
    // Sla op in cache
    cacheService.set(cacheKey, result);
    
    // Stuur response
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/employees/month
 * 
 * Haal medewerkers op voor een specifieke maand
 */
router.get('/month', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = (req as any).db;
    
    // Parse parameters
    const month = parseInt(req.query.month as string);
    const year = parseInt(req.query.year as string);
    
    // Valideer parameters
    if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
      throw new BadRequestError('Invalid month or year');
    }
    
    // Check cache
    const cacheKey = CACHE_KEYS.EMPLOYEES_MONTH(year, month);
    const cachedData = cacheService.get(cacheKey);
    
    if (cachedData) {
      console.log(`Using cached data for year=${year}, month=${month}`);
      return res.json(successResponse(cachedData, { fromCache: true }));
    }
    
    // Bereken maand data
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
    
    console.log(`Fetching employee data for ${year}-${month} (${startDate} to ${endDate})`);
    
    // Haal medewerkers op
    const employees = await db.all(`
      SELECT
        id, firstname, lastname, email, function, department_id, department_name
      FROM
        employees
      WHERE
        active = 1
      ORDER BY
        firstname, lastname
    `);
    
    // Haal uren op
    const hours = await db.all(`
      SELECT
        employee_id, date, hours, project_id, project_name, billable
      FROM
        hours
      WHERE
        date BETWEEN ? AND ?
    `, [startDate, endDate]);
    
    // Haal afwezigheid op
    const absences = await db.all(`
      SELECT
        arl.id,
        ar.employee_id,
        arl.date as startdate,
        arl.date as enddate,
        arl.amount as hours_per_day,
        ar.absencetype_searchname as type_name,
        arl.description,
        arl.status_id,
        arl.status_name
      FROM
        absence_request_lines arl
      JOIN
        absence_requests ar ON arl.absencerequest_id = ar.id
      WHERE
        arl.date BETWEEN ? AND ?
        AND (arl.status_id = 2 OR arl.status_id = 1)
    `, [startDate, endDate]);
    
    // Combineer data
    const result = {
      employees,
      hours,
      absences,
      period: {
        year,
        month,
        startDate,
        endDate
      }
    };
    
    // Sla op in cache
    cacheService.set(cacheKey, result);
    
    // Stuur response
    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

export default router;
