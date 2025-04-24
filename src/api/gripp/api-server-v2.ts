/**
 * Gripp API Server V2
 *
 * This server provides a REST API for accessing Gripp data, including:
 * - Employees, contracts, and hours
 * - Projects and invoices
 * - Absence requests and holidays
 *
 * It includes caching, rate limiting, and error handling.
 */

// Express and middleware
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Database
import { getDatabase } from '../../db/database';
import { Database as SqliteDatabase } from 'sqlite';

// Utilities
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// API routes
import apiRoutes from '../routes';

// Middleware
import { errorHandler, notFoundHandler } from '../middleware/error-handler';
import { requireDatabase } from '../middleware/database';

// Configuration
import { API_PORT, killProcessOnPort } from '../../config/ports';

// Services
import { projectService } from './services/project';
import { optimizedProjectService } from './services/optimized-project';
import { hourService } from './services/hour';
import { invoiceService } from './services/invoice';
import { cacheService } from './cache-service';

// Define __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load environment variables from .env file
 * This includes API keys and other configuration
 */
dotenv.config();
console.log('Dotenv loaded successfully');

/**
 * Helper function to generate a consistent hash code from a string
 * This is used to create consistent IDs from string values
 *
 * Extends the String prototype with a hashCode method
 */
if (!String.prototype.hashCode) {
  String.prototype.hashCode = function() {
    let hash = 0;

    // Java-style string hash algorithm
    for (let i = 0; i < this.length; i++) {
      const char = this.charCodeAt(i);
      hash = ((hash << 5) - hash) + char; // hash * 31 + char
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash); // Return positive value
  };
}

/**
 * Create Express application
 * This is the main API server for the application
 */
const app: Express = express();
const port = API_PORT; // Use port from central config

// Log API key (partial, for security)
console.log(`Using API key: ${process.env.GRIPP_API_KEY?.substring(0, 20)}...`);

/**
 * Standard rate limiter for most API endpoints
 *
 * Limits:
 * - 500 requests per 15 minutes
 * - Returns 429 status with retry information when exceeded
 */
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased from 100 to 500 requests per windowMs
  message: 'Too many requests, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, next, options) => {
    // Log rate limit exceeded events
    console.warn(`Rate limit exceeded for ${req.ip} on ${req.path} (standard limiter)`);

    // Return structured response with retry information
    res.status(options.statusCode).json({
      status: 429,
      message: options.message,
      retryAfter: Math.ceil(options.windowMs / 1000) // Seconds until reset
    });
  }
});

/**
 * Dashboard-specific rate limiter
 *
 * More generous limits for dashboard endpoints which need frequent refreshes:
 * - 300 requests per 5 minutes
 * - Returns 429 status with retry information when exceeded
 */
const dashboardLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 300, // Higher limit for dashboard endpoints
  message: 'Too many dashboard requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    // Log rate limit exceeded events
    console.warn(`Rate limit exceeded for ${req.ip} on ${req.path} (dashboard limiter)`);

    // Return structured response with retry information
    res.status(options.statusCode).json({
      status: 429,
      message: options.message,
      retryAfter: Math.ceil(options.windowMs / 1000) // Seconds until reset
    });
  }
});

/**
 * Track API endpoint usage
 * Maps endpoint paths to hit counts for monitoring
 */
const endpointHits = new Map<string, number>();

/**
 * API usage monitoring middleware
 *
 * Tracks endpoint usage and logs warnings for high traffic endpoints.
 * This helps identify potential performance bottlenecks or abuse.
 */
const apiMonitor = (req: Request, res: Response, next: NextFunction) => {
  const endpoint = req.path;

  // Get current hit count or default to 0
  const currentHits = endpointHits.get(endpoint) || 0;

  // Increment hit count
  endpointHits.set(endpoint, currentHits + 1);

  // Log warning if endpoint has high traffic
  if (currentHits > 1000) {
    console.warn(`High traffic detected on endpoint: ${endpoint} - ${currentHits} hits`);
  }

  next();
};

/**
 * Database connection reference
 * Initialized during server startup
 */
let db: SqliteDatabase | null = null;

/**
 * Server start timestamp
 * Used for uptime calculation in health checks
 */
const serverStartTime = Date.now();

/**
 * Initialize database connection on server startup
 *
 * Connects to the SQLite database and stores the connection
 * for use by API endpoints.
 */
(async () => {
  try {
    console.log('Opening database connection to ' + join(__dirname, '../../db/database.sqlite') + '...');
    const database = await getDatabase();
    if (database) {
      console.log('Database initialized successfully on server startup');
      db = database;

      // Test database connection
      const version = await db.get('SELECT sqlite_version() as version');
      console.log(`SQLite version: ${version?.version}`);

      // Initialize services
      await optimizedProjectService.initialize(db);
      console.log('Project service initialized');
    } else {
      console.error('Database initialization failed - db object is null');
    }
  } catch (dbError) {
    console.error('Error during forced database initialization:', dbError);
  }
})();

// Apply middleware
app.use(cors());                // Enable CORS for all routes
app.use(express.json());        // Parse JSON request bodies
app.use(apiMonitor);            // Track API usage

/**
 * Additional CORS configuration middleware
 *
 * Adds specific CORS headers to allow cross-origin requests.
 * Cache-control headers are commented out to allow browser caching.
 */
app.use((req, res, next) => {
  // Allow requests from any origin
  res.header('Access-Control-Allow-Origin', '*');

  // Allow specific headers in requests
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

  next();
});

/**
 * Apply rate limiting to API endpoints
 */
app.use('/api/', standardLimiter);
app.use('/api/dashboard', dashboardLimiter);

/**
 * Legacy routes for backward compatibility
 * These routes don't use the database middleware to avoid issues
 */
// Dashboard API compatibility routes
app.get('/api/dashboard/projects/active', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    console.log('Legacy route: Fetching active projects for dashboard');

    // Optioneel forceren van refresh door query parameter
    const forceRefresh = req.query.refresh === 'true';

    // Clear de project cache als nodig
    if (forceRefresh) {
      console.log('Force refresh requested, clearing project cache');
      cacheService.clearProjectData();
    }

    // Zet cache-control headers om browser caching te voorkomen
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const projects = await projectService.getActiveProjects(db);
    console.log(`Returning ${projects.length} active projects via legacy route`);
    res.json({ response: projects });
  } catch (error) {
    console.error('Error fetching active projects:', error);
    res.status(500).json({ error: 'Failed to fetch active projects' });
  }
});

// Employee stats endpoint
app.get('/api/employee-stats', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const week = parseInt(req.query.week as string) || new Date().getDay();
    const isDashboard = req.query.dashboard === 'true';

    console.log(`Legacy route: Fetching employee stats for year=${year}, week=${week}, isDashboard=${isDashboard}`);

    // Zet cache-control headers om browser caching te voorkomen
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Haal de data op uit de cache of haal het op uit de database
    const cacheKey = `employees_week_${year}_${week}`;
    const cachedData = cacheService.get(cacheKey);

    if (cachedData) {
      console.log(`Using cached data for year=${year}, week=${week}`);
      return res.json(cachedData);
    }

    console.log(`Cache MISS for key: ${cacheKey}`);
    console.log(`Fetching employee data for week ${week} of ${year} (${year}-W${week})`);

    try {
      // Bereken de start- en einddatum van de week
      const startDate = new Date(year, 0, 1 + (week - 1) * 7);
      const dayOfWeek = startDate.getDay();
      const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const weekStart = new Date(startDate.setDate(diff));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const formattedStartDate = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;
      const formattedEndDate = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, '0')}-${String(weekEnd.getDate()).padStart(2, '0')}`;

      console.log(`Week dates: ${formattedStartDate} to ${formattedEndDate}`);

      // Haal medewerkers op uit de database
      const employees = await db.all(`
        SELECT e.id, e.firstname, e.lastname,
               (e.firstname || ' ' || e.lastname) as name,
               e.function, e.active,
               c.startdate as contract_startdate,
               c.enddate as contract_enddate,
               c.hours_monday_even, c.hours_tuesday_even,
               c.hours_wednesday_even, c.hours_thursday_even,
               c.hours_friday_even,
               c.hours_monday_odd, c.hours_tuesday_odd,
               c.hours_wednesday_odd, c.hours_thursday_odd,
               c.hours_friday_odd
        FROM employees e
        LEFT JOIN contracts c ON e.id = c.employee_id
        WHERE e.active = 1
        ORDER BY e.lastname, e.firstname
      `);

      // Haal uren op voor deze week
      const hoursData = await db.all(`
        SELECT employee_id, date, SUM(amount) as total_hours
        FROM hours
        WHERE date >= ? AND date <= ?
        GROUP BY employee_id, date
      `, [formattedStartDate, formattedEndDate]);

      // Haal verlofuren op voor deze week
      const leaveData = await db.all(`
        SELECT ar.employee_id, arl.date, arl.amount as hours
        FROM absence_request_lines arl
        JOIN absence_requests ar ON arl.absencerequest_id = ar.id
        WHERE arl.date >= ? AND arl.date <= ?
          AND (arl.status_id = 2 OR arl.status_id = 1)
      `, [formattedStartDate, formattedEndDate]);

      // Verwerk de data
      const employeeData = employees.map(employee => {
        // Bereken contract uren
        const evenWeekHours = (
          (employee.hours_monday_even || 0) +
          (employee.hours_tuesday_even || 0) +
          (employee.hours_wednesday_even || 0) +
          (employee.hours_thursday_even || 0) +
          (employee.hours_friday_even || 0)
        );

        const oddWeekHours = (
          (employee.hours_monday_odd || 0) +
          (employee.hours_tuesday_odd || 0) +
          (employee.hours_wednesday_odd || 0) +
          (employee.hours_thursday_odd || 0) +
          (employee.hours_friday_odd || 0)
        );

        const weeklyContractHours = Math.round((evenWeekHours + oddWeekHours) / 2);
        const contractPeriod = weeklyContractHours >= 36 ? 'Fulltime' : 'Parttime';

        // Bereken geschreven uren
        const employeeHours = hoursData.filter(h => h.employee_id === employee.id);
        const totalWrittenHours = employeeHours.reduce((sum, h) => sum + h.total_hours, 0);

        // Bereken verlofuren
        const employeeLeave = leaveData.filter(l => l.employee_id === employee.id);
        const totalLeaveHours = employeeLeave.reduce((sum, l) => sum + l.hours, 0);

        // Bereken verwachte uren (contract uren - feestdagen)
        const expectedHours = weeklyContractHours;

        // Bereken totale uren (geschreven + verlof)
        const totalActualHours = totalWrittenHours + totalLeaveHours;

        // Bereken vakantie-uren (jaarlijks)
        const holidayHours = weeklyContractHours * 5; // Ongeveer 5 weken vakantie per jaar

        return {
          id: employee.id,
          name: employee.name,
          function: employee.function,
          contract_period: contractPeriod,
          contract_hours: weeklyContractHours,
          holiday_hours: holidayHours,
          expected_hours: expectedHours,
          leave_hours: totalLeaveHours,
          written_hours: totalWrittenHours,
          actual_hours: totalActualHours,
          active: employee.active === 1
        };
      });

      // Sla de data op in de cache
      const responseData = { response: employeeData };
      cacheService.set(cacheKey, responseData);

      // Stuur de response
      return res.json(responseData);
    } catch (dbError) {
      console.error('Database error in employee-stats endpoint:', dbError);
      throw dbError;
    }
  } catch (error) {
    console.error('Error fetching employee stats:', error);
    res.status(500).json({
      success: false,
      error: {
        message: `Error fetching employee stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// Employee month stats endpoint
app.get('/api/employee-month-stats', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
    const isDashboard = req.query.dashboard === 'true';

    console.log(`Legacy route: Fetching employee month stats for year=${year}, month=${month}, isDashboard=${isDashboard}`);

    // Zet cache-control headers om browser caching te voorkomen
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Haal de data op uit de cache of haal het op uit de database
    const cacheKey = `employees_month_${year}_${month}`;
    const cachedData = cacheService.get(cacheKey);

    if (cachedData) {
      console.log(`Using cached data for year=${year}, month=${month}`);
      return res.json(cachedData);
    }

    console.log(`Cache MISS for key: ${cacheKey}`);

    // Bereken de start- en einddatum van de maand
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    console.log(`Fetching employee data for ${year}-${month} (${startDate} to ${endDate})`);

    try {
      // Haal medewerkers op uit de database
      const employees = await db.all(`
        SELECT e.id, e.firstname, e.lastname,
               (e.firstname || ' ' || e.lastname) as name,
               e.function, e.active,
               c.startdate as contract_startdate,
               c.enddate as contract_enddate,
               c.hours_monday_even, c.hours_tuesday_even,
               c.hours_wednesday_even, c.hours_thursday_even,
               c.hours_friday_even,
               c.hours_monday_odd, c.hours_tuesday_odd,
               c.hours_wednesday_odd, c.hours_thursday_odd,
               c.hours_friday_odd
        FROM employees e
        LEFT JOIN contracts c ON e.id = c.employee_id
        WHERE e.active = 1
        ORDER BY e.lastname, e.firstname
      `);

      // Haal uren op voor deze maand
      const hoursData = await db.all(`
        SELECT employee_id, SUM(amount) as total_hours
        FROM hours
        WHERE date >= ? AND date <= ?
        GROUP BY employee_id
      `, [startDate, endDate]);

      // Haal verlofuren op voor deze maand
      const leaveData = await db.all(`
        SELECT ar.employee_id, SUM(arl.amount) as total_hours
        FROM absence_request_lines arl
        JOIN absence_requests ar ON arl.absencerequest_id = ar.id
        WHERE arl.date >= ? AND arl.date <= ?
          AND (arl.status_id = 2 OR arl.status_id = 1)
        GROUP BY ar.employee_id
      `, [startDate, endDate]);

      // Maak een map voor snelle lookup
      const hoursMap = new Map();
      hoursData.forEach(entry => {
        hoursMap.set(entry.employee_id, entry.total_hours);
      });

      const leaveMap = new Map();
      leaveData.forEach(entry => {
        leaveMap.set(entry.employee_id, entry.total_hours);
      });

      // Bereken het aantal werkdagen in de maand
      const workingDaysInMonth = getWorkingDaysInMonth(year, month);

      // Verwerk de data
      const employeeStats = employees.map(emp => {
        // Bereken contract uren
        const evenWeekHours = (
          (emp.hours_monday_even || 0) +
          (emp.hours_tuesday_even || 0) +
          (emp.hours_wednesday_even || 0) +
          (emp.hours_thursday_even || 0) +
          (emp.hours_friday_even || 0)
        );

        const oddWeekHours = (
          (emp.hours_monday_odd || 0) +
          (emp.hours_tuesday_odd || 0) +
          (emp.hours_wednesday_odd || 0) +
          (emp.hours_thursday_odd || 0) +
          (emp.hours_friday_odd || 0)
        );

        const averageWeeklyHours = (evenWeekHours + oddWeekHours) / 2;
        const contractHours = Math.round(averageWeeklyHours);
        const contractPeriod = contractHours >= 36 ? 'Fulltime' : 'Parttime';

        // Bereken verwachte uren voor de maand
        const expectedHours = Math.round(averageWeeklyHours / 5 * workingDaysInMonth);

        // Bereken geschreven uren
        const totalWrittenHours = hoursMap.get(emp.id) || 0;

        // Bereken verlofuren
        const leaveHours = leaveMap.get(emp.id) || 0;

        // Bereken totale uren (geschreven + verlof)
        const totalActualHours = totalWrittenHours + leaveHours;

        // Bereken vakantie-uren (jaarlijks)
        const holidayHours = contractHours * 5; // Ongeveer 5 weken vakantie per jaar

        return {
          id: emp.id,
          name: emp.name,
          function: emp.function,
          contract_period: contractPeriod,
          contract_hours: contractHours,
          holiday_hours: holidayHours,
          expected_hours: expectedHours,
          leave_hours: leaveHours,
          written_hours: totalWrittenHours,
          actual_hours: totalActualHours,
          active: emp.active === 1
        };
      });

      // Sla de data op in de cache
      const responseData = { response: employeeStats };
      cacheService.set(cacheKey, responseData);

      // Stuur de response
      return res.json(responseData);
    } catch (dbError) {
      console.error('Database error in employee-month-stats endpoint:', dbError);
      throw dbError;
    }
  } catch (error) {
    console.error('Error fetching employee month stats:', error);
    res.status(500).json({
      success: false,
      error: {
        message: `Error fetching employee month stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// Helper functie om het aantal werkdagen in een maand te berekenen
function getWorkingDaysInMonth(year: number, month: number): number {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  let workingDays = 0;

  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = zondag, 6 = zaterdag
      workingDays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return workingDays;
}



app.get('/api/dashboard/projects/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    console.log(`Legacy route: Fetching project ${projectId}`);
    const project = await projectService.getProjectById(db, projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ response: project });
  } catch (error) {
    console.error(`Error fetching project ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch project details' });
  }
});

// Legacy route for syncing projects
app.post('/api/sync/projects', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Database not connected',
          code: 'DATABASE_ERROR'
        }
      });
    }

    console.log('Legacy route: Syncing projects with Gripp');

    // Clear project cache before syncing
    cacheService.clearProjectData();

    // Sync projects
    await optimizedProjectService.syncProjects(db);

    // Return success response
    res.json({
      success: true,
      message: 'Projects synced successfully'
    });
  } catch (error) {
    console.error('Error syncing projects:', error);
    res.status(500).json({
      success: false,
      error: {
        message: `Failed to sync projects: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'SYNC_ERROR'
      }
    });
  }
});

// Legacy route for syncing all data
app.post('/api/sync', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Database not connected',
          code: 'DATABASE_ERROR'
        }
      });
    }

    console.log('Legacy route: Syncing all data with Gripp');

    // Clear all caches
    cacheService.clearAll();

    // Sync all data (projects, employees, etc.)
    // In deze dummy implementatie synchroniseren we alleen projecten
    await optimizedProjectService.syncProjects(db);

    // Return success response
    res.json({
      success: true,
      message: 'All data synced successfully'
    });
  } catch (error) {
    console.error('Error syncing all data:', error);
    res.status(500).json({
      success: false,
      error: {
        message: `Failed to sync all data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'SYNC_ERROR'
      }
    });
  }
});

// Invoices endpoint
app.get('/api/invoices', async (req, res) => {
  try {
    console.log('Legacy route: Fetching invoices');
    const year = req.query.year ? parseInt(req.query.year as string) : 0;

    const filters = [];

    // Only apply year filter if a specific year is requested
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
      // If no specific year, get all invoices from 2024 onwards
      filters.push({
        field: 'invoice.date',
        operator: 'greaterequals',
        value: '2024-01-01'
      });
    }

    // Zet cache-control headers om browser caching te voorkomen
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

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

    res.json(response.result);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      error: {
        message: `Error fetching invoices: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// Unpaid invoices endpoint
app.get('/api/invoices/unpaid', async (req, res) => {
  try {
    console.log('Legacy route: Fetching unpaid invoices');

    // Parse year parameter if provided
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;

    // Zet cache-control headers om browser caching te voorkomen
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Just use the invoiceService which now includes client-side filtering
    const response = await invoiceService.getUnpaid(year);
    res.json(response.result);
  } catch (error) {
    console.error('Error fetching unpaid invoices:', error);
    res.status(500).json({
      success: false,
      error: {
        message: `Error fetching unpaid invoices: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

// Overdue invoices endpoint
app.get('/api/invoices/overdue', async (req, res) => {
  try {
    console.log('Legacy route: Fetching overdue invoices');

    // Parse year parameter if provided
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;

    // Zet cache-control headers om browser caching te voorkomen
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Just use the invoiceService which now includes client-side filtering
    const response = await invoiceService.getOverdue(year);
    res.json(response.result);
  } catch (error) {
    console.error('Error fetching overdue invoices:', error);
    res.status(500).json({
      success: false,
      error: {
        message: `Error fetching overdue invoices: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

/**
 * Add database middleware to all API routes
 */
app.use('/api/v1', (req, res, next) => {
  // Voeg de database toe aan de request
  (req as any).db = db;
  next();
});

/**
 * Mount API routes
 */
app.use('/api', apiRoutes);

/**
 * Add legacy routes for backward compatibility
 * These routes will be deprecated in the future
 */
app.use('/api/health', (req, res) => {
  res.redirect(301, '/api/v1/health');
});

app.use('/api/cache/clear', (req, res) => {
  res.redirect(307, '/api/v1/cache/clear');
});

// Redirect /api/sync to /api/v1/sync
app.use('/api/sync', (req, res, next) => {
  // Als het een specifieke endpoint is zoals /api/sync/projects, dan niet redirecten
  if (req.path !== '/') {
    return next();
  }
  res.redirect(307, '/api/v1/sync');
});

/**
 * Add error handling middleware
 */
app.use(notFoundHandler);
app.use(errorHandler);

/**
 * Start the server
 */
const startServer = () => {
  app.listen(port, () => {
    console.log(`API server v2 running at http://localhost:${port}`);
  }).on('error', async (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use`);

      try {
        // Attempt to kill the process using the port
        await killProcessOnPort(port);
        console.log(`Killed process on port ${port}, retrying in 1 second...`);

        // Retry server startup after a short delay
        setTimeout(() => {
          startServer();
        }, 1000);
      } catch (killError) {
        // Failed to kill the process
        console.error(`Failed to kill process on port ${port}:`, killError);
        console.error(`Cannot start API server. Please manually kill process on port ${port}`);
        process.exit(1); // Exit with error code
      }
    } else {
      // Other server startup error
      console.error('Failed to start API server:', error);
      process.exit(1); // Exit with error code
    }
  });
};

// Start the server
console.log('Initializing API Server v2...');
startServer();
