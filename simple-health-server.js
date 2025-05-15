/**
 * Simple API Server
 *
 * This is a very simple Express server that implements the health endpoint
 * and some basic data endpoints.
 */

import express from 'express';
import cors from 'cors';

// Create Express app
const app = express();

// Enable CORS
app.use(cors());

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  console.log('Health check request received');
  res.json({
    success: true,
    data: { status: 'ok' },
    meta: { timestamp: new Date().toISOString() }
  });
});

// Invoices endpoint
app.get('/api/v1/invoices', (req, res) => {
  console.log('Invoices request received');
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
  console.log('Employees request received');
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

// Employee month stats endpoint
app.get('/api/v1/employees/month-stats', (req, res) => {
  console.log('Employee month stats request received');
  res.json({
    success: true,
    data: [
      {
        id: 1,
        name: 'John Doe',
        function: 'Developer',
        contractPeriod: '40 uur per week',
        contractHours: 40,
        holidayHours: 16,
        expectedHours: 144,
        leaveHours: 8,
        writtenHours: 142,
        actualHours: 142,
        active: true
      },
      {
        id: 2,
        name: 'Jane Smith',
        function: 'Designer',
        contractPeriod: '32 uur per week',
        contractHours: 32,
        holidayHours: 16,
        expectedHours: 112,
        leaveHours: 0,
        writtenHours: 110,
        actualHours: 110,
        active: true
      },
      {
        id: 3,
        name: 'Bob Johnson',
        function: 'Project Manager',
        contractPeriod: '40 uur per week',
        contractHours: 40,
        holidayHours: 16,
        expectedHours: 144,
        leaveHours: 16,
        writtenHours: 130,
        actualHours: 130,
        active: true
      }
    ],
    meta: {
      timestamp: new Date().toISOString()
    }
  });
});

// Employee week stats endpoint
app.get('/api/v1/employees/week-stats', (req, res) => {
  console.log('Employee week stats request received');
  res.json({
    success: true,
    data: [
      {
        id: 1,
        name: 'John Doe',
        function: 'Developer',
        contractPeriod: '40 uur per week',
        contractHours: 40,
        holidayHours: 0,
        expectedHours: 40,
        leaveHours: 0,
        writtenHours: 38,
        actualHours: 38,
        active: true
      },
      {
        id: 2,
        name: 'Jane Smith',
        function: 'Designer',
        contractPeriod: '32 uur per week',
        contractHours: 32,
        holidayHours: 0,
        expectedHours: 32,
        leaveHours: 0,
        writtenHours: 30,
        actualHours: 30,
        active: true
      },
      {
        id: 3,
        name: 'Bob Johnson',
        function: 'Project Manager',
        contractPeriod: '40 uur per week',
        contractHours: 40,
        holidayHours: 0,
        expectedHours: 40,
        leaveHours: 8,
        writtenHours: 32,
        actualHours: 32,
        active: true
      }
    ],
    meta: {
      timestamp: new Date().toISOString()
    }
  });
});

// Start server
const PORT = 3004;
app.listen(PORT, () => {
  console.log(`Simple health server running on port ${PORT}`);
});
