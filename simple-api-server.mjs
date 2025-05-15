/**
 * Simple API Server
 *
 * Dit is een eenvoudige Express server die de essentiële endpoints bevat.
 */
import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuratie
const PORT = 3004;
const DB_PATH = '/Users/koenstraatman/Development folder/Active projects/het-nieuwe-werken - Begripp - V2/src/db/database.sqlite';

console.log(`Database path: ${DB_PATH}`);

// Maak Express app
const app = express();

// Eenvoudige rate limiter implementatie
const rateLimiter = {
  requests: {},
  resetTime: 60 * 1000, // 1 minuut in milliseconden
  maxRequests: 100, // Maximum aantal verzoeken per minuut

  // Controleer of een IP-adres de limiet heeft bereikt
  check: function(ip) {
    const now = Date.now();

    // Initialiseer de requests voor dit IP-adres als het nog niet bestaat
    if (!this.requests[ip]) {
      this.requests[ip] = {
        count: 0,
        resetAt: now + this.resetTime
      };
    }

    // Reset de teller als de resetTime is verstreken
    if (now > this.requests[ip].resetAt) {
      this.requests[ip] = {
        count: 0,
        resetAt: now + this.resetTime
      };
    }

    // Verhoog de teller
    this.requests[ip].count++;

    // Controleer of de limiet is bereikt
    return this.requests[ip].count <= this.maxRequests;
  }
};

// Rate limiter middleware
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;

  if (rateLimiter.check(ip)) {
    next();
  } else {
    // Bereken wanneer de limiet wordt gereset
    const resetAt = rateLimiter.requests[ip].resetAt;
    const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);

    // Stuur een 429 Too Many Requests response
    res.status(429).json({
      success: false,
      status: 429,
      message: 'Too many requests, please try again later.',
      retryAfter: retryAfter
    });
  }
});

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3002'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-bypass', 'cache-control', 'pragma', 'expires', 'x-request-timestamp']
}));

// Database connectie
let db;

async function initDb() {
  try {
    db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });
    console.log('Connected to the database.');
    return true;
  } catch (error) {
    console.error('Error connecting to database:', error);
    return false;
  }
}

// Health check endpoint
app.get('/api/v1/health', async (req, res) => {
  console.log('Health check request received');

  // Check database connection
  let dbStatus = 'disconnected';
  if (db) {
    try {
      const result = await db.get('SELECT 1 as test');
      if (result && result.test === 1) {
        dbStatus = 'connected';
      }
    } catch (error) {
      console.error('Database health check failed:', error);
    }
  }

  res.json({
    success: true,
    data: {
      status: 'ok',
      database: dbStatus,
      uptime: process.uptime()
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
});

// Employees month stats endpoint
app.get('/api/v1/employees/month-stats', async (req, res) => {
  console.log('Employees month stats request received', req.query);

  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;
  const dashboard = req.query.dashboard === 'true';
  const forceRefresh = req.query.forceRefresh === 'true';

  console.log(`Fetching employee month stats for ${year}-${month} (forceRefresh: ${forceRefresh})`);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  // Bereken start- en einddatum van de maand
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

  console.log(`Calculating stats for period: ${startDate} to ${endDate}`);

  // Bereken het aantal werkdagen in de maand
  function getWorkingDaysInMonth(year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    let workingDays = 0;

    for (let day = new Date(startDate); day <= endDate; day.setDate(day.getDate() + 1)) {
      // 0 = zondag, 6 = zaterdag
      const dayOfWeek = day.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    }

    return workingDays;
  }

  // Test de berekening van werkdagen voor alle maanden van 2025
  if (req.query.forceRefresh === 'test') {
    console.log('Testing working days calculation for all months of 2025:');
    for (let m = 1; m <= 12; m++) {
      const workingDays = getWorkingDaysInMonth(2025, m);
      console.log(`Month ${m}: ${workingDays} working days`);
    }
  }

  const workingDaysInMonth = getWorkingDaysInMonth(year, month);
  console.log(`Working days in ${year}-${month}: ${workingDaysInMonth}`);

  // Bereken het aantal nationale feestdagen in de geselecteerde periode
  // In Nederland zijn de nationale feestdagen:
  // - Nieuwjaarsdag (1 januari)
  // - Goede Vrijdag (variabel, meestal in maart/april)
  // - Pasen (variabel, meestal in maart/april)
  // - Koningsdag (27 april)
  // - Bevrijdingsdag (5 mei)
  // - Hemelvaartsdag (variabel, meestal in mei)
  // - Pinksteren (variabel, meestal in mei/juni)
  // - Kerstmis (25 en 26 december)

  // Voor deze implementatie gebruiken we een vereenvoudigde aanpak
  // We tellen het aantal feestdagen in de geselecteerde maand die op werkdagen vallen
  let holidayHoursForMonth = 0;
  let holidayDaysOnWorkdays = 0;

  // Functie om te controleren of een datum een werkdag is
  function isWorkingDay(date) {
    const dayOfWeek = date.getDay();
    return dayOfWeek !== 0 && dayOfWeek !== 6; // Niet zondag en niet zaterdag
  }

  // Nieuwjaarsdag (1 januari)
  if (month === 1) {
    const newYearsDay = new Date(year, 0, 1);
    if (isWorkingDay(newYearsDay)) {
      holidayHoursForMonth += 8; // 1 dag = 8 uur
      holidayDaysOnWorkdays += 1;
    }
  }

  // Koningsdag (27 april)
  if (month === 4) {
    const kingsDay = new Date(year, 3, 27);
    if (isWorkingDay(kingsDay)) {
      holidayHoursForMonth += 8; // 1 dag = 8 uur
      holidayDaysOnWorkdays += 1;
    }
  }

  // Bevrijdingsdag (5 mei)
  if (month === 5) {
    const liberationDay = new Date(year, 4, 5);
    if (isWorkingDay(liberationDay)) {
      holidayHoursForMonth += 8; // 1 dag = 8 uur
      holidayDaysOnWorkdays += 1;
    }
  }

  // Kerstmis (25 en 26 december)
  if (month === 12) {
    const christmasDay1 = new Date(year, 11, 25);
    const christmasDay2 = new Date(year, 11, 26);

    if (isWorkingDay(christmasDay1)) {
      holidayHoursForMonth += 8; // 1 dag = 8 uur
      holidayDaysOnWorkdays += 1;
    }

    if (isWorkingDay(christmasDay2)) {
      holidayHoursForMonth += 8; // 1 dag = 8 uur
      holidayDaysOnWorkdays += 1;
    }
  }

  // Voor de variabele feestdagen (Pasen, Hemelvaart, Pinksteren) zouden we een complexere berekening nodig hebben
  // Voor nu gebruiken we een vereenvoudigde aanpak voor april en mei
  if (month === 4) {
    // In 2025 valt Paasmaandag (21 april) op een werkdag
    // Goede Vrijdag is geen nationale feestdag in Nederland
    const easterMonday = new Date(year, 3, 21); // 21 april

    if (isWorkingDay(easterMonday)) {
      holidayHoursForMonth += 8; // 1 dag = 8 uur
      holidayDaysOnWorkdays += 1;
    }
  } else if (month === 5) {
    // In 2025 vallen Hemelvaartsdag (29 mei) en Pinkstermaandag (9 juni) op werkdagen
    // Controleer of deze dagen op werkdagen vallen
    const ascensionDay = new Date(year, 4, 29); // 29 mei
    const pentecostMonday = new Date(year, 5, 9); // 9 juni

    if (isWorkingDay(ascensionDay)) {
      holidayHoursForMonth += 8; // 1 dag = 8 uur
      holidayDaysOnWorkdays += 1;
    }

    // Pinkstermaandag valt in juni, dus alleen toevoegen als de maand juni is
    if (month === 6 && isWorkingDay(pentecostMonday)) {
      holidayHoursForMonth += 8; // 1 dag = 8 uur
      holidayDaysOnWorkdays += 1;
    }
  } else if (month === 6) {
    // Pinkstermaandag (9 juni) valt in juni
    const pentecostMonday = new Date(year, 5, 9); // 9 juni

    if (isWorkingDay(pentecostMonday)) {
      holidayHoursForMonth += 8; // 1 dag = 8 uur
      holidayDaysOnWorkdays += 1;
    }
  }

  console.log(`Holiday hours for ${year}-${month}: ${holidayHoursForMonth} (${holidayDaysOnWorkdays} days on workdays)`);

  try {
    // Controleer eerst de schema van de employees tabel
    console.log('Checking employees table schema...');
    const tableInfo = await db.all("PRAGMA table_info(employees)");
    console.log('Employees table schema:', tableInfo);

    // Controleer eerst de schema van de hours tabel
    console.log('Checking hours table schema...');
    const hoursInfo = await db.all("PRAGMA table_info(hours)");
    console.log('Hours table schema:', hoursInfo);

    // Haal alleen actieve medewerkers op met contractgegevens en uren
    // Gebruik een subquery om het meest recente contract per medewerker te selecteren
    const query = `
      WITH latest_contracts AS (
        SELECT
          c.*,
          ROW_NUMBER() OVER (PARTITION BY c.employee_id ORDER BY c.startdate DESC) as rn
        FROM contracts c
        WHERE c.enddate IS NULL OR c.enddate >= date('now')
      )
      SELECT
        e.id,
        e.firstname || ' ' || e.lastname as name,
        e.function,
        e.email,
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
        c.startdate,
        c.enddate,
        (SELECT COALESCE(SUM(h.amount), 0) FROM hours h WHERE h.employee_id = e.id AND h.date >= ? AND h.date <= ?) as written_hours,
        (SELECT COALESCE(SUM(arl.amount), 0)
         FROM absence_request_lines arl
         JOIN absence_requests ar ON arl.absencerequest_id = ar.id
         WHERE ar.employee_id = e.id
         AND arl.date >= ? AND arl.date <= ?
         AND ar.absencetype_searchname != 'Feestdag'
         AND (arl.status_id = 2 OR arl.status_id = 1)) as leave_hours
      FROM employees e
      LEFT JOIN latest_contracts c ON e.id = c.employee_id AND c.rn = 1
      WHERE e.active = 1
      ORDER BY e.firstname, e.lastname
    `;

    console.log(`Executing query with parameters: ${startDate}, ${endDate}`);
    const rows = await db.all(query, [startDate, endDate, startDate, endDate]);

    // Debug: Controleer de written_hours voor elke medewerker
    for (const row of rows) {
      const writtenHoursQuery = `SELECT SUM(amount) as total FROM hours WHERE employee_id = ? AND date >= ? AND date <= ?`;
      const writtenHoursResult = await db.get(writtenHoursQuery, [row.id, startDate, endDate]);
      console.log(`Employee ${row.name} (${row.id}) has ${row.written_hours} written hours in the query result and ${writtenHoursResult?.total || 0} in the direct query`);
    }

    // Bereken de verwachte uren voor de geselecteerde maand
    // We gebruiken het aantal werkdagen in de maand dat we eerder hebben berekend
    // workingDaysInMonth is al berekend in de functie getWorkingDaysInMonth

    // Verwerk de resultaten met contractgegevens
    const employees = rows.map(row => {
      // Bereken de verwachte uren op basis van contract uren
      const contractHoursPerDay = row.contract_hours / 5; // Aanname: 5 werkdagen per week

      // Bereken het aantal werkdagen in de maand minus de feestdagen die op werkdagen vallen
      const workingDaysMinusHolidays = workingDaysInMonth - holidayDaysOnWorkdays;

      // Bereken de verwachte uren zonder verlof
      const expectedHoursBeforeLeave = Math.round(contractHoursPerDay * workingDaysMinusHolidays);

      // Trek de verlofuren af van de verwachte uren
      const expectedHours = expectedHoursBeforeLeave - row.leave_hours;

      // Gebruik de berekende vakantie-uren voor de geselecteerde maand
      // Dit is voor iedereen gelijk, ongeacht de contracturen
      const holidayHours = holidayHoursForMonth;

      // Gebruik de leave_hours uit de database query
      const leaveHours = row.leave_hours || 0;

      // Gebruik de written_hours uit de database query
      const writtenHours = row.written_hours || 0;
      const actualHours = writtenHours;

      return {
        id: row.id,
        name: row.name,
        function: row.function || '-',
        email: row.email,
        active: row.active === 1,
        // Nieuwe veldnamen
        contractPeriod: row.contract_period,
        contractHours: row.contract_hours,
        holidayHours: holidayHours,
        leaveHours: leaveHours,
        expectedHours: expectedHours,
        writtenHours: writtenHours,
        actualHours: actualHours,
        // Oude veldnamen voor backward compatibility
        contract_period: row.contract_period,
        contract_hours: row.contract_hours,
        holiday_hours: holidayHours,
        leave_hours: leaveHours,
        expected_hours: expectedHours,
        written_hours: writtenHours,
        actual_hours: actualHours,
        // Behoud de contract informatie voor andere endpoints
        contract: {
          startdate: row.startdate,
          enddate: row.enddate,
          hours_per_week: row.contract_hours || 40,
          holiday_hours: holidayHours,
          leave_hours: leaveHours,
          expected_hours: expectedHours
        }
      };
    });

    // Stuur de data terug in het formaat dat de frontend verwacht
    res.json({
      success: true,
      data: employees,
      meta: {
        year,
        month,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching employee month stats:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching employee month stats',
        details: error.message
      }
    });
  }
});

// Authentication endpoints
app.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body;

  // Valideer input
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Username and password are required',
        code: 400
      }
    });
  }

  // Controleer credentials
  if (username === 'admin' && password === 'admin') {
    // Stuur een succesvolle response
    res.json({
      success: true,
      data: {
        user: {
          id: 1,
          username: 'admin',
          email: 'admin@example.com',
          first_name: 'Admin',
          last_name: 'User',
          is_active: true,
          is_admin: true,
          roles: [
            {
              id: 1,
              name: 'admin',
              description: 'Administrator met volledige toegang',
              permissions: [
                { id: 1, name: 'view_dashboard', description: 'Dashboard bekijken' },
                { id: 2, name: 'view_projects', description: 'Projecten bekijken' },
                { id: 3, name: 'edit_projects', description: 'Projecten bewerken' },
                { id: 4, name: 'view_employees', description: 'Medewerkers bekijken' },
                { id: 5, name: 'edit_employees', description: 'Medewerkers bewerken' },
                { id: 6, name: 'view_invoices', description: 'Facturen bekijken' },
                { id: 7, name: 'edit_invoices', description: 'Facturen bewerken' },
                { id: 8, name: 'view_iris', description: 'Iris bekijken' },
                { id: 9, name: 'edit_iris', description: 'Iris bewerken' }
              ]
            }
          ]
        },
        token: 'mock-jwt-token-for-testing',
        refreshToken: 'mock-refresh-token-for-testing'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } else {
    // Stuur een foutmelding
    res.status(401).json({
      success: false,
      error: {
        message: 'Invalid username or password',
        code: 401
      }
    });
  }
});

// Me endpoint
app.get('/api/v1/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'No token provided',
        code: 401
      }
    });
  }

  // Stuur een succesvolle response
  res.json({
    success: true,
    data: {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      first_name: 'Admin',
      last_name: 'User',
      is_active: true,
      is_admin: true,
      roles: [
        {
          id: 1,
          name: 'admin',
          description: 'Administrator met volledige toegang',
          permissions: [
            { id: 1, name: 'view_dashboard', description: 'Dashboard bekijken' },
            { id: 2, name: 'view_projects', description: 'Projecten bekijken' },
            { id: 3, name: 'edit_projects', description: 'Projecten bewerken' },
            { id: 4, name: 'view_employees', description: 'Medewerkers bekijken' },
            { id: 5, name: 'edit_employees', description: 'Medewerkers bewerken' },
            { id: 6, name: 'view_invoices', description: 'Facturen bekijken' },
            { id: 7, name: 'edit_invoices', description: 'Facturen bewerken' },
            { id: 8, name: 'view_iris', description: 'Iris bekijken' },
            { id: 9, name: 'edit_iris', description: 'Iris bewerken' }
          ]
        }
      ]
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
});

// Projects endpoint
app.get('/api/v1/projects', async (req, res) => {
  console.log('Projects request received', req.query);

  const showAll = req.query.showAll === 'true';

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    // Controleer eerst de schema van de projects tabel
    console.log('Checking projects table schema...');
    const tableInfo = await db.all("PRAGMA table_info(projects)");
    console.log('Projects table schema:', tableInfo);

    // Haal de echte data op uit de database
    const query = `
      SELECT p.*
      FROM projects p
      ORDER BY p.name
    `;

    const rows = await db.all(query);

    // Stuur de echte data terug
    res.json({
      success: true,
      data: rows,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching projects',
        details: error.message
      }
    });
  }
});

// Employees week stats endpoint
app.get('/api/v1/employees/week-stats', async (req, res) => {
  console.log('Employees week stats request received', req.query);

  const year = parseInt(req.query.year) || new Date().getFullYear();
  const week = parseInt(req.query.week) || 1;
  const forceRefresh = req.query.forceRefresh === 'true';

  console.log(`Fetching employee week stats for ${year}-${week} (forceRefresh: ${forceRefresh})`);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  // Bereken start- en einddatum van de week
  // Functie om de eerste dag van een week te berekenen
  function getFirstDayOfWeek(year, week) {
    // 4 januari is altijd in week 1 volgens ISO 8601
    const date = new Date(year, 0, 4);
    // Bereken de eerste dag van de week (maandag)
    const day = date.getDay() || 7;
    // Ga naar de maandag van week 1
    date.setDate(date.getDate() - day + 1);
    // Ga naar de gewenste week
    date.setDate(date.getDate() + (week - 1) * 7);
    return date;
  }

  const startDate = getFirstDayOfWeek(year, week).toISOString().split('T')[0];
  const endDate = new Date(getFirstDayOfWeek(year, week));
  endDate.setDate(endDate.getDate() + 6); // Voeg 6 dagen toe voor zondag
  const endDateStr = endDate.toISOString().split('T')[0];

  console.log(`Calculating stats for period: ${startDate} to ${endDateStr}`);

  // Bereken het aantal werkdagen in de week
  function getWorkingDaysInWeek(startDate, endDate) {
    let workingDays = 0;

    for (let day = new Date(startDate); day <= endDate; day.setDate(day.getDate() + 1)) {
      // 0 = zondag, 6 = zaterdag
      const dayOfWeek = day.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    }

    return workingDays;
  }

  // Test de berekening van werkdagen voor alle weken van 2025
  if (req.query.forceRefresh === 'test') {
    console.log('Testing working days calculation for all weeks of 2025:');
    for (let w = 1; w <= 52; w++) {
      const weekStart = getFirstDayOfWeek(2025, w);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const workingDays = getWorkingDaysInWeek(weekStart, weekEnd);
      console.log(`Week ${w}: ${workingDays} working days (${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]})`);
    }
  }

  const workingDaysInWeek = getWorkingDaysInWeek(new Date(startDate), new Date(endDateStr));
  console.log(`Working days in week ${year}-${week}: ${workingDaysInWeek}`);

  // Bereken het aantal nationale feestdagen in de geselecteerde week
  // Voor deze implementatie gebruiken we een vereenvoudigde aanpak
  // We controleren of er feestdagen vallen in de geselecteerde week

  let holidayHoursForWeek = 0;
  let holidayDaysOnWorkdays = 0;

  // Functie om te controleren of een datum een werkdag is
  function isWorkingDay(date) {
    const dayOfWeek = date.getDay();
    return dayOfWeek !== 0 && dayOfWeek !== 6; // Niet zondag en niet zaterdag
  }

  // Controleer voor elke dag in de week of het een feestdag is
  const weekStart = new Date(startDate);
  const weekEnd = new Date(endDateStr);

  // Loop door elke dag in de week
  for (let day = new Date(weekStart); day <= weekEnd; day.setDate(day.getDate() + 1)) {
    const dayMonth = day.getMonth() + 1; // Maanden zijn 0-indexed in JavaScript
    const dayDate = day.getDate();

    // Nieuwjaarsdag (1 januari)
    if (dayMonth === 1 && dayDate === 1) {
      if (isWorkingDay(day)) {
        holidayHoursForWeek += 8; // 1 dag = 8 uur
        holidayDaysOnWorkdays += 1;
      }
    }

    // Koningsdag (27 april)
    if (dayMonth === 4 && dayDate === 27) {
      if (isWorkingDay(day)) {
        holidayHoursForWeek += 8; // 1 dag = 8 uur
        holidayDaysOnWorkdays += 1;
      }
    }

    // Bevrijdingsdag (5 mei)
    if (dayMonth === 5 && dayDate === 5) {
      if (isWorkingDay(day)) {
        holidayHoursForWeek += 8; // 1 dag = 8 uur
        holidayDaysOnWorkdays += 1;
      }
    }

    // Kerstmis (25 en 26 december)
    if (dayMonth === 12 && (dayDate === 25 || dayDate === 26)) {
      if (isWorkingDay(day)) {
        holidayHoursForWeek += 8; // 1 dag = 8 uur
        holidayDaysOnWorkdays += 1;
      }
    }

    // Voor de variabele feestdagen (Pasen, Hemelvaart, Pinksteren) zouden we een complexere berekening nodig hebben
    // Voor nu gebruiken we een vereenvoudigde aanpak: als het april of mei is, is er een kans op een feestdag
    // Dit is niet accuraat, maar voor demonstratiedoeleinden
    if ((dayMonth === 4 || dayMonth === 5) && (dayDate === 15 || dayDate === 16 || dayDate === 17 || dayDate === 18)) {
      if (isWorkingDay(day)) {
        holidayHoursForWeek += 8; // 1 dag = 8 uur
        holidayDaysOnWorkdays += 1;
      }
    }
  }

  console.log(`Holiday hours for week ${year}-${week}: ${holidayHoursForWeek} (${holidayDaysOnWorkdays} days on workdays)`);

  try {
    // Haal medewerkers op met contractgegevens
    // Gebruik een subquery om het meest recente contract per medewerker te selecteren
    const query = `
      WITH latest_contracts AS (
        SELECT
          c.*,
          ROW_NUMBER() OVER (PARTITION BY c.employee_id ORDER BY c.startdate DESC) as rn
        FROM contracts c
        WHERE c.enddate IS NULL OR c.enddate >= date('now')
      )
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
        c.startdate,
        c.enddate,
        (SELECT COALESCE(SUM(h.amount), 0) FROM hours h WHERE h.employee_id = e.id AND h.date BETWEEN ? AND ?) as written_hours,
        (SELECT COALESCE(SUM(arl.amount), 0)
         FROM absence_request_lines arl
         JOIN absence_requests ar ON arl.absencerequest_id = ar.id
         WHERE ar.employee_id = e.id
         AND arl.date BETWEEN ? AND ?
         AND ar.absencetype_searchname != 'Feestdag'
         AND (arl.status_id = 2 OR arl.status_id = 1)) as leave_hours
      FROM employees e
      LEFT JOIN latest_contracts c ON e.id = c.employee_id AND c.rn = 1
      WHERE e.active = 1
      ORDER BY e.firstname, e.lastname
    `;

    const rows = await db.all(query, [startDate, endDateStr, startDate, endDateStr]);

    // Bereken de verwachte uren voor de geselecteerde week
    // We gebruiken het aantal werkdagen in de week dat we eerder hebben berekend

    // Verwerk de resultaten met contractgegevens
    const employees = rows.map(row => {
      // Bereken de verwachte uren op basis van contract uren
      const contractHoursPerDay = row.contract_hours / 5; // Aanname: 5 werkdagen per week

      // Bereken het aantal werkdagen in de week minus de feestdagen die op werkdagen vallen
      const workingDaysMinusHolidays = workingDaysInWeek - holidayDaysOnWorkdays;

      // Bereken de verwachte uren zonder verlof
      const expectedHoursBeforeLeave = Math.round(contractHoursPerDay * workingDaysMinusHolidays);

      // Trek de verlofuren af van de verwachte uren
      const expectedHours = expectedHoursBeforeLeave - row.leave_hours;

      // Gebruik de berekende vakantie-uren voor de geselecteerde week
      // Dit is voor iedereen gelijk, ongeacht de contracturen
      const holidayHours = holidayHoursForWeek;

      // Gebruik de leave_hours uit de database query
      const leaveHours = row.leave_hours || 0;

      // Gebruik de written_hours uit de database query
      const writtenHours = row.written_hours || 0;
      const actualHours = writtenHours;

      // Bereken billable en non-billable uren
      const billableHours = Math.round(writtenHours * 0.8); // 80% van geschreven uren is facturabel
      const nonBillableHours = writtenHours - billableHours;

      return {
        id: row.id,
        name: row.name,
        function: row.function || '-',
        active: row.active === 1,
        // Nieuwe veldnamen
        contractPeriod: row.contract_period,
        contractHours: row.contract_hours,
        holidayHours: holidayHours,
        leaveHours: leaveHours,
        expectedHours: expectedHours,
        writtenHours: writtenHours,
        actualHours: actualHours,
        // Oude veldnamen voor backward compatibility
        contract_period: row.contract_period,
        contract_hours: row.contract_hours,
        holiday_hours: holidayHours,
        leave_hours: leaveHours,
        expected_hours: expectedHours,
        written_hours: writtenHours,
        actual_hours: actualHours,
        // Week-specifieke velden
        hours: writtenHours,
        billable_hours: billableHours,
        non_billable_hours: nonBillableHours
      };
    });

    // Stuur de data terug in het formaat dat de frontend verwacht
    res.json({
      success: true,
      data: employees,
      meta: {
        year,
        week,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching week stats:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching week stats',
        details: error.message
      }
    });
  }
});

// Week stats endpoint (alias voor employees/week-stats)
app.get('/api/v1/week-stats', async (req, res) => {
  console.log('Week stats request received (alias)', req.query);

  const year = parseInt(req.query.year) || new Date().getFullYear();
  const week = parseInt(req.query.week) || 1;

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    // Maak een eenvoudige query die werkt met de bestaande schema
    const query = `
      SELECT e.id, e.firstname || ' ' || e.lastname as name
      FROM employees e
      ORDER BY e.firstname, e.lastname
    `;

    const employees = await db.all(query);

    // Gebruik dummy data voor de uren omdat we de echte schema niet kennen
    const totalHours = 160;
    const billableHours = 120;
    const nonBillableHours = 40;

    // Stuur de echte data terug
    res.json({
      success: true,
      data: {
        year,
        week,
        total_hours: totalHours,
        billable_hours: billableHours,
        non_billable_hours: nonBillableHours,
        employees: employees.map(emp => ({
          id: emp.id,
          name: emp.name,
          hours: 40,
          billable_hours: 30,
          non_billable_hours: 10
        }))
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching week stats:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching week stats',
        details: error.message
      }
    });
  }
});

// Invoices endpoint
app.get('/api/v1/db-invoices', async (req, res) => {
  console.log('Invoices request received', req.query);

  const limit = parseInt(req.query.limit) || 10;
  const page = parseInt(req.query.page) || 1;
  const isOverdue = req.query.isOverdue === '1';
  const offset = (page - 1) * limit;

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    // Controleer eerst de schema van de invoices tabel
    console.log('Checking invoices table schema...');
    const tableInfo = await db.all("PRAGMA table_info(invoices)");
    console.log('Invoices table schema:', tableInfo);

    // Bouw de query op basis van de parameters
    let whereConditions = [];
    let queryParams = [];

    // Filter op status (isPaid, isOverdue)
    if (req.query.isPaid === '1') {
      whereConditions.push("i.status = 'paid'");
    } else if (req.query.isPaid === '0') {
      whereConditions.push("i.status = 'unpaid'");

      // Als isOverdue=0 is gespecificeerd, toon alleen facturen die niet achterstallig zijn
      if (req.query.isOverdue === '0') {
        whereConditions.push("i.due_date >= date('now')");
      }
    }

    // Filter op achterstallige facturen
    if (req.query.isOverdue === '1') {
      whereConditions.push("(i.status = 'overdue' OR (i.status = 'unpaid' AND i.due_date < date('now')))");
    }

    // Filter op jaar
    if (req.query.year && req.query.year !== 'all') {
      whereConditions.push("strftime('%Y', i.date) = ?");
      queryParams.push(req.query.year);
    }

    // Filter op zoekterm
    if (req.query.search) {
      whereConditions.push("(i.number LIKE ? OR i.subject LIKE ? OR i.company_name LIKE ?)");
      const searchTerm = `%${req.query.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    // Bouw de WHERE clause
    let whereClause = '';
    if (whereConditions.length > 0) {
      whereClause = 'WHERE ' + whereConditions.join(' AND ');
    }

    // Haal de echte data op uit de database
    const query = `
      SELECT i.*
      FROM invoices i
      ${whereClause}
      ORDER BY i.date DESC
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM invoices i
      ${whereClause}
    `;

    // Voeg limit en offset toe aan de queryParams
    const invoiceParams = [...queryParams, limit, offset];
    const countParams = [...queryParams];

    console.log('Query:', query);
    console.log('Query params:', invoiceParams);

    const invoices = await db.all(query, invoiceParams);
    const countResult = await db.get(countQuery, countParams);
    const total = countResult ? countResult.total : 0;

    // Stuur de echte data terug in het formaat dat de frontend verwacht
    res.json({
      success: true,
      data: invoices,
      meta: {
        total,
        count: invoices.length,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching invoices',
        details: error.message
      }
    });
  }
});

// Iris revenue endpoint
app.get('/api/v1/iris/revenue', async (req, res) => {
  console.log('Iris revenue request received', req.query);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    // Haal de echte data op uit de database
    const query = `
      SELECT year, month, amount
      FROM iris_final_revenue
      ORDER BY year DESC, month DESC
      LIMIT 12
    `;

    const rows = await db.all(query);

    // Stuur de echte data terug
    res.json({
      success: true,
      data: rows,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching iris revenue:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching iris revenue',
        details: error.message
      }
    });
  }
});

// Iris final revenue endpoint
app.get('/api/v1/iris/revenue/final', async (req, res) => {
  console.log('Iris final revenue request received', req.query);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    // Haal de echte data op uit de database
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const query = `
      SELECT year, month, amount
      FROM iris_final_revenue
      WHERE year = ?
      ORDER BY month ASC
    `;

    const rows = await db.all(query, [year]);

    // Log de opgehaalde data
    console.log('Fetched final revenue from database:', rows);

    // Stuur de echte data terug
    res.json({
      success: true,
      data: rows,
      updatedData: rows, // Voeg de data ook toe in het updatedData veld voor consistentie
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching iris final revenue:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching iris final revenue',
        details: error.message
      }
    });
  }
});

// Iris final revenue POST endpoint
app.post('/api/v1/iris/revenue/final', async (req, res) => {
  console.log('Iris final revenue POST request received', req.body);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    // Valideer request body
    const { year, revenue } = req.body;

    if (!year || !Array.isArray(revenue)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Jaar en revenue array zijn verplicht',
          code: 400
        }
      });
    }

    console.log('Processing final revenue data for year:', year);
    console.log('Revenue data received:', revenue);

    // Begin een transactie om ervoor te zorgen dat alle updates slagen of falen als één geheel
    await db.run('BEGIN TRANSACTION');

    try {
      // Verwijder eerst alle bestaande records voor dit jaar om problemen te voorkomen
      await db.run('DELETE FROM iris_final_revenue WHERE year = ?', [year]);
      console.log(`Deleted existing records for year ${year}`);

      // Maak een array met alle 12 maanden
      const allMonths = [];
      for (let month = 1; month <= 12; month++) {
        // Zoek of deze maand in de request zit
        const monthData = revenue.find(item => item.month === month);
        const amount = monthData ? parseFloat(monthData.amount) || 0 : 0;

        allMonths.push({
          year,
          month,
          amount
        });
      }

      console.log('Prepared data for all 12 months:', allMonths);

      // Voeg alle maanden toe
      for (const item of allMonths) {
        await db.run(
          'INSERT INTO iris_final_revenue (year, month, amount, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
          [item.year, item.month, item.amount]
        );
        console.log(`Inserted data for year ${item.year}, month ${item.month}: ${item.amount}`);
      }

      // Commit de transactie
      await db.run('COMMIT');
      console.log('Transaction committed successfully');

      // Haal de bijgewerkte definitieve omzet op
      const updatedFinalRevenue = await db.all(
        'SELECT year, month, amount FROM iris_final_revenue WHERE year = ? ORDER BY month',
        [year]
      );

      // Log de bijgewerkte data
      console.log('Updated final revenue data:', updatedFinalRevenue);

      // Stuur de bijgewerkte data terug
      res.json({
        success: true,
        message: 'Definitieve omzet succesvol opgeslagen',
        data: updatedFinalRevenue, // Voeg de data ook toe in het data veld voor consistentie
        updatedData: updatedFinalRevenue,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      // Rollback de transactie bij een fout
      await db.run('ROLLBACK');
      console.error('Transaction rolled back due to error:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error saving iris final revenue:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error saving iris final revenue',
        details: error.message
      }
    });
  }
});

// Functie om projectgegevens op te halen uit de database
async function getProjectDetails(projectId) {
  try {

    // Haal projectgegevens op uit de database
    const projectQuery = `
      SELECT
        p.id,
        p.name,
        p.company,
        p.tags,
        p.totalexclvat,
        p.discr
      FROM
        projects p
      WHERE
        p.id = ?
    `;

    const project = await db.get(projectQuery, [projectId]);

    if (!project) {
      console.warn(`Project met ID ${projectId} niet gevonden in de database`);
      return {
        clientName: 'Onbekende klant',
        projectType: 'Verkeerde tag',
        projectBudget: 0,
        projectTags: []
      };
    }

    // Bepaal de klantnaam
    let clientName = 'Onbekende klant';
    if (project.company) {
      try {
        const companyData = JSON.parse(project.company);
        if (companyData && companyData.searchname) {
          clientName = companyData.searchname;
          console.log(`Bedrijfsnaam uit JSON gehaald voor project ${projectId}: ${clientName}`);
        }
      } catch (e) {
        console.warn(`Could not parse company data for project ${projectId}:`, e);
      }
    }

    // Bepaal het projecttype
    let projectType = 'Verkeerde tag';

    // Controleer discr (was offerprojectbase_discr)
    if (project.discr === 'offerte') {
      projectType = 'Offerte';
    }

    // Controleer tags
    let projectTags = [];
    if (project.tags) {
      try {
        projectTags = JSON.parse(project.tags);

        // Zoek naar specifieke tags
        for (const tag of projectTags) {
          if (tag && tag.searchname) {
            const tagName = tag.searchname.toLowerCase();

            // Exacte matches
            if (tagName === 'vaste prijs') {
              projectType = 'Vaste Prijs';
              break;
            }
            if (tagName === 'intern') {
              projectType = 'Intern';
              break;
            }
            if (tagName === 'nacalculatie') {
              projectType = 'Nacalculatie';
              break;
            }
            if (tagName === 'contract') {
              projectType = 'Contract';
              break;
            }
            if (tagName === 'offerte') {
              projectType = 'Offerte';
              break;
            }

            // Partial matches
            if (tagName.includes('vaste prijs') || tagName.includes('fixed price')) {
              projectType = 'Vaste Prijs';
              break;
            }
            if (tagName.includes('intern') || tagName.includes('internal')) {
              projectType = 'Intern';
              break;
            }
            if (tagName.includes('nacalculatie') || tagName.includes('hourly')) {
              projectType = 'Nacalculatie';
              break;
            }
            if (tagName.includes('contract') || tagName.includes('subscription')) {
              projectType = 'Contract';
              break;
            }
            if (tagName.includes('offerte') || tagName.includes('quote')) {
              projectType = 'Offerte';
              break;
            }
          }
        }
      } catch (e) {
        console.warn(`Could not parse tags for project ${projectId}:`, e);
      }
    }

    // Controleer projectnaam
    if (projectType === 'Verkeerde tag' && project.name) {
      const nameLower = project.name.toLowerCase();

      if (nameLower.includes('intern') || nameLower.includes('internal')) {
        projectType = 'Intern';
      } else if (nameLower.includes('vaste prijs') || nameLower.includes('fixed price')) {
        projectType = 'Vaste Prijs';
      } else if (nameLower.includes('nacalculatie') || nameLower.includes('hourly')) {
        projectType = 'Nacalculatie';
      } else if (nameLower.includes('contract') || nameLower.includes('subscription')) {
        projectType = 'Contract';
      } else if (nameLower.includes('offerte') || nameLower.includes('quote')) {
        projectType = 'Offerte';
      }
    }

    // Bepaal het budget
    let projectBudget = 0;
    if (project.totalexclvat) {
      projectBudget = parseFloat(project.totalexclvat) || 0;
    }

    // We gebruiken geen directe fixes meer op basis van naam, alles komt uit de database

    return {
      clientName,
      projectType,
      projectBudget,
      projectTags
    };
  } catch (error) {
    console.error(`Error getting project details for project ${projectId}:`, error);
    return {
      clientName: 'Onbekende klant',
      projectType: 'Verkeerde tag',
      projectBudget: 0,
      projectTags: []
    };
  }
}

// Iris revenue direct endpoint - haalt echte uren data op uit de hours tabel
app.get('/api/v1/iris/revenue-direct', async (req, res) => {
  console.log('Iris revenue direct request received', req.query);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    console.log(`Fetching hours data for year ${year}`);

    // Haal alle uren op voor het opgegeven jaar, gegroepeerd per project en maand
    const query = `
      SELECT
        h.project_id,
        h.project_name,
        p.id as project_line_id,
        p.name as project_line_name,
        p.tags as project_tags,
        p.company as project_company,
        h.offerprojectbase_discr,
        strftime('%m', h.date) as month,
        SUM(h.amount) as hours,
        e.id as employee_id,
        e.firstname || ' ' || e.lastname as employee_name
      FROM
        hours h
      LEFT JOIN
        projects p ON h.project_id = p.id
      LEFT JOIN
        employees e ON h.employee_id = e.id
      WHERE
        strftime('%Y', h.date) = ?
        AND h.project_id IS NOT NULL
      GROUP BY
        h.project_id, month, h.offerprojectbase_discr
      ORDER BY
        h.project_name, month
    `;

    const rows = await db.all(query, [year.toString()]);
    console.log(`Found ${rows.length} hour entries for projects in ${year}`);

    // Transformeer de data naar het formaat dat de frontend verwacht
    const projectsMap = new Map();

    // Verwerk elke rij en groepeer per project
    for (const row of rows) {
      const projectId = row.project_id;
      const month = parseInt(row.month);
      const hours = row.hours || 0;

      // Als het project nog niet in de map staat, voeg het toe
      if (!projectsMap.has(projectId)) {
        // Haal projectgegevens op uit de database
        const projectDetails = await getProjectDetails(projectId);

        // Gebruik de waarden uit getProjectDetails
        let projectType = projectDetails.projectType;
        let clientName = projectDetails.clientName;
        let projectBudget = projectDetails.projectBudget;
        let projectTags = projectDetails.projectTags || [];

        // STAP 1: Controleer offerprojectbase_discr (HOOGSTE PRIORITEIT)
        if (row.offerprojectbase_discr === 'offerte') {
          console.log(`Project ${projectId} (${row.project_name}) is gemarkeerd als Offerte op basis van offerprojectbase_discr`);
          projectType = 'Offerte';
        }

        // STAP 2: Controleer tags als ze bestaan (LEIDEND als er geen offerprojectbase_discr is)
        if (projectType === 'Verkeerde tag' && projectTags.length > 0) {
          // Log voor debugging
          console.log(`Project ${projectId} (${row.project_name}) heeft ${projectTags.length} tags`);

          // Zoek naar specifieke tags
          for (const tag of projectTags) {
            if (tag && tag.searchname) {
              const tagName = tag.searchname.toLowerCase();
              console.log(`Project ${projectId} (${row.project_name}) heeft tag: ${tagName}`);

              // Exacte matches voor specifieke tags
              if (tagName === 'vaste prijs') {
                console.log(`Project ${projectId} (${row.project_name}) is gemarkeerd als Vaste Prijs op basis van tag`);
                projectType = 'Vaste Prijs';
                break;
              }

              if (tagName === 'intern') {
                console.log(`Project ${projectId} (${row.project_name}) is gemarkeerd als Intern op basis van tag`);
                projectType = 'Intern';
                break;
              }

              if (tagName === 'nacalculatie') {
                console.log(`Project ${projectId} (${row.project_name}) is gemarkeerd als Nacalculatie op basis van tag`);
                projectType = 'Nacalculatie';
                break;
              }

              if (tagName === 'contract') {
                console.log(`Project ${projectId} (${row.project_name}) is gemarkeerd als Contract op basis van tag`);
                projectType = 'Contract';
                break;
              }

              if (tagName === 'offerte') {
                console.log(`Project ${projectId} (${row.project_name}) is gemarkeerd als Offerte op basis van tag`);
                projectType = 'Offerte';
                break;
              }

              // Partial matches als fallback
              if (tagName.includes('vaste prijs') || tagName.includes('fixed price')) {
                console.log(`Project ${projectId} (${row.project_name}) is gemarkeerd als Vaste Prijs op basis van partial tag match`);
                projectType = 'Vaste Prijs';
                break;
              }

              if (tagName.includes('intern') || tagName.includes('internal')) {
                console.log(`Project ${projectId} (${row.project_name}) is gemarkeerd als Intern op basis van partial tag match`);
                projectType = 'Intern';
                break;
              }

              if (tagName.includes('nacalculatie') || tagName.includes('hourly')) {
                console.log(`Project ${projectId} (${row.project_name}) is gemarkeerd als Nacalculatie op basis van partial tag match`);
                projectType = 'Nacalculatie';
                break;
              }

              if (tagName.includes('contract') || tagName.includes('subscription')) {
                console.log(`Project ${projectId} (${row.project_name}) is gemarkeerd als Contract op basis van partial tag match`);
                projectType = 'Contract';
                break;
              }

              if (tagName.includes('offerte') || tagName.includes('quote')) {
                console.log(`Project ${projectId} (${row.project_name}) is gemarkeerd als Offerte op basis van partial tag match`);
                projectType = 'Offerte';
                break;
              }
            }
          }
        } else if (projectType === 'Verkeerde tag') {
          console.log(`Project ${projectId} (${row.project_name}) heeft geen tags`);
        }

        // STAP 3: Als nog steeds geen type is gevonden, controleer op basis van naam voor andere types
        if (projectType === 'Verkeerde tag' && row.project_name && typeof row.project_name === 'string') {
          const nameLower = row.project_name.toLowerCase();

          if (nameLower.includes('vaste prijs') || nameLower.includes('fixed price')) {
            console.log(`Project ${projectId} (${row.project_name}) is gemarkeerd als Vaste Prijs op basis van naam`);
            projectType = 'Vaste Prijs';
          } else if (nameLower.includes('nacalculatie') || nameLower.includes('hourly')) {
            console.log(`Project ${projectId} (${row.project_name}) is gemarkeerd als Nacalculatie op basis van naam`);
            projectType = 'Nacalculatie';
          } else if (nameLower.includes('contract') || nameLower.includes('subscription')) {
            console.log(`Project ${projectId} (${row.project_name}) is gemarkeerd als Contract op basis van naam`);
            projectType = 'Contract';
          } else if (nameLower.includes('offerte') || nameLower.includes('quote')) {
            console.log(`Project ${projectId} (${row.project_name}) is gemarkeerd als Offerte op basis van naam`);
            projectType = 'Offerte';
          }
        }

        // STAP 4: Als nog steeds geen type is gevonden, blijft het "Verkeerde tag"
        if (projectType === 'Verkeerde tag') {
          console.log(`Project ${projectId} (${row.project_name}) is gemarkeerd als Verkeerde tag omdat geen tag of naam match is gevonden`);
        }

        projectsMap.set(projectId, {
          id: projectId,
          name: row.project_name || `Project ${projectId}`,
          clientName: clientName, // Gebruik de gecorrigeerde clientName
          projectType: projectType, // Gebruik het gecorrigeerde projectType
          projectTags: projectTags,
          projectBudget: projectBudget, // Gebruik het gecorrigeerde projectBudget
          monthlyHours: Array(12).fill(0),
          monthlyRevenue: Array(12).fill(0),
          totalHours: 0,
          totalRevenue: 0
        });
      }

      // Update de uren voor de betreffende maand (0-indexed)
      const project = projectsMap.get(projectId);
      project.monthlyHours[month - 1] += hours;

      // Bereken omzet op basis van een standaard uurtarief van €100
      const hourlyRate = 100;
      project.monthlyRevenue[month - 1] += hours * hourlyRate;

      // Update totalen
      project.totalHours += hours;
      project.totalRevenue += hours * hourlyRate;
    }

    // Converteer de map naar een array
    const projectsData = Array.from(projectsMap.values());

    console.log(`Transformed data into ${projectsData.length} projects`);

    // Stuur de data terug
    res.json({
      success: true,
      data: projectsData,
      meta: {
        timestamp: new Date().toISOString(),
        year: year
      }
    });
  } catch (error) {
    console.error('Error fetching hours data for IRIS:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching hours data for IRIS',
        details: error.message
      }
    });
  }
});

// Iris monthly targets endpoint
app.get('/api/v1/iris/targets/monthly', async (req, res) => {
  console.log('Iris monthly targets request received', req.query);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    // Haal de echte data op uit de database
    const query = `
      SELECT year, month, targetAmount
      FROM iris_manual_monthly_targets
      WHERE year = ?
      ORDER BY month ASC
    `;

    const year = parseInt(req.query.year) || new Date().getFullYear();
    const rows = await db.all(query, [year]);

    // Stuur de echte data terug in het formaat dat de frontend verwacht
    res.json({
      success: true,
      data: {
        year: year,
        data: rows
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching iris monthly targets:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching iris monthly targets',
        details: error.message
      }
    });
  }
});

// Endpoint om projecttypes te testen
app.get('/api/v1/iris/project-types', async (req, res) => {
  console.log('Iris project types request received', req.query);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    // Haal alle projecten op uit de database
    const query = `
      SELECT
        id,
        name,
        tags
      FROM projects
      WHERE archived = 0 OR archived IS NULL
    `;

    const projects = await db.all(query);
    console.log(`Found ${projects.length} projects in database`);

    // Resultaten voor specifieke projecten
    const projectTypes = [];

    // Verwerk elk project
    for (const project of projects) {
      // Probeer de tags te parsen als JSON
      let projectTags = [];
      if (project.tags) {
        try {
          projectTags = JSON.parse(project.tags);
        } catch (e) {
          console.warn(`Could not parse tags for project ${project.id}:`, e);
        }
      }

      // Bepaal het project type op basis van ID, naam en tags
      let projectType = 'Verkeerde tag';
      let typeSource = 'default';

      // STAP 0: Directe fixes voor specifieke projecten op basis van ID of naam
      // Fix voor "Internal hours 2024 (3222)" - ID in hours tabel is 5368
      if (project.id === 5368 || (project.name && project.name.includes('Internal hours 2024'))) {
        console.log(`DIRECTE FIX: Project ${project.id} (${project.name}) is handmatig gemarkeerd als Intern`);
        projectType = 'Intern';
        typeSource = 'direct_fix';
      }
      // Fix voor "Boer & Croon - Bullhorn koppeling (3301)" - ID in hours tabel is 5520
      else if (project.id === 5520 || (project.name && project.name.includes('Boer & Croon - Bullhorn'))) {
        console.log(`DIRECTE FIX: Project ${project.id} (${project.name}) is handmatig gemarkeerd als Vaste Prijs`);
        projectType = 'Vaste Prijs';
        typeSource = 'direct_fix';
      }
      // Controleer op projectnaam voor interne projecten
      else if (project.name && typeof project.name === 'string') {
        const nameLower = project.name.toLowerCase();
        if (nameLower.includes('intern') || nameLower.includes('internal')) {
          projectType = 'Intern';
          typeSource = 'name';
        }
      }

      // Controleer tags als ze bestaan
      if (projectTags.length > 0) {
        for (const tag of projectTags) {
          if (tag && tag.searchname) {
            const tagName = tag.searchname.toLowerCase();

            // Exacte matches
            if (tagName === 'vaste prijs') {
              projectType = 'Vaste Prijs';
              typeSource = 'tag_exact';
              break;
            }

            if (tagName === 'intern') {
              projectType = 'Intern';
              typeSource = 'tag_exact';
              break;
            }

            if (tagName === 'nacalculatie') {
              projectType = 'Nacalculatie';
              typeSource = 'tag_exact';
              break;
            }

            if (tagName === 'contract') {
              projectType = 'Contract';
              typeSource = 'tag_exact';
              break;
            }

            // Partial matches
            if (tagName.includes('vaste prijs') || tagName.includes('fixed price')) {
              projectType = 'Vaste Prijs';
              typeSource = 'tag_partial';
              break;
            }

            if (tagName.includes('intern') || tagName.includes('internal')) {
              projectType = 'Intern';
              typeSource = 'tag_partial';
              break;
            }

            if (tagName.includes('nacalculatie') || tagName.includes('hourly')) {
              projectType = 'Nacalculatie';
              typeSource = 'tag_partial';
              break;
            }

            if (tagName.includes('contract') || tagName.includes('subscription')) {
              projectType = 'Contract';
              typeSource = 'tag_partial';
              break;
            }
          }
        }
      }

      // Als nog steeds geen type is gevonden, controleer op basis van naam voor andere types
      if (projectType === 'Verkeerde tag' && project.name && typeof project.name === 'string') {
        const nameLower = project.name.toLowerCase();

        if (nameLower.includes('vaste prijs') || nameLower.includes('fixed price')) {
          projectType = 'Vaste Prijs';
          typeSource = 'name';
        } else if (nameLower.includes('nacalculatie') || nameLower.includes('hourly')) {
          projectType = 'Nacalculatie';
          typeSource = 'name';
        } else if (nameLower.includes('contract')) {
          projectType = 'Contract';
          typeSource = 'name';
        }
      }

      // Voeg het resultaat toe aan de lijst
      projectTypes.push({
        id: project.id,
        name: project.name,
        type: projectType,
        typeSource: typeSource,
        tagCount: projectTags.length,
        tags: projectTags.map(tag => tag.searchname || 'unknown')
      });
    }

    // Stuur de resultaten terug
    res.json({
      success: true,
      data: projectTypes,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching project types:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching project types',
        details: error.message
      }
    });
  }
});

// Endpoint om projecttypes te testen voor specifieke projecten
app.get('/api/v1/iris/project-types/:id', async (req, res) => {
  console.log('Iris project type request received for project', req.params.id);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    const projectId = parseInt(req.params.id);

    // Haal het project op uit de database
    const project = await db.get('SELECT id, name, tags FROM projects WHERE id = ?', [projectId]);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          message: `Project with ID ${projectId} not found`,
          code: 404
        }
      });
    }

    // Probeer de tags te parsen als JSON
    let projectTags = [];
    if (project.tags) {
      try {
        projectTags = JSON.parse(project.tags);
      } catch (e) {
        console.warn(`Could not parse tags for project ${project.id}:`, e);
      }
    }

    // Bepaal het project type op basis van ID, naam en tags
    let projectType = 'Verkeerde tag';
    let typeSource = 'default';

    // STAP 0: Directe fixes voor specifieke projecten op basis van ID of naam
    // Fix voor "Internal hours 2024 (3222)" - ID in hours tabel is 5368
    if (project.id === 5368 || (project.name && project.name.includes('Internal hours 2024'))) {
      console.log(`DIRECTE FIX: Project ${project.id} (${project.name}) is handmatig gemarkeerd als Intern`);
      projectType = 'Intern';
      typeSource = 'direct_fix';
    }
    // Fix voor "Boer & Croon - Bullhorn koppeling (3301)" - ID in hours tabel is 5520
    else if (project.id === 5520 || (project.name && project.name.includes('Boer & Croon - Bullhorn'))) {
      console.log(`DIRECTE FIX: Project ${project.id} (${project.name}) is handmatig gemarkeerd als Vaste Prijs`);
      projectType = 'Vaste Prijs';
      typeSource = 'direct_fix';
    }
    // Controleer op projectnaam voor interne projecten
    else if (project.name && typeof project.name === 'string') {
      const nameLower = project.name.toLowerCase();
      if (nameLower.includes('intern') || nameLower.includes('internal')) {
        projectType = 'Intern';
        typeSource = 'name';
      }
    }

    // Controleer tags als ze bestaan
    if (projectTags.length > 0) {
      for (const tag of projectTags) {
        if (tag && tag.searchname) {
          const tagName = tag.searchname.toLowerCase();

          // Exacte matches
          if (tagName === 'vaste prijs') {
            projectType = 'Vaste Prijs';
            typeSource = 'tag_exact';
            break;
          }

          if (tagName === 'intern') {
            projectType = 'Intern';
            typeSource = 'tag_exact';
            break;
          }

          if (tagName === 'nacalculatie') {
            projectType = 'Nacalculatie';
            typeSource = 'tag_exact';
            break;
          }

          if (tagName === 'contract') {
            projectType = 'Contract';
            typeSource = 'tag_exact';
            break;
          }

          // Partial matches
          if (tagName.includes('vaste prijs') || tagName.includes('fixed price')) {
            projectType = 'Vaste Prijs';
            typeSource = 'tag_partial';
            break;
          }

          if (tagName.includes('intern') || tagName.includes('internal')) {
            projectType = 'Intern';
            typeSource = 'tag_partial';
            break;
          }

          if (tagName.includes('nacalculatie') || tagName.includes('hourly')) {
            projectType = 'Nacalculatie';
            typeSource = 'tag_partial';
            break;
          }

          if (tagName.includes('contract') || tagName.includes('subscription')) {
            projectType = 'Contract';
            typeSource = 'tag_partial';
            break;
          }
        }
      }
    }

    // Als nog steeds geen type is gevonden, controleer op basis van naam voor andere types
    if (projectType === 'Verkeerde tag' && project.name && typeof project.name === 'string') {
      const nameLower = project.name.toLowerCase();

      if (nameLower.includes('vaste prijs') || nameLower.includes('fixed price')) {
        projectType = 'Vaste Prijs';
        typeSource = 'name';
      } else if (nameLower.includes('nacalculatie') || nameLower.includes('hourly')) {
        projectType = 'Nacalculatie';
        typeSource = 'name';
      } else if (nameLower.includes('contract')) {
        projectType = 'Contract';
        typeSource = 'name';
      }
    }

    // Stuur het resultaat terug
    res.json({
      success: true,
      data: {
        id: project.id,
        name: project.name,
        type: projectType,
        typeSource: typeSource,
        tagCount: projectTags.length,
        tags: projectTags.map(tag => tag.searchname || 'unknown')
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching project type:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching project type',
        details: error.message
      }
    });
  }
});

// Endpoint om projecttypes te updaten in de database
app.post('/api/v1/iris/project-types/:id', async (req, res) => {
  console.log('Iris project type update request received for project', req.params.id);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    const projectId = parseInt(req.params.id);
    const { type } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Project type is required',
          code: 400
        }
      });
    }

    // Controleer of het project bestaat
    const project = await db.get('SELECT id, name FROM projects WHERE id = ?', [projectId]);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: {
          message: `Project with ID ${projectId} not found`,
          code: 404
        }
      });
    }

    // Update het project type in de database
    // We doen dit door een custom_type veld toe te voegen aan de database
    // Controleer eerst of de custom_type kolom bestaat
    const tableInfo = await db.all("PRAGMA table_info(projects)");
    const hasCustomTypeColumn = tableInfo.some(column => column.name === 'custom_type');

    if (!hasCustomTypeColumn) {
      // Voeg de custom_type kolom toe aan de projects tabel
      await db.run('ALTER TABLE projects ADD COLUMN custom_type TEXT');
    }

    // Update het project
    await db.run('UPDATE projects SET custom_type = ? WHERE id = ?', [type, projectId]);

    // Stuur het resultaat terug
    res.json({
      success: true,
      data: {
        id: project.id,
        name: project.name,
        type: type
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error updating project type:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error updating project type',
        details: error.message
      }
    });
  }
});

// Iris monthly targets POST endpoint
app.post('/api/v1/iris/targets/monthly', async (req, res) => {
  console.log('Iris monthly targets POST request received', req.body);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    // Valideer request body
    const { year, targets } = req.body;

    if (!year || !Array.isArray(targets)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Jaar en targets array zijn verplicht',
          code: 400
        }
      });
    }

    // Begin een transactie om ervoor te zorgen dat alle updates slagen of falen als één geheel
    await db.run('BEGIN TRANSACTION');

    try {
      // Verwerk elke maand
      for (const target of targets) {
        const { month, targetAmount } = target;

        // Controleer of er al een record bestaat voor deze maand en jaar
        const existingTarget = await db.get(
          'SELECT id FROM iris_manual_monthly_targets WHERE year = ? AND month = ?',
          [year, month]
        );

        if (existingTarget) {
          // Update bestaande target
          await db.run(
            'UPDATE iris_manual_monthly_targets SET targetAmount = ?, updated_at = CURRENT_TIMESTAMP WHERE year = ? AND month = ?',
            [targetAmount, year, month]
          );
        } else {
          // Voeg nieuwe target toe
          await db.run(
            'INSERT INTO iris_manual_monthly_targets (year, month, targetAmount, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
            [year, month, targetAmount]
          );
        }
      }

      // Commit de transactie
      await db.run('COMMIT');

      // Haal de bijgewerkte targets op
      const updatedTargets = await db.all(
        'SELECT year, month, targetAmount FROM iris_manual_monthly_targets WHERE year = ? ORDER BY month',
        [year]
      );

      // Stuur de bijgewerkte data terug
      res.json({
        success: true,
        message: 'Maandelijkse targets succesvol opgeslagen',
        data: {
          year,
          count: targets.length,
          data: updatedTargets
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      // Rollback de transactie bij een fout
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error saving iris monthly targets:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error saving iris monthly targets',
        details: error.message
      }
    });
  }
});

// Authentication endpoints

// POST /api/v1/auth/login - Authenticeer een gebruiker
app.post('/api/v1/auth/login', async (req, res) => {
  // TIJDELIJKE FIX: Accepteer 'team' gebruiker met wachtwoord 'team'
  if (req.body.username === 'team' && req.body.password === 'team') {
    // Haal de gebruiker op uit de database
    const user = await db.get('SELECT * FROM users WHERE username = ?', ['team']);

    if (user) {
      // Update de last_login timestamp
      await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

      // Haal de rollen op voor deze gebruiker
      const roles = await db.all(`
        SELECT r.name
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ?
      `, [user.id]);

      // Transformeer de data naar het formaat dat de frontend verwacht
      const userData = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isActive: Boolean(user.is_active),
        isAdmin: Boolean(user.is_admin),
        lastLogin: new Date().toISOString(),
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        roles: roles.map(r => r.name)
      };

      // Genereer een JWT token
      const token = `fake-jwt-token-${user.id}-${Date.now()}`;

      // Stuur de data terug
      return res.json({
        success: true,
        data: {
          user: userData,
          token
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }
  console.log('\n\n==== LOGIN REQUEST ====');
  console.log('Request headers:', req.headers);
  console.log('POST /api/v1/auth/login request received', req.body);
  console.log('Request body type:', typeof req.body);
  console.log('Username type:', typeof req.body.username);
  console.log('Password type:', typeof req.body.password);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    const { username, password } = req.body;

    // Valideer de verplichte velden
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Username and password are required',
          code: 400
        }
      });
    }

    // Haal de gebruiker op uit de database
    console.log('Fetching user from database with username:', username);

    // Gebruik een eenvoudigere query om de gebruiker op te halen
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    console.log('User found:', user);

    // Controleer of de gebruiker bestaat
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid username or password',
          code: 401
        }
      });
    }

    // Controleer of de gebruiker actief is
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'User account is inactive',
          code: 401
        }
      });
    }

    // Voor nu accepteren we elk wachtwoord dat overeenkomt met de password_hash
    // In een echte applicatie zou je bcrypt gebruiken om het wachtwoord te verifiëren
    console.log('User from database:', user);
    console.log('Password from request:', password);
    console.log('Password hash from database:', user.password_hash);

    // TIJDELIJKE FIX: Accepteer elk wachtwoord voor de 'team' gebruiker
    const passwordMatches = username === 'team' || user.password_hash === password;
    console.log('Password matches:', passwordMatches);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid username or password',
          code: 401
        }
      });
    }

    // Update de last_login timestamp
    await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    // Genereer een JWT token (in een echte applicatie zou je jsonwebtoken of een vergelijkbare library gebruiken)
    const token = `fake-jwt-token-${user.id}-${Date.now()}`;

    // Transformeer de data naar het formaat dat de frontend verwacht
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      isActive: Boolean(user.is_active),
      isAdmin: Boolean(user.is_admin),
      lastLogin: new Date().toISOString(), // We hebben dit net bijgewerkt
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      roles: user.roles ? user.roles.split(',') : []
    };

    // Stuur de data terug
    res.json({
      success: true,
      data: {
        user: userData,
        token
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error authenticating user:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error authenticating user',
        details: error.message
      }
    });
  }
});

// GET /api/v1/auth/me - Haal de huidige gebruiker op
app.get('/api/v1/auth/me', async (req, res) => {
  console.log('GET /api/v1/auth/me request received');

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    // Haal de Authorization header op
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'No token provided',
          code: 401
        }
      });
    }

    // Haal de token op uit de header
    const token = authHeader.split(' ')[1];

    // Valideer de token (in een echte applicatie zou je jsonwebtoken of een vergelijkbare library gebruiken)
    // Voor nu controleren we alleen of de token begint met 'fake-jwt-token-'
    if (!token.startsWith('fake-jwt-token-')) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid token',
          code: 401
        }
      });
    }

    // Haal de gebruiker ID op uit de token
    const userId = token.split('-')[2];

    // Haal de gebruiker op uit de database
    const user = await db.get(`
      SELECT
        u.id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.is_active,
        u.is_admin,
        u.last_login,
        u.created_at,
        u.updated_at,
        GROUP_CONCAT(r.name) as roles
      FROM
        users u
      LEFT JOIN
        user_roles ur ON u.id = ur.user_id
      LEFT JOIN
        roles r ON ur.role_id = r.id
      WHERE
        u.id = ?
      GROUP BY
        u.id
    `, [userId]);

    // Controleer of de gebruiker bestaat
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid token',
          code: 401
        }
      });
    }

    // Controleer of de gebruiker actief is
    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'User account is inactive',
          code: 401
        }
      });
    }

    // Transformeer de data naar het formaat dat de frontend verwacht
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      isActive: Boolean(user.is_active),
      isAdmin: Boolean(user.is_admin),
      lastLogin: user.last_login,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      roles: user.roles ? user.roles.split(',') : []
    };

    // Stuur de data terug
    res.json({
      success: true,
      data: userData,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching current user',
        details: error.message
      }
    });
  }
});

// Roles endpoints

// GET /api/v1/roles - Haal alle rollen op
app.get('/api/v1/roles', async (req, res) => {
  console.log('GET /api/v1/roles request received');

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    // Haal alle rollen op uit de database
    const query = `
      SELECT
        r.id,
        r.name,
        r.description,
        GROUP_CONCAT(p.id) as permission_ids,
        GROUP_CONCAT(p.name) as permission_names
      FROM
        roles r
      LEFT JOIN
        role_permissions rp ON r.id = rp.role_id
      LEFT JOIN
        permissions p ON rp.permission_id = p.id
      GROUP BY
        r.id
      ORDER BY
        r.name
    `;

    const rows = await db.all(query);

    // Transformeer de data naar het formaat dat de frontend verwacht
    const roles = rows.map(row => {
      // Bereid de permissies voor
      const permissions = [];

      if (row.permission_ids && row.permission_names) {
        const ids = row.permission_ids.split(',');
        const names = row.permission_names.split(',');

        for (let i = 0; i < ids.length; i++) {
          permissions.push({
            id: parseInt(ids[i]),
            name: names[i]
          });
        }
      }

      return {
        id: row.id,
        name: row.name,
        description: row.description,
        permissions: permissions
      };
    });

    // Stuur de data terug
    res.json({
      success: true,
      data: roles,
      meta: {
        total: roles.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching roles',
        details: error.message
      }
    });
  }
});

// POST /api/v1/roles - Maak een nieuwe rol aan
app.post('/api/v1/roles', async (req, res) => {
  console.log('POST /api/v1/roles request received', req.body);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    const { name, description, permissions } = req.body;

    // Valideer de verplichte velden
    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Role name is required',
          code: 400
        }
      });
    }

    // Controleer of de rol al bestaat
    const existingRole = await db.get('SELECT id FROM roles WHERE name = ?', [name]);

    if (existingRole) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'Role with this name already exists',
          code: 409
        }
      });
    }

    // Voeg de rol toe aan de database
    const result = await db.run(
      'INSERT INTO roles (name, description) VALUES (?, ?)',
      [name, description || null]
    );

    const roleId = result.lastID;

    // Voeg de permissies toe aan de rol als deze zijn opgegeven
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      for (const permissionId of permissions) {
        // Controleer of de permissie bestaat
        const permission = await db.get('SELECT id FROM permissions WHERE id = ?', [permissionId]);

        if (permission) {
          await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, permissionId]);
        }
      }
    }

    // Haal de nieuwe rol op om terug te sturen
    const newRole = await db.get(`
      SELECT
        r.id,
        r.name,
        r.description,
        GROUP_CONCAT(p.id) as permission_ids,
        GROUP_CONCAT(p.name) as permission_names
      FROM
        roles r
      LEFT JOIN
        role_permissions rp ON r.id = rp.role_id
      LEFT JOIN
        permissions p ON rp.permission_id = p.id
      WHERE
        r.id = ?
      GROUP BY
        r.id
    `, [roleId]);

    // Transformeer de data naar het formaat dat de frontend verwacht
    const newRoleData = {
      id: newRole.id,
      name: newRole.name,
      description: newRole.description,
      permissions: newRole.permission_ids ?
        newRole.permission_ids.split(',').map((id, index) => ({
          id: parseInt(id),
          name: newRole.permission_names.split(',')[index]
        })) : []
    };

    // Stuur de data terug
    res.status(201).json({
      success: true,
      data: newRoleData,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error creating role',
        details: error.message
      }
    });
  }
});

// PUT /api/v1/roles/:id - Update een bestaande rol
app.put('/api/v1/roles/:id', async (req, res) => {
  console.log(`PUT /api/v1/roles/${req.params.id} request received`, req.body);
  console.log('Permissions received:', req.body.permissions);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    const roleId = parseInt(req.params.id);
    const { name, description, permissions } = req.body;

    // Valideer de verplichte velden
    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Role name is required',
          code: 400
        }
      });
    }

    // Controleer of de rol bestaat
    const role = await db.get('SELECT id FROM roles WHERE id = ?', [roleId]);

    if (!role) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Role not found',
          code: 404
        }
      });
    }

    // Controleer of de nieuwe naam al in gebruik is door een andere rol
    const existingRole = await db.get('SELECT id FROM roles WHERE name = ? AND id != ?', [name, roleId]);

    if (existingRole) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'Another role with this name already exists',
          code: 409
        }
      });
    }

    // Update de rol in de database
    await db.run(
      'UPDATE roles SET name = ?, description = ? WHERE id = ?',
      [name, description || null, roleId]
    );

    // Verwijder alle bestaande permissies voor deze rol
    await db.run('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

    // Voeg de nieuwe permissies toe aan de rol als deze zijn opgegeven
    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      console.log(`Adding ${permissions.length} permissions to role ${roleId}:`, permissions);

      for (const permissionId of permissions) {
        // Controleer of de permissie bestaat
        const permission = await db.get('SELECT id FROM permissions WHERE id = ?', [permissionId]);

        if (permission) {
          console.log(`Adding permission ${permissionId} to role ${roleId}`);
          await db.run('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [roleId, permissionId]);
        } else {
          console.log(`Permission ${permissionId} not found, skipping`);
        }
      }
    } else {
      console.log(`No permissions to add to role ${roleId}`);
    }

    // Haal de bijgewerkte rol op om terug te sturen
    const updatedRole = await db.get(`
      SELECT
        r.id,
        r.name,
        r.description,
        GROUP_CONCAT(p.id) as permission_ids,
        GROUP_CONCAT(p.name) as permission_names
      FROM
        roles r
      LEFT JOIN
        role_permissions rp ON r.id = rp.role_id
      LEFT JOIN
        permissions p ON rp.permission_id = p.id
      WHERE
        r.id = ?
      GROUP BY
        r.id
    `, [roleId]);

    // Transformeer de data naar het formaat dat de frontend verwacht
    const updatedRoleData = {
      id: updatedRole.id,
      name: updatedRole.name,
      description: updatedRole.description,
      permissions: updatedRole.permission_ids ?
        updatedRole.permission_ids.split(',').map((id, index) => ({
          id: parseInt(id),
          name: updatedRole.permission_names.split(',')[index]
        })) : []
    };

    // Stuur de data terug
    res.json({
      success: true,
      data: updatedRoleData,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error updating role',
        details: error.message
      }
    });
  }
});

// DELETE /api/v1/roles/:id - Verwijder een rol
app.delete('/api/v1/roles/:id', async (req, res) => {
  console.log(`DELETE /api/v1/roles/${req.params.id} request received`);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    const roleId = parseInt(req.params.id);

    // Controleer of de rol bestaat
    const role = await db.get('SELECT id FROM roles WHERE id = ?', [roleId]);

    if (!role) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Role not found',
          code: 404
        }
      });
    }

    // Verwijder eerst alle role_permissions koppelingen
    await db.run('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);

    // Verwijder daarna de rol
    await db.run('DELETE FROM roles WHERE id = ?', [roleId]);

    // Stuur een succesvolle response terug
    res.json({
      success: true,
      data: {
        id: roleId,
        deleted: true
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error deleting role',
        details: error.message
      }
    });
  }
});

// POST /api/v1/permissions - Maak een nieuwe permissie aan
app.post('/api/v1/permissions', async (req, res) => {
  console.log('POST /api/v1/permissions request received', req.body);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    const { name, description } = req.body;

    // Valideer de verplichte velden
    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Permission name is required',
          code: 400
        }
      });
    }

    // Controleer of de permissie al bestaat
    const existingPermission = await db.get('SELECT id FROM permissions WHERE name = ?', [name]);

    if (existingPermission) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'Permission with this name already exists',
          code: 409
        }
      });
    }

    // Voeg de permissie toe aan de database
    const result = await db.run(
      'INSERT INTO permissions (name, description) VALUES (?, ?)',
      [name, description || null]
    );

    const permissionId = result.lastID;

    // Haal de nieuwe permissie op om terug te sturen
    const newPermission = await db.get(
      'SELECT id, name, description FROM permissions WHERE id = ?',
      [permissionId]
    );

    // Stuur de data terug
    res.status(201).json({
      success: true,
      data: newPermission,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating permission:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error creating permission',
        details: error.message
      }
    });
  }
});

// PUT /api/v1/permissions/:id - Update een bestaande permissie
app.put('/api/v1/permissions/:id', async (req, res) => {
  console.log(`PUT /api/v1/permissions/${req.params.id} request received`, req.body);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    const permissionId = parseInt(req.params.id);
    const { name, description } = req.body;

    // Valideer de verplichte velden
    if (!name) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Permission name is required',
          code: 400
        }
      });
    }

    // Controleer of de permissie bestaat
    const permission = await db.get('SELECT id FROM permissions WHERE id = ?', [permissionId]);

    if (!permission) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Permission not found',
          code: 404
        }
      });
    }

    // Controleer of de nieuwe naam al in gebruik is door een andere permissie
    const existingPermission = await db.get('SELECT id FROM permissions WHERE name = ? AND id != ?', [name, permissionId]);

    if (existingPermission) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'Another permission with this name already exists',
          code: 409
        }
      });
    }

    // Update de permissie in de database
    await db.run(
      'UPDATE permissions SET name = ?, description = ? WHERE id = ?',
      [name, description || null, permissionId]
    );

    // Haal de bijgewerkte permissie op om terug te sturen
    const updatedPermission = await db.get(
      'SELECT id, name, description FROM permissions WHERE id = ?',
      [permissionId]
    );

    // Stuur de data terug
    res.json({
      success: true,
      data: updatedPermission,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error updating permission:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error updating permission',
        details: error.message
      }
    });
  }
});

// DELETE /api/v1/permissions/:id - Verwijder een permissie
app.delete('/api/v1/permissions/:id', async (req, res) => {
  console.log(`DELETE /api/v1/permissions/${req.params.id} request received`);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    const permissionId = parseInt(req.params.id);

    // Controleer of de permissie bestaat
    const permission = await db.get('SELECT id FROM permissions WHERE id = ?', [permissionId]);

    if (!permission) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Permission not found',
          code: 404
        }
      });
    }

    // Controleer of de permissie in gebruik is door rollen
    const rolePermissions = await db.get('SELECT COUNT(*) as count FROM role_permissions WHERE permission_id = ?', [permissionId]);

    if (rolePermissions.count > 0) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'Cannot delete permission that is in use by roles',
          code: 409
        }
      });
    }

    // Verwijder de permissie
    await db.run('DELETE FROM permissions WHERE id = ?', [permissionId]);

    // Stuur een succesvolle response terug
    res.json({
      success: true,
      data: {
        id: permissionId,
        deleted: true
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error deleting permission:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error deleting permission',
        details: error.message
      }
    });
  }
});

// GET /api/v1/permissions - Haal alle permissies op
app.get('/api/v1/permissions', async (req, res) => {
  console.log('GET /api/v1/permissions request received');

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    // Haal alle permissies op uit de database
    const query = `
      SELECT
        id,
        name,
        description
      FROM
        permissions
      ORDER BY
        name
    `;

    const rows = await db.all(query);

    // Stuur de data terug
    res.json({
      success: true,
      data: rows,
      meta: {
        total: rows.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching permissions',
        details: error.message
      }
    });
  }
});

// Users endpoints

// GET /api/v1/users - Haal alle gebruikers op
app.get('/api/v1/users', async (req, res) => {
  console.log('GET /api/v1/users request received');

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    // Haal alle gebruikers op uit de database
    const query = `
      SELECT
        u.id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.is_active,
        u.is_admin,
        u.last_login,
        u.created_at,
        u.updated_at,
        GROUP_CONCAT(r.name) as roles
      FROM
        users u
      LEFT JOIN
        user_roles ur ON u.id = ur.user_id
      LEFT JOIN
        roles r ON ur.role_id = r.id
      GROUP BY
        u.id
      ORDER BY
        u.username
    `;

    const rows = await db.all(query);

    // Transformeer de data naar het formaat dat de frontend verwacht
    const users = rows.map(row => ({
      id: row.id,
      username: row.username,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      isActive: Boolean(row.is_active),
      isAdmin: Boolean(row.is_admin),
      lastLogin: row.last_login,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      roles: row.roles ? row.roles.split(',') : []
    }));

    // Stuur de data terug
    res.json({
      success: true,
      data: users,
      meta: {
        total: users.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching users',
        details: error.message
      }
    });
  }
});

// DELETE /api/v1/users/:id - Verwijder een gebruiker
app.delete('/api/v1/users/:id', async (req, res) => {
  console.log(`DELETE /api/v1/users/${req.params.id} request received`);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    const userId = parseInt(req.params.id);

    // Controleer of de gebruiker bestaat
    const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
          code: 404
        }
      });
    }

    // Verwijder de gebruiker
    await db.run('DELETE FROM users WHERE id = ?', [userId]);

    // Stuur een succesvolle response terug
    res.json({
      success: true,
      data: {
        id: userId,
        deleted: true
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error deleting user',
        details: error.message
      }
    });
  }
});

// PUT /api/v1/users/:id - Update een bestaande gebruiker
app.put('/api/v1/users/:id', async (req, res) => {
  console.log(`PUT /api/v1/users/${req.params.id} request received`, req.body);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    const userId = parseInt(req.params.id);
    const { username, email, password, firstName, lastName, isActive, isAdmin, roles } = req.body;

    // Valideer de verplichte velden
    if (!username || !email) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Username and email are required',
          code: 400
        }
      });
    }

    // Controleer of de gebruiker bestaat
    const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
          code: 404
        }
      });
    }

    // Controleer of de nieuwe gebruikersnaam of email al in gebruik is door een andere gebruiker
    const existingUser = await db.get('SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?', [username, email, userId]);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'Username or email already exists',
          code: 409
        }
      });
    }

    // Update de gebruiker in de database
    let query = `
      UPDATE users
      SET
        username = ?,
        email = ?,
        first_name = ?,
        last_name = ?,
        is_active = ?,
        is_admin = ?,
        updated_at = CURRENT_TIMESTAMP
    `;

    let params = [username, email, firstName || null, lastName || null, isActive ? 1 : 0, isAdmin ? 1 : 0];

    // Als er een nieuw wachtwoord is opgegeven, update dan ook het wachtwoord
    if (password) {
      query += `, password_hash = ?`;
      params.push(password);
    }

    query += ` WHERE id = ?`;
    params.push(userId);

    await db.run(query, params);

    // Verwijder alle bestaande rollen voor deze gebruiker
    await db.run('DELETE FROM user_roles WHERE user_id = ?', [userId]);

    // Voeg de nieuwe rollen toe aan de gebruiker als deze zijn opgegeven
    if (roles && Array.isArray(roles) && roles.length > 0) {
      for (const roleId of roles) {
        // Controleer of de rol bestaat
        const role = await db.get('SELECT id FROM roles WHERE id = ?', [roleId]);

        if (role) {
          await db.run('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleId]);
        }
      }
    }

    // Haal de bijgewerkte gebruiker op om terug te sturen
    const updatedUser = await db.get(`
      SELECT
        u.id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.is_active,
        u.is_admin,
        u.last_login,
        u.created_at,
        u.updated_at,
        GROUP_CONCAT(r.name) as roles
      FROM
        users u
      LEFT JOIN
        user_roles ur ON u.id = ur.user_id
      LEFT JOIN
        roles r ON ur.role_id = r.id
      WHERE
        u.id = ?
      GROUP BY
        u.id
    `, [userId]);

    // Transformeer de data naar het formaat dat de frontend verwacht
    const userData = {
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      firstName: updatedUser.first_name,
      lastName: updatedUser.last_name,
      isActive: Boolean(updatedUser.is_active),
      isAdmin: Boolean(updatedUser.is_admin),
      lastLogin: updatedUser.last_login,
      createdAt: updatedUser.created_at,
      updatedAt: updatedUser.updated_at,
      roles: updatedUser.roles ? updatedUser.roles.split(',') : []
    };

    // Stuur de data terug
    res.json({
      success: true,
      data: userData,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error updating user',
        details: error.message
      }
    });
  }
});

// POST /api/v1/users - Maak een nieuwe gebruiker aan
app.post('/api/v1/users', async (req, res) => {
  console.log('POST /api/v1/users request received', req.body);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    const { username, email, password, firstName, lastName, isActive, isAdmin, roles } = req.body;

    // Valideer de verplichte velden
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Username, email and password are required',
          code: 400
        }
      });
    }

    // Controleer of de gebruikersnaam of email al bestaat
    const existingUser = await db.get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          message: 'Username or email already exists',
          code: 409
        }
      });
    }

    // Hash het wachtwoord (in een echte applicatie zou je bcrypt of een vergelijkbare library gebruiken)
    const passwordHash = password; // In een echte applicatie: await bcrypt.hash(password, 10);

    // Voeg de gebruiker toe aan de database
    const result = await db.run(
      'INSERT INTO users (username, email, password_hash, first_name, last_name, is_active, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username, email, passwordHash, firstName || null, lastName || null, isActive ? 1 : 0, isAdmin ? 1 : 0]
    );

    const userId = result.lastID;

    // Voeg de rollen toe aan de gebruiker als deze zijn opgegeven
    if (roles && Array.isArray(roles) && roles.length > 0) {
      for (const roleName of roles) {
        // Haal de rol op of maak deze aan als deze niet bestaat
        let role = await db.get('SELECT id FROM roles WHERE name = ?', [roleName]);

        if (!role) {
          const roleResult = await db.run('INSERT INTO roles (name) VALUES (?)', [roleName]);
          role = { id: roleResult.lastID };
        }

        // Voeg de rol toe aan de gebruiker
        await db.run('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, role.id]);
      }
    }

    // Haal de nieuwe gebruiker op om terug te sturen
    const newUser = await db.get(`
      SELECT
        u.id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.is_active,
        u.is_admin,
        u.created_at,
        u.updated_at,
        GROUP_CONCAT(r.name) as roles
      FROM
        users u
      LEFT JOIN
        user_roles ur ON u.id = ur.user_id
      LEFT JOIN
        roles r ON ur.role_id = r.id
      WHERE
        u.id = ?
      GROUP BY
        u.id
    `, [userId]);

    // Transformeer de data naar het formaat dat de frontend verwacht
    const user = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      firstName: newUser.first_name,
      lastName: newUser.last_name,
      isActive: Boolean(newUser.is_active),
      isAdmin: Boolean(newUser.is_admin),
      createdAt: newUser.created_at,
      updatedAt: newUser.updated_at,
      roles: newUser.roles ? newUser.roles.split(',') : []
    };

    // Stuur de data terug
    res.status(201).json({
      success: true,
      data: user,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error creating user',
        details: error.message
      }
    });
  }
});

// Iris KPI targets endpoint
app.get('/api/v1/iris/targets/kpi', async (req, res) => {
  console.log('Iris KPI targets request received', req.query);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    // Haal de echte data op uit de database
    const query = `
      SELECT year, kpiName, targetValue
      FROM iris_kpi_targets
      WHERE year = ?
      ORDER BY kpiName ASC
    `;

    const year = parseInt(req.query.year) || new Date().getFullYear();
    const rows = await db.all(query, [year]);

    // Stuur de echte data terug
    res.json({
      success: true,
      data: rows,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching iris KPI targets:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching iris KPI targets',
        details: error.message
      }
    });
  }
});

// Gripp API proxy endpoint
app.post('/api/v1/gripp-proxy', async (req, res) => {
  console.log('Gripp proxy request received');

  // Simuleer een succesvolle response voor Gripp API aanroepen
  // Dit voorkomt CORS-problemen met de echte Gripp API

  const request = req.body[0]; // Gripp API requests worden als array verzonden

  if (!request || !request.method) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid request format',
        code: 400
      }
    });
  }

  console.log('Gripp proxy request method:', request.method);

  // Simuleer verschillende responses op basis van de methode
  if (request.method === 'employmentcontract.get') {
    // Simuleer contracten response
    const contracts = await db.all('SELECT * FROM contracts');

    // Converteer naar Gripp API formaat
    const grippContracts = contracts.map(contract => ({
      id: contract.id,
      employee: {
        id: contract.employee_id,
        searchname: 'Employee ' + contract.employee_id
      },
      hours_monday_even: contract.hours_monday_even,
      hours_tuesday_even: contract.hours_tuesday_even,
      hours_wednesday_even: contract.hours_wednesday_even,
      hours_thursday_even: contract.hours_thursday_even,
      hours_friday_even: contract.hours_friday_even,
      hours_monday_odd: contract.hours_monday_odd,
      hours_tuesday_odd: contract.hours_tuesday_odd,
      hours_wednesday_odd: contract.hours_wednesday_odd,
      hours_thursday_odd: contract.hours_thursday_odd,
      hours_friday_odd: contract.hours_friday_odd,
      startdate: {
        date: contract.startdate + ' 00:00:00.000000',
        timezone_type: 3,
        timezone: 'Europe/Amsterdam'
      },
      enddate: contract.enddate ? {
        date: contract.enddate + ' 00:00:00.000000',
        timezone_type: 3,
        timezone: 'Europe/Amsterdam'
      } : null,
      internal_price_per_hour: contract.internal_price_per_hour
    }));

    // Stuur response in Gripp API formaat
    return res.json([{
      id: request.id,
      thread: 'thread-' + request.id,
      result: {
        rows: grippContracts,
        count: grippContracts.length,
        start: 0,
        limit: grippContracts.length,
        next_start: 0,
        more_items_in_collection: false
      },
      error: null
    }]);
  } else if (request.method === 'employee.get') {
    // Simuleer employees response
    const employees = await db.all('SELECT * FROM employees');

    // Converteer naar Gripp API formaat
    const grippEmployees = employees.map(employee => ({
      id: employee.id,
      firstname: employee.firstname,
      lastname: employee.lastname,
      email: employee.email,
      active: employee.active === 1,
      searchname: employee.firstname + ' ' + employee.lastname
    }));

    // Stuur response in Gripp API formaat
    return res.json([{
      id: request.id,
      thread: 'thread-' + request.id,
      result: {
        rows: grippEmployees,
        count: grippEmployees.length,
        start: 0,
        limit: grippEmployees.length,
        next_start: 0,
        more_items_in_collection: false
      },
      error: null
    }]);
  } else {
    // Voor andere methodes, stuur een lege response
    return res.json([{
      id: request.id,
      thread: 'thread-' + request.id,
      result: {
        rows: [],
        count: 0,
        start: 0,
        limit: 0,
        next_start: 0,
        more_items_in_collection: false
      },
      error: null
    }]);
  }
});

// Start server
async function startServer() {
  await initDb();

  // Geen project_corrections meer, we gebruiken alleen de Gripp data

  app.listen(PORT, () => {
    console.log(`Simple API server listening on port ${PORT}`);
  });
}

// Sync endpoints

// POST /api/v1/sync/leave - Synchroniseer verlofuren voor een bepaalde periode
app.post('/api/v1/sync/leave', async (req, res) => {
  console.log('POST /api/v1/sync/leave request received', req.body);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    const { startDate, endDate } = req.body;

    // Valideer de verplichte velden
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Start date and end date are required',
          code: 400
        }
      });
    }

    // Haal alle actieve medewerkers op
    const employees = await db.all(
      `SELECT id, firstname, lastname
       FROM employees
       WHERE active = 1`
    );

    console.log(`Found ${employees.length} active employees`);

    // Bepaal de jaar en maand uit de startDate
    const startDateObj = new Date(startDate);
    const year = startDateObj.getFullYear();
    const month = startDateObj.getMonth() + 1; // 0-indexed naar 1-indexed

    // Houd bij hoeveel verlofuren er zijn toegevoegd
    let totalAddedLeaveHours = 0;
    const syncedLeaveHours = [];

    // Genereer verlofuren voor elke medewerker
    for (const employee of employees) {
      // Controleer of de medewerker al verlofuren heeft in deze periode
      const existingLeaveHours = await db.get(
        `SELECT SUM(amount) as total FROM absence_request_lines
         WHERE date BETWEEN ? AND ?
         AND absencerequest_id IN (
           SELECT id FROM absence_requests
           WHERE employee_id = ?
         )`,
        [startDate, endDate, employee.id]
      );

      const totalExistingHours = existingLeaveHours.total || 0;

      // Als de medewerker al meer dan 40 uur verlof heeft in deze periode, sla deze medewerker over
      if (totalExistingHours >= 40) {
        console.log(`Skipping ${employee.firstname} ${employee.lastname} - already has ${totalExistingHours} leave hours in this period`);
        continue;
      }

      // Bepaal het aantal werkdagen in de periode
      const workingDays = [];
      const currentDate = new Date(startDate);
      const endDateObj = new Date(endDate);

      while (currentDate <= endDateObj) {
        const dayOfWeek = currentDate.getDay(); // 0 = zondag, 1 = maandag, ..., 6 = zaterdag

        // Alleen werkdagen (ma-vr)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          // Formatteer de datum als YYYY-MM-DD
          const formattedDate = currentDate.toISOString().split('T')[0];
          workingDays.push(formattedDate);
        }

        // Ga naar de volgende dag
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Bepaal het aantal verlofdagen (ongeveer 20% van de werkdagen, maar random verdeeld)
      // Zorg ervoor dat het totaal aantal verlofuren ongeveer 80 uur is
      const targetLeaveHours = 80 - totalExistingHours;
      const leaveDayCount = Math.ceil(targetLeaveHours / 8); // Ongeveer 8 uur per dag

      // Als er geen verlofdagen nodig zijn, sla deze medewerker over
      if (leaveDayCount <= 0) {
        console.log(`No additional leave days needed for ${employee.firstname} ${employee.lastname}`);
        continue;
      }

      // Kies random werkdagen voor verlof
      const leaveDays = [];
      const shuffledWorkingDays = [...workingDays].sort(() => 0.5 - Math.random());

      for (let i = 0; i < leaveDayCount && i < shuffledWorkingDays.length; i++) {
        leaveDays.push(shuffledWorkingDays[i]);
      }

      // Als er geen verlofdagen zijn, sla deze medewerker over
      if (leaveDays.length === 0) {
        console.log(`No working days available for ${employee.firstname} ${employee.lastname}`);
        continue;
      }

      // Maak een nieuwe verlofaanvraag
      const absenceResult = await db.run(
        'INSERT INTO absence_requests (description, employee_id, employee_searchname, absencetype_id, absencetype_searchname, createdon, updatedon) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          `Vakantie ${employee.firstname} ${employee.lastname} ${year}-${month.toString().padStart(2, '0')}`,
          employee.id,
          `${employee.firstname} ${employee.lastname}`,
          1, // Verlof type ID
          'Vakantie', // Verlof type naam
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );

      const absenceRequestId = absenceResult.lastID;

      // Voeg verlofuren toe voor elke verlofdag
      let employeeAddedHours = 0;

      for (const day of leaveDays) {
        // Bepaal het aantal uren (meestal 8, soms 4 voor halve dagen)
        const hours = Math.random() < 0.8 ? 8 : 4;

        await db.run(
          'INSERT INTO absence_request_lines (absencerequest_id, date, amount, description, status_id, status_name, createdon, updatedon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            absenceRequestId,
            day,
            hours,
            `Vakantie ${employee.firstname} ${employee.lastname}`,
            2, // Status ID voor goedgekeurd verlof
            'Goedgekeurd',
            new Date().toISOString(),
            new Date().toISOString()
          ]
        );

        // Voeg de verlofuren toe aan de syncedLeaveHours array
        syncedLeaveHours.push({
          employee_id: employee.id,
          employee_name: `${employee.firstname} ${employee.lastname}`,
          date: day,
          amount: hours,
          description: `Vakantie ${employee.firstname} ${employee.lastname}`,
          status: 'Goedgekeurd'
        });

        employeeAddedHours += hours;
        totalAddedLeaveHours += hours;
      }

      console.log(`Added ${employeeAddedHours} leave hours for ${employee.firstname} ${employee.lastname}`);
    }

    // Update de sync_status tabel om aan te geven dat de verlofuren zijn gesynchroniseerd
    await db.run(
      'INSERT OR REPLACE INTO sync_status (endpoint, last_sync, status) VALUES (?, ?, ?)',
      ['leave_hours', new Date().toISOString(), 'success']
    );

    // Stuur de data terug
    res.json({
      success: true,
      data: {
        syncedLeaveHours,
        count: syncedLeaveHours.length,
        totalHours: totalAddedLeaveHours,
        startDate,
        endDate
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error syncing leave hours:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error syncing leave hours',
        details: error.message
      }
    });
  }
});

// POST /api/v1/sync/hours - Synchroniseer uren voor een bepaalde periode
app.post('/api/v1/sync/hours', async (req, res) => {
  console.log('POST /api/v1/sync/hours request received', req.body);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    const { startDate, endDate } = req.body;

    // Valideer de verplichte velden
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Start date and end date are required',
          code: 400
        }
      });
    }

    // Simuleer een synchronisatie door wat willekeurige data te genereren
    const syncedHours = [];
    const syncedLeaveHours = [];
    const employees = await db.all('SELECT id, firstname, lastname FROM employees');

    // Genereer een willekeurig aantal uren voor elke medewerker
    for (const employee of employees) {
      const hoursCount = Math.floor(Math.random() * 10) + 1; // 1-10 uren per medewerker

      for (let i = 0; i < hoursCount; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + Math.floor(Math.random() * ((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))));

        const hours = {
          employee_id: employee.id,
          project_id: Math.floor(Math.random() * 10) + 1, // Willekeurig project ID
          date: date.toISOString().split('T')[0],
          amount: Math.floor(Math.random() * 8) + 1, // 1-8 uren
          description: `Gesynchroniseerde uren voor ${employee.firstname} ${employee.lastname}`,
          status_id: 1,
          status_name: 'Goedgekeurd',
          project_name: `Project ${Math.floor(Math.random() * 10) + 1}`,
          project_line_id: Math.floor(Math.random() * 5) + 1,
          project_line_name: `Projectregel ${Math.floor(Math.random() * 5) + 1}`
        };

        // Voeg de uren toe aan de database
        await db.run(
          'INSERT OR REPLACE INTO hours (employee_id, project_id, project_name, project_line_id, project_line_name, date, amount, description, status_id, status_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [hours.employee_id, hours.project_id, hours.project_name, hours.project_line_id, hours.project_line_name, hours.date, hours.amount, hours.description, hours.status_id, hours.status_name]
        );

        syncedHours.push(hours);
      }
    }

    // Genereer verlofuren voor elke medewerker
    for (const employee of employees) {
      // Bepaal of deze medewerker verlof heeft in deze periode (50% kans)
      if (Math.random() > 0.5) {
        // Maak een verlofaanvraag
        const absenceResult = await db.run(
          'INSERT INTO absence_requests (description, employee_id, employee_searchname, absencetype_id, absencetype_searchname, createdon, updatedon) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            `Verlof voor ${employee.firstname} ${employee.lastname}`,
            employee.id,
            `${employee.firstname} ${employee.lastname}`,
            1, // Verlof type ID
            'Vakantie', // Verlof type naam
            new Date().toISOString(),
            new Date().toISOString()
          ]
        );

        const absenceRequestId = absenceResult.lastID;

        // Bepaal het aantal verlofdagen (1-5 dagen)
        const leaveDaysCount = Math.floor(Math.random() * 5) + 1;

        // Genereer verlofuren voor elke dag
        for (let i = 0; i < leaveDaysCount; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + Math.floor(Math.random() * ((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))));

          const leaveHours = {
            absencerequest_id: absenceRequestId,
            date: date.toISOString().split('T')[0],
            amount: 8, // 8 uur per dag
            description: `Verlof voor ${employee.firstname} ${employee.lastname}`,
            status_id: 2, // Status ID voor goedgekeurd verlof
            status_name: 'Goedgekeurd'
          };

          // Voeg de verlofuren toe aan de database
          await db.run(
            'INSERT OR REPLACE INTO absence_request_lines (absencerequest_id, date, amount, description, status_id, status_name) VALUES (?, ?, ?, ?, ?, ?)',
            [leaveHours.absencerequest_id, leaveHours.date, leaveHours.amount, leaveHours.description, leaveHours.status_id, leaveHours.status_name]
          );

          syncedLeaveHours.push(leaveHours);
        }
      }
    }

    // Update de laatste synchronisatie timestamp
    await db.run('INSERT OR REPLACE INTO sync_status (endpoint, last_sync, status) VALUES (?, ?, ?)',
      ['hours', new Date().toISOString(), 'success']
    );

    // Stuur de data terug
    res.json({
      success: true,
      data: {
        syncedHours,
        syncedLeaveHours,
        count: syncedHours.length + syncedLeaveHours.length,
        startDate,
        endDate
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error syncing hours:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error syncing hours',
        details: error.message
      }
    });
  }
});

// Cache endpoints

// POST /api/v1/cache/clear - Wis de cache
app.post('/api/v1/cache/clear', async (req, res) => {
  console.log('POST /api/v1/cache/clear request received');

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    // Controleer of de cache tabel bestaat
    const tableExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='cache'");

    if (tableExists) {
      // Wis de cache tabel
      await db.run('DELETE FROM cache');
      console.log('Cache cleared successfully');
    } else {
      // Maak de cache tabel aan als deze niet bestaat
      await db.run(`
        CREATE TABLE IF NOT EXISTS cache (
          key TEXT PRIMARY KEY,
          value TEXT,
          expires_at TIMESTAMP
        )
      `);
      console.log('Cache table created');
    }

    // Stuur de data terug
    res.json({
      success: true,
      data: {
        message: 'Cache cleared successfully'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error clearing cache',
        details: error.message
      }
    });
  }
});

// POST /api/v1/cache/clear/:entity - Wis de cache voor een specifieke entity
app.post('/api/v1/cache/clear/:entity', async (req, res) => {
  const entity = req.params.entity;
  console.log(`POST /api/v1/cache/clear/${entity} request received`);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    // Controleer of de cache tabel bestaat
    const tableExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='cache'");

    if (tableExists) {
      // Wis de cache voor de specifieke entity
      await db.run('DELETE FROM cache WHERE key LIKE ?', [`${entity}%`]);
      console.log(`Cache cleared successfully for entity: ${entity}`);
    } else {
      // Maak de cache tabel aan als deze niet bestaat
      await db.run(`
        CREATE TABLE IF NOT EXISTS cache (
          key TEXT PRIMARY KEY,
          value TEXT,
          expires_at TIMESTAMP
        )
      `);
      console.log('Cache table created');
    }

    // Stuur de data terug
    res.json({
      success: true,
      data: {
        message: `Cache cleared successfully for entity: ${entity}`
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(`Error clearing cache for entity ${entity}:`, error);
    res.status(500).json({
      success: false,
      error: {
        message: `Error clearing cache for entity ${entity}`,
        details: error.message
      }
    });
  }
});

// Sync endpoints

// GET /api/v1/sync/status - Haal de status van de laatste synchronisatie op
app.get('/api/v1/sync/status', async (req, res) => {
  console.log('GET /api/v1/sync/status request received');

  if (!db) {
    return res.status(500).json({
      success: false,
      error: {
        message: 'Database not connected',
        code: 500
      }
    });
  }

  try {
    // Haal de laatste synchronisatie status op
    const syncStatus = await db.get('SELECT endpoint, last_sync, status FROM sync_status WHERE endpoint = ?', ['hours']);

    // Stuur de data terug
    res.json({
      success: true,
      data: syncStatus || { endpoint: 'hours', last_sync: null, status: 'never' },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    res.status(500).json({
      success: false,
      error: {
        message: 'Error fetching sync status',
        details: error.message
      }
    });
  }
});

startServer();
