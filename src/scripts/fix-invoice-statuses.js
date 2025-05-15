/**
 * Script to fix invoice statuses
 *
 * This script updates all invoices in the database to ensure that the status, isPaid and isOverdue fields
 * are correctly set based on the paidAmount and dueDate fields.
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect to the database
const db = new sqlite3.Database(path.join(__dirname, '../db/database.sqlite'));

// Begin transaction
db.serialize(() => {
  db.run('BEGIN TRANSACTION');

  console.log('Fixing invoice statuses...');

  // Step 1: Update all invoices with paidAmount that equals total (or very close) to be marked as paid
  db.run(`
    UPDATE invoices
    SET status = 'paid', isPaid = 1, isOverdue = 0
    WHERE (paidAmount IS NOT NULL AND total IS NOT NULL AND ABS(total - paidAmount) < 0.01 AND paidAmount > 0)
    OR (grippStatus = 'paid' AND paidAmount > 0)
  `, function(err) {
    if (err) {
      console.error('Error updating paid invoices:', err);
      db.run('ROLLBACK');
      process.exit(1);
    }
    console.log(`Updated ${this.changes} invoices to paid status`);
  });

  // Step 2: Update all unpaid invoices with a due date in the past to be marked as overdue
  db.run(`
    UPDATE invoices
    SET status = 'overdue', isOverdue = 1, isPaid = 0
    WHERE (
      (total IS NOT NULL AND paidAmount IS NOT NULL AND ABS(total - paidAmount) >= 0.01)
      OR (total IS NOT NULL AND paidAmount IS NULL)
      OR (grippStatus = 'overdue')
    )
    AND date(dueDate) < date('now')
    AND status != 'paid'
  `, function(err) {
    if (err) {
      console.error('Error updating overdue invoices:', err);
      db.run('ROLLBACK');
      process.exit(1);
    }
    console.log(`Updated ${this.changes} invoices to overdue status`);
  });

  // Step 3: Update all other invoices to be marked as unpaid
  db.run(`
    UPDATE invoices
    SET status = 'unpaid', isPaid = 0, isOverdue = 0
    WHERE (
      (total IS NOT NULL AND paidAmount IS NOT NULL AND ABS(total - paidAmount) >= 0.01)
      OR (total IS NOT NULL AND paidAmount IS NULL)
      OR (grippStatus = 'unpaid')
    )
    AND date(dueDate) >= date('now')
    AND status != 'paid'
  `, function(err) {
    if (err) {
      console.error('Error updating unpaid invoices:', err);
      db.run('ROLLBACK');
      process.exit(1);
    }
    console.log(`Updated ${this.changes} invoices to unpaid status`);
  });

  // Step 4: Handle special case for invoices with status 'verzonden'
  // These should be marked as unpaid if the due date is in the future, or overdue if the due date is in the past
  db.run(`
    UPDATE invoices
    SET status = 'unpaid', isPaid = 0, isOverdue = 0
    WHERE status = 'verzonden' AND date(dueDate) >= date('now')
  `, function(err) {
    if (err) {
      console.error('Error updating verzonden invoices to unpaid:', err);
      db.run('ROLLBACK');
      process.exit(1);
    }
    console.log(`Updated ${this.changes} verzonden invoices to unpaid status`);
  });

  db.run(`
    UPDATE invoices
    SET status = 'overdue', isPaid = 0, isOverdue = 1
    WHERE status = 'verzonden' AND date(dueDate) < date('now')
  `, function(err) {
    if (err) {
      console.error('Error updating verzonden invoices to overdue:', err);
      db.run('ROLLBACK');
      process.exit(1);
    }
    console.log(`Updated ${this.changes} verzonden invoices to overdue status`);
  });

  // Commit transaction
  db.run('COMMIT', function(err) {
    if (err) {
      console.error('Error committing transaction:', err);
      db.run('ROLLBACK');
      process.exit(1);
    }
    console.log('Successfully updated all invoice statuses');

    // Check the status counts
    db.all('SELECT status, COUNT(*) as count FROM invoices GROUP BY status', (err, rows) => {
      if (err) {
        console.error('Error getting status counts:', err);
      } else {
        console.log('Status counts:');
        rows.forEach(row => {
          console.log(`${row.status}: ${row.count}`);
        });
      }

      // Close the database connection
      db.close();
    });
  });
});
