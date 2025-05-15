/**
 * Test API Server with Gripp Integration
 *
 * This script starts a simple Express server for testing with real Gripp data.
 */

import express from 'express';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { GrippApiClient } from './db/unified/api/gripp/client';
import { CacheManager } from './db/unified/cache';
import { createUnitOfWork } from './db/unified/unit-of-work';
import { ProjectAdapter } from './db/unified/api/adapters/project-adapter';
import { EmployeeAdapter } from './db/unified/api/adapters/employee-adapter';
import { InvoiceAdapter } from './db/unified/api/adapters/invoice-adapter';
import { HourAdapter } from './db/unified/api/adapters/hour-adapter';
import { GrippSyncService } from './db/unified/api/gripp/sync-service';

/**
 * Initialize the database schema
 *
 * @param db The database connection
 */
async function initializeDatabase(db: Database): Promise<void> {
  // Create projects table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY,
      name TEXT,
      number INTEGER,
      company INTEGER,
      companyName TEXT,
      phase TEXT,
      deadline TEXT,
      archived INTEGER DEFAULT 0,
      tags TEXT,
      projectLines TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  // Create employees table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY,
      firstname TEXT,
      lastname TEXT,
      email TEXT,
      function TEXT,
      active INTEGER DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  // Create hours table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS hours (
      id INTEGER PRIMARY KEY,
      employee INTEGER,
      project INTEGER,
      projectline INTEGER,
      date TEXT,
      amount REAL,
      description TEXT,
      status TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  // Create invoices table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY,
      number TEXT,
      company INTEGER,
      companyName TEXT,
      date TEXT,
      dueDate TEXT,
      status TEXT,
      total REAL,
      totalExclVat REAL,
      totalVat REAL,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  // Create sync_status table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sync_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT UNIQUE,
      last_sync TIMESTAMP,
      status TEXT,
      error TEXT
    )
  `);

  console.log('Database schema initialized');
}

/**
 * Seed the database with realistic test data that mimics real Gripp data
 *
 * @param db The database connection
 */
async function seedRealisticDatabase(db: Database): Promise<void> {
  // Create companies
  const companies = [
    { id: 1, name: 'Bravoure', type: 'client' },
    { id: 2, name: 'IRIS', type: 'client' },
    { id: 3, name: 'Acme Corp', type: 'client' },
    { id: 4, name: 'TechSolutions', type: 'client' },
    { id: 5, name: 'Global Innovations', type: 'client' }
  ];

  // Create project lines for different projects
  const projectLines1 = JSON.stringify([
    { id: 1, amount: 100, amountWritten: 75, description: 'Development', sellingPrice: 100, sellingRate: 100, product: 1, productName: 'Development' },
    { id: 2, amount: 50, amountWritten: 40, description: 'Design', sellingPrice: 90, sellingRate: 90, product: 2, productName: 'Design' },
    { id: 3, amount: 30, amountWritten: 25, description: 'Project Management', sellingPrice: 110, sellingRate: 110, product: 3, productName: 'Project Management' }
  ]);

  const projectLines2 = JSON.stringify([
    { id: 4, amount: 80, amountWritten: 85, description: 'Development', sellingPrice: 100, sellingRate: 100, product: 1, productName: 'Development' },
    { id: 5, amount: 40, amountWritten: 30, description: 'Testing', sellingPrice: 80, sellingRate: 80, product: 4, productName: 'Testing' },
    { id: 6, amount: 20, amountWritten: 15, description: 'Project Management', sellingPrice: 110, sellingRate: 110, product: 3, productName: 'Project Management' }
  ]);

  const projectLines3 = JSON.stringify([
    { id: 7, amount: 120, amountWritten: 20, description: 'Development', sellingPrice: 100, sellingRate: 100, product: 1, productName: 'Development' },
    { id: 8, amount: 60, amountWritten: 10, description: 'Design', sellingPrice: 90, sellingRate: 90, product: 2, productName: 'Design' },
    { id: 9, amount: 40, amountWritten: 5, description: 'Project Management', sellingPrice: 110, sellingRate: 110, product: 3, productName: 'Project Management' }
  ]);

  const projectLines4 = JSON.stringify([
    { id: 10, amount: 200, amountWritten: 150, description: 'Development', sellingPrice: 100, sellingRate: 100, product: 1, productName: 'Development' },
    { id: 11, amount: 100, amountWritten: 90, description: 'Design', sellingPrice: 90, sellingRate: 90, product: 2, productName: 'Design' },
    { id: 12, amount: 50, amountWritten: 40, description: 'Project Management', sellingPrice: 110, sellingRate: 110, product: 3, productName: 'Project Management' }
  ]);

  const projectLines5 = JSON.stringify([
    { id: 13, amount: 150, amountWritten: 160, description: 'Development', sellingPrice: 100, sellingRate: 100, product: 1, productName: 'Development' },
    { id: 14, amount: 75, amountWritten: 70, description: 'Design', sellingPrice: 90, sellingRate: 90, product: 2, productName: 'Design' },
    { id: 15, amount: 35, amountWritten: 30, description: 'Project Management', sellingPrice: 110, sellingRate: 110, product: 3, productName: 'Project Management' }
  ]);

  // Seed projects with realistic data
  await db.run(`
    INSERT INTO projects (id, name, number, company, companyName, phase, deadline, archived, tags, projectLines, createdAt, updatedAt)
    VALUES (1001, 'Website Redesign', 2023001, 1, 'Bravoure', 'In Progress', '2023-12-31', 0, 'website,design,development', ?, '2023-01-01', '2023-04-15')
  `, projectLines1);

  await db.run(`
    INSERT INTO projects (id, name, number, company, companyName, phase, deadline, archived, tags, projectLines, createdAt, updatedAt)
    VALUES (1002, 'Mobile App Development', 2023002, 2, 'IRIS', 'Completed', '2023-11-30', 0, 'mobile,app,development', ?, '2023-01-02', '2023-03-16')
  `, projectLines2);

  await db.run(`
    INSERT INTO projects (id, name, number, company, companyName, phase, deadline, archived, tags, projectLines, createdAt, updatedAt)
    VALUES (1003, 'E-commerce Platform', 2023003, 3, 'Acme Corp', 'Planning', '2024-01-31', 0, 'ecommerce,platform,development', ?, '2023-01-03', '2023-02-17')
  `, projectLines3);

  await db.run(`
    INSERT INTO projects (id, name, number, company, companyName, phase, deadline, archived, tags, projectLines, createdAt, updatedAt)
    VALUES (1004, 'CRM Integration', 2023004, 4, 'TechSolutions', 'In Progress', '2023-10-15', 0, 'crm,integration,development', ?, '2023-02-01', '2023-04-10')
  `, projectLines4);

  await db.run(`
    INSERT INTO projects (id, name, number, company, companyName, phase, deadline, archived, tags, projectLines, createdAt, updatedAt)
    VALUES (1005, 'Marketing Campaign', 2023005, 5, 'Global Innovations', 'In Progress', '2023-09-30', 0, 'marketing,campaign,design', ?, '2023-02-15', '2023-04-05')
  `, projectLines5);

  // Seed employees with realistic data
  await db.run(`
    INSERT INTO employees (id, firstname, lastname, email, function, active, createdAt, updatedAt)
    VALUES (101, 'John', 'Doe', 'john.doe@example.com', 'Senior Developer', 1, '2020-01-01', '2023-01-15')
  `);

  await db.run(`
    INSERT INTO employees (id, firstname, lastname, email, function, active, createdAt, updatedAt)
    VALUES (102, 'Jane', 'Smith', 'jane.smith@example.com', 'UI/UX Designer', 1, '2020-02-01', '2023-01-16')
  `);

  await db.run(`
    INSERT INTO employees (id, firstname, lastname, email, function, active, createdAt, updatedAt)
    VALUES (103, 'Michael', 'Johnson', 'michael.johnson@example.com', 'Project Manager', 1, '2020-03-01', '2023-01-17')
  `);

  await db.run(`
    INSERT INTO employees (id, firstname, lastname, email, function, active, createdAt, updatedAt)
    VALUES (104, 'Emily', 'Williams', 'emily.williams@example.com', 'Frontend Developer', 1, '2021-01-01', '2023-01-18')
  `);

  await db.run(`
    INSERT INTO employees (id, firstname, lastname, email, function, active, createdAt, updatedAt)
    VALUES (105, 'David', 'Brown', 'david.brown@example.com', 'Backend Developer', 1, '2021-02-01', '2023-01-19')
  `);

  // Seed hours with realistic data
  // Project 1 hours
  await db.run(`
    INSERT INTO hours (id, employee, project, projectline, date, amount, description, status, createdAt, updatedAt)
    VALUES (1001, 101, 1001, 1, '2023-04-01', 8, 'Development work on website backend', 'approved', '2023-04-01', '2023-04-15')
  `);

  await db.run(`
    INSERT INTO hours (id, employee, project, projectline, date, amount, description, status, createdAt, updatedAt)
    VALUES (1002, 102, 1001, 2, '2023-04-01', 6, 'Design work on website UI', 'approved', '2023-04-01', '2023-04-15')
  `);

  await db.run(`
    INSERT INTO hours (id, employee, project, projectline, date, amount, description, status, createdAt, updatedAt)
    VALUES (1003, 103, 1001, 3, '2023-04-01', 4, 'Project management and client meeting', 'approved', '2023-04-01', '2023-04-15')
  `);

  await db.run(`
    INSERT INTO hours (id, employee, project, projectline, date, amount, description, status, createdAt, updatedAt)
    VALUES (1004, 104, 1001, 1, '2023-04-02', 7, 'Frontend development work', 'approved', '2023-04-02', '2023-04-15')
  `);

  await db.run(`
    INSERT INTO hours (id, employee, project, projectline, date, amount, description, status, createdAt, updatedAt)
    VALUES (1005, 105, 1001, 1, '2023-04-02', 8, 'API development work', 'approved', '2023-04-02', '2023-04-15')
  `);

  // Project 2 hours
  await db.run(`
    INSERT INTO hours (id, employee, project, projectline, date, amount, description, status, createdAt, updatedAt)
    VALUES (1006, 101, 1002, 4, '2023-03-01', 8, 'Mobile app development', 'approved', '2023-03-01', '2023-03-15')
  `);

  await db.run(`
    INSERT INTO hours (id, employee, project, projectline, date, amount, description, status, createdAt, updatedAt)
    VALUES (1007, 104, 1002, 4, '2023-03-01', 7, 'Mobile app frontend work', 'approved', '2023-03-01', '2023-03-15')
  `);

  await db.run(`
    INSERT INTO hours (id, employee, project, projectline, date, amount, description, status, createdAt, updatedAt)
    VALUES (1008, 105, 1002, 5, '2023-03-02', 6, 'Testing and debugging', 'approved', '2023-03-02', '2023-03-15')
  `);

  await db.run(`
    INSERT INTO hours (id, employee, project, projectline, date, amount, description, status, createdAt, updatedAt)
    VALUES (1009, 103, 1002, 6, '2023-03-02', 4, 'Project management', 'approved', '2023-03-02', '2023-03-15')
  `);

  // Project 3 hours
  await db.run(`
    INSERT INTO hours (id, employee, project, projectline, date, amount, description, status, createdAt, updatedAt)
    VALUES (1010, 101, 1003, 7, '2023-02-01', 6, 'Initial development setup', 'approved', '2023-02-01', '2023-02-15')
  `);

  await db.run(`
    INSERT INTO hours (id, employee, project, projectline, date, amount, description, status, createdAt, updatedAt)
    VALUES (1011, 102, 1003, 8, '2023-02-01', 5, 'UI design concepts', 'approved', '2023-02-01', '2023-02-15')
  `);

  await db.run(`
    INSERT INTO hours (id, employee, project, projectline, date, amount, description, status, createdAt, updatedAt)
    VALUES (1012, 103, 1003, 9, '2023-02-02', 3, 'Project planning', 'approved', '2023-02-02', '2023-02-15')
  `);

  // Project 4 hours
  await db.run(`
    INSERT INTO hours (id, employee, project, projectline, date, amount, description, status, createdAt, updatedAt)
    VALUES (1013, 101, 1004, 10, '2023-04-03', 8, 'CRM integration development', 'approved', '2023-04-03', '2023-04-10')
  `);

  await db.run(`
    INSERT INTO hours (id, employee, project, projectline, date, amount, description, status, createdAt, updatedAt)
    VALUES (1014, 102, 1004, 11, '2023-04-03', 6, 'Interface design for CRM', 'approved', '2023-04-03', '2023-04-10')
  `);

  await db.run(`
    INSERT INTO hours (id, employee, project, projectline, date, amount, description, status, createdAt, updatedAt)
    VALUES (1015, 103, 1004, 12, '2023-04-04', 4, 'Project coordination', 'approved', '2023-04-04', '2023-04-10')
  `);

  // Project 5 hours
  await db.run(`
    INSERT INTO hours (id, employee, project, projectline, date, amount, description, status, createdAt, updatedAt)
    VALUES (1016, 102, 1005, 14, '2023-04-01', 7, 'Marketing materials design', 'approved', '2023-04-01', '2023-04-05')
  `);

  await db.run(`
    INSERT INTO hours (id, employee, project, projectline, date, amount, description, status, createdAt, updatedAt)
    VALUES (1017, 104, 1005, 13, '2023-04-02', 6, 'Campaign website development', 'approved', '2023-04-02', '2023-04-05')
  `);

  await db.run(`
    INSERT INTO hours (id, employee, project, projectline, date, amount, description, status, createdAt, updatedAt)
    VALUES (1018, 103, 1005, 15, '2023-04-03', 4, 'Campaign management', 'approved', '2023-04-03', '2023-04-05')
  `);

  // No dummy invoices - we'll use real Gripp data instead
  console.log('Skipping dummy invoice data - will use real Gripp data instead');

  console.log('Database seeded with realistic test data');
}

// Initialize the API server
async function initializeApiServer() {
  // Create Express server
  const app = express();

  // Enable CORS
  app.use(cors());

  // Parse JSON body
  app.use(express.json());

  // Create Gripp API client
  const apiClient = new GrippApiClient({
    apiKey: 'mi3Pq0Pfw6CtuFAtEoQ6gXIT7cra2c',
    baseUrl: process.env.GRIPP_API_URL || 'https://api.gripp.com/public/api3.php',
    maxRetries: 3,
    retryDelay: 1000,
    rateLimit: 10, // 10 requests per second
    timeout: 30000 // 30 seconds
  });

  // Create cache manager
  const cacheManager = new CacheManager();

  // Create SQLite database connection to the real database file
  const db = await open({
    filename: 'src/db/database.sqlite', // Use the real database file
    driver: sqlite3.Database
  });

  // Create unit of work with real repositories
  const unitOfWork = await createUnitOfWork(db, false);

  // Log database status
  const employeeCount = await db.get('SELECT COUNT(*) as count FROM employees');
  console.log(`Using real database with ${employeeCount.count} employees`);

  // Create sync service
  const syncService = new GrippSyncService(apiClient, db);

  // Add sync endpoint
  app.post('/api/v1/sync', async (req, res) => {
    try {
      console.log('Syncing data from Gripp API...', req.body);

      // Initialize sync service
      await syncService.initialize();

      // Determine if this is a full or incremental sync
      // Default to incremental sync if not specified
      const isIncremental = req.body.incremental !== false;
      const force = req.body.force === true;

      // For backward compatibility, if no parameters are provided, assume incremental sync
      // This is needed for the dashboard components that don't provide any parameters
      console.log(`Starting ${isIncremental ? 'incremental' : 'full'} synchronization${force ? ' (forced)' : ''}...`);

      // Actually sync data from Gripp API
      console.log('Starting real data synchronization...');
      await syncService.syncAll(isIncremental);

      console.log('Data synced successfully from Gripp API');

      res.json({
        success: true,
        message: 'Data synced successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error syncing data:', error);

      res.status(500).json({
        success: false,
        message: 'Error syncing data',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Add sync invoices endpoint
  app.post('/api/v1/sync/invoices', async (req, res) => {
    try {
      console.log('Syncing invoices from Gripp API...', req.body);

      // Initialize sync service
      await syncService.initialize();

      // Determine if this is a full or incremental sync
      // Default to incremental sync if not specified
      const isIncremental = req.body.incremental !== false;
      const force = req.body.force === true;

      console.log(`Starting ${isIncremental ? 'incremental' : 'full'} invoice synchronization${force ? ' (forced)' : ''}...`);

      // Actually sync invoices from Gripp API
      console.log('Starting invoice synchronization...');
      await syncService.syncInvoices(isIncremental);

      console.log('Invoices synced successfully from Gripp API');

      res.json({
        success: true,
        message: 'Invoices synced successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error syncing invoices:', error);

      res.status(500).json({
        success: false,
        message: 'Error syncing invoices',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Add cache clear endpoint
  app.post('/api/v1/cache/clear', async (req, res) => {
    try {
      console.log('Clearing cache...');

      // Get entity from request body
      const entity = req.body.entity || 'all';

      console.log(`Clearing cache for entity: ${entity}`);

      // Clear cache
      if (entity === 'all') {
        cacheManager.clearAll();
      } else {
        cacheManager.clear(entity);
      }

      console.log('Cache cleared successfully');

      res.json({
        success: true,
        message: `Cache cleared successfully for entity: ${entity}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error clearing cache:', error);

      res.status(500).json({
        success: false,
        message: 'Error clearing cache',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

// Define routes
app.get('/api/v1', (req, res) => {
  res.json({
    message: 'Welcome to the API',
    version: '1.0.0',
    endpoints: [
      '/api/v1/projects',
      '/api/v1/employees',
      '/api/v1/employees/week-stats',
      '/api/v1/employees/month-stats',
      '/api/v1/hours',
      '/api/v1/invoices',
      '/api/v1/sync',
      '/api/v1/cache/clear',
      '/api/v1/health',
      '/api/dashboard/projects/active'
    ]
  });
});

// Add health endpoint
app.get('/api/v1/health', (req, res) => {
  console.log('Health check requested');

  // Check database connection
  const dbConnected = db !== null;

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
});

// Dashboard routes for backward compatibility
app.get('/api/dashboard/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working',
    timestamp: new Date().toISOString()
  });
});

// Dashboard statistics endpoint
app.get('/api/dashboard/statistics', async (req, res) => {
  try {
    console.log('Fetching dashboard statistics...');

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
    const projectsOverBudget = await db.all(`
      SELECT id, name, number, company, projectLines
      FROM projects
      WHERE archived = 0
    `);

    // Calculate projects over budget
    const overBudgetProjects = projectsOverBudget.filter(project => {
      try {
        const projectLines = JSON.parse(project.projectLines || '[]');
        return projectLines.some(line => line.amountWritten > line.amount);
      } catch (e) {
        return false;
      }
    });

    // Get projects with rules over budget
    const projectsWithRulesOverBudget = projectsOverBudget.filter(project => {
      try {
        const projectLines = JSON.parse(project.projectLines || '[]');
        return !projectLines.every(line => line.amountWritten > line.amount) &&
               projectLines.some(line => line.amountWritten > line.amount);
      } catch (e) {
        return false;
      }
    });

    // Get on-schedule projects
    const onScheduleProjects = await db.all(`
      SELECT COUNT(*) as count FROM projects
      WHERE (deadline >= date('now') OR deadline IS NULL) AND archived = 0
    `);

    // Return dashboard statistics
    res.json({
      success: true,
      data: {
        totalProjects: projectCount.count || 0,
        activeEmployees: employeeCount.count || 0,
        overdueDeadlines: overdueProjects[0].count || 0,
        projectsOverBudget: overBudgetProjects.length || 0,
        projectsWithRulesOverBudget: projectsWithRulesOverBudget.length || 0,
        onScheduleProjects: onScheduleProjects[0].count || 0,
        invoiceCount: invoiceCount.count || 0
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard statistics:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to fetch dashboard statistics',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Dashboard invoice statistics endpoint
app.get('/api/dashboard/invoices/statistics', async (req, res) => {
  try {
    console.log('Fetching invoice statistics...');

    // Get total invoices
    const totalInvoices = await db.get('SELECT COUNT(*) as count FROM invoices');

    // Get paid invoices
    const paidInvoices = await db.get("SELECT COUNT(*) as count FROM invoices WHERE status = 'paid'");

    // Get pending invoices
    const pendingInvoices = await db.get("SELECT COUNT(*) as count FROM invoices WHERE status = 'pending'");

    // Get overdue invoices
    const overdueInvoices = await db.get(`
      SELECT COUNT(*) as count FROM invoices
      WHERE dueDate < date('now') AND status != 'paid'
    `);

    // Return invoice statistics
    res.json({
      success: true,
      data: {
        total: totalInvoices.count || 0,
        paid: paidInvoices.count || 0,
        pending: pendingInvoices.count || 0,
        overdue: overdueInvoices.count || 0
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching invoice statistics:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to fetch invoice statistics',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Dashboard overdue invoices endpoint
app.get('/api/dashboard/invoices/overdue', async (req, res) => {
  try {
    console.log('Fetching overdue invoices...');

    // Get overdue invoices
    const overdueInvoices = await db.all(`
      SELECT * FROM invoices
      WHERE dueDate < date('now') AND status != 'paid'
      ORDER BY dueDate ASC
      LIMIT 10
    `);

    // Calculate days overdue
    const overdueInvoicesWithDays = overdueInvoices.map(invoice => {
      const dueDate = new Date(invoice.dueDate);
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - dueDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        ...invoice,
        daysOverdue: diffDays
      };
    });

    // Return overdue invoices
    res.json({
      success: true,
      data: overdueInvoicesWithDays,
      meta: {
        timestamp: new Date().toISOString(),
        total: overdueInvoicesWithDays.length
      }
    });
  } catch (error) {
    console.error('Error fetching overdue invoices:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to fetch overdue invoices',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Dashboard projects over budget endpoint
app.get('/api/dashboard/projects/over-budget', async (req, res) => {
  try {
    console.log('Fetching projects over budget...');

    // Get all non-archived projects
    const projects = await db.all(`
      SELECT id, name, number, company, projectLines
      FROM projects
      WHERE archived = 0
    `);

    // Filter projects over budget
    const projectsOverBudget = projects.filter(project => {
      try {
        const projectLines = JSON.parse(project.projectLines || '[]');
        return projectLines.some(line => line.amountWritten > line.amount);
      } catch (e) {
        return false;
      }
    }).map(project => {
      try {
        const projectLines = JSON.parse(project.projectLines || '[]');
        const overBudgetAmount = projectLines.reduce((total, line) => {
          if (line.amountWritten > line.amount) {
            return total + ((line.amountWritten - line.amount) * (line.sellingRate || 0));
          }
          return total;
        }, 0);

        return {
          id: project.id,
          name: project.name,
          number: project.number,
          company: project.company,
          companyName: project.company, // Use company ID as name for now
          overBudgetAmount: overBudgetAmount
        };
      } catch (e) {
        return {
          id: project.id,
          name: project.name,
          number: project.number,
          company: project.company,
          companyName: project.company, // Use company ID as name for now
          overBudgetAmount: 0
        };
      }
    });

    // Return projects over budget
    res.json({
      success: true,
      data: projectsOverBudget,
      meta: {
        timestamp: new Date().toISOString(),
        total: projectsOverBudget.length
      }
    });
  } catch (error) {
    console.error('Error fetching projects over budget:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to fetch projects over budget',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Dashboard projects with rules over budget endpoint
app.get('/api/dashboard/projects/rules-over-budget', async (req, res) => {
  try {
    console.log('Fetching projects with rules over budget...');

    // Get all non-archived projects
    const projects = await db.all(`
      SELECT id, name, number, company, projectLines
      FROM projects
      WHERE archived = 0
    `);

    // Filter projects with rules over budget
    const projectsWithRulesOverBudget = projects.filter(project => {
      try {
        const projectLines = JSON.parse(project.projectLines || '[]');
        return !projectLines.every(line => line.amountWritten > line.amount) &&
               projectLines.some(line => line.amountWritten > line.amount);
      } catch (e) {
        return false;
      }
    }).map(project => {
      try {
        const projectLines = JSON.parse(project.projectLines || '[]');
        const overBudgetLines = projectLines.filter(line => line.amountWritten > line.amount);
        const overBudgetAmount = overBudgetLines.reduce((total, line) => {
          return total + ((line.amountWritten - line.amount) * (line.sellingRate || 0));
        }, 0);

        return {
          id: project.id,
          name: project.name,
          number: project.number,
          company: project.company,
          companyName: project.company, // Use company ID as name for now
          overBudgetAmount: overBudgetAmount,
          overBudgetLines: overBudgetLines
        };
      } catch (e) {
        return {
          id: project.id,
          name: project.name,
          number: project.number,
          company: project.company,
          companyName: project.company, // Use company ID as name for now
          overBudgetAmount: 0,
          overBudgetLines: []
        };
      }
    });

    // Return projects with rules over budget
    res.json({
      success: true,
      data: projectsWithRulesOverBudget,
      meta: {
        timestamp: new Date().toISOString(),
        total: projectsWithRulesOverBudget.length
      }
    });
  } catch (error) {
    console.error('Error fetching projects with rules over budget:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to fetch projects with rules over budget',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Dashboard employees with unwritten hours endpoint
app.get('/api/dashboard/employees/unwritten-hours', async (req, res) => {
  try {
    console.log('Fetching employees with unwritten hours...');

    // Create employee adapter
    const employeeAdapter = new EmployeeAdapter(unitOfWork, apiClient, cacheManager);

    // Get current year and week
    const today = new Date();
    const year = today.getFullYear();
    const week = Math.ceil((today.getDate() + today.getDay()) / 7);

    // Get employee week data
    const result = await employeeAdapter.getForWeek({
      year,
      week,
      refresh: true
    });

    // Filter employees with unwritten hours
    const employeesWithUnwrittenHours = result.data.filter(employee => {
      return employee.expected_hours > employee.written_hours;
    }).map(employee => {
      return {
        id: employee.id,
        name: `${employee.firstname} ${employee.lastname}`,
        function: employee.function || '-',
        expectedHours: employee.expected_hours || 0,
        writtenHours: employee.written_hours || 0,
        unwrittenHours: (employee.expected_hours || 0) - (employee.written_hours || 0)
      };
    });

    // Return employees with unwritten hours
    res.json({
      success: true,
      data: employeesWithUnwrittenHours,
      meta: {
        timestamp: new Date().toISOString(),
        total: employeesWithUnwrittenHours.length,
        year,
        week
      }
    });
  } catch (error) {
    console.error('Error fetching employees with unwritten hours:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to fetch employees with unwritten hours',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

app.get('/api/dashboard/projects/active', async (req, res) => {
  try {
    // Create project adapter
    const projectAdapter = new ProjectAdapter(unitOfWork, apiClient, cacheManager);

    // Get projects with archived=false
    const result = await projectAdapter.getAll({
      ...req.query,
      archived: 'false'
    });

    // Return response in the format expected by the dashboard
    res.json({
      success: true,
      response: result.data,
      error: null
    });
  } catch (error) {
    console.error('Error getting active projects:', error);
    res.status(500).json({
      success: false,
      response: null,
      error: error instanceof Error ? error.message : 'Failed to get active projects'
    });
  }
});

// Project routes
app.get('/api/v1/projects', async (req, res) => {
  try {
    // Create project adapter
    const projectAdapter = new ProjectAdapter(unitOfWork, apiClient, cacheManager);

    // Get projects
    const result = await projectAdapter.getAll(req.query);

    // Return response
    res.json(result);
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to get projects',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

app.get('/api/v1/projects/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    // Create project adapter
    const projectAdapter = new ProjectAdapter(unitOfWork, apiClient, cacheManager);

    // Get project by ID
    const result = await projectAdapter.getById(id, req.query);

    // Return response
    res.json(result);
  } catch (error) {
    console.error('Error getting project:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to get project',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Project sync endpoint
app.post('/api/v1/projects/sync', async (req, res) => {
  try {
    const force = req.body.force === true;
    console.log(`Syncing projects (force=${force})...`);

    // Create project adapter
    const projectAdapter = new ProjectAdapter(unitOfWork, apiClient, cacheManager);

    // Sync projects
    const result = await projectAdapter.sync({ force });

    console.log(`Projects synced successfully`);

    // Return response
    res.json({
      success: true,
      data: { synced: true },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error syncing projects:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to sync projects',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Employee routes
app.get('/api/v1/employees', async (req, res) => {
  try {
    // Create employee adapter
    const employeeAdapter = new EmployeeAdapter(unitOfWork, apiClient, cacheManager);

    // Get employees
    const result = await employeeAdapter.getAll(req.query);

    // Return response
    res.json(result);
  } catch (error) {
    console.error('Error getting employees:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to get employees',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Legacy employee-stats endpoint for backward compatibility
app.get('/api/employee-stats', async (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const week = parseInt(req.query.week as string) || 1;
    const isDashboard = req.query.dashboard === 'true';
    const forceRefresh = req.query.refresh === 'true';

    console.log(`Legacy endpoint: Redirecting to /api/v1/employees/week-stats for year=${year}, week=${week}, isDashboard=${isDashboard}, forceRefresh=${forceRefresh}`);

    // Set cache-control headers to prevent browser caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Create employee adapter
    const employeeAdapter = new EmployeeAdapter(unitOfWork, apiClient, cacheManager);

    // Get employee week data
    const result = await employeeAdapter.getForWeek({
      year,
      week,
      refresh: forceRefresh,
      ...req.query
    });

    // Format response for legacy endpoint
    const employeeData = result.data.map(employee => ({
      id: employee.id,
      name: `${employee.firstname} ${employee.lastname}`,
      function: employee.function || '-',
      contract_period: employee.contract_period || 'full',
      contract_hours: employee.contract_hours || 40,
      week_contract_hours: employee.contract_hours || 40,
      holiday_hours: employee.holiday_hours || 0,
      expected_hours: employee.expected_hours || 40,
      written_hours: employee.written_hours || 0,
      total_hours: employee.actual_hours || 0,
      actual_hours: employee.actual_hours || 0,
      leave_hours: employee.leave_hours || 0,
      daily_hours: employee.daily_hours || [],
      difference: (employee.actual_hours || 0) - (employee.expected_hours || 40),
      percentage: employee.expected_hours > 0
        ? Math.round(((employee.actual_hours || 0) / employee.expected_hours) * 100)
        : 0,
      dates: employee.dates || []
    }));

    // Return response in the format expected by the legacy code
    res.json({
      success: true,
      response: employeeData
    });
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

// New employee-month-stats endpoint for the unified data structure
app.get('/api/employee-month-stats', async (req, res) => {
  try {
    // Get query parameters
    console.log('Legacy employee-month-stats request params:', req.query);
    console.log('Stack trace:', new Error().stack);

    // Parse year and month with validation
    let year = new Date().getFullYear();
    let month = new Date().getMonth() + 1;

    if (req.query.year) {
      const parsedYear = parseInt(req.query.year as string);
      if (!isNaN(parsedYear)) {
        year = parsedYear;
      } else {
        console.warn(`Invalid year parameter: ${req.query.year}, using current year instead`);
      }
    }

    if (req.query.month) {
      const parsedMonth = parseInt(req.query.month as string);
      if (!isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
        month = parsedMonth;
      } else {
        console.warn(`Invalid month parameter: ${req.query.month}, using month ${new Date().getMonth() + 1} instead`);
      }
    }

    const isDashboard = req.query.dashboard === 'true';
    const forceRefresh = req.query.refresh === 'true';

    console.log(`Legacy endpoint: Redirecting to /api/v1/employees/month-stats for year=${year}, month=${month}, isDashboard=${isDashboard}, forceRefresh=${forceRefresh}`);

    // Set cache-control headers to prevent browser caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Create employee adapter
    const employeeAdapter = new EmployeeAdapter(unitOfWork, apiClient, cacheManager, db);

    // Get employee month data
    const result = await employeeAdapter.getForMonth({
      year,
      month,
      dashboard: isDashboard ? 'true' : 'false',
      refresh: forceRefresh,
      ...req.query
    });

    // Format response for legacy endpoint
    const employeeData = result.data.map(employee => ({
      id: employee.id,
      name: `${employee.firstname} ${employee.lastname}`,
      function: employee.function || '-',
      contract_period: employee.contract_period || 'full',
      contract_hours: employee.contract_hours || 40,
      month_contract_hours: employee.contract_hours || 160,
      holiday_hours: employee.holiday_hours || 0,
      expected_hours: employee.expected_hours || 160,
      written_hours: employee.written_hours || 0,
      total_hours: employee.actual_hours || 0,
      actual_hours: employee.actual_hours || 0,
      leave_hours: employee.leave_hours || 0,
      difference: (employee.actual_hours || 0) - (employee.expected_hours || 160),
      percentage: employee.expected_hours > 0
        ? Math.round(((employee.actual_hours || 0) / employee.expected_hours) * 100)
        : 0,
      dates: employee.dates || []
    }));

    // Return response in the format expected by the legacy code
    res.json({
      success: true,
      response: employeeData
    });
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

// Employee week data
app.get('/api/v1/employees/week', async (req, res) => {
  try {
    // Create employee adapter
    const employeeAdapter = new EmployeeAdapter(unitOfWork, apiClient, cacheManager, db);

    // Get query parameters
    console.log('Employee week request params:', req.query);
    console.log('Stack trace:', new Error().stack);

    // Parse year and week with validation
    let year = new Date().getFullYear();
    let week = 1;

    if (req.query.year) {
      const parsedYear = parseInt(req.query.year as string);
      if (!isNaN(parsedYear)) {
        year = parsedYear;
      } else {
        console.warn(`Invalid year parameter: ${req.query.year}, using current year instead`);
      }
    }

    if (req.query.week) {
      const parsedWeek = parseInt(req.query.week as string);
      if (!isNaN(parsedWeek) && parsedWeek >= 1 && parsedWeek <= 53) {
        week = parsedWeek;
      } else {
        console.warn(`Invalid week parameter: ${req.query.week}, using week 1 instead`);
      }
    }

    // Get employee week data
    const result = await employeeAdapter.getForWeek({
      year,
      week,
      ...req.query
    });

    // Return response
    res.json(result);
  } catch (error) {
    console.error('Error getting employee week data:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to get employee week data',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Employee week stats
app.get('/api/v1/employees/week-stats', async (req, res) => {
  try {
    // Log all request parameters for debugging
    console.log('Employee week stats request params:', req.query);

    // Create employee adapter with real database
    const employeeAdapter = new EmployeeAdapter(unitOfWork, apiClient, cacheManager, db);

    // Parse year and week with validation
    let year = new Date().getFullYear();
    let week = 1;

    if (req.query.year) {
      const parsedYear = parseInt(req.query.year as string);
      if (!isNaN(parsedYear)) {
        year = parsedYear;
      } else {
        console.warn(`Invalid year parameter: ${req.query.year}, using current year instead`);
      }
    }

    if (req.query.week) {
      const parsedWeek = parseInt(req.query.week as string);
      if (!isNaN(parsedWeek) && parsedWeek >= 1 && parsedWeek <= 53) {
        week = parsedWeek;
      } else {
        console.warn(`Invalid week parameter: ${req.query.week}, using week 1 instead`);
      }
    }

    // Get employee week data from the real database
    const result = await employeeAdapter.getForWeek(req, res);

    // Return real data
    res.json(result);
  } catch (error) {
    console.error('Error getting employee week stats:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to get employee week stats',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Employee month data
app.get('/api/v1/employees/month', async (req, res) => {
  try {
    // Create employee adapter
    const employeeAdapter = new EmployeeAdapter(unitOfWork, apiClient, cacheManager, db);

    // Get query parameters
    console.log('Employee month request params:', req.query);
    console.log('Stack trace:', new Error().stack);

    // Parse year and month with validation
    let year = new Date().getFullYear();
    let month = 1;

    if (req.query.year) {
      const parsedYear = parseInt(req.query.year as string);
      if (!isNaN(parsedYear)) {
        year = parsedYear;
      } else {
        console.warn(`Invalid year parameter: ${req.query.year}, using current year instead`);
      }
    }

    if (req.query.month) {
      const parsedMonth = parseInt(req.query.month as string);
      if (!isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
        month = parsedMonth;
      } else {
        console.warn(`Invalid month parameter: ${req.query.month}, using month 1 instead`);
      }
    }

    // Get employee month data
    const result = await employeeAdapter.getForMonth(req, res);

    // Return response
    res.json(result);
  } catch (error) {
    console.error('Error getting employee month data:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to get employee month data',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Employee month stats
app.get('/api/v1/employees/month-stats', async (req, res) => {
  try {
    // Log all request parameters for debugging
    console.log('Employee month stats request params:', req.query);

    // Create employee adapter with real database
    const employeeAdapter = new EmployeeAdapter(unitOfWork, apiClient, cacheManager, db);

    // Parse year and month with validation
    let year = new Date().getFullYear();
    let month = new Date().getMonth() + 1;

    if (req.query.year) {
      const parsedYear = parseInt(req.query.year as string);
      if (!isNaN(parsedYear)) {
        year = parsedYear;
      } else {
        console.warn(`Invalid year parameter: ${req.query.year}, using current year instead`);
      }
    }

    if (req.query.month) {
      const parsedMonth = parseInt(req.query.month as string);
      if (!isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
        month = parsedMonth;
      } else {
        console.warn(`Invalid month parameter: ${req.query.month}, using current month instead`);
      }
    }

    // Get employee month data from the real database
    const result = await employeeAdapter.getForMonth(req, res);

    // Return real data
    res.json(result);
  } catch (error) {
    console.error('Error getting employee month stats:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to get employee month stats',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

app.get('/api/v1/employees/:id', async (req, res) => {
  try {
    const idParam = req.params.id;
    console.log(`API request for employee with ID: ${idParam}, type: ${typeof idParam}`);

    // Create employee adapter
    const employeeAdapter = new EmployeeAdapter(unitOfWork, apiClient, cacheManager, db);

    // Get employee by ID
    const result = await employeeAdapter.getById(Number(idParam));

    // Return response
    return res.json(result);
  } catch (error) {
    console.error('Error getting employee:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to get employee',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Update function titles
app.post('/api/v1/employees/update-function-titles', async (req, res) => {
  try {
    console.log('Updating function titles...');

    // Create employee adapter
    const employeeAdapter = new EmployeeAdapter(unitOfWork, apiClient, cacheManager, db);

    // Update function titles
    await employeeAdapter.updateFunctionTitles(req, res);
  } catch (error) {
    console.error('Error updating function titles:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to update function titles',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Hour routes
app.get('/api/v1/hours', async (req, res) => {
  try {
    // Create hour adapter
    const hourAdapter = new HourAdapter(unitOfWork, apiClient, cacheManager);

    // Get hours
    const result = await hourAdapter.getAll(req.query);

    // Return response
    res.json(result);
  } catch (error) {
    console.error('Error getting hours:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to get hours',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

app.get('/api/v1/hours/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    // Create hour adapter
    const hourAdapter = new HourAdapter(unitOfWork, apiClient, cacheManager);

    // Get hour by ID
    const result = await hourAdapter.getById(id, req.query);

    // Return response
    res.json(result);
  } catch (error) {
    console.error('Error getting hour:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to get hour',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});





app.get('/api/v1/employees/:id/hours', async (req, res) => {
  try {
    const employeeId = Number(req.params.id);

    // Create hour adapter
    const hourAdapter = new HourAdapter(unitOfWork, apiClient, cacheManager);

    // Get employee hours
    const result = await hourAdapter.getByEmployeeId(employeeId, req.query);

    // Return response
    res.json(result);
  } catch (error) {
    console.error('Error getting employee hours:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to get employee hours',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Invoice routes
app.get('/api/v1/invoices', async (req, res) => {
  try {
    // Create invoice adapter
    const invoiceAdapter = new InvoiceAdapter(unitOfWork, apiClient, cacheManager);

    // Get invoices
    const result = await invoiceAdapter.getAll(req.query);

    // Return response
    res.json(result);
  } catch (error) {
    console.error('Error getting invoices:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to get invoices',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

app.get('/api/v1/invoices/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    // Create invoice adapter
    const invoiceAdapter = new InvoiceAdapter(unitOfWork, apiClient, cacheManager);

    // Get invoice by ID
    const result = await invoiceAdapter.getById(id, req.query);

    // Return response
    res.json(result);
  } catch (error) {
    console.error('Error getting invoice:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to get invoice',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

app.get('/api/v1/invoices/:id/lines', async (req, res) => {
  try {
    const invoiceId = Number(req.params.id);

    // Create invoice adapter
    const invoiceAdapter = new InvoiceAdapter(unitOfWork, apiClient, cacheManager);

    // Get invoice lines
    const result = await invoiceAdapter.getLines(invoiceId, req.query);

    // Return response
    res.json(result);
  } catch (error) {
    console.error('Error getting invoice lines:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to get invoice lines',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

app.get('/api/v1/companies/:id/invoices', async (req, res) => {
  try {
    const companyId = Number(req.params.id);

    // Create invoice adapter
    const invoiceAdapter = new InvoiceAdapter(unitOfWork, apiClient, cacheManager);

    // Get company invoices
    const result = await invoiceAdapter.getByCompanyId(companyId, req.query);

    // Return response
    res.json(result);
  } catch (error) {
    console.error('Error getting company invoices:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to get company invoices',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Cache clear endpoint
app.post('/api/v1/cache/clear', async (req, res) => {
  try {
    const entity = req.body.entity || 'all';
    console.log(`Clearing cache for entity: ${entity}`);

    if (entity === 'all') {
      // Clear all cache
      await cacheManager.clear();
    } else {
      // Clear specific entity cache
      await cacheManager.clear(entity);
    }

    console.log(`Cache cleared successfully for ${entity}`);

    // Return response
    res.json({
      success: true,
      data: { cleared: true, entity },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Failed to clear cache',
        code: 'INTERNAL_SERVER_ERROR'
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Sync projects endpoint for dashboard
app.post('/api/sync/projects', async (req, res) => {
  try {
    const force = req.body.force === true || req.query._force === 'true';
    console.log(`Syncing projects for dashboard (force=${force})...`);

    // Create project adapter
    const projectAdapter = new ProjectAdapter(unitOfWork, apiClient, cacheManager);

    // Sync projects
    const result = await projectAdapter.sync({ force });

    console.log(`Projects synced successfully for dashboard`);

    // Return response in the format expected by the dashboard
    res.json({
      success: true,
      message: 'Projects synced successfully',
      timestamp: new Date().toISOString(),
      data: { synced: true }
    });
  } catch (error) {
    console.error('Error syncing projects for dashboard:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to sync projects',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Legacy invoices endpoint for backward compatibility
app.get('/api/invoices', async (req, res) => {
  try {
    console.log('Fetching invoices for legacy endpoint');

    // Set cache-control headers to prevent browser caching
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Get all invoices
    const invoices = await db.all('SELECT * FROM invoices');

    // Format response
    const formattedInvoices = invoices.map(invoice => ({
      id: invoice.id,
      number: invoice.number,
      company: invoice.company,
      companyName: invoice.companyName,
      date: invoice.date,
      dueDate: invoice.dueDate,
      status: invoice.status,
      amount: invoice.totalExclVat,
      taxAmount: invoice.totalVat,
      totalAmount: invoice.total,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt
    }));

    // Return response in the format expected by the legacy code
    res.json({
      result: {
        rows: formattedInvoices,
        total: formattedInvoices.length
      },
      success: true
    });
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



  // Start the server
  const port = 3004; // Make sure this matches the API_PORT in src/config/ports.ts
  app.listen(port, () => {
    console.log(`Test API server listening on port ${port}`);
    console.log(`API endpoints available at http://localhost:${port}/api/v1/...`);
  });

  return app;
}

// Start the server
initializeApiServer().catch(error => {
  console.error('Failed to start API server:', error);
  process.exit(1);
});
