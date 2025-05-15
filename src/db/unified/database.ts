/**
 * Database Initialization
 *
 * This file provides functions for initializing and managing the SQLite database.
 */

import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

// Database file path
// Use the database in the current project directory
const DB_PATH = '/Users/koenstraatman/Development folder/Active projects/het-nieuwe-werken - Begripp - V2/src/db/database.sqlite';

// Ensure the data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Open the database connection
 *
 * @returns A promise that resolves to the database connection
 */
export async function openDatabase(): Promise<Database> {
  return open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });
}

/**
 * Initialize the database
 *
 * @returns A promise that resolves when the database has been initialized
 */
export async function initializeDatabase(): Promise<void> {
  const db = await openDatabase();

  // Enable foreign keys
  await db.exec('PRAGMA foreign_keys = ON');

  // Create projects table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      number INTEGER NOT NULL UNIQUE,
      archived BOOLEAN NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  // Create project_lines table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS project_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      budget REAL,
      rate REAL,
      archived BOOLEAN NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    )
  `);

  // Create employees table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstname TEXT NOT NULL,
      lastname TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      function TEXT,
      active BOOLEAN NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  // Create hours table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee INTEGER NOT NULL,
      project INTEGER NOT NULL,
      projectline INTEGER NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (employee) REFERENCES employees (id) ON DELETE CASCADE,
      FOREIGN KEY (project) REFERENCES projects (id) ON DELETE CASCADE,
      FOREIGN KEY (projectline) REFERENCES project_lines (id) ON DELETE CASCADE
    )
  `);

  // Create invoices table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY,
      grippId INTEGER,
      number TEXT,
      date TEXT,
      dueDate TEXT,
      company INTEGER,
      amount REAL,
      taxAmount REAL,
      totalAmount REAL,
      status TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      external_id TEXT,
      external_data TEXT,
      isPaid INTEGER DEFAULT 0,
      isOverdue INTEGER DEFAULT 0,
      totalExclVat REAL,
      totalInclVat REAL,
      tax_amount REAL,
      company_id INTEGER,
      company_name TEXT,
      due_date TEXT,
      subject TEXT
    )
  `);

  // Create invoice_lines table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoice_lines (
      id INTEGER PRIMARY KEY,
      invoice INTEGER NOT NULL,
      description TEXT,
      amount REAL,
      price REAL,
      taxPercentage TEXT,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (invoice) REFERENCES invoices (id) ON DELETE CASCADE
    )
  `);

  // Create sync_status table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sync_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity TEXT NOT NULL UNIQUE,
      lastSyncTime TEXT,
      lastIncrementalSyncTime TEXT,
      lastFullSyncTime TEXT,
      syncInterval INTEGER,
      lastSyncCount INTEGER,
      lastSyncStatus TEXT,
      lastSyncError TEXT
    )
  `);

  // Close the database connection
  await db.close();
}

/**
 * Reset the database
 *
 * @returns A promise that resolves when the database has been reset
 */
export async function resetDatabase(): Promise<void> {
  // Delete the database file if it exists
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  // Initialize the database
  await initializeDatabase();
}

/**
 * Seed the database with initial structure only (no test data)
 *
 * @returns A promise that resolves when the database has been seeded
 */
export async function seedDatabase(): Promise<void> {
  const db = await openDatabase();

  // Only seed sync status to initialize the sync system
  await db.exec(`
    INSERT INTO sync_status (entity, lastSyncTime, lastIncrementalSyncTime, lastFullSyncTime, syncInterval, lastSyncCount, lastSyncStatus)
    VALUES
      ('projects', NULL, NULL, NULL, 3600, 0, 'pending'),
      ('employees', NULL, NULL, NULL, 3600, 0, 'pending'),
      ('hours', NULL, NULL, NULL, 3600, 0, 'pending'),
      ('invoices', NULL, NULL, NULL, 3600, 0, 'pending')
  `);

  // Close the database connection
  await db.close();
}

/**
 * Initialize and seed the database
 *
 * @returns A promise that resolves when the database has been initialized and seeded
 */
export async function initializeAndSeedDatabase(): Promise<void> {
  await resetDatabase();
  await seedDatabase();
}

/**
 * Get a database connection
 *
 * @returns A promise that resolves to the database connection
 */
export async function getDatabase(): Promise<Database> {
  // Check if the database exists
  if (!fs.existsSync(DB_PATH)) {
    // Initialize and seed the database
    await initializeAndSeedDatabase();
  }

  // Open the database connection
  return openDatabase();
}
