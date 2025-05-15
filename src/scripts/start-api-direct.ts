/**
 * Direct API Server Starter
 * 
 * This script starts the API server directly.
 */

import express from 'express';
import cors from 'cors';
import { API_PORT } from '../config/ports';
import { Database } from 'better-sqlite3';
import path from 'path';

// Create the Express app
const app = express();

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Create a database connection
const dbPath = path.resolve(process.cwd(), 'src/db/database.sqlite');
console.log(`Opening database connection to ${dbPath}...`);
const db = new Database(dbPath);

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Invoices endpoint
app.get('/api/v1/invoices', (req, res) => {
  try {
    const invoices = db.prepare('SELECT * FROM invoices LIMIT 100').all();
    res.json({
      success: true,
      data: invoices,
      meta: {
        total: invoices.length,
        page: 1,
        limit: 100
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoices'
    });
  }
});

// Employees endpoint
app.get('/api/v1/employees', (req, res) => {
  try {
    const employees = db.prepare('SELECT * FROM employees LIMIT 100').all();
    res.json({
      success: true,
      data: employees,
      meta: {
        total: employees.length,
        page: 1,
        limit: 100
      }
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employees'
    });
  }
});

// Start the server
app.listen(API_PORT, () => {
  console.log(`API server listening on port ${API_PORT}`);
});
