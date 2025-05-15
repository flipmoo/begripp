/**
 * Simple API Server
 * 
 * Dit is een eenvoudige Express server die de essentiële endpoints bevat.
 */
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Configuratie
const PORT = 3004;
const DB_PATH = './src/db/database.sqlite';

// Maak Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3002'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-bypass', 'cache-control', 'pragma', 'expires']
}));

// Database connectie
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the database.');
});

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  console.log('Health check request received');
  
  // Check database connection
  db.get('SELECT 1 as test', (err, row) => {
    const dbStatus = err ? 'disconnected' : 'connected';
    
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
});

// Employees month stats endpoint
app.get('/api/v1/employees/month-stats', (req, res) => {
  console.log('Employees month stats request received', req.query);
  
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;
  const dashboard = req.query.dashboard === 'true';
  
  console.log(`Fetching employee month stats for ${year}-${month}`);
  
  // Simuleer een vertraging om de applicatie te testen
  setTimeout(() => {
    // Stuur een eenvoudige response
    res.json({
      success: true,
      data: {
        year,
        month,
        employees: [
          {
            id: 1,
            name: 'John Doe',
            hours: 160,
            status: 'complete'
          },
          {
            id: 2,
            name: 'Jane Smith',
            hours: 120,
            status: 'incomplete'
          },
          {
            id: 3,
            name: 'Bob Johnson',
            hours: 80,
            status: 'incomplete'
          }
        ]
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }, 500);
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

// Start server
app.listen(PORT, () => {
  console.log(`Simple API server listening on port ${PORT}`);
});
