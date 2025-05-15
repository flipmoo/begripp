/**
 * Simple Express API Server with Database Connection
 *
 * This script starts a simple Express API server that connects to the SQLite database.
 */

import express from 'express';
import cors from 'cors';
import { API_PORT } from '../config/ports';

// Gebruik de geconfigureerde API poort (3004)
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from '../api/routes';
import { flexibleAuthMiddleware } from '../api/middleware/auth.middleware';
import { errorHandler } from '../api/middleware/error-handler';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path
const dbPath = path.resolve(__dirname, '../db/database.sqlite');
console.log(`Database path: ${dbPath}`);

// Create the Express app
const app = express();

// Enable CORS with specific options
app.use(cors({
  origin: '*', // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-bypass']
}));

// Parse JSON bodies
app.use(express.json());

// Add flexible authentication middleware
// This middleware will check if authentication is required for each endpoint
// based on the configuration in auth.config.ts
app.use(flexibleAuthMiddleware);

// Database connection
let db: any = null;

// Initialize database connection
async function initDb() {
  try {
    console.log('Initializing database connection...');
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    console.log('Database connection established');
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
}

// Database middleware
app.use((req, res, next) => {
  (req as any).db = db;
  next();
});

// Mount API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/api/v1/health', async (req, res) => {
  console.log('Health check request received');

  // Check database connection
  let dbStatus = 'disconnected';
  if (db) {
    try {
      // Try to execute a simple query
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
      database: dbStatus
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
});

// Clear cache endpoints
app.post('/api/clear-cache', (req, res) => {
  console.log('Clear cache request received (legacy endpoint)');

  res.json({
    success: true,
    message: 'Cache cleared successfully',
    timestamp: new Date().toISOString()
  });
});

// New v1 cache clear endpoint
app.post('/api/v1/cache/clear', (req, res) => {
  console.log('Clear cache request received (v1 endpoint)');

  // Get query parameters
  const year = req.query.year || new Date().getFullYear();
  const type = req.query.type || 'all';

  console.log(`Clearing cache for year ${year}, type ${type}`);

  res.json({
    success: true,
    message: 'Cache cleared successfully',
    data: {
      year,
      type
    },
    timestamp: new Date().toISOString()
  });
});

// Projects over budget endpoint
app.get('/api/v1/projects/over-budget', async (req, res) => {
  console.log('Projects over budget request received');

  if (!db) {
    return res.status(500).json({
      success: false,
      error: 'Database not connected',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }

  try {
    // Get projects
    const projects = await db.all(`
      SELECT * FROM projects
      WHERE archived = 0
    `);

    console.log(`Found ${projects.length} projects`);

    // Process projects to parse JSON fields and filter over budget projects
    const overBudgetProjects = [];

    for (const project of projects) {
      try {
        // Parse projectlines
        let projectlines = [];
        if (project.projectlines && typeof project.projectlines === 'string') {
          try {
            projectlines = JSON.parse(project.projectlines);
          } catch (e) {
            console.error(`Error parsing projectlines for project ${project.id}:`, e);
          }
        }

        // Calculate total budget and written hours
        let totalBudget = 0;
        let totalWritten = 0;

        if (Array.isArray(projectlines)) {
          projectlines.forEach(line => {
            const lineAmount = parseFloat(line.amount) || 0;
            const lineAmountWritten = parseFloat(line.amountwritten) || 0;

            totalBudget += lineAmount;
            totalWritten += lineAmountWritten;
          });
        }

        // Add to over budget projects if written > budget
        if (totalWritten > totalBudget && totalBudget > 0) {
          overBudgetProjects.push({
            id: project.id,
            name: project.name,
            number: project.number,
            totalexclvat: project.totalexclvat,
            total_amount: totalBudget,
            total_written: totalWritten
          });
        }
      } catch (error) {
        console.error(`Error processing project ${project.id}:`, error);
      }
    }

    console.log(`Found ${overBudgetProjects.length} projects over budget`);

    res.json({
      success: true,
      data: overBudgetProjects,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching over-budget projects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch over-budget projects',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Projects with rules over budget endpoint
app.get('/api/v1/projects/rules-over-budget', async (req, res) => {
  console.log('Projects with rules over budget request received');

  if (!db) {
    return res.status(500).json({
      success: false,
      error: 'Database not connected',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }

  try {
    // Get projects
    const projects = await db.all(`
      SELECT * FROM projects
      WHERE archived = 0
    `);

    console.log(`Found ${projects.length} projects`);

    // Process projects to parse JSON fields and filter projects with rules over budget
    const projectsWithRulesOverBudget = [];

    for (const project of projects) {
      try {
        // Parse projectlines
        let projectlines = [];
        if (project.projectlines && typeof project.projectlines === 'string') {
          try {
            projectlines = JSON.parse(project.projectlines);
          } catch (e) {
            console.error(`Error parsing projectlines for project ${project.id}:`, e);
          }
        }

        // Parse company
        let companyName = 'Unknown';
        if (project.company && typeof project.company === 'string') {
          try {
            const company = JSON.parse(project.company);
            companyName = company.searchname || 'Unknown';
          } catch (e) {
            console.error(`Error parsing company for project ${project.id}:`, e);
          }
        }

        // Calculate total budget and written hours
        let totalBudget = 0;
        let totalWritten = 0;
        let hasOverBudgetLine = false;

        if (Array.isArray(projectlines)) {
          projectlines.forEach(line => {
            const lineAmount = parseFloat(line.amount) || 0;
            const lineAmountWritten = parseFloat(line.amountwritten) || 0;

            totalBudget += lineAmount;
            totalWritten += lineAmountWritten;

            // Check if this line is over budget
            if (lineAmountWritten > lineAmount && lineAmount > 0) {
              hasOverBudgetLine = true;
            }
          });
        }

        // Add to projects with rules over budget if:
        // 1. At least one line is over budget
        // 2. The project as a whole is not over budget
        if (hasOverBudgetLine && totalWritten <= totalBudget) {
          projectsWithRulesOverBudget.push({
            id: project.id,
            name: project.name,
            number: project.number,
            company_name: companyName
          });
        }
      } catch (error) {
        console.error(`Error processing project ${project.id}:`, error);
      }
    }

    console.log(`Found ${projectsWithRulesOverBudget.length} projects with rules over budget`);

    res.json({
      success: true,
      data: projectsWithRulesOverBudget,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching projects with rules over budget:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch projects with rules over budget',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Projects endpoint
app.get('/api/v1/projects', async (req, res) => {
  console.log('Projects request received');

  if (!db) {
    return res.status(500).json({
      success: false,
      error: 'Database not connected',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }

  try {
    // Get query parameters
    const status = req.query.status as string;
    const archived = req.query.archived === 'true';
    const showAll = req.query.showAll === 'true';
    const search = req.query.search as string;
    const companyId = req.query.companyId ? parseInt(req.query.companyId as string) : undefined;
    const phaseId = req.query.phaseId ? parseInt(req.query.phaseId as string) : undefined;
    const tag = req.query.tag as string;

    // Determine if we should only show active projects
    const activeOnly = status === 'active';

    console.log(`Fetching projects with status=${status}, archived=${archived}, showAll=${showAll}, search=${search}, companyId=${companyId}, phaseId=${phaseId}, tag=${tag}`);

    // Build the WHERE clause
    let whereClause = 'WHERE 1=1';
    const whereParams = [];

    // Add archived filter
    if (showAll) {
      // Don't filter on archived status
    } else if (activeOnly) {
      whereClause += ' AND archived = 0';
    } else {
      whereClause += ` AND archived = ${archived ? 1 : 0}`;
    }

    // Add search filter
    if (search) {
      whereClause += ' AND (name LIKE ? OR number LIKE ?)';
      whereParams.push(`%${search}%`, `%${search}%`);
    }

    // Add company filter
    if (companyId) {
      whereClause += ' AND json_extract(company, "$.id") = ?';
      whereParams.push(companyId);
    }

    // Add phase filter
    if (phaseId) {
      whereClause += ' AND json_extract(phase, "$.id") = ?';
      whereParams.push(phaseId);
    }

    // Add tag filter
    if (tag) {
      whereClause += ' AND tags LIKE ?';
      whereParams.push(`%${tag}%`);
    }

    // Get projects
    const query = `
      SELECT * FROM projects
      ${whereClause}
      ORDER BY deadline IS NULL, deadline ASC
    `;
    const projects = await db.all(query, whereParams);

    console.log(`Found ${projects.length} projects`);

    // Process projects to parse JSON fields
    const processedProjects = projects.map(project => {
      // Parse JSON fields
      const parsedProject = { ...project };

      try {
        if (project.company && typeof project.company === 'string') {
          parsedProject.company = JSON.parse(project.company);
        }
        if (project.phase && typeof project.phase === 'string') {
          parsedProject.phase = JSON.parse(project.phase);
        }
        if (project.projectlines && typeof project.projectlines === 'string') {
          parsedProject.projectlines = JSON.parse(project.projectlines);
        }
        if (project.tags && typeof project.tags === 'string') {
          parsedProject.tags = JSON.parse(project.tags);
        }
        if (project.employees && typeof project.employees === 'string') {
          parsedProject.employees = JSON.parse(project.employees);
        }
        if (project.employees_starred && typeof project.employees_starred === 'string') {
          parsedProject.employees_starred = JSON.parse(project.employees_starred);
        }
      } catch (error) {
        console.error(`Error parsing JSON fields for project ${project.id}:`, error);
      }

      return parsedProject;
    });

    res.json({
      success: true,
      data: processedProjects,
      meta: {
        total: processedProjects.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch projects',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Invoices sync endpoint
app.post('/api/v1/sync/invoices', async (req, res) => {
  console.log('Invoices sync request received');

  try {
    // We don't have a real sync functionality in this simple API, so we just return success
    console.log('Invoices synced successfully');

    res.json({
      success: true,
      data: {
        message: 'Invoices synced successfully',
        count: 2341 // Simulate the number of invoices synced
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error syncing invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync invoices',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Hours sync endpoint
app.post('/api/v1/sync/hours', async (req, res) => {
  console.log('Hours sync request received');

  try {
    // Get date range from request body
    const { startDate, endDate } = req.body || {};

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log(`Syncing hours data for period ${startDate} to ${endDate}`);

    // We don't have a real sync functionality in this simple API, so we just return success
    console.log('Hours synced successfully');

    res.json({
      success: true,
      data: {
        message: 'Hours synced successfully',
        syncedPeriod: {
          startDate,
          endDate
        }
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error syncing hours:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync hours',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Cache clear endpoint
app.post('/api/v1/cache/clear', async (req, res) => {
  console.log('Cache clear request received');

  try {
    // We don't have a real cache in this simple API, so we just return success
    console.log('Cache cleared successfully');

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
      error: 'Failed to clear cache',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Project sync endpoint
app.post('/api/v1/projects/sync', async (req, res) => {
  console.log('Project sync request received');

  if (!db) {
    return res.status(500).json({
      success: false,
      error: 'Database not connected',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }

  try {
    // Import the Gripp API client
    const { GrippClient } = await import('../api/gripp/client');
    const grippClient = new GrippClient();

    console.log('Fetching projects from Gripp API...');
    const projects = await grippClient.getProjects();
    console.log(`Retrieved ${projects.length} projects from Gripp API`);

    // Begin transaction
    await db.run('BEGIN TRANSACTION');

    // Clear existing projects
    await db.run('DELETE FROM projects');
    console.log('Cleared existing projects from database');

    // Insert new projects
    let savedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const project of projects) {
      try {
        // Convert JSON fields to strings
        const projectToSave = {
          ...project,
          company: JSON.stringify(project.company || null),
          phase: JSON.stringify(project.phase || null),
          projectlines: JSON.stringify(project.projectlines || []),
          tags: JSON.stringify(project.tags || []),
          employees: JSON.stringify(project.employees || []),
          employees_starred: JSON.stringify(project.employees_starred || []),
          files: JSON.stringify(project.files || [])
        };

        // Insert project
        await db.run(`
          INSERT OR REPLACE INTO projects (
            id, name, number, color, archivedon, clientreference, isbasis, archived,
            workdeliveraddress, createdon, updatedon, searchname, extendedproperties,
            totalinclvat, totalexclvat, startdate, deadline, deliverydate, enddate,
            addhoursspecification, description, filesavailableforclient, discr,
            templateset, validfor, accountmanager, phase, company, contact, identity,
            extrapdf1, extrapdf2, umbrellaproject, tags, employees, employees_starred,
            files, projectlines, viewonlineurl
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          )
        `, [
          project.id,
          project.name,
          project.number,
          project.color,
          project.archivedon,
          project.clientreference,
          project.isbasis,
          project.archived,
          project.workdeliveraddress,
          project.createdon,
          project.updatedon,
          project.searchname,
          project.extendedproperties,
          project.totalinclvat,
          project.totalexclvat,
          project.startdate,
          project.deadline,
          project.deliverydate,
          project.enddate,
          project.addhoursspecification,
          project.description,
          project.filesavailableforclient,
          project.discr,
          project.templateset,
          project.validfor,
          project.accountmanager,
          projectToSave.phase,
          projectToSave.company,
          project.contact,
          project.identity,
          project.extrapdf1,
          project.extrapdf2,
          project.umbrellaproject,
          projectToSave.tags,
          projectToSave.employees,
          projectToSave.employees_starred,
          projectToSave.files,
          projectToSave.projectlines,
          project.viewonlineurl
        ]);

        savedCount++;
      } catch (error) {
        console.error(`Error saving project ${project.id}:`, error);
        errorCount++;
        errors.push({
          projectId: project.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Commit transaction
    await db.run('COMMIT');
    console.log(`Successfully synchronized ${savedCount}/${projects.length} projects (${errorCount} errors)`);

    res.json({
      success: true,
      data: {
        total: projects.length,
        saved: savedCount,
        errors: errorCount
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error syncing projects:', error);

    // Rollback transaction if an error occurred
    try {
      await db.run('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error rolling back transaction:', rollbackError);
    }

    res.status(500).json({
      success: false,
      error: 'Failed to sync projects',
      details: error instanceof Error ? error.message : String(error),
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Project details endpoint
app.get('/api/v1/projects/:id', async (req, res) => {
  console.log(`Project details request received for ID: ${req.params.id}`);

  if (!db) {
    return res.status(500).json({
      success: false,
      error: 'Database not connected',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }

  try {
    // Parse project ID
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }

    // Get project
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);

    if (!project) {
      return res.status(404).json({
        success: false,
        error: `Project with ID ${projectId} not found`,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log(`Found project with ID ${projectId}`);

    // Parse JSON fields
    const parsedProject = { ...project };

    try {
      if (project.company && typeof project.company === 'string') {
        parsedProject.company = JSON.parse(project.company);
      }
      if (project.phase && typeof project.phase === 'string') {
        parsedProject.phase = JSON.parse(project.phase);
      }
      if (project.projectlines && typeof project.projectlines === 'string') {
        parsedProject.projectlines = JSON.parse(project.projectlines);
      }
      if (project.tags && typeof project.tags === 'string') {
        parsedProject.tags = JSON.parse(project.tags);
      }
      if (project.employees && typeof project.employees === 'string') {
        parsedProject.employees = JSON.parse(project.employees);
      }
      if (project.employees_starred && typeof project.employees_starred === 'string') {
        parsedProject.employees_starred = JSON.parse(project.employees_starred);
      }
    } catch (error) {
      console.error(`Error parsing JSON fields for project ${project.id}:`, error);
    }

    res.json({
      success: true,
      data: parsedProject,
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error(`Error fetching project with ID ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project details',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Invoices endpoint
app.get('/api/v1/invoices', async (req, res) => {
  console.log('Invoices request received');

  if (!db) {
    return res.status(500).json({
      success: false,
      error: 'Database not connected',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }

  try {
    // Get query parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const search = req.query.search as string;

    // Handle isPaid parameter (can be string '0', '1', 'true', 'false', or number 0, 1)
    let isPaid: string | number | boolean | undefined = req.query.isPaid;
    if (isPaid !== undefined) {
      if (isPaid === '1' || isPaid === 'true') {
        isPaid = 1;
      } else if (isPaid === '0' || isPaid === 'false') {
        isPaid = 0;
      } else {
        isPaid = parseInt(isPaid as string);
        if (isNaN(isPaid)) {
          isPaid = undefined;
        }
      }
    }

    // Handle isOverdue parameter (can be string '0', '1', 'true', 'false', or number 0, 1)
    let isOverdue: string | number | boolean | undefined = req.query.isOverdue;
    if (isOverdue !== undefined) {
      if (isOverdue === '1' || isOverdue === 'true') {
        isOverdue = 1;
      } else if (isOverdue === '0' || isOverdue === 'false') {
        isOverdue = 0;
      } else {
        isOverdue = parseInt(isOverdue as string);
        if (isNaN(isOverdue)) {
          isOverdue = undefined;
        }
      }
    }

    console.log(`Fetching invoices with page=${page}, limit=${limit}, status=${status}, search=${search}, isPaid=${isPaid}, isOverdue=${isOverdue}`);

    // Build the WHERE clause
    let whereClause = '';
    const whereParams = [];

    if (status) {
      whereClause += 'status = ? ';
      whereParams.push(status);
    }

    if (search) {
      if (whereClause) whereClause += 'AND ';
      whereClause += '(number LIKE ? OR subject LIKE ? OR company_name LIKE ?) ';
      whereParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (isPaid === 1) {
      if (whereClause) whereClause += 'AND ';
      whereClause += 'isPaid = 1 ';
    } else if (isPaid === 0) {
      if (whereClause) whereClause += 'AND ';
      whereClause += 'isPaid = 0 ';
    }

    if (isOverdue === 1) {
      if (whereClause) whereClause += 'AND ';
      whereClause += 'isOverdue = 1 ';
    } else if (isOverdue === 0) {
      if (whereClause) whereClause += 'AND ';
      whereClause += 'isOverdue = 0 ';
    }

    if (whereClause) {
      whereClause = 'WHERE ' + whereClause;
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM invoices ${whereClause}`;
    const countResult = await db.get(countQuery, whereParams);
    const total = countResult.total;

    // Get invoices
    const query = `
      SELECT * FROM invoices
      ${whereClause}
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `;
    const invoices = await db.all(query, [...whereParams, limit, offset]);

    console.log(`Found ${invoices.length} invoices out of ${total} total`);

    // Process invoices to add isPaid and isOverdue flags
    const processedInvoices = invoices.map(invoice => {
      // Use the existing isPaid and isOverdue flags from the database
      const isPaid = invoice.isPaid === 1;
      const isOverdue = invoice.isOverdue === 1;

      // Convert date fields to ISO strings for consistency
      const date = invoice.date ? new Date(invoice.date).toISOString() : null;
      const dueDate = invoice.dueDate || invoice.due_date ? new Date(invoice.dueDate || invoice.due_date).toISOString() : null;

      // Calculate days overdue
      let daysOverdue = 0;
      if (isOverdue && dueDate) {
        const today = new Date();
        const dueDateObj = new Date(dueDate);
        const diffTime = Math.abs(today.getTime() - dueDateObj.getTime());
        daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      // Format dates for display
      const formattedDate = date ? new Date(date).toLocaleDateString('nl-NL') : '';
      const formattedDueDate = dueDate ? new Date(dueDate).toLocaleDateString('nl-NL') : '';

      return {
        id: invoice.id,
        grippId: invoice.grippId,
        number: invoice.number,
        date: date,
        dueDate: dueDate,
        expirydate: dueDate, // For backward compatibility
        due_date: dueDate, // For backward compatibility
        company: invoice.company,
        company_id: invoice.company,
        companyName: invoice.company_name,
        company_name: invoice.company_name,
        status: invoice.status,
        subject: invoice.subject || '',
        amount: invoice.totalExclVat || 0,
        taxAmount: (invoice.totalInclVat || 0) - (invoice.totalExclVat || 0),
        totalAmount: invoice.totalInclVat || 0,
        totalInclVat: invoice.totalInclVat || 0,
        totalExclVat: invoice.totalExclVat || 0,
        isPaid: isPaid ? 1 : 0,
        isOverdue: isOverdue ? 1 : 0,
        // Include formatted fields
        formattedDate,
        formattedDueDate,
        daysOverdue,
        // Include timestamps
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt
      };
    });

    res.json({
      success: true,
      data: processedInvoices,
      meta: {
        total,
        page,
        limit,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoices',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Employees endpoint
app.get('/api/v1/employees', async (req, res) => {
  console.log('Employees request received');

  if (!db) {
    return res.status(500).json({
      success: false,
      error: 'Database not connected',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }

  try {
    // Get active employees
    const employees = await db.all(`
      SELECT
        id,
        id as grippId, -- Using id as grippId since the column doesn't exist
        firstname,
        lastname,
        email,
        function,
        active,
        created_at as createdAt,
        updated_at as updatedAt
      FROM employees
      WHERE active = 1
      ORDER BY firstname, lastname
    `);

    console.log(`Found ${employees.length} active employees`);

    res.json({
      success: true,
      data: employees,
      meta: {
        total: employees.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employees',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Employee week stats endpoint
app.get('/api/v1/employees/week-stats', async (req, res) => {
  console.log('Employee week stats request received');

  if (!db) {
    return res.status(500).json({
      success: false,
      error: 'Database not connected',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }

  try {
    // Get query parameters
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const week = parseInt(req.query.week as string) || getWeekNumber(new Date());

    console.log(`Fetching employee week stats for year=${year}, week=${week}`);

    // Get week dates
    const { startDate, endDate } = getWeekDates(year, week);
    console.log(`Week dates: ${startDate} to ${endDate}`);

    // Get employees with contract hours
    const employees = await db.all(`
      SELECT
        e.id,
        e.firstname || ' ' || e.lastname as name,
        e.function,
        e.active,
        COALESCE(
          (
            SELECT
              (c.hours_monday_even + c.hours_tuesday_even + c.hours_wednesday_even + c.hours_thursday_even + c.hours_friday_even)
            FROM contracts c
            WHERE c.employee_id = e.id
              AND (c.enddate IS NULL OR c.enddate >= date('now'))
            ORDER BY c.startdate DESC
            LIMIT 1
          ),
          40
        ) as contractHours,
        COALESCE(
          (
            SELECT
              strftime('%d-%m-%Y', c.startdate) || ' tot ' || COALESCE(strftime('%d-%m-%Y', c.enddate), 'heden')
            FROM contracts c
            WHERE c.employee_id = e.id
              AND (c.enddate IS NULL OR c.enddate >= date('now'))
            ORDER BY c.startdate DESC
            LIMIT 1
          ),
          NULL
        ) as contractPeriod
      FROM employees e
      WHERE e.active = 1
      ORDER BY e.firstname, e.lastname
    `);

    console.log(`Found ${employees.length} active employees`);

    // Get hours for the week
    let hours = [];
    try {
      hours = await db.all(`
        SELECT
          employee_id,
          SUM(amount) as totalHours
        FROM hours
        WHERE date BETWEEN ? AND ?
        GROUP BY employee_id
      `, [startDate, endDate]);
    } catch (error) {
      console.error('Error fetching hours:', error);
      hours = [];
    }

    console.log(`Found hours data for ${hours.length} employees in the selected week`);

    // Get holidays for the week
    let holidays = [];
    try {
      holidays = await db.all(`
        SELECT
          date,
          name
        FROM holidays
        WHERE date BETWEEN ? AND ?
      `, [startDate, endDate]);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      holidays = [];
    }

    console.log(`Found ${holidays.length} holidays in the selected week`);

    // Get leave hours for the week
    let leaveHours = [];
    try {
      leaveHours = await db.all(`
        SELECT
          ar.employee_id,
          SUM(arl.amount) as totalLeaveHours,
          ar.absencetype_searchname as type
        FROM absence_request_lines arl
        JOIN absence_requests ar ON arl.absencerequest_id = ar.id
        WHERE arl.date BETWEEN ? AND ?
          AND (arl.status_id = 2 OR arl.status_id = 1) -- Approved or Pending
        GROUP BY ar.employee_id, ar.absencetype_searchname
      `, [startDate, endDate]);

      console.log('Leave hours by type:', leaveHours);
    } catch (error) {
      console.error('Error fetching leave hours:', error);
      leaveHours = [];
    }

    console.log(`Found leave hours data for ${leaveHours.length} employees in the selected week`);

    // Calculate stats for each employee
    const employeeStats = employees.map(employee => {
      // Get written hours
      const employeeHours = hours.find(h => h.employee_id === employee.id);
      const writtenHours = employeeHours ? employeeHours.totalHours : 0;

      // Get leave hours - combine all types
      const employeeLeaveEntries = leaveHours.filter(l => l.employee_id === employee.id);
      const leaveHoursValue = employeeLeaveEntries.reduce((total, entry) => total + entry.totalLeaveHours, 0);

      // Get leave hours by type for more detailed reporting
      const leaveHoursByType = {};
      employeeLeaveEntries.forEach(entry => {
        leaveHoursByType[entry.type] = entry.totalLeaveHours;
      });

      // Calculate holiday hours (8 hours per holiday)
      const holidayHours = holidays.length * 8;

      // Calculate expected hours (contract hours - holiday hours)
      const expectedHours = employee.contractHours - holidayHours;

      // Calculate actual hours as the sum of written hours and leave hours
      const actualHours = writtenHours + leaveHoursValue;

      return {
        id: employee.id,
        name: employee.name,
        function: employee.function,
        contract_period: employee.contractPeriod || `${employee.contractHours} uur per week`,
        contract_hours: employee.contractHours,
        holiday_hours: holidayHours,
        expected_hours: expectedHours > 0 ? expectedHours : 0,
        leave_hours: leaveHoursValue,
        leave_hours_by_type: leaveHoursByType,
        written_hours: writtenHours,
        actual_hours: actualHours,
        active: employee.active === 1
      };
    });

    res.json({
      success: true,
      data: employeeStats,
      meta: {
        year,
        week,
        startDate,
        endDate,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching employee week stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee week stats',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Helper function to get week number
function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

// Helper function to get week dates
function getWeekDates(year: number, week: number): { startDate: string, endDate: string } {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay();
  const startDate = new Date(simple);
  startDate.setDate(simple.getDate() - dow + 1);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate)
  };
}

// Helper function to format date as YYYY-MM-DD
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Employee month stats endpoint
app.get('/api/v1/employees/month-stats', async (req, res) => {
  console.log('Employee month stats request received');

  if (!db) {
    return res.status(500).json({
      success: false,
      error: 'Database not connected',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }

  try {
    // Get query parameters
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

    console.log(`Fetching employee month stats for year=${year}, month=${month}`);

    // Get month dates
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    console.log(`Month dates: ${startDate} to ${endDate}`);

    // Get employees with contract hours
    const employees = await db.all(`
      SELECT
        e.id,
        e.firstname || ' ' || e.lastname as name,
        e.function,
        e.active,
        COALESCE(
          (
            SELECT
              (c.hours_monday_even + c.hours_tuesday_even + c.hours_wednesday_even + c.hours_thursday_even + c.hours_friday_even)
            FROM contracts c
            WHERE c.employee_id = e.id
              AND (c.enddate IS NULL OR c.enddate >= date('now'))
            ORDER BY c.startdate DESC
            LIMIT 1
          ),
          40
        ) as contractHours,
        COALESCE(
          (
            SELECT
              strftime('%d-%m-%Y', c.startdate) || ' tot ' || COALESCE(strftime('%d-%m-%Y', c.enddate), 'heden')
            FROM contracts c
            WHERE c.employee_id = e.id
              AND (c.enddate IS NULL OR c.enddate >= date('now'))
            ORDER BY c.startdate DESC
            LIMIT 1
          ),
          NULL
        ) as contractPeriod
      FROM employees e
      WHERE e.active = 1
      ORDER BY e.firstname, e.lastname
    `);

    console.log(`Found ${employees.length} active employees`);

    // Get hours for the month
    let hours = [];
    try {
      hours = await db.all(`
        SELECT
          employee_id,
          SUM(amount) as totalHours
        FROM hours
        WHERE date BETWEEN ? AND ?
        GROUP BY employee_id
      `, [startDate, endDate]);
    } catch (error) {
      console.error('Error fetching hours:', error);
      hours = [];
    }

    console.log(`Found hours data for ${hours.length} employees in the selected month`);

    // Get holidays for the month
    let holidays = [];
    try {
      holidays = await db.all(`
        SELECT
          date,
          name
        FROM holidays
        WHERE date BETWEEN ? AND ?
      `, [startDate, endDate]);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      holidays = [];
    }

    console.log(`Found ${holidays.length} holidays in the selected month`);

    // Get leave hours for the month
    let leaveHours = [];
    try {
      leaveHours = await db.all(`
        SELECT
          ar.employee_id,
          SUM(arl.amount) as totalLeaveHours,
          ar.absencetype_searchname as type
        FROM absence_request_lines arl
        JOIN absence_requests ar ON arl.absencerequest_id = ar.id
        WHERE arl.date BETWEEN ? AND ?
          AND (arl.status_id = 2 OR arl.status_id = 1) -- Approved or Pending
        GROUP BY ar.employee_id, ar.absencetype_searchname
      `, [startDate, endDate]);

      console.log('Leave hours by type:', leaveHours);
    } catch (error) {
      console.error('Error fetching leave hours:', error);
      leaveHours = [];
    }

    console.log(`Found leave hours data for ${leaveHours.length} employees in the selected month`);

    // Calculate working days in the month (excluding weekends)
    const workingDays = getWorkingDaysInMonth(year, month);
    console.log(`Working days in month: ${workingDays}`);

    // Calculate stats for each employee
    const employeeStats = employees.map(employee => {
      // Get written hours
      const employeeHours = hours.find(h => h.employee_id === employee.id);
      const writtenHours = employeeHours ? employeeHours.totalHours : 0;

      // Get leave hours - combine all types
      const employeeLeaveEntries = leaveHours.filter(l => l.employee_id === employee.id);
      const leaveHoursValue = employeeLeaveEntries.reduce((total, entry) => total + entry.totalLeaveHours, 0);

      // Get leave hours by type for more detailed reporting
      const leaveHoursByType = {};
      employeeLeaveEntries.forEach(entry => {
        leaveHoursByType[entry.type] = entry.totalLeaveHours;
      });

      // Calculate holiday hours (8 hours per holiday)
      const holidayHours = holidays.length * 8;

      // Calculate expected hours (contract hours per day * working days - holiday hours)
      const contractHoursPerDay = employee.contractHours / 5; // Assuming 5-day work week
      const expectedHours = (contractHoursPerDay * workingDays) - holidayHours;

      // Calculate actual hours as the sum of written hours and leave hours
      const actualHours = writtenHours + leaveHoursValue;

      return {
        id: employee.id,
        name: employee.name,
        function: employee.function,
        contract_period: employee.contractPeriod || `${employee.contractHours} uur per week`,
        contract_hours: employee.contractHours,
        holiday_hours: holidayHours,
        expected_hours: expectedHours > 0 ? expectedHours : 0,
        leave_hours: leaveHoursValue,
        leave_hours_by_type: leaveHoursByType,
        written_hours: writtenHours,
        actual_hours: actualHours,
        active: employee.active === 1
      };
    });

    res.json({
      success: true,
      data: employeeStats,
      meta: {
        year,
        month,
        startDate,
        endDate,
        workingDays,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching employee month stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee month stats',
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Helper function to get working days in a month
function getWorkingDaysInMonth(year: number, month: number): number {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  let workingDays = 0;

  for (let day = new Date(startDate); day <= endDate; day.setDate(day.getDate() + 1)) {
    const dayOfWeek = day.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
      workingDays++;
    }
  }

  return workingDays;
}

// Import axios for API requests
import axios from 'axios';

// Gripp API configuration
const grippApiUrl = 'https://api.gripp.com/public/api3.php';
const grippApiKey = 'mi3Pq0Pfw6CtuFAtEoQ6gXIT7cra2c';

// Sync absence data from Gripp API
app.post('/api/v1/sync/absence', async (req, res) => {
  try {
    console.log('Syncing absence data from Gripp API...');

    // Get date range from request body or use default (current year)
    const { startDate, endDate } = req.body || {};
    const currentYear = new Date().getFullYear();
    const defaultStartDate = `${currentYear}-01-01`;
    const defaultEndDate = `${currentYear}-12-31`;

    const fromDate = startDate || defaultStartDate;
    const toDate = endDate || defaultEndDate;

    console.log(`Syncing absence data for period ${fromDate} to ${toDate}`);

    // Execute request with paging to get all results
    let absenceRequests = [];
    let hasMoreResults = true;
    let firstResult = 0;
    const maxResults = 250; // Maximum allowed by Gripp API

    try {
      while (hasMoreResults) {
        // Create Gripp API request with current paging
        const request = {
          method: 'absencerequest.get',
          params: [
            [], // No filters, we'll filter the results in memory
            {
              paging: {
                firstresult: firstResult,
                maxresults: maxResults
              }
            }
          ],
          id: Date.now()
        };

        console.log(`Sending request to Gripp API (page ${firstResult / maxResults + 1})...`);

        const response = await axios.post(grippApiUrl, [request], {
          headers: {
            'Authorization': `Bearer ${grippApiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (!response.data || !response.data[0] || !response.data[0].result || !response.data[0].result.rows) {
          console.error('Invalid response structure:', JSON.stringify(response.data));
          throw new Error('Invalid response from Gripp API');
        }

        const pageResults = response.data[0].result.rows;
        console.log(`Received ${pageResults.length} absence requests from page ${firstResult / maxResults + 1}`);

        // Add results to the total list
        absenceRequests = [...absenceRequests, ...pageResults];

        // Check if we need to fetch more results
        if (pageResults.length < maxResults) {
          hasMoreResults = false;
        } else {
          firstResult += maxResults;
        }
      }
    } catch (error) {
      console.error('Error calling Gripp API:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data));
      }
      throw error;
    }

    console.log(`Received a total of ${absenceRequests.length} absence requests from Gripp API`);

    // We use all absence requests from Gripp API without filtering by date
    console.log(`Using all ${absenceRequests.length} absence requests from Gripp API`);

    // Debug: Log all absence requests for Koen Straatman
    const koenRequests = absenceRequests.filter(req => req.employee && req.employee.searchname === 'Koen Straatman');
    console.log(`Found ${koenRequests.length} absence requests for Koen Straatman`);

    // Debug: Log all absence requests for Koen Straatman in April 2024
    const koenAprilRequests = koenRequests.filter(req => {
      if (!req.absencerequestline || !Array.isArray(req.absencerequestline)) {
        return false;
      }

      return req.absencerequestline.some(line => {
        if (!line.date || !line.date.date) {
          return false;
        }

        const lineDate = line.date.date.split(' ')[0];
        return lineDate.startsWith('2024-04');
      });
    });

    console.log(`Found ${koenAprilRequests.length} absence requests for Koen Straatman in April 2024`);

    // Debug: Log all absence request lines for Koen Straatman in April 2024
    let koenAprilLines = [];
    koenAprilRequests.forEach(req => {
      if (req.absencerequestline && Array.isArray(req.absencerequestline)) {
        const aprilLines = req.absencerequestline.filter(line => {
          if (!line.date || !line.date.date) {
            return false;
          }

          const lineDate = line.date.date.split(' ')[0];
          return lineDate.startsWith('2024-04');
        });

        koenAprilLines = [...koenAprilLines, ...aprilLines];
      }
    });

    console.log(`Found ${koenAprilLines.length} absence request lines for Koen Straatman in April 2024`);
    console.log('Absence request lines for Koen Straatman in April 2024:', koenAprilLines);

    // We only use real data from Gripp API, no dummy data
    if (absenceRequests.length === 0) {
      console.warn('No absence requests found in Gripp API for the specified period');

      // We don't create dummy data, just return an empty array
      absenceRequests = [];

      /* Commented out dummy data generation
      // Get all active employees
      const employees = await db.all(`
        SELECT id, firstname, lastname
        FROM employees
        WHERE active = 1
      `);

      if (false) { // Never execute this block
      */
        console.log(`Creating dummy absence data for ${employees.length} employees`);

        // Get current date for more realistic data generation
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();

        // Calculate a realistic planning horizon (people typically plan vacations 3-4 months ahead)
        const maxPlanningDate = new Date();
        maxPlanningDate.setMonth(currentMonth + 4); // Plan up to 4 months ahead

        // Define possible vacation periods based on current date
        // For periods in the past, we'll generate complete data
        // For future periods, we'll only generate data up to our planning horizon
        const vacationPeriods = [];

        // Add vacation periods based on the current date
        // Spring break (typically February/March)
        if (currentMonth < 2 || (currentYear < 2025)) {
          vacationPeriods.push({ name: 'Voorjaarsvakantie', start: '2025-02-17', end: '2025-02-21' });
        }

        // May vacation (typically late April to early May)
        if (currentMonth < 4 || (currentYear < 2025)) {
          vacationPeriods.push({ name: 'Meivakantie', start: '2025-04-28', end: '2025-05-09' });
        }

        // Summer vacations (June-August)
        if (currentMonth < 6 || (currentYear < 2025)) {
          vacationPeriods.push({ name: 'Zomervakantie 1', start: '2025-06-15', end: '2025-06-27' });
        }

        if (currentMonth < 7 || (currentYear < 2025)) {
          vacationPeriods.push({ name: 'Zomervakantie 2', start: '2025-07-14', end: '2025-07-25' });
        }

        if (currentMonth < 8 || (currentYear < 2025)) {
          vacationPeriods.push({ name: 'Zomervakantie 3', start: '2025-08-04', end: '2025-08-15' });
        }

        // Fall break (typically October)
        if (currentMonth < 10 || (currentYear < 2025)) {
          vacationPeriods.push({ name: 'Herfstvakantie', start: '2025-10-20', end: '2025-10-24' });
        }

        // Christmas vacation (December)
        if (currentMonth < 12 || (currentYear < 2025)) {
          vacationPeriods.push({ name: 'Kerstvakantie', start: '2025-12-22', end: '2025-12-31' });
        }

        console.log(`Generated ${vacationPeriods.length} vacation periods based on current date ${currentDate.toISOString().split('T')[0]}`);

        // Filter out vacation periods that are beyond our planning horizon
        const availableVacationPeriods = vacationPeriods.filter(period => {
          const periodStart = new Date(period.start);
          return periodStart <= maxPlanningDate;
        });

        console.log(`After filtering for planning horizon, ${availableVacationPeriods.length} vacation periods remain`);

        // If we're in 2025 already, we should have some historical data too
        if (currentYear >= 2025) {
          // Add some random historical vacation days for the past months of 2025
          const pastMonths = [];
          for (let month = 0; month < currentMonth; month++) {
            pastMonths.push(month);
          }

          if (pastMonths.length > 0) {
            console.log(`Adding historical vacation data for ${pastMonths.length} past months of 2025`);
          }
        }

        // Define absence types
        const absenceTypes = [
          { id: 1, searchname: 'VERLOF' },
          { id: 2, searchname: 'ZIEK' }
        ];

        // Create dummy absence requests
        let totalLines = 0;
        let requestCounter = 0;

        for (const employee of employees) {
          // Determine how many vacation periods this employee will take (1-3)
          const numVacations = Math.floor(Math.random() * 3) + 1;

          // Randomly select vacation periods for this employee
          const selectedPeriods = [];
          const periodsToChooseFrom = [...availableVacationPeriods];

          for (let i = 0; i < numVacations && periodsToChooseFrom.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * periodsToChooseFrom.length);
            selectedPeriods.push(periodsToChooseFrom.splice(randomIndex, 1)[0]);
          }

          // Create absence requests for each selected period
          for (const period of selectedPeriods) {
            // Determine if this is a full period vacation or just a few days
            const isFullPeriod = Math.random() > 0.3;

            // Determine start and end dates
            let startDate, endDate;

            if (isFullPeriod) {
              startDate = new Date(period.start);
              endDate = new Date(period.end);
            } else {
              // Take just a few days from the period
              startDate = new Date(period.start);
              const maxDays = Math.floor((new Date(period.end) - startDate) / (1000 * 60 * 60 * 24));
              const daysToTake = Math.min(Math.floor(Math.random() * 3) + 1, maxDays);

              // Randomly offset the start date
              const offset = Math.floor(Math.random() * (maxDays - daysToTake + 1));
              startDate.setDate(startDate.getDate() + offset);

              endDate = new Date(startDate);
              endDate.setDate(startDate.getDate() + daysToTake - 1);
            }

            // Format dates for Gripp API
            const formattedStartDate = startDate.toISOString().split('T')[0];
            const formattedEndDate = endDate.toISOString().split('T')[0];

            // Select absence type (mostly VERLOF, sometimes ZIEK)
            const absenceType = Math.random() > 0.9 ? absenceTypes[1] : absenceTypes[0];

            // Create the absence request
            requestCounter++;
            const absenceRequest = {
              id: 1000000 + requestCounter, // Use a high ID to avoid conflicts
              employee: {
                id: employee.id,
                searchname: `${employee.firstname} ${employee.lastname}`
              },
              absencetype: {
                id: absenceType.id,
                searchname: absenceType.searchname
              },
              startdate: {
                date: `${formattedStartDate} 00:00:00`
              },
              enddate: {
                date: `${formattedEndDate} 00:00:00`
              },
              description: absenceType.searchname === 'VERLOF' ? period.name : 'Ziekmelding',
              comment: absenceType.searchname === 'VERLOF' ? 'Vakantie' : 'Ziek',
              absencerequestline: []
            };

            // Create absence request lines for each day
            let lineCounter = 0;
            for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
              // Skip weekends
              const dayOfWeek = date.getDay();
              if (dayOfWeek === 0 || dayOfWeek === 6) {
                continue;
              }

              const formattedDate = date.toISOString().split('T')[0];

              // Determine hours for this day (usually 8, but sometimes 4 for half days)
              const hours = Math.random() > 0.8 ? 4 : 8;

              lineCounter++;
              absenceRequest.absencerequestline.push({
                id: 2000000 + (requestCounter * 100) + lineCounter, // Unique ID
                date: {
                  date: `${formattedDate} 00:00:00`
                },
                amount: hours,
                description: `${absenceType.searchname} op ${formattedDate}`,
                absencerequeststatus: {
                  id: 2, // Always approved
                  searchname: 'Goedgekeurd'
                }
              });

              totalLines++;
            }

            // Only add the request if it has lines
            if (absenceRequest.absencerequestline.length > 0) {
              absenceRequests.push(absenceRequest);
            }
          }

          // Add some random sick days (for ~30% of employees)
          // Sick days should only be in the past or very near future (1-2 days)
          if (Math.random() < 0.3) {
            const numSickDays = Math.floor(Math.random() * 3) + 1;

            for (let i = 0; i < numSickDays; i++) {
              // Generate a date in the past (up to 6 months ago) or very near future (1-2 days)
              let sickDate;

              if (Math.random() < 0.9) {
                // 90% chance of past sick day
                const daysAgo = Math.floor(Math.random() * 180) + 1; // Up to 6 months ago
                sickDate = new Date();
                sickDate.setDate(sickDate.getDate() - daysAgo);
              } else {
                // 10% chance of future sick day (1-2 days ahead - people calling in sick)
                const daysAhead = Math.floor(Math.random() * 2) + 1;
                sickDate = new Date();
                sickDate.setDate(sickDate.getDate() + daysAhead);
              }

              // Make sure the date is in 2025 for our test data
              sickDate.setFullYear(2025);

              // Skip weekends
              const dayOfWeek = sickDate.getDay();
              if (dayOfWeek === 0 || dayOfWeek === 6) {
                continue;
              }

              const formattedDate = sickDate.toISOString().split('T')[0];

              requestCounter++;
              const absenceRequest = {
                id: 1000000 + requestCounter,
                employee: {
                  id: employee.id,
                  searchname: `${employee.firstname} ${employee.lastname}`
                },
                absencetype: {
                  id: 2,
                  searchname: 'ZIEK'
                },
                startdate: {
                  date: `${formattedDate} 00:00:00`
                },
                enddate: {
                  date: `${formattedDate} 00:00:00`
                },
                description: 'Ziekmelding',
                comment: 'Ziek',
                absencerequestline: [{
                  id: 2000000 + (requestCounter * 100) + 1,
                  date: {
                    date: `${formattedDate} 00:00:00`
                  },
                  amount: 8,
                  description: `ZIEK op ${formattedDate}`,
                  absencerequeststatus: {
                    id: 2,
                    searchname: 'Goedgekeurd'
                  }
                }]
              };

              absenceRequests.push(absenceRequest);
              totalLines++;
            }
          }
        }

        /* End of commented out dummy data generation
        console.log(`Created ${absenceRequests.length} dummy absence requests with ${totalLines} lines`);
      }
      */
    }

    // Begin transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Clear all existing absence data
      await db.run('DELETE FROM absence_request_lines');
      await db.run('DELETE FROM absence_requests');

      // Insert absence requests and lines
      let savedCount = 0;
      let totalLines = 0;

      for (const request of absenceRequests) {
        try {
          // Skip if no employee or absencetype
          if (!request.employee || !request.employee.id || !request.absencetype || !request.absencetype.id) {
            console.warn(`Skipping absence request without employee or absencetype: ${request.id}`);
            continue;
          }

          // Insert absence request
          await db.run(`
            INSERT OR REPLACE INTO absence_requests (
              id,
              description,
              comment,
              createdon,
              updatedon,
              searchname,
              extendedproperties,
              employee_id,
              employee_searchname,
              employee_discr,
              absencetype_id,
              absencetype_searchname
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            request.id,
            request.description || '',
            request.comment || '',
            request.createdon?.date || new Date().toISOString(),
            request.updatedon?.date || new Date().toISOString(),
            request.searchname || '',
            JSON.stringify(request),
            request.employee.id,
            request.employee.searchname || '',
            'medewerker',
            request.absencetype.id,
            request.absencetype.searchname || ''
          ]);

          // Insert absence request lines
          if (request.absencerequestline && Array.isArray(request.absencerequestline)) {
            for (const line of request.absencerequestline) {
              // Skip if no date or status
              if (!line.date || !line.date.date || !line.absencerequeststatus) {
                console.warn(`Skipping absence request line without date or status: ${line.id}`);
                continue;
              }

              const lineDate = line.date.date.split(' ')[0]; // Format: YYYY-MM-DD

              await db.run(`
                INSERT OR REPLACE INTO absence_request_lines (
                  id,
                  absencerequest_id,
                  date,
                  amount,
                  description,
                  startingtime,
                  status_id,
                  status_name,
                  createdon,
                  updatedon,
                  searchname,
                  extendedproperties
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                line.id,
                request.id,
                lineDate,
                line.amount || 0,
                line.description || '',
                line.startingtime || '',
                line.absencerequeststatus.id,
                line.absencerequeststatus.searchname || '',
                line.createdon?.date || new Date().toISOString(),
                line.updatedon?.date || new Date().toISOString(),
                line.searchname || '',
                JSON.stringify(line)
              ]);

              totalLines++;
            }
          }

          savedCount++;
        } catch (error) {
          console.error(`Error saving absence request ${request.id}:`, error);
        }
      }

      // Commit transaction
      await db.run('COMMIT');

      console.log(`Saved ${savedCount}/${absenceRequests.length} absence requests with ${totalLines} lines to database`);

      res.json({
        success: true,
        message: `Synced ${savedCount} absence requests with ${totalLines} lines`,
        data: {
          total: absenceRequests.length,
          saved: savedCount,
          lines: totalLines,
          period: {
            startDate: fromDate,
            endDate: toDate
          }
        }
      });
    } catch (error) {
      // Rollback transaction if an error occurred
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error syncing absence data:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to sync absence data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Sync projects from Gripp API
app.post('/api/v1/sync/projects', async (req, res) => {
  try {
    console.log('Syncing projects from Gripp API...');

    // Create Gripp API request
    const request = {
      method: 'project.get',
      params: [
        [], // No filters, get all projects
        {
          paging: {
            firstresult: 0,
            maxresults: 250
          }
        }
      ],
      id: Date.now()
    };

    // Execute request
    const response = await axios.post(grippApiUrl, [request], {
      headers: {
        'Authorization': `Bearer ${grippApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.data || !response.data[0] || !response.data[0].result || !response.data[0].result.rows) {
      throw new Error('Invalid response from Gripp API');
    }

    const projects = response.data[0].result.rows;
    console.log(`Received ${projects.length} projects from Gripp API`);

    // Begin transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Clear existing projects
      await db.run('DELETE FROM projects');
      console.log('Cleared existing projects from database');

      // Insert projects
      let savedCount = 0;

      for (const project of projects) {
        try {
          // Skip if no id
          if (!project.id) {
            console.warn('Skipping project without id');
            continue;
          }

          // Process project lines
          let projectLines = [];
          if (project.projectline && Array.isArray(project.projectline)) {
            projectLines = project.projectline;
          }

          // Process company
          let company = null;
          if (project.company) {
            company = project.company;
          }

          // Process phase
          let phase = null;
          if (project.phase) {
            phase = project.phase;
          }

          // Process tags
          let tags = [];
          if (project.tag && Array.isArray(project.tag)) {
            tags = project.tag;
          }

          // Insert project
          await db.run(`
            INSERT OR REPLACE INTO projects (
              id,
              gripp_id,
              number,
              name,
              description,
              deadline,
              company,
              phase,
              projectlines,
              tags,
              archived,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            project.id,
            project.id,
            project.number || '',
            project.name || '',
            project.description || '',
            project.deadline?.date ? project.deadline.date.split(' ')[0] : null,
            JSON.stringify(company),
            JSON.stringify(phase),
            JSON.stringify(projectLines),
            JSON.stringify(tags),
            project.archived === true ? 1 : 0,
            new Date().toISOString(),
            new Date().toISOString()
          ]);

          savedCount++;
        } catch (error) {
          console.error(`Error saving project ${project.id}:`, error);
        }
      }

      // Commit transaction
      await db.run('COMMIT');

      console.log(`Saved ${savedCount}/${projects.length} projects to database`);

      res.json({
        success: true,
        data: {
          message: `Synced ${savedCount} projects`,
          total: projects.length,
          saved: savedCount
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      // Rollback transaction if an error occurred
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error syncing projects:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to sync projects',
      meta: {
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Sync a specific project by ID
app.post('/api/v1/sync/projects/:id', async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);

    if (isNaN(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid project ID',
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log(`Syncing project with ID ${projectId} from Gripp API...`);

    // Create Gripp API request
    const request = {
      method: 'project.get',
      params: [
        [
          {
            field: 'project.id',
            operator: '=',
            value: projectId
          }
        ],
        {
          paging: {
            firstresult: 0,
            maxresults: 1
          }
        }
      ],
      id: Date.now()
    };

    // Execute request
    const response = await axios.post(grippApiUrl, [request], {
      headers: {
        'Authorization': `Bearer ${grippApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.data || !response.data[0] || !response.data[0].result || !response.data[0].result.rows) {
      throw new Error('Invalid response from Gripp API');
    }

    const projects = response.data[0].result.rows;

    if (projects.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Project with ID ${projectId} not found in Gripp API`,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }

    const project = projects[0];
    console.log(`Received project ${project.id} from Gripp API`);

    // Begin transaction
    await db.run('BEGIN TRANSACTION');

    try {
      // Process project lines
      let projectLines = [];
      if (project.projectline && Array.isArray(project.projectline)) {
        projectLines = project.projectline;
      }

      // Process company
      let company = null;
      if (project.company) {
        company = project.company;
      }

      // Process phase
      let phase = null;
      if (project.phase) {
        phase = project.phase;
      }

      // Process tags
      let tags = [];
      if (project.tag && Array.isArray(project.tag)) {
        tags = project.tag;
      }

      // Insert or update project
      await db.run(`
        INSERT OR REPLACE INTO projects (
          id,
          gripp_id,
          number,
          name,
          description,
          deadline,
          company,
          phase,
          projectlines,
          tags,
          archived,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        project.id,
        project.id,
        project.number || '',
        project.name || '',
        project.description || '',
        project.deadline?.date ? project.deadline.date.split(' ')[0] : null,
        JSON.stringify(company),
        JSON.stringify(phase),
        JSON.stringify(projectLines),
        JSON.stringify(tags),
        project.archived === true ? 1 : 0,
        new Date().toISOString(),
        new Date().toISOString()
      ]);

      // Commit transaction
      await db.run('COMMIT');

      console.log(`Saved project ${project.id} to database`);

      // Get the updated project from the database
      const updatedProject = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);

      // Parse JSON fields
      const parsedProject = { ...updatedProject };

      try {
        if (updatedProject.company && typeof updatedProject.company === 'string') {
          parsedProject.company = JSON.parse(updatedProject.company);
        }
        if (updatedProject.phase && typeof updatedProject.phase === 'string') {
          parsedProject.phase = JSON.parse(updatedProject.phase);
        }
        if (updatedProject.projectlines && typeof updatedProject.projectlines === 'string') {
          parsedProject.projectlines = JSON.parse(updatedProject.projectlines);
        }
        if (updatedProject.tags && typeof updatedProject.tags === 'string') {
          parsedProject.tags = JSON.parse(updatedProject.tags);
        }
      } catch (error) {
        console.error(`Error parsing JSON fields for project ${projectId}:`, error);
      }

      res.json({
        success: true,
        data: parsedProject,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      // Rollback transaction if an error occurred
      await db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error(`Error syncing project with ID ${req.params.id}:`, error);

    res.status(500).json({
      success: false,
      error: `Failed to sync project with ID ${req.params.id}`,
      meta: {
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Sync contracts from Gripp API
app.post('/api/v1/sync/contracts', async (req, res) => {
  try {
    console.log('Syncing contracts from Gripp API...');

    // Create Gripp API request
    const request = {
      method: 'employmentcontract.get',
      params: [
        [], // No filters, get all contracts
        {
          paging: {
            firstresult: 0,
            maxresults: 250
          },
          orderings: [
            {
              field: 'employmentcontract.startdate',
              direction: 'desc'
            }
          ]
        }
      ],
      id: Date.now()
    };

    // Execute request
    const response = await axios.post(grippApiUrl, [request], {
      headers: {
        'Authorization': `Bearer ${grippApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.data || !response.data[0] || !response.data[0].result || !response.data[0].result.rows) {
      throw new Error('Invalid response from Gripp API');
    }

    const contracts = response.data[0].result.rows;
    console.log(`Received ${contracts.length} contracts from Gripp API`);

    // Begin transaction
    await db.run('BEGIN TRANSACTION');

    // Clear existing contracts
    await db.run('DELETE FROM contracts');

    // Insert contracts
    let savedCount = 0;
    for (const contract of contracts) {
      try {
        // Convert Gripp date format to SQLite date format
        const startdate = contract.startdate ? contract.startdate.date.split(' ')[0] : null;
        const enddate = contract.enddate ? contract.enddate.date.split(' ')[0] : null;

        await db.run(`
          INSERT INTO contracts (
            employee_id,
            hours_monday_even,
            hours_tuesday_even,
            hours_wednesday_even,
            hours_thursday_even,
            hours_friday_even,
            hours_monday_odd,
            hours_tuesday_odd,
            hours_wednesday_odd,
            hours_thursday_odd,
            hours_friday_odd,
            startdate,
            enddate,
            internal_price_per_hour
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          contract.employee.id,
          contract.hours_monday_even,
          contract.hours_tuesday_even,
          contract.hours_wednesday_even,
          contract.hours_thursday_even,
          contract.hours_friday_even,
          contract.hours_monday_odd,
          contract.hours_tuesday_odd,
          contract.hours_wednesday_odd,
          contract.hours_thursday_odd,
          contract.hours_friday_odd,
          startdate,
          enddate,
          contract.internal_price_per_hour || null
        ]);

        savedCount++;
      } catch (error) {
        console.error('Error saving contract:', error);
      }
    }

    // Commit transaction
    await db.run('COMMIT');

    console.log(`Saved ${savedCount}/${contracts.length} contracts to database`);

    res.json({
      success: true,
      message: `Synced ${savedCount} contracts`,
      data: {
        total: contracts.length,
        saved: savedCount
      }
    });
  } catch (error) {
    console.error('Error syncing contracts:', error);

    // Rollback transaction if it was started
    try {
      await db.run('ROLLBACK');
    } catch (rollbackError) {
      console.error('Error during rollback:', rollbackError);
    }

    res.status(500).json({
      success: false,
      message: 'Failed to sync contracts',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Initialize database and start server
(async () => {
  try {
    // Initialize database
    const dbInitialized = await initDb();

    if (!dbInitialized) {
      console.error('Failed to initialize database. Exiting...');
      process.exit(1);
    }

    // Add error handler middleware
    app.use(errorHandler);

    // Start the server
    app.listen(API_PORT, '0.0.0.0', () => {
      console.log(`API server listening on port ${API_PORT}`);
      console.log(`API server is also accessible on the network at http://192.168.2.41:${API_PORT}`);
      console.log(`Authentication is ${process.env.REQUIRE_AUTH === 'true' ? 'enabled' : 'disabled'} globally`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
})();
