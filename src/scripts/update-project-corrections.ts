/**
 * Update Project Corrections Script
 * 
 * Dit script voegt de project_corrections tabel toe aan de database en vult deze met initiële data.
 * Het script kan ook worden gebruikt om bestaande correcties bij te werken.
 */

import { Database } from 'sqlite';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getDatabase } from '../db/database';

// Configuratie
const DB_PATH = process.env.DB_PATH || './src/db/database.sqlite';

// Initiële project correcties
const INITIAL_CORRECTIONS = [
  {
    project_id: 5368,
    project_name: 'Internal hours 2024',
    client_name: 'Bravoure',
    project_type: 'Intern',
    budget: 0,
    previous_year_budget_used: 0
  },
  {
    project_id: 5520,
    project_name: 'Boer & Croon - Bullhorn koppeling',
    client_name: 'Boer & Croon Management Solutions B.V..',
    project_type: 'Vaste Prijs',
    budget: 13093,
    previous_year_budget_used: 0
  },
  {
    project_id: 5787,
    project_name: 'Dynamics Koppeling - Courses',
    client_name: 'Ebbinge B.V.',
    project_type: 'Vaste Prijs',
    budget: 13093,
    previous_year_budget_used: 0
  },
  {
    project_id: 5632,
    project_name: 'OLM - Phase 3A',
    client_name: 'Limburgs Museum',
    project_type: 'Vaste Prijs',
    budget: 154154,
    previous_year_budget_used: 142757
  }
];

/**
 * Hoofdfunctie om de project correcties bij te werken
 */
async function main() {
  console.log('Updating project corrections...');
  
  try {
    // Open database connection
    console.log(`Opening database connection to ${DB_PATH}...`);
    const db = await getDatabase();
    console.log('Database connection opened successfully');

    // Controleer of de project_corrections tabel bestaat
    const tableExists = await checkTableExists(db, 'project_corrections');
    
    if (!tableExists) {
      console.log('Creating project_corrections table...');
      await createProjectCorrectionsTable(db);
    } else {
      console.log('project_corrections table already exists');
    }

    // Voeg initiële correcties toe of update bestaande
    console.log('Adding/updating project corrections...');
    await updateProjectCorrections(db, INITIAL_CORRECTIONS);

    // Toon alle project correcties
    console.log('Current project corrections:');
    const corrections = await db.all('SELECT * FROM project_corrections');
    console.table(corrections);

    console.log('Project corrections updated successfully');
  } catch (error) {
    console.error('Error updating project corrections:', error);
    process.exit(1);
  }
}

/**
 * Controleert of een tabel bestaat in de database
 */
async function checkTableExists(db: Database, tableName: string): Promise<boolean> {
  const result = await db.get(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    [tableName]
  );
  return !!result;
}

/**
 * Maakt de project_corrections tabel aan
 */
async function createProjectCorrectionsTable(db: Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS project_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      project_name TEXT,
      client_name TEXT,
      project_type TEXT,
      budget REAL,
      previous_year_budget_used REAL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(project_id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_project_corrections_project_id ON project_corrections (project_id);
  `);
}

/**
 * Voegt project correcties toe of update bestaande
 */
async function updateProjectCorrections(db: Database, corrections: any[]): Promise<void> {
  // Begin transaction
  await db.run('BEGIN TRANSACTION');

  try {
    for (const correction of corrections) {
      // Controleer of de correctie al bestaat
      const existing = await db.get(
        'SELECT id FROM project_corrections WHERE project_id = ?',
        [correction.project_id]
      );

      if (existing) {
        // Update bestaande correctie
        await db.run(
          `UPDATE project_corrections 
           SET project_name = ?, client_name = ?, project_type = ?, budget = ?, previous_year_budget_used = ?, updated_at = CURRENT_TIMESTAMP
           WHERE project_id = ?`,
          [
            correction.project_name,
            correction.client_name,
            correction.project_type,
            correction.budget,
            correction.previous_year_budget_used,
            correction.project_id
          ]
        );
        console.log(`Updated correction for project ${correction.project_id} (${correction.project_name})`);
      } else {
        // Voeg nieuwe correctie toe
        await db.run(
          `INSERT INTO project_corrections 
           (project_id, project_name, client_name, project_type, budget, previous_year_budget_used)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            correction.project_id,
            correction.project_name,
            correction.client_name,
            correction.project_type,
            correction.budget,
            correction.previous_year_budget_used
          ]
        );
        console.log(`Added correction for project ${correction.project_id} (${correction.project_name})`);
      }
    }

    // Commit transaction
    await db.run('COMMIT');
  } catch (error) {
    // Rollback transaction bij fout
    await db.run('ROLLBACK');
    throw error;
  }
}

// Run the main function
main();
