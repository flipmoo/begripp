/**
 * Gripp API Server
 *
 * This server provides a REST API for accessing Gripp data, including:
 * - Employees, contracts, and hours
 * - Projects and invoices
 * - Absence requests and holidays
 *
 * It includes caching, rate limiting, and error handling.
 */

// Express and middleware
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

// Database
import { getDatabase } from '../../db/database';
import { Database as SqliteDatabase } from 'sqlite';

// Utilities
import dotenv from 'dotenv';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Date utilities
import { getWeekDates } from '../../utils/date-utils';

// Services
import { invoiceService } from './services/invoice';
import { projectService } from './services/project';
import { cacheService } from './cache-service';
import debugHours from './debug-hours';

// Configuration
import { API_PORT, killProcessOnPort } from '../../config/ports';
import { syncAllData, syncAbsenceRequests } from '../../services/sync.service';
import { syncService } from '../../services/sync-service';

// Import unified API
import { createApiRouter, GrippApiClient } from '../../db/unified/api';
import { createUnitOfWork } from '../../db/unified/unit-of-work';
import { CacheManager } from '../../db/unified/cache';

// Import child_process for killing processes
import { execSync } from 'child_process';

// Define __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Interface for Gripp API requests
 *
 * Represents the structure of a request to the Gripp API.
 */
interface GrippRequest {
  /** The API method to call */
  method: string;

  /** Parameters to pass to the method */
  params: unknown[];

  /** Request ID for tracking responses */
  id: number;
}

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
const port = process.env.PORT ? parseInt(process.env.PORT) : API_PORT; // Use port from environment variable or central config
console.log(`Using port ${port} for API server`);

// Function to check if a port is in use
async function isPortInUse(port: number): Promise<boolean> {
  try {
    if (process.platform === 'win32') {
      // Windows
      const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`).toString();
      return result.length > 0;
    } else {
      // macOS/Linux
      const result = execSync(`lsof -i:${port} | grep LISTEN`).toString();
      return result.length > 0;
    }
  } catch (error) {
    // If the command fails, it means the port is not in use
    return false;
  }
}

// Log API key (partial, for security)
console.log(`Using API key: ${process.env.GRIPP_API_KEY?.substring(0, 20)}...`);

/**
 * Standard rate limiter for most API endpoints
 *
 * Limits:
 * - 5000 requests per 15 minutes (temporarily increased for development)
 * - Returns 429 status with retry information when exceeded
 */
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Temporarily increased for development
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
 * - 3000 requests per 5 minutes (temporarily increased for development)
 * - Returns 429 status with retry information when exceeded
 */
const dashboardLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3000, // Temporarily increased for development
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
const apiMonitor = (req: Request, res: Response, next: () => void) => {
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

  // Cache control headers are commented out to allow caching
  // res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  // res.header('Pragma', 'no-cache');
  // res.header('Expires', '0');

  next();
});

/**
 * Apply rate limiting to API endpoints
 *
 * Different rate limits are applied based on endpoint type:
 * - Dashboard endpoints get more generous limits
 * - Standard endpoints get stricter limits
 */

// Apply standard rate limiting to all API endpoints as a baseline
app.use('/api/', standardLimiter);

// Apply dashboard-specific rate limiting to dashboard endpoints
app.use('/api/dashboard', dashboardLimiter);

/**
 * Conditional rate limiting for employee stats endpoint
 * Uses dashboard limiter when accessed from dashboard, otherwise standard limiter
 */
app.use('/api/employee-stats', (req, res, next) => {
  if (req.query.dashboard === 'true') {
    dashboardLimiter(req, res, next);
  } else {
    standardLimiter(req, res, next);
  }
});

/**
 * Conditional rate limiting for employee monthly stats endpoint
 * Uses dashboard limiter when accessed from dashboard, otherwise standard limiter
 */
app.use('/api/employee-month-stats', (req, res, next) => {
  if (req.query.dashboard === 'true') {
    dashboardLimiter(req, res, next);
  } else {
    standardLimiter(req, res, next);
  }
});

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
getDatabase()
  .then(async database => {
    db = database;
    console.log('Database connected successfully');
  })
  .catch(error => {
    console.error('Database connection error:', error);
  });

/**
 * Health check endpoint
 *
 * Provides basic server health information including:
 * - Server status
 * - Database connection status
 * - Current timestamp
 * - Server uptime in seconds
 */
app.get('/health', async (req: Request, res: Response) => {
  // Calculate server uptime in seconds
  const uptime = Math.floor((Date.now() - serverStartTime) / 1000);

  try {
    // Check database connection status
    const dbConnected = !!db;

    // Return health information
    res.json({
      status: 'ok',
      database: dbConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      uptime: uptime
    });
  } catch (error) {
    // Log and return error information
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

// Add health check endpoint under /api/v1 prefix for unified API
app.get('/api/v1/health', async (req: Request, res: Response) => {
  const uptime = Math.floor((Date.now() - serverStartTime) / 1000); // in seconds

  try {
    // Check database connection
    const dbConnected = !!db;

    res.json({
      success: true,
      data: {
        status: 'ok',
        version: '1.0.0',
        database: dbConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Cache management endpoints
 *
 * These endpoints allow clearing various cache levels to refresh data
 */

/**
 * Clear all cache data
 *
 * Removes all cached data, forcing fresh data to be fetched
 * from the Gripp API on subsequent requests.
 */
app.post('/api/cache/clear', async (req: Request, res: Response) => {
  try {
    console.log('Clearing all application cache');
    cacheService.clear();

    return res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing cache:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Clear dashboard-specific cache data
 *
 * Removes only dashboard-related cached data, preserving other
 * cached data for better performance.
 */
app.post('/api/cache/clear/dashboard', (req: Request, res: Response) => {
  try {
    console.log('Clearing dashboard data cache');
    cacheService.clearDashboardData();

    return res.json({
      success: true,
      message: 'Dashboard data cache cleared successfully'
    });
  } catch (error) {
    console.error('Error clearing dashboard data cache:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to clear dashboard data cache',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * API monitoring endpoint
 *
 * Provides statistics about API usage including:
 * - Total hits
 * - Unique endpoints
 * - Top 10 most used endpoints
 * - Rate limit configuration
 * - Server uptime
 */
app.get('/api/monitor', async (req: Request, res: Response) => {
  try {
    // Convert endpointHits map to a sorted array (most hits first)
    const endpoints = Array.from(endpointHits.entries())
      .map(([endpoint, hits]) => ({ endpoint, hits }))
      .sort((a, b) => b.hits - a.hits);

    // Calculate total hits across all endpoints
    const totalHits = endpoints.reduce((sum, current) => sum + current.hits, 0);

    // Get top 10 most used endpoints
    const topEndpoints = endpoints.slice(0, 10);

    // Return monitoring data
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),

      // Rate limit configuration
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

      // Usage statistics
      stats: {
        totalHits,
        uniqueEndpoints: endpoints.length,
        topEndpoints
      },

      // Server uptime in seconds
      uptime: Math.floor((Date.now() - serverStartTime) / 1000)
    });
  } catch (error) {
    // Log and return error
    console.error('Monitor endpoint error:', error);

    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Data synchronization endpoint
 *
 * Synchronizes data from Gripp API for a specified date range.
 * Requires startDate and endDate in the request body.
 */
app.post('/api/sync', async (req: Request, res: Response) => {
  try {
    // Check if database is initialized
    if (!db) {
      console.error('Database not initialized');
      return res.status(503).json({
        success: false,
        error: 'Database not ready. Please try again in a few seconds.'
      });
    }

    // Extract date range from request body
    const { startDate, endDate } = req.body;

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required'
      });
    }

    console.log(`Syncing data for period ${startDate} to ${endDate}`);

    // Clear employee data cache to ensure fresh data after sync
    cacheService.clearEmployeeData();

    // Perform the synchronization
    const success = await syncAllData(startDate, endDate);

    // Return appropriate response based on sync result
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
    // Log and return error details
    console.error('Error syncing data:', error);

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add the new sync endpoints
app.use('/api/v2/sync', async (req: Request, res: Response, next) => {
  // Check if database is initialized
  if (!db) {
    console.error('Database not initialized');
    return res.status(503).json({
      success: false,
      error: 'Database not ready. Please try again in a few seconds.'
    });
  }

  // Continue to the sync endpoints
  next();
});

// Legacy projects sync endpoint for backward compatibility
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
      // Use the new sync service
      const success = await syncService.syncProjects();

      return res.json({
        success,
        message: success ? 'Projects synced successfully' : 'Failed to sync projects'
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
      if (!db) {
        return res.status(500).json({
          success: false,
          error: 'Database not initialized'
        });
      }

      // Get project count
      const projectCount = await db.get('SELECT COUNT(*) as count FROM projects WHERE archived = 0');

      // Get employee count
      const employeeCount = await db.get('SELECT COUNT(*) as count FROM employees WHERE active = 1');

      // Get invoice count
      const invoiceCount = await db.get('SELECT COUNT(*) as count FROM invoices');

      // Get projects with deadlines in the past
      const overdueProjects = await db.all(`
        SELECT COUNT(*) as count FROM projects
        WHERE deadline < date('now') AND archived = 0 AND deadline IS NOT NULL
      `);

      // Get projects over budget
      const projectsWithBudget = await db.all(`
        SELECT p.id, p.name, p.number, p.totalexclvat,
               SUM(pl.amount) as total_amount,
               SUM(pl.amountwritten) as total_written
        FROM projects p
        JOIN projectlines pl ON p.id = pl.project_id
        WHERE p.archived = 0
        GROUP BY p.id
        HAVING total_written > total_amount
      `);

      // Get projects with rules over budget
      const projectsWithRulesOverBudget = await db.all(`
        SELECT DISTINCT p.id, p.name, p.number
        FROM projects p
        JOIN projectlines pl ON p.id = pl.project_id
        WHERE p.archived = 0 AND pl.amountwritten > pl.amount
      `);

      // Get projects on schedule
      const onScheduleProjects = await db.all(`
        SELECT COUNT(*) as count FROM projects
        WHERE archived = 0 AND (deadline IS NULL OR deadline >= date('now'))
      `);

      res.json({
        success: true,
        data: {
          totalProjects: projectCount.count || 0,
          activeEmployees: employeeCount.count || 0,
          overdueDeadlines: overdueProjects[0].count || 0,
          projectsOverBudget: projectsWithBudget.length || 0,
          projectsWithRulesOverBudget: projectsWithRulesOverBudget.length || 0,
          onScheduleProjects: onScheduleProjects[0].count || 0,
          invoiceCount: invoiceCount.count || 0,
          timestamp: new Date().toISOString()
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
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

        // Check if debug mode is enabled
        const debug = req.query.debug === 'true';

        // Always include all statuses by default
        const includeAllStatuses = true;
        const statusId = null;

        let hoursData;
        let hourDetails = [];

        if (debug) {
          // Get detailed hour information for debugging
          // Always include all statuses
          hourDetails = await db.all(`
            SELECT id, employee_id, date, amount, description, status_id, status_name
            FROM hours
            WHERE date >= ? AND date <= ?
            ORDER BY employee_id, date
          `, [startDate, endDate]);

          // Also get the summary for normal processing
          // Always include all statuses
          hoursData = await db.all(`
            SELECT employee_id, SUM(amount) as total_hours,
                   GROUP_CONCAT(DISTINCT status_name) as status_names,
                   COUNT(DISTINCT status_id) as status_count
            FROM hours
            WHERE date >= ? AND date <= ?
            GROUP BY employee_id
          `, [startDate, endDate]);
        } else {
          // Normal operation - just get the summary
          // Always include all hours regardless of status
          hoursData = await db.all(`
            SELECT employee_id, SUM(amount) as total_hours
            FROM hours
            WHERE date >= ? AND date <= ?
            GROUP BY employee_id
          `, [startDate, endDate]);
        }

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

        // Include debug information if requested
        if (debug) {
          console.log(`Debug mode enabled for dashboard employee-month-stats, year=${year}, month=${month}`);

          // Filter hour details for specific employee if requested
          const filteredHourDetails = req.query.employee_id
            ? hourDetails.filter(h => h.employee_id === parseInt(req.query.employee_id as string))
            : hourDetails;

          // Calculate hours by status
          const hoursByStatus = {};
          filteredHourDetails.forEach(hour => {
            const status = hour.status_name || 'Unknown';
            hoursByStatus[status] = (hoursByStatus[status] || 0) + hour.amount;
          });

          return res.json({
            debug: {
              period: { year, month, startDate, endDate },
              hourDetails: filteredHourDetails,
              hoursByStatus: hoursByStatus,
              employeeId: req.query.employee_id ? parseInt(req.query.employee_id as string) : null
            },
            response: employeeStats
          });
        } else {
          return res.json(employeeStats);
        }
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

        // Check if debug mode is enabled
        const debug = req.query.debug === 'true';

        // Always include all statuses by default
        const includeAllStatuses = true;
        const statusId = null;

        let hoursData;
        let hourDetails = [];

        if (debug) {
          // Get detailed hour information for debugging
          // Always include all statuses
          hourDetails = await db.all(`
            SELECT id, employee_id, date, amount, description, status_id, status_name
            FROM hours
            WHERE date >= ? AND date <= ?
            ORDER BY employee_id, date
          `, [startDate, endDate]);

          // Also get the summary for normal processing
          // Always include all statuses
          hoursData = await db.all(`
            SELECT employee_id, SUM(amount) as total_hours,
                   GROUP_CONCAT(DISTINCT status_name) as status_names,
                   COUNT(DISTINCT status_id) as status_count
            FROM hours
            WHERE date >= ? AND date <= ?
            GROUP BY employee_id
          `, [startDate, endDate]);
        } else {
          // Normal operation - just get the summary
          // Always include all hours regardless of status
          hoursData = await db.all(`
            SELECT employee_id, SUM(amount) as total_hours
            FROM hours
            WHERE date >= ? AND date <= ?
            GROUP BY employee_id
          `, [startDate, endDate]);
        }

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

        // Include debug information if requested
        if (debug) {
          console.log(`Debug mode enabled for employee-month-stats, year=${year}, month=${month}`);

          // Filter hour details for specific employee if requested
          const filteredHourDetails = req.query.employee_id
            ? hourDetails.filter(h => h.employee_id === parseInt(req.query.employee_id as string))
            : hourDetails;

          // Calculate hours by status
          const hoursByStatus = {};
          filteredHourDetails.forEach(hour => {
            const status = hour.status_name || 'Unknown';
            hoursByStatus[status] = (hoursByStatus[status] || 0) + hour.amount;
          });

          return res.json({
            debug: {
              period: { year, month, startDate, endDate },
              hourDetails: filteredHourDetails,
              hoursByStatus: hoursByStatus,
              employeeId: req.query.employee_id ? parseInt(req.query.employee_id as string) : null
            },
            response: employeeStats
          });
        } else {
          return res.json(employeeStats);
        }
    } else {
        throw new Error('Database not initialized');
      }
  } catch (error) {
      console.error('Error fetching employee month stats:', error);
      res.status(500).json({ error: 'Failed to fetch employee month stats', message: error.message });
    }
  });

  // Debug endpoint to check hours in the database and compare with Gripp
  app.get('/api/debug/hours', async (req: Request, res: Response) => {
    try {
      if (!db) {
        return res.status(500).json({ error: 'Database not connected' });
      }

      // Use the enhanced debug hours function
      return await debugHours(req, res, db);
    } catch (error) {
      console.error('Error in debug hours endpoint:', error);
      return res.status(500).json({
        error: 'Failed to fetch debug hours data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
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

  /**
   * Start the server on the specified port
   *
   * This function:
   * 1. Attempts to start the server on the specified port
   * 2. Handles port conflicts by attempting to kill the existing process
   * 3. Retries server startup after resolving conflicts
   *
   * @param portToUse - The port number to use for the server
   * @returns The Express server instance
   */
  const startServer = (portToUse: number) => {
    return app.listen(portToUse, '0.0.0.0', () => {
      // Log successful server start
      console.log(`API server running on port ${portToUse} and accessible over the network`);
    }).on('error', async (error: any) => {
      // Handle server startup errors
      if (error.code === 'EADDRINUSE') {
        // Port conflict error
        console.error(`Port ${portToUse} is already in use. Killing existing process and retrying...`);

        try {
          // Attempt to kill the process using the port
          await killProcessOnPort(portToUse);
          console.log(`Killed process on port ${portToUse}, retrying in 1 second...`);

          // Retry server startup after a short delay
          setTimeout(() => {
            startServer(portToUse);
          }, 1000);
        } catch (killError) {
          // Failed to kill the process
          console.error(`Failed to kill process on port ${portToUse}:`, killError);
          console.error(`Cannot start API server. Please manually kill process on port ${portToUse}`);
          process.exit(1); // Exit with error code
        }
      } else {
        // Other server startup error
        console.error('Failed to start API server:', error);
        process.exit(1); // Exit with error code
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

  holidays.forEach(holiday => {
    const holidayDate = new Date(holiday.date);
    // Skip if holiday is not in our date range
    if (holidayDate < startDate || holidayDate > endDate) return;

    const dayOfWeek = holidayDate.getDay(); // 0=Sunday, 1=Monday, etc.

    // Only count weekdays (Monday-Friday)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // Voor nationale feestdagen tellen we standaard 8 uur per dag voor alle medewerkers,
      // ongeacht of ze fulltime of parttime werken
      totalHolidayHours += 8;
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

/**
 * API Server Restart Endpoint
 *
 * Provides a way to restart the API server gracefully.
 * Returns an HTML page that shows restart status and automatically
 * checks when the server is back online.
 */
app.get('/api/restart', (req, res) => {
  // Generate HTML page with auto-refresh and status checking
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
            // Periodically check if the API is back online
            let attempts = 0;
            const maxAttempts = 30;
            const interval = setInterval(async () => {
              attempts++;
              try {
                // Try to fetch the health endpoint
                const response = await fetch('/api/health');
                const data = await response.json();

                // If server is back online, show success message
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

              // Stop checking after maximum attempts
              if (attempts >= maxAttempts) {
                clearInterval(interval);
                document.querySelector('.container').innerHTML =
                  '<h1>Herstart timeout</h1>' +
                  '<p>De API server lijkt niet te reageren na meerdere pogingen.</p>' +
                  '<a href="/" class="btn">Terug naar de applicatie</a>';
              }
            }, 2000); // Check every 2 seconds
          </script>
        </div>
      </body>
    </html>
  `);

  // Log restart process
  console.log('API restart requested');
  console.log('Initiating API server restart...');

  // Log process information for debugging
  const pid = process.pid;
  console.log(`Current process ID: ${pid}`);

  // Log script path for debugging
  const scriptPath = fileURLToPath(import.meta.url);
  console.log(`Script path: ${scriptPath}`);

  // Schedule graceful shutdown
  console.log('Exiting current API server instance...');

  // Exit after a short delay to allow the response to be sent
  setTimeout(() => {
    process.exit(0); // Exit with success code
  }, 1000);
});

/**
 * Invoice Endpoints
 *
 * These endpoints provide access to invoice data from Gripp.
 */

/**
 * Get all invoices with optional year filtering
 *
 * Returns a list of invoices, optionally filtered by year.
 * If no year is specified, returns invoices from 2024 onwards.
 */
app.get('/api/invoices', async (req, res) => {
  try {
    console.log('API server: Fetching invoices');
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

    res.json({
      success: true,
      data: response.result.rows,
      meta: {
        count: response.result.count,
        fromCache: false
      }
    });
    } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

/**
 * Get unpaid invoices with optional year filtering
 *
 * Returns a list of unpaid invoices (invoices that have not been fully paid).
 * Can be filtered by year if the year parameter is provided.
 */
app.get('/api/invoices/unpaid', async (req, res) => {
  try {
    console.log('API server: Fetching unpaid invoices');

    // Parse year parameter if provided
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;

    // Just use the invoiceService which now includes client-side filtering
    const response = await invoiceService.getUnpaid(year);
    res.json({
      success: true,
      data: response.result.rows,
      meta: {
        count: response.result.count,
        fromCache: false
      }
    });
  } catch (error) {
    console.error('Error fetching unpaid invoices:', error);
    res.status(500).json({ error: 'Failed to fetch unpaid invoices' });
  }
});

/**
 * Get overdue invoices with optional year filtering
 *
 * Returns a list of overdue invoices (unpaid invoices past their due date).
 * Can be filtered by year if the year parameter is provided.
 */
app.get('/api/invoices/overdue', async (req, res) => {
  try {
    console.log('API server: Fetching overdue invoices');

    // Parse year parameter if provided
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;

    // Just use the invoiceService which now includes client-side filtering
    const response = await invoiceService.getOverdue(year);
    res.json({
      success: true,
      data: response.result.rows,
      meta: {
        count: response.result.count,
        fromCache: false
      }
    });
  } catch (error) {
    console.error('Error fetching overdue invoices:', error);
    res.status(500).json({ error: 'Failed to fetch overdue invoices' });
  }
});

/**
 * Initialize the unified API
 *
 * Sets up the unified API router with the necessary dependencies.
 */
let unifiedApiInitialized = false;

// We'll initialize the unified API after the server is started
// to avoid blocking the server startup process

/**
 * Start the server
 *
 * Starts the Express server on the configured port.
 * Logs server information to the console.
 */
async function startServer() {
  try {
    // Check if port is in use
    const portInUse = await isPortInUse(port);

    if (portInUse) {
      console.log(`Port ${port} is already in use. Killing existing process...`);

      try {
        // Force kill any process on the port
        if (process.platform === 'win32') {
          execSync(`netstat -ano | findstr :${port} | findstr LISTENING && FOR /F "tokens=5" %p in ('netstat -ano | findstr :${port} | findstr LISTENING') DO taskkill /F /PID %p`);
        } else {
          execSync(`lsof -t -i:${port} | xargs kill -9 2>/dev/null || echo "No process on port ${port}"`);
        }
        console.log(`Killed process on port ${port}, waiting 1 second before starting server...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to kill process on port ${port}:`, error);
      }
    }

    // Start the server
    const server = app.listen(port, () => {
      console.log(`API server running on port ${port} and accessible over the network`);

      // Initialize the unified API after the server is started
      getDatabase()
        .then(async database => {
          db = database;
          console.log('Database initialized successfully on server startup');

          try {
            if (unifiedApiInitialized) {
              console.log('Unified API already initialized');
              return;
            }

            console.log('Initializing unified API...');

            // Create the unit of work
            const unitOfWork = createUnitOfWork(db);

            // Create the API client
            const apiClient = new GrippApiClient(process.env.GRIPP_API_KEY || '');

            // Create the cache manager
            const cacheManager = new CacheManager();

            // Create the API router
            const apiRouter = createApiRouter(unitOfWork, apiClient, cacheManager);

            // Mount the API router
            app.use('/api/v1', apiRouter);

            console.log('Unified API initialized successfully');
            unifiedApiInitialized = true;
          } catch (error) {
            console.error('Error initializing unified API:', error);
          }
        })
        .catch(error => {
          console.error('Database initialization error:', error);
        });
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please close the application using this port and try again.`);
        process.exit(1);
      } else {
        console.error('Server error:', error);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();