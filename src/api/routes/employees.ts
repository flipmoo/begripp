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
import { getDatabase } from '../../db/database';

/**
 * Berekent de datum van Pasen voor een gegeven jaar
 * Implementatie van het Meeus/Jones/Butcher algoritme
 */
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
}

/**
 * Berekent de datum van Hemelvaart voor een gegeven jaar
 * Hemelvaart is 39 dagen na Pasen
 */
function calculateAscensionDay(year: number): Date {
  const easter = calculateEaster(year);
  const ascensionDay = new Date(easter);
  ascensionDay.setDate(easter.getDate() + 39);
  return ascensionDay;
}

/**
 * Berekent de datum van Pinksteren voor een gegeven jaar
 * Pinksteren is 49 dagen na Pasen
 */
function calculatePentecost(year: number): Date {
  const easter = calculateEaster(year);
  const pentecost = new Date(easter);
  pentecost.setDate(easter.getDate() + 49);
  return pentecost;
}

/**
 * Formatteert een datum als YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Geeft een lijst van Nederlandse feestdagen voor een gegeven jaar
 */
function getHolidaysForYear(year: number): Array<{ name: string, date: string }> {
  // Bereken Pasen en gerelateerde feestdagen
  const easter = calculateEaster(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);

  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  const ascensionDay = calculateAscensionDay(year);
  const pentecost = calculatePentecost(year);
  const pentecostMonday = new Date(pentecost);
  pentecostMonday.setDate(pentecost.getDate() + 1);

  // Vaste feestdagen
  const holidays = [
    { name: 'Nieuwjaarsdag', date: `${year}-01-01` },
    { name: 'Goede Vrijdag', date: formatDate(goodFriday) },
    { name: 'Eerste Paasdag', date: formatDate(easter) },
    { name: 'Tweede Paasdag', date: formatDate(easterMonday) },
    { name: 'Koningsdag', date: `${year}-04-27` }, // Sinds 2014
    { name: 'Hemelvaartsdag', date: formatDate(ascensionDay) },
    { name: 'Eerste Pinksterdag', date: formatDate(pentecost) },
    { name: 'Tweede Pinksterdag', date: formatDate(pentecostMonday) },
    { name: 'Eerste Kerstdag', date: `${year}-12-25` },
    { name: 'Tweede Kerstdag', date: `${year}-12-26` }
  ];

  // Bevrijdingsdag (5 mei) - alleen in lustrumjaren een officiële vrije dag
  if (year % 5 === 0) {
    holidays.push({ name: 'Bevrijdingsdag', date: `${year}-05-05` });
  }

  return holidays;
}

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

    // Haal medewerkers op met contractgegevens
    const employees = await db.all(`
      SELECT
        e.id,
        e.firstname,
        e.lastname,
        e.email,
        e.function,
        e.department_id,
        e.department_name,
        COALESCE(c.hours_monday_even + c.hours_tuesday_even + c.hours_wednesday_even + c.hours_thursday_even + c.hours_friday_even, 40) as contract_hours,
        CASE
          WHEN c.id IS NOT NULL THEN
            CASE
              WHEN c.startdate IS NOT NULL AND c.enddate IS NOT NULL THEN
                date(c.startdate) || ' - ' || date(c.enddate)
              WHEN c.startdate IS NOT NULL AND c.enddate IS NULL THEN
                date(c.startdate) || ' - heden'
              ELSE '40 uur per week'
            END
          ELSE '40 uur per week'
        END as contract_period,
        (
          SELECT COALESCE(SUM(arl.amount), 0)
          FROM absence_request_lines arl
          JOIN absence_requests ar ON arl.absencerequest_id = ar.id
          WHERE ar.employee_id = e.id
          AND arl.date BETWEEN ? AND ?
          AND ar.absencetype_searchname = 'Feestdag'
          AND (arl.status_id = 2 OR arl.status_id = 1)
        ) as holiday_hours
      FROM
        employees e
      LEFT JOIN
        contracts c ON e.id = c.employee_id AND (c.enddate IS NULL OR date(c.enddate.date) >= date('now'))
      WHERE
        e.active = 1
      ORDER BY
        e.firstname, e.lastname
    `, [startDate, endDate]);

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

    // Bereken verwachte uren per werknemer
    const employeesWithStats = employees.map(employee => {
      // Bereken geschreven uren
      const employeeHours = hours.filter(h => h.employee_id === employee.id);
      const writtenHours = employeeHours.reduce((sum, h) => sum + h.amount, 0);

      // Bereken verlofuren
      const employeeAbsences = absences.filter(a => a.employee_id === employee.id);
      const leaveHours = employeeAbsences.reduce((sum, a) => {
        // Tel alleen verlofuren, geen feestdagen
        if (a.type_name !== 'Feestdag') {
          return sum + a.hours_per_day;
        }
        return sum;
      }, 0);

      // Bereken vakantie-uren (feestdagen) - hardcoded waarden
      // In een echte implementatie zou dit uit de database moeten komen
      let holidayHours = 0;

      // Koningsdag (27 april)
      if (startDate <= '2025-04-27' && '2025-04-27' <= endDate) {
        holidayHours += 8;
      }

      // Bevrijdingsdag (5 mei) - eens in de 5 jaar vrij (2025 is een lustrumjaar)
      if (startDate <= '2025-05-05' && '2025-05-05' <= endDate) {
        holidayHours += 8;
      }

      // Hemelvaartsdag (29 mei 2025)
      if (startDate <= '2025-05-29' && '2025-05-29' <= endDate) {
        holidayHours += 8;
      }

      // Pinksteren (8 juni 2025)
      if (startDate <= '2025-06-08' && '2025-06-08' <= endDate) {
        holidayHours += 8;
      }

      // Bereken verwachte uren op basis van contracturen
      const workingDays = 5; // Standaard werkdagen per week
      const expectedHours = (employee.contract_hours / workingDays) * workingDays;

      // Bereken werkelijke uren (geschreven uren)
      const actualHours = writtenHours;

      return {
        ...employee,
        written_hours: writtenHours,
        leave_hours: leaveHours,
        holiday_hours: holidayHours,
        expected_hours: expectedHours,
        actual_hours: actualHours
      };
    });

    // Combineer data
    const result = {
      employees: employeesWithStats,
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

    // Haal medewerkers op met contractgegevens
    const employees = await db.all(`
      SELECT
        e.id,
        e.firstname,
        e.lastname,
        e.email,
        e.function,
        e.department_id,
        e.department_name,
        COALESCE(c.hours_monday_even + c.hours_tuesday_even + c.hours_wednesday_even + c.hours_thursday_even + c.hours_friday_even, 40) as contract_hours,
        CASE
          WHEN c.id IS NOT NULL THEN
            CASE
              WHEN c.startdate IS NOT NULL AND c.enddate IS NOT NULL THEN
                date(c.startdate) || ' - ' || date(c.enddate)
              WHEN c.startdate IS NOT NULL AND c.enddate IS NULL THEN
                date(c.startdate) || ' - heden'
              ELSE '40 uur per week'
            END
          ELSE '40 uur per week'
        END as contract_period,
        (
          SELECT COALESCE(SUM(arl.amount), 0)
          FROM absence_request_lines arl
          JOIN absence_requests ar ON arl.absencerequest_id = ar.id
          WHERE ar.employee_id = e.id
          AND arl.date BETWEEN ? AND ?
          AND ar.absencetype_searchname = 'Feestdag'
          AND (arl.status_id = 2 OR arl.status_id = 1)
        ) as holiday_hours
      FROM
        employees e
      LEFT JOIN
        contracts c ON e.id = c.employee_id AND (c.enddate IS NULL OR date(c.enddate) >= date('now'))
      WHERE
        e.active = 1
      ORDER BY
        e.firstname, e.lastname
    `, [startDate, endDate]);

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

    // Bereken verwachte uren per werknemer
    const employeesWithStats = employees.map(employee => {
      // Bereken geschreven uren
      const employeeHours = hours.filter(h => h.employee_id === employee.id);
      const writtenHours = employeeHours.reduce((sum, h) => sum + h.amount, 0);

      // Bereken verlofuren
      const employeeAbsences = absences.filter(a => a.employee_id === employee.id);
      const leaveHours = employeeAbsences.reduce((sum, a) => {
        // Tel alleen verlofuren, geen feestdagen
        if (a.type_name !== 'Feestdag') {
          return sum + a.hours_per_day;
        }
        return sum;
      }, 0);

      // Bereken vakantie-uren (feestdagen)
      // Haal feestdagen op uit de database of gebruik een lijst van bekende feestdagen
      let holidayHours = 0;

      // Lijst van Nederlandse feestdagen voor het huidige jaar
      const holidays = getHolidaysForYear(year);

      // Filter feestdagen die in de huidige maand vallen
      const holidaysInMonth = holidays.filter(holiday => {
        const holidayDate = holiday.date;
        return holidayDate >= startDate && holidayDate <= endDate;
      });

      // Tel alleen feestdagen die op werkdagen vallen (ma-vr)
      holidaysInMonth.forEach(holiday => {
        const holidayDate = new Date(holiday.date);
        const dayOfWeek = holidayDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = zondag, 6 = zaterdag
          holidayHours += 8; // Standaard 8 uur per feestdag
        }
      });

      console.log(`Feestdagen in maand ${month}-${year}: ${holidaysInMonth.length}, uren: ${holidayHours}`);

      // Bereken verwachte uren op basis van contracturen
      // Bereken het werkelijke aantal werkdagen in de maand (ma-vr)
      const firstDay = new Date(year, month - 1, 1);
      const lastDayOfMonth = new Date(year, month, 0);

      // Tel het aantal werkdagen (ma-vr) in de maand
      let workingDaysInMonth = 0;
      const currentDate = new Date(firstDay);
      while (currentDate <= lastDayOfMonth) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = zondag, 6 = zaterdag
          workingDaysInMonth++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      console.log(`Werkdagen in maand ${month}-${year}: ${workingDaysInMonth}`);
      const expectedHours = (employee.contract_hours / 5) * workingDaysInMonth;

      // Bereken werkelijke uren (geschreven uren)
      const actualHours = writtenHours;

      return {
        ...employee,
        written_hours: writtenHours,
        leave_hours: leaveHours,
        holiday_hours: holidayHours,
        expected_hours: expectedHours,
        actual_hours: actualHours
      };
    });

    // Combineer data
    const result = {
      employees: employeesWithStats,
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

/**
 * GET /api/v1/employees/unwritten-hours
 *
 * Haal medewerkers op met ongeschreven uren
 */
router.get('/unwritten-hours', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();

    if (!db) {
      return res.status(500).json({
        success: false,
        error: 'Database not initialized'
      });
    }

    // Get current month start and end dates
    const now = new Date();
    const startDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const endDate = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${lastDay}`;

    // Get employees with contract hours and written hours
    const employees = await db.all(`
      SELECT
        e.id,
        e.firstname || ' ' || e.lastname as name,
        e.function,
        e.active,
        COALESCE(c.hours_monday_even + c.hours_tuesday_even + c.hours_wednesday_even + c.hours_thursday_even + c.hours_friday_even, 40) as contractHours,
        CASE
          WHEN c.id IS NOT NULL THEN
            CASE
              WHEN c.startdate IS NOT NULL AND c.enddate IS NOT NULL THEN
                date(c.startdate) || ' - ' || date(c.enddate)
              WHEN c.startdate IS NOT NULL AND c.enddate IS NULL THEN
                date(c.startdate) || ' - heden'
              ELSE '40 uur per week'
            END
          ELSE '40 uur per week'
        END as contract_period,
        (
          SELECT COALESCE(SUM(arl.amount), 0)
          FROM absence_request_lines arl
          JOIN absence_requests ar ON arl.absencerequest_id = ar.id
          WHERE ar.employee_id = e.id
          AND arl.date BETWEEN ? AND ?
          AND ar.absencetype_searchname = 'Feestdag'
          AND (arl.status_id = 2 OR arl.status_id = 1)
        ) as holiday_hours,
        COALESCE(SUM(h.amount), 0) as writtenHours
      FROM
        employees e
      LEFT JOIN
        contracts c ON e.id = c.employee_id AND (c.enddate IS NULL OR date(c.enddate) >= date('now'))
      LEFT JOIN
        hours h ON e.id = h.employee_id AND h.date >= date('now', 'start of month') AND h.date <= date('now', 'end of month')
      WHERE
        e.active = 1
      GROUP BY
        e.id
      ORDER BY
        writtenHours ASC
    `, [startDate, endDate]);

    // Calculate expected hours for the current month
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const workingDaysInMonth = 22; // Approximate working days in a month

    // Process employee data
    const employeesWithUnwrittenHours = employees.map(emp => {
      const expectedHours = Math.round((emp.contractHours / 5) * workingDaysInMonth); // 5 working days per week
      const unwrittenHours = expectedHours - emp.writtenHours;

      return {
        ...emp,
        expectedHours,
        unwrittenHours: unwrittenHours > 0 ? unwrittenHours : 0
      };
    });

    res.json({
      success: true,
      data: employeesWithUnwrittenHours,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching employees with unwritten hours:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employees with unwritten hours',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/employees/month-stats
 *
 * Haal statistieken op voor medewerkers voor een specifieke maand
 */
router.get('/month-stats', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();

    if (!db) {
      return res.status(500).json({
        success: false,
        error: 'Database not initialized'
      });
    }

    // Parse parameters
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    // Valideer parameters
    if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
      throw new BadRequestError('Invalid month or year');
    }

    // Bereken maand data
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;

    console.log(`Fetching employee month stats for ${year}-${month} (${startDate} to ${endDate})`);

    // Get all active employees with contract data and written hours
    const employees = await db.all(`
      SELECT
        e.id,
        e.firstname || ' ' || e.lastname as name,
        e.function,
        e.active,
        COALESCE(c.hours_monday_even + c.hours_tuesday_even + c.hours_wednesday_even + c.hours_thursday_even + c.hours_friday_even, 40) as contract_hours,
        CASE
          WHEN c.id IS NOT NULL THEN
            CASE
              WHEN c.startdate IS NOT NULL AND c.enddate IS NOT NULL THEN
                date(c.startdate) || ' - ' || date(c.enddate)
              WHEN c.startdate IS NOT NULL AND c.enddate IS NULL THEN
                date(c.startdate) || ' - heden'
              ELSE '40 uur per week'
            END
          ELSE '40 uur per week'
        END as contract_period,
        (
          -- Feestdagen worden nu dynamisch berekend in de JavaScript code
          -- Deze query haalt alleen de feestdagen op die in de database staan
          SELECT COALESCE(SUM(arl.amount), 0)
          FROM absence_request_lines arl
          JOIN absence_requests ar ON arl.absencerequest_id = ar.id
          WHERE ar.employee_id = e.id
          AND arl.date BETWEEN ? AND ?
          AND ar.absencetype_searchname = 'Feestdag'
          AND (arl.status_id = 2 OR arl.status_id = 1)
        ) as holiday_hours,
        (
          SELECT COALESCE(SUM(h.amount), 0)
          FROM hours h
          WHERE h.employee_id = e.id
          AND h.date BETWEEN ? AND ?
        ) as written_hours,
        (
          SELECT COALESCE(SUM(h.amount), 0)
          FROM hours h
          WHERE h.employee_id = e.id
          AND h.date BETWEEN ? AND ?
        ) as actual_hours,
        (
          SELECT COALESCE(SUM(arl.amount), 0)
          FROM absence_request_lines arl
          JOIN absence_requests ar ON arl.absencerequest_id = ar.id
          WHERE ar.employee_id = e.id
          AND arl.date BETWEEN ? AND ?
          AND ar.absencetype_searchname != 'Feestdag'
          AND (arl.status_id = 2 OR arl.status_id = 1)
        ) as leave_hours,
        (
          -- Bereken expected hours: contract uren per dag * werkdagen in maand - feestdagen - verlof
          -- Bereken het werkelijke aantal werkdagen in de maand (ma-vr)
          (COALESCE(c.hours_monday_even + c.hours_tuesday_even + c.hours_wednesday_even + c.hours_thursday_even + c.hours_friday_even, 40) / 5) *
          (
            -- Bereken het aantal werkdagen (ma-vr) in de maand
            (
              SELECT COUNT(*)
              FROM (
                WITH RECURSIVE dates(date) AS (
                  VALUES(?)
                  UNION ALL
                  SELECT date(date, '+1 day')
                  FROM dates
                  WHERE date < ?
                )
                SELECT date FROM dates
                WHERE strftime('%w', date) NOT IN ('0', '6') -- Exclude weekends (0=Sunday, 6=Saturday)
              )
            )
          ) -
          (
            -- Feestdagen worden nu dynamisch berekend in de JavaScript code
            -- Deze query haalt alleen de feestdagen op die in de database staan
            SELECT COALESCE(SUM(arl.amount), 0)
            FROM absence_request_lines arl
            JOIN absence_requests ar ON arl.absencerequest_id = ar.id
            WHERE ar.employee_id = e.id
            AND arl.date BETWEEN ? AND ?
            AND ar.absencetype_searchname = 'Feestdag'
            AND (arl.status_id = 2 OR arl.status_id = 1)
          ) -
          (
            -- Verlof en ziekte uren
            SELECT COALESCE(SUM(arl.amount), 0)
            FROM absence_request_lines arl
            JOIN absence_requests ar ON arl.absencerequest_id = ar.id
            WHERE ar.employee_id = e.id
            AND arl.date BETWEEN ? AND ?
            AND ar.absencetype_searchname != 'Feestdag'
            AND (arl.status_id = 2 OR arl.status_id = 1)
          )
        ) as expected_hours
      FROM
        employees e
      LEFT JOIN
        contracts c ON e.id = c.employee_id
      WHERE
        e.active = 1
      GROUP BY
        e.id
      ORDER BY
        e.firstname, e.lastname
    `, [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate]);

    // Bereken feestdagen voor deze maand
    const holidays = getHolidaysForYear(year);
    const holidaysInMonth = holidays.filter(holiday => {
      const holidayDate = holiday.date;
      return holidayDate >= startDate && holidayDate <= endDate;
    });

    // Tel alleen feestdagen die op werkdagen vallen (ma-vr)
    const workdayHolidays = holidaysInMonth.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      const dayOfWeek = holidayDate.getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6; // 0 = zondag, 6 = zaterdag
    });

    // Bereken het aantal werkdagen in de maand
    const firstDay = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);
    let workingDaysInMonth = 0;
    const currentDate = new Date(firstDay);
    while (currentDate <= lastDayOfMonth) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = zondag, 6 = zaterdag
        workingDaysInMonth++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`Found ${employees.length} employees with stats for month ${month} of ${year}`);
    console.log(`Werkdagen in maand ${month}-${year}: ${workingDaysInMonth}`);
    console.log(`Feestdagen in maand ${month}-${year}: ${holidaysInMonth.length}, waarvan op werkdagen: ${workdayHolidays.length}`);
    console.log(`Feestdagen: ${workdayHolidays.map(h => `${h.name} (${h.date})`).join(', ')}`);

    res.json({
      success: true,
      data: employees,
      meta: {
        timestamp: new Date().toISOString(),
        period: {
          year,
          month,
          startDate,
          endDate
        }
      }
    });
  } catch (error) {
    console.error('Error fetching employee month stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee month stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/employees/week-stats
 *
 * Haal statistieken op voor medewerkers voor een specifieke week
 */
router.get('/week-stats', async (req: Request, res: Response) => {
  try {
    const db = await getDatabase();

    if (!db) {
      return res.status(500).json({
        success: false,
        error: 'Database not initialized'
      });
    }

    // Parse parameters
    const week = parseInt(req.query.week as string);
    const year = parseInt(req.query.year as string);

    // Valideer parameters
    if (isNaN(week) || isNaN(year) || week < 1 || week > 53) {
      throw new BadRequestError('Invalid week or year');
    }

    // Bereken week data
    const { startDate, endDate } = getWeekDates(year, week);
    console.log(`Fetching employee week stats for ${year}-${week} (${startDate} to ${endDate})`);

    // Get all active employees with contract data and written hours
    const employees = await db.all(`
      SELECT
        e.id,
        e.firstname || ' ' || e.lastname as name,
        e.function,
        e.active,
        COALESCE(c.hours_monday_even + c.hours_tuesday_even + c.hours_wednesday_even + c.hours_thursday_even + c.hours_friday_even, 40) as contract_hours,
        CASE
          WHEN c.id IS NOT NULL THEN
            CASE
              WHEN c.startdate IS NOT NULL AND c.enddate IS NOT NULL THEN
                date(c.startdate) || ' - ' || date(c.enddate)
              WHEN c.startdate IS NOT NULL AND c.enddate IS NULL THEN
                date(c.startdate) || ' - heden'
              ELSE '40 uur per week'
            END
          ELSE '40 uur per week'
        END as contract_period,
        (
          -- Feestdagen worden nu dynamisch berekend in de JavaScript code
          -- Deze query haalt alleen de feestdagen op die in de database staan
          SELECT COALESCE(SUM(arl.amount), 0)
          FROM absence_request_lines arl
          JOIN absence_requests ar ON arl.absencerequest_id = ar.id
          WHERE ar.employee_id = e.id
          AND arl.date BETWEEN ? AND ?
          AND ar.absencetype_searchname = 'Feestdag'
          AND (arl.status_id = 2 OR arl.status_id = 1)
        ) as holiday_hours,
        (
          SELECT COALESCE(SUM(h.amount), 0)
          FROM hours h
          WHERE h.employee_id = e.id
          AND h.date BETWEEN ? AND ?
        ) as written_hours,
        (
          SELECT COALESCE(SUM(h.amount), 0)
          FROM hours h
          WHERE h.employee_id = e.id
          AND h.date BETWEEN ? AND ?
        ) as actual_hours,
        (
          SELECT COALESCE(SUM(arl.amount), 0)
          FROM absence_request_lines arl
          JOIN absence_requests ar ON arl.absencerequest_id = ar.id
          WHERE ar.employee_id = e.id
          AND arl.date BETWEEN ? AND ?
          AND ar.absencetype_searchname != 'Feestdag'
          AND (arl.status_id = 2 OR arl.status_id = 1)
        ) as leave_hours,
        (
          -- Bereken expected hours: contract uren per dag * werkdagen in week - feestdagen - verlof
          -- Voor een 40-uurs contract: 8 uur per dag * 5 werkdagen = 40 uur
          -- Minus feestdagen en verlof
          (COALESCE(c.hours_monday_even + c.hours_tuesday_even + c.hours_wednesday_even + c.hours_thursday_even + c.hours_friday_even, 40)) -
          (
            -- Feestdagen worden nu dynamisch berekend in de JavaScript code
            -- Deze query haalt alleen de feestdagen op die in de database staan
            SELECT COALESCE(SUM(arl.amount), 0)
            FROM absence_request_lines arl
            JOIN absence_requests ar ON arl.absencerequest_id = ar.id
            WHERE ar.employee_id = e.id
            AND arl.date BETWEEN ? AND ?
            AND ar.absencetype_searchname = 'Feestdag'
            AND (arl.status_id = 2 OR arl.status_id = 1)
          ) -
          (
            -- Verlof en ziekte uren
            SELECT COALESCE(SUM(arl.amount), 0)
            FROM absence_request_lines arl
            JOIN absence_requests ar ON arl.absencerequest_id = ar.id
            WHERE ar.employee_id = e.id
            AND arl.date BETWEEN ? AND ?
            AND ar.absencetype_searchname != 'Feestdag'
            AND (arl.status_id = 2 OR arl.status_id = 1)
          )
        ) as expected_hours
      FROM
        employees e
      LEFT JOIN
        contracts c ON e.id = c.employee_id
      WHERE
        e.active = 1
      GROUP BY
        e.id
      ORDER BY
        e.firstname, e.lastname
    `, [startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate, startDate, endDate]);

    console.log(`Found ${employees.length} employees with stats for week ${week} of ${year}`);

    res.json({
      success: true,
      data: employees,
      meta: {
        timestamp: new Date().toISOString(),
        period: {
          year,
          week,
          startDate,
          endDate
        }
      }
    });
  } catch (error) {
    console.error('Error fetching employee week stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee week stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
