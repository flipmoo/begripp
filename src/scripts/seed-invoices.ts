import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';

async function seedInvoices() {
  console.log('Starting invoice seeding process...');

  // Database path
  const dbPath = path.resolve(process.cwd(), 'src/db/database.sqlite');
  console.log(`Database path: ${dbPath}`);

  // Check if database file exists
  if (!fs.existsSync(dbPath)) {
    console.error(`Database file does not exist at ${dbPath}`);
    return;
  }

  console.log('Database file exists, checking permissions...');
  try {
    fs.accessSync(dbPath, fs.constants.R_OK | fs.constants.W_OK);
    console.log('Database file is readable and writable');
  } catch (err) {
    console.error(`Database file is not accessible: ${err}`);
    return;
  }

  console.log(`Opening database connection to ${dbPath}...`);

  // Open database connection
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  console.log('Database connection opened successfully');

  // Create sample invoices
  const sampleInvoices = [
    {
      id: 1001,
      number: '25010001',
      date: '2025-04-01 00:00:00.000000',
      dueDate: '2025-04-15 00:00:00.000000',
      company: 100001,
      company_id: 100001,
      company_name: 'Acme Corporation',
      totalAmount: 1200.00,
      status: 'Verzonden',
      grippId: 10001,
      createdAt: '2025-04-01T10:00:00.000Z',
      updatedAt: '2025-04-01T10:00:00.000Z',
      isPaid: 0,
      isOverdue: 1,
      totalInclVat: 1200.00,
      due_date: '2025-04-15 00:00:00.000000',
      subject: 'Website Development - Phase 1',
      totalExclVat: 991.74
    },
    {
      id: 1002,
      number: '25010002',
      date: '2025-04-05 00:00:00.000000',
      dueDate: '2025-04-19 00:00:00.000000',
      company: 100002,
      company_id: 100002,
      company_name: 'Globex Industries',
      totalAmount: 2500.00,
      status: 'Verzonden',
      grippId: 10002,
      createdAt: '2025-04-05T10:00:00.000Z',
      updatedAt: '2025-04-05T10:00:00.000Z',
      isPaid: 0,
      isOverdue: 1,
      totalInclVat: 2500.00,
      due_date: '2025-04-19 00:00:00.000000',
      subject: 'Mobile App Development',
      totalExclVat: 2066.12
    },
    {
      id: 1003,
      number: '25010003',
      date: '2025-04-10 00:00:00.000000',
      dueDate: '2025-04-24 00:00:00.000000',
      company: 100003,
      company_id: 100003,
      company_name: 'Initech LLC',
      totalAmount: 1800.00,
      status: 'Verzonden',
      grippId: 10003,
      createdAt: '2025-04-10T10:00:00.000Z',
      updatedAt: '2025-04-10T10:00:00.000Z',
      isPaid: 0,
      isOverdue: 1,
      totalInclVat: 1800.00,
      due_date: '2025-04-24 00:00:00.000000',
      subject: 'UX Design Services',
      totalExclVat: 1487.60
    },
    {
      id: 1004,
      number: '25010004',
      date: '2025-04-15 00:00:00.000000',
      dueDate: '2025-04-29 00:00:00.000000',
      company: 100004,
      company_id: 100004,
      company_name: 'Umbrella Corporation',
      totalAmount: 3200.00,
      status: 'Verzonden',
      grippId: 10004,
      createdAt: '2025-04-15T10:00:00.000Z',
      updatedAt: '2025-04-15T10:00:00.000Z',
      isPaid: 0,
      isOverdue: 1,
      totalInclVat: 3200.00,
      due_date: '2025-04-29 00:00:00.000000',
      subject: 'SEO Optimization',
      totalExclVat: 2644.63
    },
    {
      id: 1005,
      number: '25010005',
      date: '2025-04-20 00:00:00.000000',
      dueDate: '2025-05-04 00:00:00.000000',
      company: 100005,
      company_id: 100005,
      company_name: 'Stark Industries',
      totalAmount: 5000.00,
      status: 'Verzonden',
      grippId: 10005,
      createdAt: '2025-04-20T10:00:00.000Z',
      updatedAt: '2025-04-20T10:00:00.000Z',
      isPaid: 0,
      isOverdue: 1,
      totalInclVat: 5000.00,
      due_date: '2025-05-04 00:00:00.000000',
      subject: 'Website Redesign',
      totalExclVat: 4132.23
    }
  ];

  try {
    // Clear existing invoices
    await db.run('DELETE FROM invoices');
    console.log('Cleared existing invoices');

    // Insert sample invoices
    for (const invoice of sampleInvoices) {
      await db.run(`
        INSERT INTO invoices (
          id, number, date, dueDate, company, company_id, company_name,
          totalAmount, status, grippId, createdAt, updatedAt,
          isPaid, isOverdue, totalInclVat, due_date, subject, totalExclVat
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        invoice.id,
        invoice.number,
        invoice.date,
        invoice.dueDate,
        invoice.company,
        invoice.company_id,
        invoice.company_name,
        invoice.totalAmount,
        invoice.status,
        invoice.grippId,
        invoice.createdAt,
        invoice.updatedAt,
        invoice.isPaid,
        invoice.isOverdue,
        invoice.totalInclVat,
        invoice.due_date,
        invoice.subject,
        invoice.totalExclVat
      ]);
      console.log(`Inserted invoice ${invoice.id}: ${invoice.number}`);
    }

    // Verify the number of invoices
    const count = await db.get('SELECT COUNT(*) as count FROM invoices');
    console.log(`Total invoices in database: ${count.count}`);

    console.log('Invoice seeding completed successfully');
  } catch (error) {
    console.error('Error seeding invoices:', error);
  } finally {
    await db.close();
    console.log('Database connection closed');
  }
}

// Run the seeding function
seedInvoices().catch(console.error);
