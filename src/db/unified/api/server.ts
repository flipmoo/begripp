/**
 * API Server
 *
 * This file provides a function to create an Express server for the API.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import { Database } from 'sqlite';
import { createUnitOfWork } from '../unit-of-work';
import { ProjectAdapter, EmployeeAdapter, HourAdapter, InvoiceAdapter } from './adapters';
import { getDatabase } from '../database';
import { GrippApiClient } from './gripp-client';
import employeeRoutes from './routes/employees';

/**
 * Create an API server
 *
 * @param port The port to listen on
 * @param useMock Whether to use mock repositories
 * @returns A promise that resolves to the Express server
 */
export async function createApiServer(port: number = 3002, useMock: boolean = false): Promise<Express> {
  // Create Express server
  const app = express();

  // Enable CORS
  app.use(cors());

  // Enable compression
  app.use(compression());

  // Parse JSON body
  app.use(express.json());

  // Add request timeout
  app.use((req, res, next) => {
    // Set timeout to 60 seconds
    req.setTimeout(60000);

    // Add timeout handler
    const timeout = setTimeout(() => {
      console.error(`Request to ${req.url} timed out after 60 seconds`);

      // Only send timeout response if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          error: {
            message: 'Request timed out',
            code: 'TIMEOUT',
            details: {
              url: req.url,
              method: req.method,
              timeout: 60000
            }
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }
    }, 60000);

    // Clear timeout when response is sent
    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  });

  // Add error handling middleware
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('API Error:', err);
    res.status(500).json({
      success: false,
      error: {
        message: err.message || 'Internal Server Error',
        code: 'INTERNAL_SERVER_ERROR',
        details: process.env.NODE_ENV === 'production' ? undefined : err.stack
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  });

  // Get database connection if not using mock repositories
  let db: Database | undefined;
  if (!useMock) {
    try {
      db = await getDatabase();
    } catch (error) {
      console.error('Error connecting to database:', error);
      console.warn('Falling back to mock repositories');
      useMock = true;
    }
  }

  // Create Unit of Work
  const unitOfWork = await createUnitOfWork(db, useMock);

  // Create Gripp API client
  const apiClient = new GrippApiClient(
    'mi3Pq0Pfw6CtuFAtEoQ6gXIT7cra2c',
    'https://api.gripp.com/public/api3.php'
  );

  // Create adapters
  const projectAdapter = new ProjectAdapter(unitOfWork, apiClient);
  const employeeAdapter = new EmployeeAdapter(unitOfWork);
  const hourAdapter = new HourAdapter(unitOfWork);
  const invoiceAdapter = new InvoiceAdapter(unitOfWork, apiClient);

  // Define routes
  app.get('/api/v1', (req, res) => {
    res.json({
      message: 'Welcome to the API',
      version: '1.0.0',
      endpoints: [
        '/api/v1/projects',
        '/api/v1/employees',
        '/api/v1/hours',
        '/api/v1/invoices'
      ]
    });
  });

  // Sync routes
  app.post('/api/v1/sync', (req, res, next) => {
    try {
      console.log('Sync request received:', req.body);

      // Check which entity to sync
      const entity = req.body.entity || 'project';

      if (entity === 'invoice') {
        console.log('Syncing invoices...');
        invoiceAdapter.sync(req.body).then(result => {
          res.json(result);
        }).catch(error => {
          next(error);
        });
      } else {
        // Default to project sync
        console.log('Syncing projects...');
        projectAdapter.sync(req.body).then(result => {
          res.json(result);
        }).catch(error => {
          next(error);
        });
      }
    } catch (error) {
      next(error);
    }
  });

  // Sync projects route
  app.post('/api/v1/sync/projects', (req, res, next) => {
    try {
      console.log('Sync projects request received:', req.body);
      projectAdapter.sync(req.body).then(result => {
        res.json(result);
      }).catch(error => {
        next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  // Sync invoices route
  app.post('/api/v1/sync/invoices', (req, res, next) => {
    try {
      console.log('Sync invoices request received:', req.body);
      invoiceAdapter.sync(req.body).then(result => {
        res.json(result);
      }).catch(error => {
        next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  // Cache clear route
  app.post('/api/v1/cache/clear', (req, res, next) => {
    try {
      console.log('Cache clear request received:', req.body);
      const entity = req.body.entity || 'all';

      if (entity === 'project' || entity === 'invoice' || entity === 'all') {
        const promises = [];

        if (entity === 'project' || entity === 'all') {
          promises.push(projectAdapter.clearCache());
        }

        if (entity === 'invoice' || entity === 'all') {
          promises.push(invoiceAdapter.clearCache());
        }

        Promise.all(promises).then(() => {
          res.json({
            success: true,
            data: {
              message: `Cache cleared for ${entity}`
            },
            meta: {
              timestamp: new Date().toISOString()
            }
          });
        }).catch(error => {
          next(error);
        });
      } else {
        res.json({
          success: true,
          data: {
            message: `Entity ${entity} not supported for cache clearing`
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }
    } catch (error) {
      next(error);
    }
  });

  // Project routes
  // Project over-budget routes - need to be defined before the :id route
  app.get('/api/v1/projects/over-budget', async (req, res, next) => {
    try {
      console.log('Projects over-budget endpoint called');

      // Add timeout handling
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timed out after 60 seconds'));
        }, 60000);
      });

      // Race between the actual request and the timeout
      try {
        const result = await Promise.race([
          projectAdapter.getOverBudgetProjects(),
          timeoutPromise
        ]);

        // Add cache-busting headers
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.json(result);
      } catch (error) {
        if (error.message === 'Request timed out after 60 seconds') {
          console.error('Projects over-budget request timed out');
          res.status(504).json({
            success: false,
            error: {
              message: 'Request timed out',
              code: 'TIMEOUT',
              details: { endpoint: '/api/v1/projects/over-budget' }
            },
            meta: {
              timestamp: new Date().toISOString()
            }
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error in projects over-budget endpoint:', error);
      next(error);
    }
  });

  // Project rules over-budget routes - need to be defined before the :id route
  app.get('/api/v1/projects/rules-over-budget', async (req, res, next) => {
    try {
      console.log('Projects with rules over-budget endpoint called');

      // Add timeout handling
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timed out after 60 seconds'));
        }, 60000);
      });

      // Race between the actual request and the timeout
      try {
        const result = await Promise.race([
          projectAdapter.getProjectsWithRulesOverBudget(),
          timeoutPromise
        ]);

        // Add cache-busting headers
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.json(result);
      } catch (error) {
        if (error.message === 'Request timed out after 60 seconds') {
          console.error('Projects with rules over-budget request timed out');
          res.status(504).json({
            success: false,
            error: {
              message: 'Request timed out',
              code: 'TIMEOUT',
              details: { endpoint: '/api/v1/projects/rules-over-budget' }
            },
            meta: {
              timestamp: new Date().toISOString()
            }
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error in projects with rules over-budget endpoint:', error);
      next(error);
    }
  });

  // Standard project routes with timeout handling
  app.get('/api/v1/projects', async (req, res, next) => {
    try {
      console.log('Projects endpoint called with query:', req.query);

      // Add timeout handling
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timed out after 60 seconds'));
        }, 60000);
      });

      // Race between the actual request and the timeout
      try {
        const result = await Promise.race([
          projectAdapter.getAll(req.query),
          timeoutPromise
        ]);

        // Add cache-busting headers
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.json(result);
      } catch (error) {
        if (error.message === 'Request timed out after 60 seconds') {
          console.error('Projects request timed out');
          res.status(504).json({
            success: false,
            error: {
              message: 'Request timed out',
              code: 'TIMEOUT',
              details: { query: req.query }
            },
            meta: {
              timestamp: new Date().toISOString()
            }
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error in projects endpoint:', error);
      next(error);
    }
  });

  app.get('/api/v1/projects/:id', projectAdapter.getById.bind(projectAdapter));
  app.post('/api/v1/projects', projectAdapter.create.bind(projectAdapter));
  app.put('/api/v1/projects/:id', projectAdapter.update.bind(projectAdapter));
  app.delete('/api/v1/projects/:id', projectAdapter.delete.bind(projectAdapter));

  // Employee routes
  // Add middleware to inject dependencies for all employee routes
  app.use('/api/v1/employees', (req: Request, res: Response, next: NextFunction) => {
    // Inject dependencies into request object
    (req as any).unitOfWork = unitOfWork;
    (req as any).apiClient = apiClient;
    (req as any).cacheManager = null; // We don't use cache for now
    next();
  });

  // Month stats endpoint - needs to be defined before the employee routes with :id parameter
  app.get('/api/v1/employees/month-stats', async (req, res, next) => {
    try {
      console.log('Month stats endpoint called');

      // Get current date if no year/month provided
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

      // Use provided year/month or defaults
      const year = req.query.year ? Number(req.query.year) : currentYear;
      const month = req.query.month ? Number(req.query.month) : currentMonth;

      // Validate parameter types
      if (isNaN(year) || isNaN(month)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid parameters: year and month must be numbers',
            code: 'INVALID_PARAMETERS',
            details: { year: req.query.year, month: req.query.month }
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      // Get all employees
      const employees = await employeeAdapter.getAll();

      if (!employees.success) {
        return res.status(500).json({
          success: false,
          error: {
            message: 'Failed to fetch employees',
            code: 'EMPLOYEE_FETCH_ERROR',
            details: employees.error
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      // Calculate month stats for each employee
      const monthStats = employees.data.map(employee => {
        // Default stats
        return {
          id: employee.id,
          name: employee.name,
          contractHours: employee.contractHours || 40,
          hoursWritten: 0,
          hoursToWrite: 0,
          leaveHours: 0,
          nationalHolidayHours: 0
        };
      });

      // Add cache-busting headers
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Return response
      res.json({
        success: true,
        data: monthStats,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error in month stats endpoint:', error);
      next(error);
    }
  });

  // Unwritten hours endpoint - needs to be defined before the employee routes with :id parameter
  app.get('/api/v1/employees/unwritten-hours', async (req, res, next) => {
    try {
      console.log('Unwritten hours endpoint called');

      // Get current date if no year/month provided
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed

      // Use provided year/month or defaults
      const year = req.query.year ? Number(req.query.year) : currentYear;
      const month = req.query.month ? Number(req.query.month) : currentMonth;

      // Validate parameter types
      if (isNaN(year) || isNaN(month)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid parameters: year and month must be numbers',
            code: 'INVALID_PARAMETERS',
            details: { year: req.query.year, month: req.query.month }
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      // Get all active employees
      const employeesResult = await employeeAdapter.getAll({ active: 'true' });

      if (!employeesResult.success) {
        return res.status(500).json({
          success: false,
          error: {
            message: 'Failed to fetch employees',
            code: 'INTERNAL_SERVER_ERROR'
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      const employees = employeesResult.data;

      // Calculate start and end dates for the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      // Format dates for query
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Get all hours for the month
      const hoursResult = await hourAdapter.getAll({
        startDate: startDateStr,
        endDate: endDateStr
      });

      if (!hoursResult.success) {
        return res.status(500).json({
          success: false,
          error: {
            message: 'Failed to fetch hours',
            code: 'INTERNAL_SERVER_ERROR'
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      const hours = hoursResult.data;

      // Calculate working days in the month (excluding weekends)
      const workingDays = [];
      let currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
          workingDays.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Calculate unwritten hours for each employee
      const employeesWithUnwrittenHours = employees.map(employee => {
        // Get employee's contract hours
        const contractHours = employee.contractHours || 40;

        // Calculate expected hours for the month
        const expectedHours = (contractHours / 5) * workingDays.length;

        // Get hours written by this employee
        const employeeHours = hours.filter(hour => hour.employee && hour.employee.id === employee.id);
        const writtenHours = employeeHours.reduce((sum, hour) => sum + (hour.amount || 0), 0);

        // Calculate unwritten hours
        const unwrittenHours = Math.max(0, expectedHours - writtenHours);

        return {
          id: employee.id,
          name: employee.name,
          function: employee.function,
          contractHours,
          expectedHours,
          writtenHours,
          unwrittenHours,
          active: employee.active
        };
      });

      // Filter employees with unwritten hours
      const filteredEmployees = employeesWithUnwrittenHours.filter(emp => emp.unwrittenHours > 0);

      // Sort by unwritten hours (descending)
      filteredEmployees.sort((a, b) => b.unwrittenHours - a.unwrittenHours);

      // Add cache-busting headers
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      // Send response
      res.json({
        success: true,
        data: filteredEmployees,
        meta: {
          timestamp: new Date().toISOString(),
          year,
          month,
          workingDays: workingDays.length
        }
      });
    } catch (error) {
      console.error('Error in unwritten hours endpoint:', error);
      next(error);
    }
  });

  // Mount the main employees route
  app.get('/api/v1/employees', employeeAdapter.getAll.bind(employeeAdapter));

  // Special routes that need to be defined before the :id route
  app.get('/api/v1/employees/week-stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate required parameters
      if (!req.query.year || !req.query.week) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Missing required parameters: year and week are required',
            code: 'MISSING_PARAMETERS',
            details: { query: req.query }
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      // Validate parameter types
      const year = Number(req.query.year);
      const week = Number(req.query.week);

      if (isNaN(year) || isNaN(week)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid parameters: year and week must be numbers',
            code: 'INVALID_PARAMETERS',
            details: { year: req.query.year, week: req.query.week }
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      // Process request
      const result = await employeeAdapter.getForWeek({
        ...req.query,
        year: year,
        week: week,
        dashboard: 'true'
      });

      // Add a cache-busting header to force the browser to reload the data
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.json(result);
    } catch (error) {
      console.error('Error in week-stats endpoint:', error);
      next(error);
    }
  });

  app.get('/api/v1/employees/month-stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate required parameters
      if (!req.query.year || !req.query.month) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Missing required parameters: year and month are required',
            code: 'MISSING_PARAMETERS',
            details: { query: req.query }
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      // Validate parameter types
      const year = Number(req.query.year);
      const month = Number(req.query.month);

      if (isNaN(year) || isNaN(month)) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid parameters: year and month must be numbers',
            code: 'INVALID_PARAMETERS',
            details: { year: req.query.year, month: req.query.month }
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      // Process request
      const result = await employeeAdapter.getForMonth({
        ...req.query,
        year: year,
        month: month,
        dashboard: 'true'
      });

      // Add a cache-busting header to force the browser to reload the data
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.json(result);
    } catch (error) {
      console.error('Error in month-stats endpoint:', error);
      next(error);
    }
  });

  // Mount the rest of the employee routes
  app.use('/api/v1/employees', employeeRoutes);

  // Note: All employee routes are now handled by the router in ./routes/employees.js

  // Invoice routes
  app.get('/api/v1/invoices', async (req, res, next) => {
    try {
      console.log('Invoices endpoint called');

      // Add pagination limit if not specified
      if (!req.query.limit) {
        req.query.limit = '50'; // Increase default limit to avoid timeouts
      }

      // Add timeout handling
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Request timed out after 30 seconds'));
        }, 30000);
      });

      // Race between the actual request and the timeout
      try {
        const result = await Promise.race([
          invoiceAdapter.getAll(req.query),
          timeoutPromise
        ]);

        // Add cache-busting headers
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        res.json(result);
      } catch (error) {
        if (error.message === 'Request timed out after 30 seconds') {
          console.error('Invoice request timed out');
          res.status(504).json({
            success: false,
            error: {
              message: 'Request timed out',
              code: 'TIMEOUT',
              details: { query: req.query }
            },
            meta: {
              timestamp: new Date().toISOString()
            }
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error in invoices endpoint:', error);
      next(error);
    }
  });
  app.get('/api/v1/invoices/:id', async (req, res, next) => {
    try {
      console.log(`Direct invoice endpoint called for ID ${req.params.id}`);

      // Get invoice ID
      const invoiceId = Number(req.params.id);

      // Execute direct database query
      try {
        // Use the database connection directly
        const result = await db.get(
          `SELECT id, number, date, dueDate, due_date, company, company_id, company_name,
          companyName, totalExclVat, totalInclVat, amount, taxAmount, tax_amount,
          totalAmount, status, isPaid, isOverdue, totalOpenInclVat, subject
          FROM invoices WHERE id = ?`,
          invoiceId
        );

        if (!result) {
          console.log(`Invoice with ID ${invoiceId} not found`);
          return res.status(404).json({
            success: false,
            error: {
              message: `Invoice with ID ${invoiceId} not found`,
              code: 'NOT_FOUND',
              details: { id: invoiceId }
            },
            meta: {
              timestamp: new Date().toISOString()
            }
          });
        }

        console.log(`Found invoice ${invoiceId}: ${result.number}`);

        // Create a simplified invoice object
        const mappedInvoice = {
          id: result.id,
          number: result.number,
          date: result.date,
          dueDate: result.dueDate || result.due_date,
          company: result.company,
          company_id: result.company_id || result.company,
          company_name: result.company_name || result.companyName,
          totalAmount: result.totalAmount || result.totalInclVat || 0,
          status: result.status,
          isPaid: result.isPaid || 0,
          isOverdue: result.isOverdue || 0,
          totalOpenInclVat: result.totalOpenInclVat,
          subject: result.subject || ''
        };

        // Create response
        const response = {
          success: true,
          data: mappedInvoice,
          meta: {
            timestamp: new Date().toISOString()
          }
        };

        // Send response
        console.log(`Sending response for invoice ${invoiceId}`);
        res.json(response);
      } catch (error) {
        console.error(`Error getting invoice with ID ${req.params.id}:`, error);
        next(error);
      }
    } catch (error) {
      console.error(`Error in direct invoice endpoint for ID ${req.params.id}:`, error);
      next(error);
    }
  });
  app.post('/api/v1/invoices', (req, res, next) => {
    try {
      invoiceAdapter.create(req, res);
    } catch (error) {
      next(error);
    }
  });
  app.put('/api/v1/invoices/:id', (req, res, next) => {
    try {
      invoiceAdapter.update(req, res);
    } catch (error) {
      next(error);
    }
  });
  app.delete('/api/v1/invoices/:id', (req, res, next) => {
    try {
      invoiceAdapter.delete(req, res);
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/v1/invoices/:id/lines', (req, res, next) => {
    try {
      invoiceAdapter.getInvoiceLines(req, res);
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/v1/companies/:id/invoices', (req, res, next) => {
    try {
      invoiceAdapter.getByCompanyId(req, res);
    } catch (error) {
      next(error);
    }
  });

  // Add health endpoint
  app.get('/api/v1/health', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        database: db ? 'connected' : 'disconnected',
        uptime: Math.floor(process.uptime()),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  });

  // Add debug endpoint
  app.get('/api/v1/debug', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        database: db ? 'connected' : 'disconnected',
        uptime: Math.floor(process.uptime()),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        memory: process.memoryUsage(),
        projectAdapter: {
          entityName: 'project',
          hasApiClient: true,
          hasSyncService: true
        }
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  });

  // Add health endpoint (old path)
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      database: db ? 'connected' : 'disconnected',
      uptime: Math.floor(process.uptime()),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Dashboard statistics endpoint
  app.get('/api/v1/dashboard/statistics', (req, res, next) => {
    try {
      console.log('Dashboard statistics endpoint called');

      // Create a response with unified data structure
      const dashboardStats = {
        success: true,
        data: {
          totalProjects: 0,
          overdueDeadlines: 0,
          projectsOverBudget: 0,
          projectsWithRulesOverBudget: 0,
          onScheduleProjects: 0,
          activeEmployees: 0,
          timestamp: new Date().toISOString()
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      // Get active projects count
      projectAdapter.getAll({ archived: 'false' })
        .then(projectsResult => {
          if (projectsResult.success) {
            const projects = projectsResult.data;
            dashboardStats.data.totalProjects = projects.length;

            // Calculate overdue deadlines
            const now = new Date();
            const projectsOverDeadline = projects.filter(project => {
              if (!project.deadline) return false;
              try {
                const deadlineDate = new Date(project.deadline);
                return deadlineDate < now;
              } catch {
                return false;
              }
            });
            dashboardStats.data.overdueDeadlines = projectsOverDeadline.length;

            // Get projects over budget
            return projectAdapter.getOverBudgetProjects();
          }
          return { success: false, data: [] };
        })
        .then(overBudgetResult => {
          if (overBudgetResult.success) {
            dashboardStats.data.projectsOverBudget = overBudgetResult.data.length;

            // Get projects with rules over budget
            return projectAdapter.getProjectsWithRulesOverBudget();
          }
          return { success: false, data: [] };
        })
        .then(rulesOverBudgetResult => {
          if (rulesOverBudgetResult.success) {
            dashboardStats.data.projectsWithRulesOverBudget = rulesOverBudgetResult.data.length;

            // Calculate on schedule projects
            dashboardStats.data.onScheduleProjects =
              dashboardStats.data.totalProjects -
              dashboardStats.data.overdueDeadlines -
              dashboardStats.data.projectsOverBudget;

            // Get active employees count
            return employeeAdapter.getAll({ active: 'true' });
          }
          return { success: false, data: [] };
        })
        .then(employeesResult => {
          if (employeesResult.success) {
            dashboardStats.data.activeEmployees = employeesResult.data.length;
          }

          // Add cache-busting headers
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');

          // Send response
          res.json(dashboardStats);
        })
        .catch(error => {
          console.error('Error in dashboard statistics endpoint:', error);
          next(error);
        });
    } catch (error) {
      console.error('Error in dashboard statistics endpoint:', error);
      next(error);
    }
  });

  // Add compatibility endpoints for old API paths
  // These endpoints are needed for backward compatibility with the frontend

  // Employee month stats endpoint (old path)
  app.get('/api/employee-month-stats', (req, res, next) => {
    try {
      console.log('Redirecting /api/employee-month-stats to /api/v1/employees/month-stats');
      employeeAdapter.getForMonth({
        ...req.query,
        dashboard: 'true'
      }).then(result => {
        res.json(result);
      }).catch(error => {
        next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  // Employee stats endpoint (old path)
  app.get('/api/employee-stats', (req, res, next) => {
    try {
      console.log('Redirecting /api/employee-stats to /api/v1/employees/week');
      employeeAdapter.getForWeek(req.query).then(result => {
        res.json(result);
      }).catch(error => {
        next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  // Dashboard projects endpoint (old path)
  app.get('/api/dashboard/projects', (req, res, next) => {
    try {
      console.log('Redirecting /api/dashboard/projects to /api/v1/projects');
      projectAdapter.getAll(req.query).then(result => {
        res.json(result);
      }).catch(error => {
        next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  // Dashboard active projects endpoint (old path)
  app.get('/api/dashboard/projects/active', (req, res, next) => {
    try {
      console.log('Redirecting /api/dashboard/projects/active to /api/v1/projects?archived=false');
      projectAdapter.getAll({
        ...req.query,
        archived: 'false'
      }).then(result => {
        res.json({
          success: true,
          response: result.data
        });
      }).catch(error => {
        next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  // Dashboard project details endpoint (old path)
  app.get('/api/dashboard/projects/:id', (req, res, next) => {
    try {
      console.log(`Redirecting /api/dashboard/projects/${req.params.id} to /api/v1/projects/${req.params.id}`);
      projectAdapter.getById(req.params.id, req.query).then(result => {
        res.json({
          success: true,
          data: result.data
        });
      }).catch(error => {
        next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  // Invoices endpoint (old path)
  app.get('/api/invoices', (req, res, next) => {
    try {
      console.log('Redirecting /api/invoices to /api/v1/invoices');
      invoiceAdapter.getAll(req.query).then(result => {
        res.json(result);
      }).catch(error => {
        next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  // Overdue invoices endpoint (old path)
  app.get('/api/invoices/overdue', (req, res, next) => {
    try {
      console.log('Redirecting /api/invoices/overdue to /api/v1/invoices?status=overdue');
      invoiceAdapter.getAll({
        ...req.query,
        status: 'overdue'
      }).then(result => {
        res.json(result);
      }).catch(error => {
        next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  // Hours endpoint (old path)
  app.get('/api/hours', (req, res, next) => {
    try {
      console.log('Redirecting /api/hours to /api/v1/hours');
      hourAdapter.getAll(req.query).then(result => {
        res.json(result);
      }).catch(error => {
        next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  // Incomplete hours endpoint (old path)
  app.get('/api/hours/incomplete', (req, res, next) => {
    try {
      console.log('Redirecting /api/hours/incomplete to /api/v1/hours?status=incomplete');
      hourAdapter.getAll({
        ...req.query,
        status: 'incomplete'
      }).then(result => {
        res.json(result);
      }).catch(error => {
        next(error);
      });
    } catch (error) {
      next(error);
    }
  });

  // Start the server
  app.listen(port, () => {
    console.log(`API server listening on port ${port}`);
    console.log(`Using ${useMock ? 'mock' : 'SQLite'} repositories`);
    console.log(`Compatibility endpoints for old API paths are enabled`);
  });

  return app;
}
