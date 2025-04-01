import express, { Express, Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { executeRequest } from './client';
import { getDatabase } from '../../db/database';
import { employeeService } from './services/employee';
import { contractService } from './services/contract';
import { hourService } from './services/hour';
import { absenceService, AbsenceRequest } from './services/absence';
import { startOfWeek, setWeek, addDays } from 'date-fns';
import { format, getDay } from 'date-fns';
import { getAbsenceRequests } from './simple-client';
import { getWeekDates } from './utils/date-utils';
import dotenv from 'dotenv';
import { Database } from 'sqlite3';
import { Database as SqliteDatabase } from 'sqlite';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { cacheService, CACHE_KEYS } from './cache-service';
import { projectService, ProjectService } from './services/project';
import { grippClient } from './client';
import { invoiceService } from './services/invoice';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { API_PORT, killProcessOnPort } from '../../config/ports';

// Define __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Define the GrippRequest interface
interface GrippRequest {
  method: string;
  params: any[];
  id: number;
}

const exec = promisify(execCallback);

// Load environment variables from .env file
dotenv.config();
console.log('Dotenv loaded successfully');

// Helper function to generate a consistent hash code from a string
// This is used to create consistent IDs from string values
if (!String.prototype.hashCode) {
  String.prototype.hashCode = function() {
    let hash = 0;
    for (let i = 0; i < this.length; i++) {
      const char = this.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  };
}

// Create Express application
const app: Express = express();
const port = API_PORT; // Use port from central config
// const alternativePorts = [3004, 3005, 3006]; // Comment out alternative ports

console.log(`Using API key: ${process.env.GRIPP_API_KEY?.substring(0, 20)}...`);

// Rate limiting
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // increased from 100 to 500 requests per windowMs
  message: 'Too many requests, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, next, options) => {
    console.warn(`Rate limit exceeded for ${req.ip} on ${req.path} (standard limiter)`);
    res.status(options.statusCode).json({
      status: 429,
      message: options.message,
      retryAfter: Math.ceil(options.windowMs / 1000)
    });
  }
});

// More generous limiter for dashboard endpoints which need frequent refreshes
const dashboardLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 300, // Allow more requests for dashboard endpoints
  message: 'Too many dashboard requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.warn(`Rate limit exceeded for ${req.ip} on ${req.path} (dashboard limiter)`);
    res.status(options.statusCode).json({
      status: 429,
      message: options.message,
      retryAfter: Math.ceil(options.windowMs / 1000)
    });
  }
});

// Track API endpoint usage
const endpointHits = new Map<string, number>();

// API usage monitor middleware
const apiMonitor = (req: Request, res: Response, next: Function) => {
  const endpoint = req.path;
  const currentHits = endpointHits.get(endpoint) || 0;
  endpointHits.set(endpoint, currentHits + 1);
  
  // Check if high number of requests
  if (currentHits > 1000) {
    console.warn(`High traffic detected on endpoint: ${endpoint} - ${currentHits} hits`);
  }
  
  next();
};

app.use(cors());
app.use(express.json());
app.use(apiMonitor); // Add API monitoring

// Add CORS headers to allow requests from any origin
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  // Remove the cache-control headers that were preventing caching
  // res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  // res.header('Pragma', 'no-cache');
  // res.header('Expires', '0');
  
  next();
});

// Apply standard rate limiting to all endpoints
app.use('/api/', standardLimiter);

// Apply dashboard-specific rate limiting to dashboard endpoints
app.use('/api/dashboard', dashboardLimiter);
app.use('/api/employee-stats', (req, res, next) => {
  if (req.query.dashboard === 'true') {
    dashboardLimiter(req, res, next);
  } else {
    standardLimiter(req, res, next);
  }
});
app.use('/api/employee-month-stats', (req, res, next) => {
  if (req.query.dashboard === 'true') {
    dashboardLimiter(req, res, next);
  } else {
    standardLimiter(req, res, next);
  }
});

let db: SqliteDatabase | null = null;
let serverStartTime = Date.now();

// Initialize database on startup
getDatabase().then(async database => {
  db = database;
  console.log('Database connected');
}).catch(error => {
  console.error('Database connection error:', error);
});

// Health check endpoints
app.get('/health', async (req: Request, res: Response) => {
  const uptime = Math.floor((Date.now() - serverStartTime) / 1000); // in seconds
  
  try {
    // Check database connection
    const dbConnected = !!db;
    
    res.json({
      status: 'ok',
      database: dbConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      uptime: uptime
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      database: 'unknown',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      uptime: uptime
    });
  }
});

// Also add the same endpoint under /api prefix for consistency
app.get('/api/health', async (req: Request, res: Response) => {
  const uptime = Math.floor((Date.now() - serverStartTime) / 1000); // in seconds
  
  try {
    // Check database connection
    const dbConnected = !!db;
    
    res.json({
      status: 'ok',
      database: dbConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      uptime: uptime
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      database: 'unknown',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
      uptime: uptime
    });
  }
});

// Add API monitoring endpoint
app.get('/api/monitor', async (req: Request, res: Response) => {
  try {
    // Convert endpointHits map to a sorted array
    const endpoints = Array.from(endpointHits.entries())
      .map(([endpoint, hits]) => ({ endpoint, hits }))
      .sort((a, b) => b.hits - a.hits);
    
    // Get total hits
    const totalHits = endpoints.reduce((sum, current) => sum + current.hits, 0);
    
    // Get top endpoints (most used)
    const topEndpoints = endpoints.slice(0, 10);
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      rateLimit: {
        standard: {
          windowMs: standardLimiter.options.windowMs,
          max: standardLimiter.options.max
        },
        dashboard: {
          windowMs: dashboardLimiter.options.windowMs,
          max: dashboardLimiter.options.max
        }
      },
      stats: {
        totalHits,
        uniqueEndpoints: endpoints.length,
        topEndpoints
      },
      uptime: Math.floor((Date.now() - serverStartTime) / 1000)
    });
  } catch (error) {
    console.error('Monitor endpoint error:', error);
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

// Helper function to normalize date strings for comparison
const normalizeDate = (dateStr: string): string => {
  // Ensure the date is in YYYY-MM-DD format
  if (!dateStr) return '';
  return dateStr.split('T')[0];
};

interface Employee {
  id: number;
  firstname: string;
  lastname: string;
  name: string;
  function: string;
  contract_startdate?: string;
  contract_enddate?: string;
  hours_monday_even?: number;
  hours_tuesday_even?: number;
  hours_wednesday_even?: number;
  hours_thursday_even?: number;
  hours_friday_even?: number;
  hours_monday_odd?: number;
  hours_tuesday_odd?: number;
  hours_wednesday_odd?: number;
  hours_thursday_odd?: number;
  hours_friday_odd?: number;
  active: boolean;
}

interface AbsenceData {
  id: number;
  employee_id: number;
  firstname?: string;
  lastname?: string;
  startdate: string;
  enddate: string;
  type_id: number;
  type_name: string;
  hours_per_day: number;
  description?: string;
  status_id: number;
  status_name: string;
}

interface Holiday {
  date: string;
  name: string;
}

// Add helper functions at the top of the file

/**
 * Get the ISO week number for a given date
 * @param date Date to get week number for
 * @returns Week number (1-53)
 */
function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7)); // Set to nearest Thursday
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Get the date of the first day (Monday) of a specific week in a year
 * @param year Year
 * @param week Week number (1-53)
 * @returns Date object for the Monday of that week
 */
function getDateOfWeek(year: number, week: number): Date {
  const firstDayOfYear = new Date(year, 0, 1);
  const dayOffset = 1 - (firstDayOfYear.getDay() || 7); // Adjust for the first Thursday
  firstDayOfYear.setDate(firstDayOfYear.getDate() + dayOffset);
  const daysToAdd = (week - 1) * 7;
  firstDayOfYear.setDate(firstDayOfYear.getDate() + daysToAdd);
  return firstDayOfYear;
}

// Add an endpoint to get employee data for the current week
app.get('/api/employees', async (req: Request, res: Response) => {
  try {
    if (!db) {
      console.error('Database not initialized');
      return res.status(503).json({ error: 'Database not ready. Please try again in a few seconds.' });
    }

    // Parse the request parameters
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const week = parseInt(req.query.week as string) || getWeekNumber(new Date());
    const isDashboard = req.query.dashboard === 'true';
    
    // Generate cache key based on parameters
    const cacheKey = CACHE_KEYS.EMPLOYEES_WEEK(year, week);
    
    // Check if the data is already in cache
    const cachedData = cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`Using cached data for year=${year}, week=${week} from /api/employees endpoint`);
      
      // Set cache control headers
      res.header('X-Cache', 'HIT');
      // Set cache-control to allow caching for 24 hours
      res.header('Cache-Control', 'max-age=86400, public');
      
      return res.json(cachedData);
    }
    
    console.log(`Cache MISS for key: ${cacheKey}`);
    console.log(`Fetching employee data for year=${year}, week=${week} from /api/employees endpoint`);
    
    // Calculate the start and end dates for the specified week
    const startDate = getDateOfWeek(year, week);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    
    console.log(`Week date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    
    // Get employees from database with their contracts
    const employees = await db.all<Employee[]>(`
      SELECT 
        e.id, 
        e.firstname, 
        e.lastname,
        e.firstname || ' ' || e.lastname as name,
        e.function,
        e.active,
        date(c.startdate) as contract_startdate,
        date(c.enddate) as contract_enddate,
        c.hours_monday_even,
        c.hours_tuesday_even,
        c.hours_wednesday_even,
        c.hours_thursday_even,
        c.hours_friday_even,
        c.hours_monday_odd,
        c.hours_tuesday_odd,
        c.hours_wednesday_odd,
        c.hours_thursday_odd,
        c.hours_friday_odd
      FROM 
        employees e
      LEFT JOIN
        contracts c ON e.id = c.employee_id
      WHERE 
        e.active = true
      GROUP BY
        e.id
      ORDER BY
        e.firstname, e.lastname
    `);

    if (!employees || employees.length === 0) {
      console.log('No employees found in database');
      return res.status(404).json({ error: 'No employees found' });
    }

    console.log(`Found ${employees.length} employees in database`);
    
    // Get absence data for the week
    const absenceData = await db.all<AbsenceData[]>(`
      SELECT 
        ar.id,
        ar.employee_id,
        arl.date as startdate,
        arl.date as enddate,
        ar.absencetype_id as type_id,
        ar.absencetype_searchname as type_name,
        arl.amount as hours_per_day,
        ar.description,
        arl.status_id,
        arl.status_name
      FROM 
        absence_requests ar
      JOIN
        absence_request_lines arl ON ar.id = arl.absencerequest_id
      JOIN
        employees e ON ar.employee_id = e.id
      WHERE 
        e.active = true AND
        arl.date BETWEEN ? AND ?
      ORDER BY
        arl.date ASC
    `, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);
    
    console.log('Found absence data:', absenceData.length, 'records');
    
    // Get written hours for the week
    const writtenHoursData = await db.all(`
      SELECT 
        employee_id,
        SUM(amount) as total_hours
      FROM 
        hours
      WHERE 
        date BETWEEN ? AND ?
      GROUP BY
        employee_id
    `, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);

    console.log('Found written hours data:', writtenHoursData.length, 'records');
    
    // Get holidays for the week
    const holidays = await db.all<Holiday[]>(`
      SELECT date, name FROM holidays 
      WHERE date >= ? AND date <= ?
    `, [
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    ]);

    console.log('Found holidays:', holidays);
    
    // Create a map of employee absences
    const absencesByEmployee: { [key: number]: AbsenceData[] } = {};
    absenceData.forEach(absence => {
      const employeeId = absence.employee_id;
      if (!absencesByEmployee[employeeId]) {
        absencesByEmployee[employeeId] = [];
      }
      absencesByEmployee[employeeId].push(absence);
    });
    
    // Create a map of written hours
    const writtenHoursByEmployee: { [key: number]: number } = {};
    writtenHoursData.forEach(item => {
      writtenHoursByEmployee[item.employee_id] = item.total_hours;
    });
    
    // Create a list for detailed absence debugging
    const absenceDebugInfo: { [key: number]: any } = {};
    
    // Process employees
    const processedEmployees = employees.map(employee => {
      // Check if the current week is odd or even
      const currentDate = new Date();
      const weekNumber = getWeekNumber(currentDate);
      const isEven = weekNumber % 2 === 0;
      
      // Get weekly contract hours based on even/odd week
      const weeklyHours = calculateWeeklyContractHours(employee, isEven);
      
      // Get absences for this employee
      const employeeAbsences = absencesByEmployee[employee.id] || [];
      
      // Update debugging info
      absenceDebugInfo[employee.id] = {
        totalAbsences: employeeAbsences.length,
        absenceDetails: employeeAbsences.map(a => ({
          id: a.id,
          date: a.startdate,
          hours: a.hours_per_day,
          status_id: a.status_id,
          status_name: a.status_name,
          isApproved: a.status_id === 2 || 
                     a.status_name === 'GOEDGEKEURD' || 
                     a.status_name === 'Approved' ||
                     (a.status_name?.toUpperCase() === 'GOEDGEKEURD'),
          description: a.description
        }))
      };
      
      // Calculate leave hours for approved absences
      const leaveHours = employeeAbsences.reduce((total, absence) => {
        const isApproved = 
          absence.status_id === 2 || 
          absence.status_name === 'GOEDGEKEURD' || 
          absence.status_name === 'Approved' ||
          absence.status_name?.toUpperCase() === 'GOEDGEKEURD';
        
        if (isApproved) {
          return total + (absence.hours_per_day || 0);
        }
        return total;
      }, 0);
      
      // Get written hours
      const writtenHours = writtenHoursByEmployee[employee.id] || 0;
      
      // Format contract period
      let contractPeriod = '';
      if (employee.contract_startdate) {
        contractPeriod = employee.contract_enddate 
          ? `${employee.contract_startdate} - ${employee.contract_enddate}`
          : `${employee.contract_startdate} - present`;
      }
      
      // Calculate expected hours for the week (accounting for holidays)
      const expectedHours = weeklyHours - (holidays.length * 8); // Subtract 8 hours for each holiday
      
      return {
        id: employee.id,
        name: employee.name,
        function: employee.function || '',
        contract_period: contractPeriod,
        contract_hours: weeklyHours,
        expected_hours: expectedHours,
        leave_hours: leaveHours,
        written_hours: writtenHours,
        actual_hours: writtenHours + leaveHours,
        active: employee.active,
        absences: employeeAbsences,
        absenceDebug: absenceDebugInfo[employee.id]
      };
    });
    
    // Filter for dashboard if requested
    const finalEmployees = isDashboard
      ? processedEmployees.filter(e => e.contract_hours > 0) // Only show employees with contract hours for dashboard
      : processedEmployees;
    
    // Cache the results
    cacheService.set(cacheKey, finalEmployees, 86400); // Cache for 24 hours
    console.log(`Cache SET for key: ${cacheKey} with TTL: 86400s`);
    
    // Send response with cache headers
    res.header('X-Cache', 'MISS');
    res.header('Cache-Control', 'max-age=86400, public');
    return res.json(finalEmployees);
    
  } catch (error) {
    console.error('Error fetching employee data:', error);
    res.status(500).json({ error: 'Failed to fetch employee data for the week' });
  }
});

// Endpoint to get employees data by month
app.get('/api/employees/month', async (req: Request, res: Response) => {
  try {
    if (!db) {
      console.error('Database not initialized');
      return res.status(503).json({ error: 'Database not ready. Please try again in a few seconds.' });
    }

    // Get query parameters
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
    const month = req.query.month ? parseInt(req.query.month as string) : new Date().getMonth() + 1; // Month is 0-indexed in JS

    // Calculate start and end date for the month
    const startDate = new Date(year, month - 1, 1); // First day of month
    const endDate = new Date(year, month, 0); // Last day of month
    
    console.log(`Fetching employee data for month ${month} of ${year} (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})`);
    
    // Check if we have cached data for this request
    const cacheKey = CACHE_KEYS.EMPLOYEES_MONTH(year, month);
    const cachedData = cacheService.get(cacheKey);
    
    if (cachedData) {
      console.log(`Cache HIT for key: ${cacheKey}`);
      // Set cache-control header to allow caching
      res.header('Cache-Control', 'max-age=3600, public');
      res.header('X-Cache', 'HIT');
      return res.json(cachedData);
    }
    
    console.log(`Cache MISS for key: ${cacheKey}`);
    
    // Get all employees with their contracts
    const employees = await db.all<Employee[]>(`
      SELECT 
        e.id, 
        e.firstname || ' ' || e.lastname as name,
        e.function,
        e.active,
        c.startdate as contract_startdate, 
        c.enddate as contract_enddate,
        c.hours_monday_even, 
        c.hours_tuesday_even, 
        c.hours_wednesday_even, 
        c.hours_thursday_even, 
        c.hours_friday_even,
        c.hours_monday_odd, 
        c.hours_tuesday_odd, 
        c.hours_wednesday_odd, 
        c.hours_thursday_odd, 
        c.hours_friday_odd
      FROM 
        employees e
      LEFT JOIN 
        contracts c ON e.id = c.employee_id
      WHERE 
        e.active = 1
      ORDER BY
        e.firstname, e.lastname
    `);

    if (!employees || employees.length === 0) {
      console.log('No employees found in database');
      return res.status(404).json({ error: 'No employees found' });
    }

    console.log(`Found ${employees.length} employees in database`);
    
    // Get absence data for the period
    const absenceData = await db.all<AbsenceData[]>(`
      SELECT 
        ar.id,
        ar.employee_id,
        arl.date as startdate,
        arl.date as enddate,
        ar.absencetype_id as type_id,
        ar.absencetype_searchname as type_name,
        arl.amount as hours_per_day,
        ar.description,
        arl.status_id,
        arl.status_name
      FROM 
        absence_requests ar
      JOIN
        absence_request_lines arl ON ar.id = arl.absencerequest_id
      JOIN
        employees e ON ar.employee_id = e.id
      WHERE 
        e.active = true AND
        arl.date BETWEEN ? AND ?
      ORDER BY
        arl.date ASC
    `, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);
    
    console.log('Found absence data:', absenceData.length, 'records');
    
    // Get written hours for the period
    const writtenHoursData = await db.all(`
      SELECT 
        employee_id,
        SUM(amount) as total_hours
      FROM 
        hours
      WHERE 
        date BETWEEN ? AND ?
      GROUP BY
        employee_id
    `, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);

    console.log('Found written hours data:', writtenHoursData.length, 'records');
    
    // Get holidays for the period
    const holidays = await db.all<Holiday[]>(`
      SELECT date, name FROM holidays 
      WHERE date >= ? AND date <= ?
    `, [
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    ]);

    console.log('Found holidays:', holidays);
    
    // Create a map of employee absences
    const absencesByEmployee: { [key: number]: AbsenceData[] } = {};
    absenceData.forEach(absence => {
      const employeeId = absence.employee_id;
      if (!absencesByEmployee[employeeId]) {
        absencesByEmployee[employeeId] = [];
      }
      absencesByEmployee[employeeId].push(absence);
    });
    
    // Create a map of written hours
    const writtenHoursByEmployee: { [key: number]: number } = {};
    writtenHoursData.forEach(item => {
      writtenHoursByEmployee[item.employee_id] = item.total_hours;
    });
    
    // Calculate total workdays and contract hours for the month
    const totalWorkdays = getWorkdaysInMonth(year, month);
    
    // Process employee data with contracts, absences, and expected hours
    const processedEmployees = employees.map(employee => {
      // Calculate average weekly contract hours
      const evenWeekHours = (employee.hours_monday_even || 0) + 
                           (employee.hours_tuesday_even || 0) + 
                           (employee.hours_wednesday_even || 0) + 
                           (employee.hours_thursday_even || 0) + 
                           (employee.hours_friday_even || 0);
      
      const oddWeekHours = (employee.hours_monday_odd || 0) + 
                          (employee.hours_tuesday_odd || 0) + 
                          (employee.hours_wednesday_odd || 0) + 
                          (employee.hours_thursday_odd || 0) + 
                          (employee.hours_friday_odd || 0);
      
      const avgWeeklyHours = (evenWeekHours + oddWeekHours) / 2;
      
      // Calculate monthly contract hours (approximate)
      const avgDailyHours = avgWeeklyHours / 5;
      const contractHours = avgDailyHours * totalWorkdays;
      
      // Calculate contract period
      const contractPeriod = formatContractPeriod(employee.contract_startdate, employee.contract_enddate);
      
      // Get absences for this employee
      const employeeAbsences = absencesByEmployee[employee.id] || [];
      
      // Calculate leave hours for this employee
      const leaveHours = calculateLeaveHours(employeeAbsences);
      
      // Calculate holiday hours
      const holidayHours = holidays.length * avgDailyHours;
      
      // Calculate expected hours (contract hours - holiday hours)
      const expectedHours = Math.max(0, contractHours - holidayHours);
      
      // Get written hours for this employee
      const writtenHours = writtenHoursByEmployee[employee.id] || 0;
      
      // Calculate actual hours (written hours + leave hours)
      const actualHours = writtenHours + leaveHours;
      
      // Return employee with all calculated metrics
      return {
        id: employee.id,
        name: employee.name,
        function: employee.function || null,
        contract_period: contractPeriod,
        contract_hours: Math.round(contractHours * 10) / 10,  // Round to 1 decimal place
        holiday_hours: Math.round(holidayHours * 10) / 10,
        expected_hours: Math.round(expectedHours * 10) / 10,
        leave_hours: Math.round(leaveHours * 10) / 10,
        written_hours: Math.round(writtenHours * 10) / 10,
        actual_hours: Math.round(actualHours * 10) / 10,
        active: employee.active
      };
    });
    
    // After processing employees, store the result in cache
    cacheService.set(cacheKey, processedEmployees);
    
    // Set cache-control header to allow caching for 24 hours
    res.header('Cache-Control', 'max-age=86400, public');
    res.header('X-Cache', 'MISS');
    
    return res.json(processedEmployees);
  } catch (error) {
    console.error('Error fetching employee data:', error);
    return res.status(500).json({ error: 'Failed to fetch employee data' });
  }
});

// Helper function to count workdays in a month (excluding weekends)
function getWorkdaysInMonth(year: number, month: number): number {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  let workdays = 0;
  
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Sunday, 6 = Saturday
      workdays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return workdays;
}

/**
 * Calculate weekly contract hours for an employee
 * @param employee Employee data with contract information 
 * @param weekIsEven Whether the week is even or odd
 * @returns Total weekly contract hours
 */
function calculateWeeklyContractHours(employee: any, weekIsEven: boolean): number {
  if (!employee) return 0;
  
  // If the employee has no contract hours defined, return 0
  if (!employee.hours_monday_even && !employee.hours_monday_odd) {
    return 0;
  }
  
  // Get the appropriate set of hours based on whether the week is even or odd
  const mondayHours = weekIsEven ? (employee.hours_monday_even || 0) : (employee.hours_monday_odd || 0);
  const tuesdayHours = weekIsEven ? (employee.hours_tuesday_even || 0) : (employee.hours_tuesday_odd || 0);
  const wednesdayHours = weekIsEven ? (employee.hours_wednesday_even || 0) : (employee.hours_wednesday_odd || 0);
  const thursdayHours = weekIsEven ? (employee.hours_thursday_even || 0) : (employee.hours_thursday_odd || 0);
  const fridayHours = weekIsEven ? (employee.hours_friday_even || 0) : (employee.hours_friday_odd || 0);
  
  // Sum up all hours for the week
  return mondayHours + tuesdayHours + wednesdayHours + thursdayHours + fridayHours;
}

/**
 * Format contract start and end dates into a readable period string
 * @param startDate Contract start date
 * @param endDate Contract end date
 * @returns Formatted contract period string
 */
function formatContractPeriod(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) {
    return 'No contract';
  }
  
  if (startDate && !endDate) {
    return `From ${startDate}`;
  }
  
  if (!startDate && endDate) {
    return `Until ${endDate}`;
  }
  
  return `${startDate} - ${endDate}`;
}

/**
 * Calculate total leave hours from employee absences
 * @param absences List of employee absences
 * @returns Total leave hours
 */
function calculateLeaveHours(absences: AbsenceData[]): number {
  if (!absences || absences.length === 0) {
    return 0;
  }
  
  // Sum up hours from all leave-type absences, ongeacht status
  return absences.reduce((total, absence) => {
    return total + (absence.hours_per_day || 0);
  }, 0);
}

/**
 * Calculate total holiday hours within a given date range
 * @param startDate Start date of the period
 * @param endDate End date of the period
 * @param holidays List of holidays
 * @param mondayHours Hours for Monday
 * @param tuesdayHours Hours for Tuesday
 * @param wednesdayHours Hours for Wednesday
 * @param thursdayHours Hours for Thursday
 * @param fridayHours Hours for Friday
 * @returns Total holiday hours
 */
function calculateHolidayHours(
  startDate: Date, 
  endDate: Date, 
  holidays: Holiday[], 
  mondayHours: number = 0, 
  tuesdayHours: number = 0, 
  wednesdayHours: number = 0, 
  thursdayHours: number = 0, 
  fridayHours: number = 0
): number {
  if (!holidays || holidays.length === 0) {
    return 0;
  }
  
  // Convert dates to ISO strings for comparison
  const startISO = startDate.toISOString().split('T')[0];
  const endISO = endDate.toISOString().split('T')[0];
  
  // Filter holidays that fall within the date range
  const relevantHolidays = holidays.filter(holiday => {
    const holidayDate = holiday.date.split('T')[0];
    return holidayDate >= startISO && holidayDate <= endISO;
  });
  
  if (relevantHolidays.length === 0) {
    return 0;
  }
  
  // Calculate hours for each holiday based on the day of the week
  return relevantHolidays.reduce((total, holiday) => {
    const holidayDate = new Date(holiday.date);
    const dayOfWeek = holidayDate.getDay(); // 0 is Sunday, 1 is Monday, etc.
    
    switch (dayOfWeek) {
      case 1: // Monday
        return total + mondayHours;
      case 2: // Tuesday
        return total + tuesdayHours;
      case 3: // Wednesday
        return total + wednesdayHours;
      case 4: // Thursday
        return total + thursdayHours;
      case 5: // Friday
        return total + fridayHours;
      default: // Weekend
        return total;
    }
  }, 0);
}

// Add a simple catch-all error handler for API routes
app.use((err, req, res, next) => {
  console.error('Unhandled API error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message || 'An unexpected error occurred'
  });
});

// Attach the dashboard router to the app
app.use('/api/dashboard', dashboardRouter);

// Add invoice endpoints
app.get('/api/invoices', async (req: Request, res: Response) => {
  try {
    console.log('API server: Fetching invoices');
    const year = req.query.year ? parseInt(req.query.year as string) : 0;
    
    let filters = [];
    
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
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

app.get('/api/invoices/unpaid', async (req: Request, res: Response) => {
  try {
    console.log('API server: Fetching unpaid invoices');
    
    // Parse year parameter if provided
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    
    // Just use the invoiceService which now includes client-side filtering
    const response = await invoiceService.getUnpaid(year);
    res.json(response.result);
  } catch (error) {
    console.error('Error fetching unpaid invoices:', error);
    res.status(500).json({ error: 'Failed to fetch unpaid invoices' });
  }
});

app.get('/api/invoices/overdue', async (req: Request, res: Response) => {
  try {
    console.log('API server: Fetching overdue invoices');
    
    // Parse year parameter if provided
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    
    // Just use the invoiceService which now includes client-side filtering
    const response = await invoiceService.getOverdue(year);
    res.json(response.result);
  } catch (error) {
    console.error('Error fetching overdue invoices:', error);
    res.status(500).json({ error: 'Failed to fetch overdue invoices' });
  }
});

// Register all app routes and ensure proper error handling
try {
  // Force database initialization on startup
  (async () => {
    try {
      console.log('Opening database connection to ' + join(__dirname, '../../db/database.sqlite') + '...');
      const database = await getDatabase();
      if (database) {
        console.log('Database initialized successfully on server startup');
        db = database;
      } else {
        console.error('Database initialization failed - db object is null');
      }
    } catch (dbError) {
      console.error('Error during forced database initialization:', dbError);
    }
  })();

  // Function to start the server with a given port
  const startServer = (portToUse: number) => {
    return app.listen(portToUse, () => {
      console.log(`API server running on port ${portToUse}`);
    }).on('error', async (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${portToUse} is already in use. Killing existing process and retrying...`);
        
        try {
          // Kill the process on port using the centralized function
          await killProcessOnPort(portToUse);
          console.log(`Killed process on port ${portToUse}, retrying in 1 second...`);
          
          // Retry after a short delay
          setTimeout(() => {
            startServer(portToUse);
          }, 1000);
        } catch (killError) {
          console.error(`Failed to kill process on port ${portToUse}:`, killError);
          console.error(`Cannot start API server. Please manually kill process on port ${portToUse}`);
          process.exit(1);
        }
      } else {
        console.error('Failed to start API server:', error);
        process.exit(1);
      }
    });
  };

  // Start the server with the main port
  startServer(port);
  
} catch (serverError) {
  console.error('Critical error starting the API server:', serverError);
  process.exit(1);
}

// Add endpoint to clear cache for dashboard data specifically
app.post('/api/cache/clear/dashboard', (req: Request, res: Response) => {
  try {
    cacheService.clearDashboardData();
    console.log('Dashboard data cache cleared successfully');
    
    return res.json({
      success: true,
      message: 'Dashboard data cache cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing dashboard data cache:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to clear dashboard data cache',
      error: (error as Error).message,
    });
  }
});

// Implement a local version of getWeekDates function in case the import fails
function getWeekDatesLocal(year: number, week: number): { startDate: string, endDate: string } {
  // Simple implementation of ISO week date calculation
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const day = simple.getDay();
  const diff = simple.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday being 0
  
  const startDate = new Date(simple.setDate(diff));
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);
  
  // Format to YYYY-MM-DD
  const formatDate = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  
  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate)
  };
}

// Where the getWeekDates is used around line 1561
// Check if the imported function exists, otherwise use local implementation
const getWeekDatesWithFallback = (year: number, week: number) => {
  try {
    // Try to use the imported function
    return getWeekDates(year, week);
  } catch (error) {
    console.warn('Failed to use imported getWeekDates, using fallback implementation:', error);
    return getWeekDatesLocal(year, week);
  }
};

// Add API restart endpoint
app.get('/api/restart', async (req, res) => {
  console.log('API restart requested');
  
  // Set headers to prevent caching
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Content-Type', 'text/html');
  
  // Send response immediately before restarting
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>API Server Restarting</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          h1 { color: #333; }
          .message { margin: 20px 0; color: #666; }
          .spinner { 
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 2s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <h1>API Server Restarting</h1>
        <div class="spinner"></div>
        <p class="message">Het API server wordt herstart...</p>
        <p class="message">Dit venster zal automatisch sluiten na succesvol herstarten.</p>
        <script>
          // Script to check if API is back online
          setTimeout(function checkApiStatus() {
            fetch('http://localhost:${API_PORT}/api/dashboard/test')
              .then(response => {
                if (response.ok) {
                  // API is back online
                  document.querySelector('.message').textContent = 'API server succesvol herstart!';
                  setTimeout(() => window.close(), 2000);
                } else {
                  // API still starting up
                  setTimeout(checkApiStatus, 1000);
                }
              })
              .catch(() => {
                // API not available, check again after delay
                setTimeout(checkApiStatus, 1000);
              });
          }, 5000); // Initial delay to allow server to start shutting down
        </script>
      </body>
    </html>
  `);
  
  // Schedule the restart after response is sent
  setTimeout(async () => {
    try {
      console.log('Initiating API server restart...');
      
      // Get the current process ID
      const pid = process.pid;
      console.log(`Current process ID: ${pid}`);
      
      // Fork a new process to start the server after this one exits
      const { spawn } = require('child_process');
      
      // Get the path to the script that started this server
      const scriptPath = process.argv[1];
      console.log(`Script path: ${scriptPath}`);
      
      // Spawn a new process that will start the server after a delay
      const restarter = spawn('node', [
        '-e',
        `
        setTimeout(() => {
          console.log('Restarting API server...');
          const { spawn } = require('child_process');
          const path = require('path');
          const tsx = path.resolve(process.cwd(), 'node_modules', '.bin', 'tsx');
          const child = spawn('${process.execPath}', ['${scriptPath}'], {
            detached: true,
            stdio: 'ignore',
            env: process.env
          });
          child.unref();
          process.exit(0);
        }, 2000);
        `
      ], {
        detached: true,
        stdio: 'ignore'
      });
      
      restarter.unref();
      
      // Exit this process after a short delay
      setTimeout(() => {
        console.log('Exiting current API server instance...');
        process.exit(0);
      }, 1000);
      
    } catch (error) {
      console.error('Failed to restart API server:', error);
    }
  }, 1000);
});