/**
 * Minimal API Server
 *
 * This script starts a minimal API server that responds to health checks and provides basic data.
 */

import express from 'express';
import cors from 'cors';
import { API_PORT } from '../config/ports';
import fs from 'fs';
import path from 'path';

// Create Express app
const app = express();

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Database path
const dbPath = path.resolve(process.cwd(), 'src/db/database.sqlite');
console.log(`Database path: ${dbPath}`);

// Check if database exists
if (fs.existsSync(dbPath)) {
  console.log('Database file exists');
} else {
  console.log('Database file does not exist');
}

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Invoices endpoint
app.get('/api/v1/invoices', (req, res) => {
  // Return dummy data
  res.json({
    success: true,
    data: [
      {
        id: 1,
        grippId: 2001,
        number: 'INV-2023-001',
        date: '2023-01-15',
        expirydate: '2023-02-15',
        company: 101,
        companyName: 'Example Company A',
        status: 'paid',
        subject: 'Website Development',
        amount: 5000,
        taxAmount: 1050,
        totalAmount: 6050,
        totalOpenInclVat: '0.00',
        isPaid: true,
        isOverdue: false,
        createdAt: '2023-01-15T00:00:00.000Z',
        updatedAt: '2023-01-15T00:00:00.000Z'
      },
      {
        id: 2,
        grippId: 2002,
        number: 'INV-2023-002',
        date: '2023-02-15',
        expirydate: '2023-03-15',
        company: 102,
        companyName: 'Example Company B',
        status: 'unpaid',
        subject: 'Mobile App Development',
        amount: 8000,
        taxAmount: 1680,
        totalAmount: 9680,
        totalOpenInclVat: '9680.00',
        isPaid: false,
        isOverdue: false,
        createdAt: '2023-02-15T00:00:00.000Z',
        updatedAt: '2023-02-15T00:00:00.000Z'
      },
      {
        id: 3,
        grippId: 2003,
        number: 'INV-2023-003',
        date: '2023-03-15',
        expirydate: '2023-04-15',
        company: 103,
        companyName: 'Example Company C',
        status: 'overdue',
        subject: 'UI/UX Design',
        amount: 3000,
        taxAmount: 630,
        totalAmount: 3630,
        totalOpenInclVat: '3630.00',
        isPaid: false,
        isOverdue: true,
        createdAt: '2023-03-15T00:00:00.000Z',
        updatedAt: '2023-03-15T00:00:00.000Z'
      }
    ],
    meta: {
      total: 3,
      page: 1,
      limit: 100
    }
  });
});

// Employees endpoint
app.get('/api/v1/employees', (req, res) => {
  // Return dummy data
  res.json({
    success: true,
    data: [
      {
        id: 1,
        grippId: 1001,
        firstname: 'John',
        lastname: 'Doe',
        email: 'john.doe@example.com',
        function: 'Developer',
        active: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      },
      {
        id: 2,
        grippId: 1002,
        firstname: 'Jane',
        lastname: 'Smith',
        email: 'jane.smith@example.com',
        function: 'Designer',
        active: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      },
      {
        id: 3,
        grippId: 1003,
        firstname: 'Bob',
        lastname: 'Johnson',
        email: 'bob.johnson@example.com',
        function: 'Project Manager',
        active: true,
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
      }
    ],
    meta: {
      total: 3,
      page: 1,
      limit: 100
    }
  });
});

// Start server
app.listen(API_PORT, () => {
  console.log(`Minimal API server running on port ${API_PORT}`);
});
