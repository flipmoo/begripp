import express, { Express, Request, Response, Router } from 'express';
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
import { syncAllData, syncAbsenceRequests } from '../../services/sync.service';

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

// Add cache clear endpoint
app.post('/api/cache/clear', async (req: Request, res: Response) => {
  try {
    console.log('Clearing all cache');
    cacheService.clear();
    return res.json({ success: true, message: 'Cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return res.status(500).json({ success: false, error: 'Failed to clear cache' });
  }
});

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

// Add the sync endpoint
app.post('/api/sync', async (req: Request, res: Response) => {
  try {
    if (!db) {
      console.error('Database not initialized');
      return res.status(503).json({ 
        success: false, 
        error: 'Database not ready. Please try again in a few seconds.' 
      });
    }
    
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'startDate and endDate are required' 
      });
    }
    
    console.log(`Syncing data for period ${startDate} to ${endDate}`);
    
    // Clear employee data cache before syncing
    cacheService.clearEmployeeData();
    
    // Use the syncAllData function from sync.service.ts
    const success = await syncAllData(startDate, endDate);
    
    if (success) {
      return res.json({ 
        success: true, 
        message: 'Data synced successfully',
        syncedPeriod: {
          startDate,
          endDate
        }
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to sync data',
        details: 'Check server logs for more information'
      });
    }
  } catch (error) {
    console.error('Error syncing data:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add projects sync endpoint
app.post('/api/sync/projects', async (req: Request, res: Response) => {
  try {
    if (!db) {
      console.error('Database not initialized');
      return res.status(503).json({ 
        success: false, 
        error: 'Database not ready. Please try again in a few seconds.' 
      });
    }
    
    console.log('Syncing projects data');
    
    // Clear project cache before syncing
    cacheService.clearProjectData();
    
    try {
      // Here you would use your projects sync function
      // For now, we'll just return success
      return res.json({ 
        success: true, 
        message: 'Projects synced successfully'
      });
    } catch (syncError) {
      console.error('Error in project sync:', syncError);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to sync projects',
        details: syncError instanceof Error ? syncError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error in sync projects endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add endpoint for syncing a specific project
app.post('/api/gripp/sync-project', async (req: Request, res: Response) => {
  try {
    if (!db) {
      console.error('Database not initialized');
      return res.status(503).json({ 
        success: false, 
        error: 'Database not ready. Please try again in a few seconds.' 
      });
    }
    
    const { projectId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectId is required' 
      });
    }
    
    console.log(`Syncing project with ID: ${projectId}`);
    
    try {
      // Here you would use your project sync function for a specific project
      // For now, we'll just return a mock response
      return res.json({ 
        success: true, 
        message: `Project ${projectId} synced successfully`,
        response: {
          id: projectId,
          name: `Project ${projectId}`,
          color: "#336699",
          status: {
            id: 1,
            name: "Active"
          }
        }
      });
    } catch (syncError) {
      console.error(`Error syncing project ${projectId}:`, syncError);
      return res.status(500).json({ 
        success: false, 
        error: `Failed to sync project ${projectId}`,
        details: syncError instanceof Error ? syncError.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error in sync project endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add absence sync endpoint
app.post('/api/sync/absence', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        message: 'startDate and endDate are required' 
      });
    }
    
    console.log(`Syncing absence data for period ${startDate} to ${endDate}`);
    
    try {
      await syncAbsenceRequests(startDate, endDate);
      return res.json({ 
        success: true, 
        message: 'Absence data synced successfully',
        syncedPeriod: {
          startDate,
          endDate
        }
      });
    } catch (error) {
      console.error('Error syncing absence data:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to sync absence data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error in absence sync endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Dashboard projects endpoints
app.get('/api/dashboard/projects/active', async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    console.log('Fetching active projects for dashboard');
    
    // Optioneel forceren van refresh door query parameter (voor testen)
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
    console.log(`Returning ${projects.length} active projects`);
    res.json({ response: projects });
  } catch (error) {
    console.error('Error fetching active projects:', error);
    res.status(500).json({ error: 'Failed to fetch active projects' });
  }
});

app.get('/api/dashboard/projects/:id', async (req: Request, res: Response) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

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

app.post('/api/dashboard/sync/projects', async (req: Request, res: Response) => {
  console.log('Project synchronization requested');
  try {
    if (!db) {
      console.error('Database connection not available for project sync');
      return res.status(503).json({ 
        error: 'Database not connected', 
        message: 'De database connectie is niet beschikbaar. Probeer het later opnieuw.'
      });
    }

    // Voeg Cache-Control headers toe om caching te voorkomen
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.header('Pragma', 'no-cache');
    res.header('Expires', '0');
    res.header('Surrogate-Control', 'no-store');

    console.log('Starting project synchronization via API...');
    
    try {
      // Test de database verbinding
      await db.get('SELECT 1');
      console.log('Database connection verified');
    } catch (dbTestError) {
      console.error('Database connection test failed:', dbTestError);
      return res.status(500).json({ 
        error: 'Database connection error',
        message: 'De database verbinding is niet beschikbaar. Controleer of de database toegankelijk is.',
        details: dbTestError instanceof Error ? dbTestError.message : String(dbTestError)
      });
    }
    
    const syncStartTime = Date.now();
    await projectService.syncProjects(db);
    const syncDuration = Date.now() - syncStartTime;
    
    console.log(`Project synchronization completed successfully in ${syncDuration}ms`);
    
    return res.json({ 
      status: 'ok', 
      message: 'Projects synchronized successfully',
      timestamp: new Date().toISOString(),
      duration_ms: syncDuration
    });
  } catch (error) {
    console.error('Error syncing projects:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    });
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
  
  // Create dashboard router for all dashboard-specific endpoints
  const dashboardRouter = express.Router();
  
  // Add dashboard routes
  dashboardRouter.get('/stats', async (req: Request, res: Response) => {
    try {
      // Return some dummy stats for now
      res.json({
        success: true,
        data: {
          activeEmployees: 133,
          totalHours: 1250,
          totalAbsences: 15
        }
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });
  
  // Add employee month stats endpoint
  dashboardRouter.get('/employee-month-stats', async (req: Request, res: Response) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
      
      console.log(`Fetching employee month stats for ${year}-${month}`);
      
      // If we have a database connection, fetch real data
      if (db) {
        const employees = await db.all(`
          SELECT e.id, e.firstname, e.lastname, 
                 (e.firstname || ' ' || e.lastname) as name,
                 e.function, e.active,
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
          FROM employees e
          LEFT JOIN (
            SELECT c1.*
            FROM contracts c1
            LEFT JOIN contracts c2 ON c1.employee_id = c2.employee_id AND 
                                    (c1.startdate < c2.startdate OR 
                                     (c1.startdate = c2.startdate AND c1.id < c2.id))
            WHERE c2.id IS NULL
          ) c ON e.id = c.employee_id
          WHERE e.active = 1
          ORDER BY e.lastname, e.firstname
        `);
        
        // Get hours entered for this month
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
        
        const hoursData = await db.all(`
          SELECT employee_id, SUM(amount) as total_hours
          FROM hours
      WHERE date >= ? AND date <= ?
          GROUP BY employee_id
        `, [startDate, endDate]);
        
        // Create a map for quick lookup
        const hoursMap = new Map();
        hoursData.forEach(entry => {
          hoursMap.set(entry.employee_id, entry.total_hours);
        });
        
        // Get absence data for the month
        const absences = await db.all(`
          SELECT ar.id, ar.employee_id, ar.createdon as startdate, ar.updatedon as enddate, 
                 arl.amount as hours_per_day, ar.absencetype_searchname as type_name, 
                 ar.description, arl.status_id, arl.status_name
          FROM absence_requests ar
          JOIN absence_request_lines arl ON ar.id = arl.absencerequest_id
          WHERE arl.date BETWEEN ? AND ?
        `, [startDate, endDate]);
        
        // Create a map for absence hours by employee
        const absenceHoursMap = new Map();
        absences.forEach(absence => {
          const currentHours = absenceHoursMap.get(absence.employee_id) || 0;
          absenceHoursMap.set(absence.employee_id, currentHours + absence.hours_per_day);
        });
        
        // Get holidays for the month
        const holidays = await db.all(`
          SELECT * FROM holidays
          WHERE date BETWEEN ? AND ?
        `, [startDate, endDate]);
        
        // Calculate detailed expected hours for an employee in a month based on their contract pattern 
        // (different hours for even/odd weeks)
        function calculateDetailedExpectedHours(
          year: number,
          month: number,
          hours_monday_even: number = 0,
          hours_tuesday_even: number = 0,
          hours_wednesday_even: number = 0,
          hours_thursday_even: number = 0,
          hours_friday_even: number = 0,
          hours_monday_odd: number = 0,
          hours_tuesday_odd: number = 0,
          hours_wednesday_odd: number = 0,
          hours_thursday_odd: number = 0,
          hours_friday_odd: number = 0
        ): number {
          // Create arrays for hourly patterns
          const evenPattern = [0, hours_monday_even, hours_tuesday_even, hours_wednesday_even, hours_thursday_even, hours_friday_even, 0];
          const oddPattern = [0, hours_monday_odd, hours_tuesday_odd, hours_wednesday_odd, hours_thursday_odd, hours_friday_odd, 0];
          
          // Get start and end date for the month
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0); // Last day of month
          
          let totalExpectedHours = 0;
          const currentDate = new Date(startDate);
          
          while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay(); // 0=Sunday, 1=Monday, etc.
            
            // Only count weekdays (Monday-Friday)
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
              // Determine if the week is even or odd
              const weekNumber = getWeekNumber(currentDate);
              const isEvenWeek = weekNumber % 2 === 0;
              
              // Add hours based on even/odd pattern
              if (isEvenWeek) {
                totalExpectedHours += evenPattern[dayOfWeek];
              } else {
                totalExpectedHours += oddPattern[dayOfWeek];
              }
            }
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          return totalExpectedHours;
        }

        // Calculate additional metrics for each employee
        const employeeStats = employees.map(emp => {
          const totalWrittenHours = hoursMap.get(emp.id) || 0;
          const leaveHours = absenceHoursMap.get(emp.id) || 0;
          const workdays = getWorkdaysInMonth(year, month);
          
          // Format contract period
          const contractPeriod = formatContractPeriod(
            emp.contract_startdate, 
            emp.contract_enddate
          );
          
          // Calculate detailed expected hours based on contract pattern (even/odd weeks)
          const detailedExpectedHours = calculateDetailedExpectedHours(
            year, 
            month,
            emp.hours_monday_even || 0,
            emp.hours_tuesday_even || 0,
            emp.hours_wednesday_even || 0,
            emp.hours_thursday_even || 0,
            emp.hours_friday_even || 0,
            emp.hours_monday_odd || 0,
            emp.hours_tuesday_odd || 0,
            emp.hours_wednesday_odd || 0,
            emp.hours_thursday_odd || 0,
            emp.hours_friday_odd || 0
          );
          
          // Calculate contract hours (simple sum for reference)
          const evenWeekHours = [
            emp.hours_monday_even || 0,
            emp.hours_tuesday_even || 0,
            emp.hours_wednesday_even || 0,
            emp.hours_thursday_even || 0,
            emp.hours_friday_even || 0
          ].reduce((sum, h) => sum + h, 0);
          
          const oddWeekHours = [
            emp.hours_monday_odd || 0,
            emp.hours_tuesday_odd || 0,
            emp.hours_wednesday_odd || 0,
            emp.hours_thursday_odd || 0,
            emp.hours_friday_odd || 0
          ].reduce((sum, h) => sum + h, 0);
          
          const contractHours = {
            even: evenWeekHours,
            odd: oddWeekHours,
            average: (evenWeekHours + oddWeekHours) / 2
          };
          
          // Calculate holiday hours based on employee's contract and even/odd pattern
          let holidayHours = 0;
          holidays.forEach(holiday => {
            const holidayDate = new Date(holiday.date);
            const dayOfWeek = holidayDate.getDay(); // 0=Sunday, 1=Monday, etc.
            
            // Skip weekends
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
              // Determine if the holiday falls in an even or odd week
              const weekNumber = getWeekNumber(holidayDate);
              const isEvenWeek = weekNumber % 2 === 0;
              
              // Add hours based on even/odd pattern
              if (isEvenWeek) {
                if (dayOfWeek === 1) holidayHours += emp.hours_monday_even || 0;
                else if (dayOfWeek === 2) holidayHours += emp.hours_tuesday_even || 0;
                else if (dayOfWeek === 3) holidayHours += emp.hours_wednesday_even || 0;
                else if (dayOfWeek === 4) holidayHours += emp.hours_thursday_even || 0;
                else if (dayOfWeek === 5) holidayHours += emp.hours_friday_even || 0;
              } else {
                if (dayOfWeek === 1) holidayHours += emp.hours_monday_odd || 0;
                else if (dayOfWeek === 2) holidayHours += emp.hours_tuesday_odd || 0;
                else if (dayOfWeek === 3) holidayHours += emp.hours_wednesday_odd || 0;
                else if (dayOfWeek === 4) holidayHours += emp.hours_thursday_odd || 0;
                else if (dayOfWeek === 5) holidayHours += emp.hours_friday_odd || 0;
              }
            }
          });
          
          // Calculate final expected hours (detailed expected hours minus holiday hours)
          const expectedHoursExcludingHolidays = detailedExpectedHours - holidayHours;
          
          // Total actual hours = written hours + leave hours
          const totalActualHours = totalWrittenHours + leaveHours;
          
          return {
            ...emp,
            contract_hours: contractHours.average * 5, // Using the average of even/odd week for backward compatibility
            contract_even_week: contractHours.even,
            contract_odd_week: contractHours.odd,
            contract_period: contractPeriod,
            holiday_hours: holidayHours,
            total_hours: totalWrittenHours,
            written_hours: totalWrittenHours,
            actual_hours: totalActualHours,
            leave_hours: leaveHours,
            expected_hours: expectedHoursExcludingHolidays,
            difference: totalActualHours - expectedHoursExcludingHolidays
          };
        });
        
        return res.json(employeeStats);
      } else {
        return res.json([]);
      }
  } catch (error) {
      console.error('Error fetching employee month stats:', error);
      res.status(500).json({ error: 'Failed to fetch employee month stats', message: error.message });
    }
  });
  
  // Attach the dashboard router to the app
  app.use('/api/dashboard', dashboardRouter);
  
  // Direct route for employee month stats for backwards compatibility
  app.get('/api/employee-month-stats', async (req: Request, res: Response) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;
      
      console.log(`Fetching employee month stats for ${year}-${month} using direct route`);
      
      // If we have a database connection, fetch real data
      if (db) {
        const employees = await db.all(`
          SELECT e.id, e.firstname, e.lastname, 
                 (e.firstname || ' ' || e.lastname) as name,
                 e.function, e.active,
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
          FROM employees e
          LEFT JOIN (
            SELECT c1.*
            FROM contracts c1
            LEFT JOIN contracts c2 ON c1.employee_id = c2.employee_id AND 
                                    (c1.startdate < c2.startdate OR 
                                     (c1.startdate = c2.startdate AND c1.id < c2.id))
            WHERE c2.id IS NULL
          ) c ON e.id = c.employee_id
          WHERE e.active = 1
          ORDER BY e.lastname, e.firstname
        `);
        
        // Get hours entered for this month
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
        
        const hoursData = await db.all(`
          SELECT employee_id, SUM(amount) as total_hours
          FROM hours
          WHERE date >= ? AND date <= ?
          GROUP BY employee_id
        `, [startDate, endDate]);
        
        // Create a map for quick lookup
        const hoursMap = new Map();
        hoursData.forEach(entry => {
          hoursMap.set(entry.employee_id, entry.total_hours);
        });
        
        // Get absence data for the month
        const absences = await db.all(`
          SELECT ar.id, ar.employee_id, ar.createdon as startdate, ar.updatedon as enddate, 
                 arl.amount as hours_per_day, ar.absencetype_searchname as type_name, 
                 ar.description, arl.status_id, arl.status_name
          FROM absence_requests ar
          JOIN absence_request_lines arl ON ar.id = arl.absencerequest_id
          WHERE arl.date BETWEEN ? AND ?
        `, [startDate, endDate]);
        
        // Create a map for absence hours by employee
        const absenceHoursMap = new Map();
        absences.forEach(absence => {
          const currentHours = absenceHoursMap.get(absence.employee_id) || 0;
          absenceHoursMap.set(absence.employee_id, currentHours + absence.hours_per_day);
        });
        
        // Get holidays for the month
        const holidays = await db.all(`
          SELECT * FROM holidays
          WHERE date BETWEEN ? AND ?
        `, [startDate, endDate]);
        
        // Calculate detailed expected hours for an employee in a month based on their contract pattern 
        // (different hours for even/odd weeks)
        function calculateDetailedExpectedHours(
          year: number,
          month: number,
          hours_monday_even: number = 0,
          hours_tuesday_even: number = 0,
          hours_wednesday_even: number = 0,
          hours_thursday_even: number = 0,
          hours_friday_even: number = 0,
          hours_monday_odd: number = 0,
          hours_tuesday_odd: number = 0,
          hours_wednesday_odd: number = 0,
          hours_thursday_odd: number = 0,
          hours_friday_odd: number = 0
        ): number {
          // Create arrays for hourly patterns
          const evenPattern = [0, hours_monday_even, hours_tuesday_even, hours_wednesday_even, hours_thursday_even, hours_friday_even, 0];
          const oddPattern = [0, hours_monday_odd, hours_tuesday_odd, hours_wednesday_odd, hours_thursday_odd, hours_friday_odd, 0];
          
          // Get start and end date for the month
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 0); // Last day of month
          
          let totalExpectedHours = 0;
          const currentDate = new Date(startDate);
          
          while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay(); // 0=Sunday, 1=Monday, etc.
            
            // Only count weekdays (Monday-Friday)
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
              // Determine if the week is even or odd
              const weekNumber = getWeekNumber(currentDate);
              const isEvenWeek = weekNumber % 2 === 0;
              
              // Add hours based on even/odd pattern
              if (isEvenWeek) {
                totalExpectedHours += evenPattern[dayOfWeek];
              } else {
                totalExpectedHours += oddPattern[dayOfWeek];
              }
            }
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          return totalExpectedHours;
        }

        // Calculate additional metrics for each employee
        const employeeStats = employees.map(emp => {
          const totalWrittenHours = hoursMap.get(emp.id) || 0;
          const leaveHours = absenceHoursMap.get(emp.id) || 0;
          const workdays = getWorkdaysInMonth(year, month);
          
          // Format contract period
          const contractPeriod = formatContractPeriod(
            emp.contract_startdate, 
            emp.contract_enddate
          );
          
          // Calculate detailed expected hours based on contract pattern (even/odd weeks)
          const detailedExpectedHours = calculateDetailedExpectedHours(
            year, 
            month,
            emp.hours_monday_even || 0,
            emp.hours_tuesday_even || 0,
            emp.hours_wednesday_even || 0,
            emp.hours_thursday_even || 0,
            emp.hours_friday_even || 0,
            emp.hours_monday_odd || 0,
            emp.hours_tuesday_odd || 0,
            emp.hours_wednesday_odd || 0,
            emp.hours_thursday_odd || 0,
            emp.hours_friday_odd || 0
          );
          
          // Calculate contract hours (simple sum for reference)
          const evenWeekHours = [
            emp.hours_monday_even || 0,
            emp.hours_tuesday_even || 0,
            emp.hours_wednesday_even || 0,
            emp.hours_thursday_even || 0,
            emp.hours_friday_even || 0
          ].reduce((sum, h) => sum + h, 0);
          
          const oddWeekHours = [
            emp.hours_monday_odd || 0,
            emp.hours_tuesday_odd || 0,
            emp.hours_wednesday_odd || 0,
            emp.hours_thursday_odd || 0,
            emp.hours_friday_odd || 0
          ].reduce((sum, h) => sum + h, 0);
          
          const contractHours = {
            even: evenWeekHours,
            odd: oddWeekHours,
            average: (evenWeekHours + oddWeekHours) / 2
          };
          
          // Calculate holiday hours based on employee's contract and even/odd pattern
          let holidayHours = 0;
          holidays.forEach(holiday => {
            const holidayDate = new Date(holiday.date);
            const dayOfWeek = holidayDate.getDay(); // 0=Sunday, 1=Monday, etc.
            
            // Skip weekends
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
              // Determine if the holiday falls in an even or odd week
              const weekNumber = getWeekNumber(holidayDate);
              const isEvenWeek = weekNumber % 2 === 0;
              
              // Add hours based on even/odd pattern
              if (isEvenWeek) {
                if (dayOfWeek === 1) holidayHours += emp.hours_monday_even || 0;
                else if (dayOfWeek === 2) holidayHours += emp.hours_tuesday_even || 0;
                else if (dayOfWeek === 3) holidayHours += emp.hours_wednesday_even || 0;
                else if (dayOfWeek === 4) holidayHours += emp.hours_thursday_even || 0;
                else if (dayOfWeek === 5) holidayHours += emp.hours_friday_even || 0;
              } else {
                if (dayOfWeek === 1) holidayHours += emp.hours_monday_odd || 0;
                else if (dayOfWeek === 2) holidayHours += emp.hours_tuesday_odd || 0;
                else if (dayOfWeek === 3) holidayHours += emp.hours_wednesday_odd || 0;
                else if (dayOfWeek === 4) holidayHours += emp.hours_thursday_odd || 0;
                else if (dayOfWeek === 5) holidayHours += emp.hours_friday_odd || 0;
              }
            }
          });
          
          // Calculate final expected hours (detailed expected hours minus holiday hours)
          const expectedHoursExcludingHolidays = detailedExpectedHours - holidayHours;
          
          // Total actual hours = written hours + leave hours
          const totalActualHours = totalWrittenHours + leaveHours;
          
          return {
            ...emp,
            contract_hours: contractHours.average * 5, // Using the average of even/odd week for backward compatibility
            contract_even_week: contractHours.even,
            contract_odd_week: contractHours.odd,
            contract_period: contractPeriod,
            holiday_hours: holidayHours,
            total_hours: totalWrittenHours,
            written_hours: totalWrittenHours,
            actual_hours: totalActualHours,
            leave_hours: leaveHours,
            expected_hours: expectedHoursExcludingHolidays,
            difference: totalActualHours - expectedHoursExcludingHolidays
          };
        });
        
        return res.json(employeeStats);
    } else {
        throw new Error('Database not initialized');
      }
  } catch (error) {
      console.error('Error fetching employee month stats:', error);
      res.status(500).json({ error: 'Failed to fetch employee month stats', message: error.message });
    }
  });
  
  // Add endpoint for employee stats (weekly view)
  app.get('/api/employee-stats', async (req: Request, res: Response) => {
    try {
      const year = parseInt(req.query.year as string) || new Date().getFullYear();
      const week = parseInt(req.query.week as string) || getWeekNumber(new Date());
      
      console.log(`Fetching employee stats for ${year}-${week}`);
      
      // If we have a database connection, fetch real data
      if (db) {
        try {
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
          
          // Get the week dates
          const startDate = getWeekDates(year, week).startDate;
          const endDate = getWeekDates(year, week).endDate;
          
          // Get hours data for the week
          const hoursData = await db.all(`
            SELECT employee_id, date, SUM(amount) as hours
            FROM hours
            WHERE date >= ? AND date <= ?
            GROUP BY employee_id, date
          `, [startDate, endDate]);
          
          // Map hours by employee and date
          const hoursByEmployeeAndDate = new Map();
          hoursData.forEach(entry => {
            const key = `${entry.employee_id}_${entry.date}`;
            hoursByEmployeeAndDate.set(key, entry.hours);
          });
          
          // Sum up total written hours by employee
          const writtenHoursByEmployee = new Map();
          hoursData.forEach(entry => {
            const currentHours = writtenHoursByEmployee.get(entry.employee_id) || 0;
            writtenHoursByEmployee.set(entry.employee_id, currentHours + entry.hours);
          });
          
          // Get absence data for the week
          const absences = await db.all(`
            SELECT ar.id, ar.employee_id, ar.createdon as startdate, ar.updatedon as enddate, 
                   arl.amount as hours_per_day, ar.absencetype_searchname as type_name, 
                   ar.description, arl.status_id, arl.status_name
            FROM absence_requests ar
            JOIN absence_request_lines arl ON ar.id = arl.absencerequest_id
            WHERE arl.date BETWEEN ? AND ?
          `, [startDate, endDate]);
          
          // Create a map for leave hours by employee
          const leaveHoursByEmployee = new Map();
          absences.forEach(absence => {
            const currentHours = leaveHoursByEmployee.get(absence.employee_id) || 0;
            leaveHoursByEmployee.set(absence.employee_id, currentHours + absence.hours_per_day);
          });
          
          // Get holidays for the week
          const holidays = await db.all(`
            SELECT * FROM holidays
            WHERE date BETWEEN ? AND ?
          `, [startDate, endDate]);
          
          // Process employee data
          const employeeData = employees.map(employee => {
            // Calculate if the week is even or odd
            const weekIsEven = week % 2 === 0;
            
            // Get weekly expected hours based on contract
            const weeklyContractHours = calculateWeeklyContractHours(employee, weekIsEven);
            
            // Format contract period
            const contractPeriod = formatContractPeriod(
              employee.contract_startdate, 
              employee.contract_enddate
            );
            
            // Create array for days of the week
            const daysOfWeek = Array.from({ length: 5 }, (_, i) => {
              const day = new Date(startDate);
              day.setDate(day.getDate() + i);
              return day.toISOString().split('T')[0];
            });
            
            // Calculate hours for each day (written hours)
            const dailyHours = daysOfWeek.map(date => {
              const key = `${employee.id}_${date}`;
              return hoursByEmployeeAndDate.get(key) || 0;
            });
            
            // Get leave hours for this employee
            const totalLeaveHours = leaveHoursByEmployee.get(employee.id) || 0;
            
            // Get written hours for this employee
            const totalWrittenHours = writtenHoursByEmployee.get(employee.id) || 0;
            
            // Calculate holiday hours based on contract hours
            const holidayHours = holidays.length > 0 ? calculateHolidayHours(
              new Date(startDate),
              new Date(endDate),
              holidays,
              weekIsEven ? (employee.hours_monday_even || 0) : (employee.hours_monday_odd || 0),
              weekIsEven ? (employee.hours_tuesday_even || 0) : (employee.hours_tuesday_odd || 0),
              weekIsEven ? (employee.hours_wednesday_even || 0) : (employee.hours_wednesday_odd || 0),
              weekIsEven ? (employee.hours_thursday_even || 0) : (employee.hours_thursday_odd || 0),
              weekIsEven ? (employee.hours_friday_even || 0) : (employee.hours_friday_odd || 0)
            ) : 0;
            
            // Calculate total actual hours (written + leave)
            const totalActualHours = totalWrittenHours + totalLeaveHours;
            
            // Calculate expected hours (contract hours - holiday hours)
            // Verlofuren hoeven niet te worden afgetrokken van de verwachte uren,
            // omdat dit al wordt verrekend in de daadwerkelijke uren
            const expectedHours = Math.max(0, weeklyContractHours - holidayHours);
            
            return {
              ...employee,
              week_contract_hours: weeklyContractHours,
              contract_hours: weeklyContractHours,
              contract_period: contractPeriod,
              holiday_hours: holidayHours,
              expected_hours: expectedHours,
              written_hours: totalWrittenHours,
              total_hours: totalActualHours,
              actual_hours: totalActualHours, // Dit is geschreven uren + verlofuren
              leave_hours: totalLeaveHours,
              daily_hours: dailyHours,
              difference: totalActualHours - expectedHours,
              percentage: expectedHours > 0 
                ? Math.round((totalActualHours / expectedHours) * 100) 
                : 0,
              dates: daysOfWeek
            };
          });
          
          return res.json(employeeData);
        } catch (dbError) {
          console.error('Database error in employee-stats endpoint:', dbError);
          throw dbError;
        }
      } else {
        throw new Error('Database not initialized');
      }
    } catch (error) {
      console.error('Error fetching employee stats:', error);
      res.status(500).json({ error: 'Failed to fetch employee stats', message: error.message });
    }
  });

  // Finally, add a catch-all error handler for API routes
  app.use((err: any, req: any, res: Response, next: Function) => {
    console.error('Unhandled API error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message || 'Unknown error occurred'
    });
  });

  // Function to start the server with a given port
  const startServer = (portToUse: number) => {
    return app.listen(portToUse, '0.0.0.0', () => {
      console.log(`API server running on port ${portToUse} and accessible over the network`);
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

/**
 * Calculate the number of workdays in a month (excludes weekends)
 */
function getWorkdaysInMonth(year: number, month: number): number {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of month
  
  let workdays = 0;
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    // Only count weekdays (Monday-Friday)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      workdays++;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return workdays;
}

/**
 * Format contract period for display
 */
function formatContractPeriod(startDate: string | null, endDate: string | null): string {
  if (!startDate) return 'Geen contract';
  
  const start = new Date(startDate);
  const formattedStart = `${start.getDate()}-${start.getMonth() + 1}-${start.getFullYear()}`;
  
  if (endDate) {
    const end = new Date(endDate);
    const formattedEnd = `${end.getDate()}-${end.getMonth() + 1}-${end.getFullYear()}`;
    return `${formattedStart} t/m ${formattedEnd}`;
  }
  
  return `Vanaf ${formattedStart}`;
}

/**
 * Calculate weekly contract hours based on contract data
 */
function calculateWeeklyContractHours(employee: any, weekIsEven: boolean): number {
  if (weekIsEven) {
    return (
      (employee.hours_monday_even || 0) +
      (employee.hours_tuesday_even || 0) +
      (employee.hours_wednesday_even || 0) +
      (employee.hours_thursday_even || 0) +
      (employee.hours_friday_even || 0)
    );
  } else {
    return (
      (employee.hours_monday_odd || 0) +
      (employee.hours_tuesday_odd || 0) +
      (employee.hours_wednesday_odd || 0) +
      (employee.hours_thursday_odd || 0) +
      (employee.hours_friday_odd || 0)
    );
  }
}

/**
 * Calculate holiday hours for an employee based on their contract
 */
function calculateHolidayHours(
  startDate: Date,
  endDate: Date,
  holidays: any[],
  mondayHours: number,
  tuesdayHours: number,
  wednesdayHours: number,
  thursdayHours: number,
  fridayHours: number
): number {
  let totalHolidayHours = 0;
  
  // Map day of week to hours
  const hoursPerDay = [0, mondayHours, tuesdayHours, wednesdayHours, thursdayHours, fridayHours, 0];
  
  holidays.forEach(holiday => {
    const holidayDate = new Date(holiday.date);
    // Skip if holiday is not in our date range
    if (holidayDate < startDate || holidayDate > endDate) return;
    
    const dayOfWeek = holidayDate.getDay(); // 0=Sunday, 1=Monday, etc.
    
    // Only count weekdays (Monday-Friday)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      totalHolidayHours += hoursPerDay[dayOfWeek];
    }
  });
  
  return totalHolidayHours;
}

/**
 * Helper function to get week number from date
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Add the API restart endpoint
app.get('/api/restart', (req, res) => {
  // Genereer eenvoudige HTML-pagina met auto-refresh
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>API Server Restarting</title>
        <meta http-equiv="refresh" content="5;url=/api/health">
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f0f0f0;
          }
          .container {
            text-align: center;
            padding: 2rem;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            max-width: 500px;
          }
          .spinner {
            border: 4px solid rgba(0, 0, 0, 0.1);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border-left-color: #09f;
            animation: spin 1s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .btn {
            background-color: #0099ff;
            border: none;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 20px;
            text-decoration: none;
            display: inline-block;
          }
          .btn:hover {
            background-color: #007acc;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>API Server aan het herstarten</h1>
          <p>Even geduld, de server wordt opnieuw opgestart...</p>
          <div class="spinner"></div>
          <p>Deze pagina vernieuwt automatisch. Als dat niet gebeurt, klik op de knop hieronder.</p>
          <a href="/api/health" class="btn">Check API Status</a>
          
          <script>
            // Start een timer om periodiek te controleren of de API weer beschikbaar is
            let attempts = 0;
            const maxAttempts = 30;
            const interval = setInterval(async () => {
              attempts++;
              try {
                const response = await fetch('/api/health');
                const data = await response.json();
                if (data.status === 'ok') {
                  clearInterval(interval);
                  document.querySelector('.container').innerHTML = 
                    '<h1>API Server Herstart Voltooid</h1>' +
                    '<p>De API server is succesvol herstart.</p>' +
                    '<a href="/" class="btn">Terug naar de applicatie</a>';
                }
              } catch (error) {
                console.log('API nog niet beschikbaar, wachten...');
              }
              
              // Stop na maximaal aantal pogingen
              if (attempts >= maxAttempts) {
                clearInterval(interval);
                document.querySelector('.container').innerHTML = 
                  '<h1>Herstart timeout</h1>' +
                  '<p>De API server lijkt niet te reageren na meerdere pogingen.</p>' +
                  '<a href="/" class="btn">Terug naar de applicatie</a>';
              }
            }, 2000);
          </script>
        </div>
      </body>
    </html>
  `);

  // Initiate the restart process
  console.log('API restart requested');
  console.log('Initiating API server restart...');
  
  // Log the current process ID
  const pid = process.pid;
  console.log(`Current process ID: ${pid}`);
  
  // Find the full path to the script
  const scriptPath = fileURLToPath(import.meta.url);
  console.log(`Script path: ${scriptPath}`);
  
  // Schedule the restart by exiting this process
  console.log('Exiting current API server instance...');
  
  // Exit after a short delay to allow the response to be sent
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

// Add the invoice endpoints
app.get('/api/invoices', async (req, res) => {
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

app.get('/api/invoices/unpaid', async (req, res) => {
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

app.get('/api/invoices/overdue', async (req, res) => {
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