/**
 * Script om de IRIS tabellen opnieuw aan te maken
 */
import path from 'path';
import fs from 'fs';
import { getDatabase } from '../db/database';

async function fixIrisTables() {
  try {
    console.log('Fixing IRIS tables...');

    // Get database connection
    const db = await getDatabase();

    // Drop existing IRIS tables
    console.log('Dropping existing IRIS tables...');
    const tables = [
      'iris_manual_project_previous_consumption',
      'iris_manual_monthly_targets',
      'iris_manual_monthly_definite_revenue',
      'iris_project_revenue_settings',
      'iris_kpi_targets',
      'iris_final_revenue'
    ];

    for (const table of tables) {
      try {
        await db.run(`DROP TABLE IF EXISTS ${table}`);
        console.log(`Dropped table ${table}`);
      } catch (error) {
        console.error(`Error dropping table ${table}:`, error);
      }
    }

    // Create IRIS tables
    console.log('Creating IRIS tables...');

    // Manual project previous consumption
    await db.run(`
      CREATE TABLE IF NOT EXISTS iris_manual_project_previous_consumption (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        previous_year_budget_used REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id)
      )
    `);
    console.log('Created table iris_manual_project_previous_consumption');

    // Manual monthly targets
    await db.run(`
      CREATE TABLE IF NOT EXISTS iris_manual_monthly_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        target_amount REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, month)
      )
    `);
    console.log('Created table iris_manual_monthly_targets');

    // Manual monthly definite revenue
    await db.run(`
      CREATE TABLE IF NOT EXISTS iris_manual_monthly_definite_revenue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        amount REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, month)
      )
    `);
    console.log('Created table iris_manual_monthly_definite_revenue');

    // Project revenue settings
    await db.run(`
      CREATE TABLE IF NOT EXISTS iris_project_revenue_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        include_in_revenue INTEGER DEFAULT 1,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id)
      )
    `);
    console.log('Created table iris_project_revenue_settings');

    // KPI targets
    await db.run(`
      CREATE TABLE IF NOT EXISTS iris_kpi_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        kpi_name TEXT NOT NULL,
        target_value REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, kpi_name)
      )
    `);
    console.log('Created table iris_kpi_targets');

    // Final revenue
    await db.run(`
      CREATE TABLE IF NOT EXISTS iris_final_revenue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        amount REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, month)
      )
    `);
    console.log('Created table iris_final_revenue');

    console.log('IRIS tables fixed successfully!');
    console.log('Created IRIS tables:');
    console.log('- iris_manual_project_previous_consumption');
    console.log('- iris_manual_monthly_targets');
    console.log('- iris_manual_monthly_definite_revenue');
    console.log('- iris_project_revenue_settings');
    console.log('- iris_kpi_targets');
    console.log('- iris_final_revenue');

    // Close database connection
    await db.close();
  } catch (error) {
    console.error('Error fixing IRIS tables:', error);
    process.exit(1);
  }
}

// Run the function
fixIrisTables();
