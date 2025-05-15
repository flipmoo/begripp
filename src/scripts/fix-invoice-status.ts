/**
 * Script to fix invoice status fields
 *
 * This script updates all invoices in the database to ensure that the isPaid and isOverdue fields
 * are correctly set based on the status field.
 */

import { Database } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get the current file path and directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the database path
const dbPath = path.resolve(__dirname, '../db/database.sqlite');

// Check if the database exists
if (!fs.existsSync(dbPath)) {
  console.error(`Database file not found at ${dbPath}`);
  process.exit(1);
}

// Connect to the database
import BetterSqlite3 from 'better-sqlite3';
const db = new BetterSqlite3(dbPath);

try {
  console.log('Fixing invoice status fields...');

  // Get all invoices
  const invoices = db.prepare('SELECT * FROM invoices').all();
  console.log(`Found ${invoices.length} invoices in the database`);

  // Update each invoice
  let updatedCount = 0;
  let errorCount = 0;

  for (const invoice of invoices) {
    try {
      // Determine isPaid and isOverdue based on status
      let isPaid = invoice.isPaid;
      let isOverdue = invoice.isOverdue;

      // If isPaid is NULL but status is 'paid', set isPaid to 1
      if ((isPaid === null || isPaid === undefined) && invoice.status === 'paid') {
        isPaid = 1;
      } else if (isPaid === null || isPaid === undefined) {
        isPaid = 0;
      }

      // If isOverdue is NULL but status is 'overdue', set isOverdue to 1
      if ((isOverdue === null || isOverdue === undefined) && invoice.status === 'overdue') {
        isOverdue = 1;
      } else if (isOverdue === null || isOverdue === undefined) {
        isOverdue = 0;
      }

      // Update the invoice
      const updateStmt = db.prepare(`
        UPDATE invoices
        SET isPaid = ?, isOverdue = ?
        WHERE id = ?
      `);

      updateStmt.run(isPaid, isOverdue, invoice.id);
      updatedCount++;

      // Log progress every 100 invoices
      if (updatedCount % 100 === 0) {
        console.log(`Updated ${updatedCount}/${invoices.length} invoices`);
      }
    } catch (error) {
      console.error(`Error updating invoice ${invoice.id}:`, error);
      errorCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} invoices`);

  if (errorCount > 0) {
    console.log(`Failed to update ${errorCount} invoices`);
  }
} catch (error) {
  console.error('Error fixing invoice status fields:', error);
} finally {
  // Close the database connection
  db.close();
}
