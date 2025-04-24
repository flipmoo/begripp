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
getDatabase()
  .then(async database => {
    db = database;
    console.log('Database connected successfully');
  })
  .catch(error => {
    console.error('Database connection error:', error);
  });

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
 * Add database middleware to all API routes
 */
app.use('/api', requireDatabase(db));

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

app.use('/api/sync', (req, res) => {
  res.redirect(307, '/api/v1/sync');
});

// Dashboard API compatibility routes
app.use('/api/dashboard/projects/active', async (req, res) => {
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

app.use('/api/dashboard/projects/:id', async (req, res) => {
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
      return res.status(500).json({ error: 'Database not connected' });
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
      error: 'Failed to sync projects',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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
