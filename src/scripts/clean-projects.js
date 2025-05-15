/**
 * Clean Projects Script
 *
 * Dit script verwijdert alle dummy projecten uit de database.
 * Het script kan worden uitgevoerd met: node src/scripts/clean-projects.js
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Laad environment variables
dotenv.config();

async function getDatabase() {
  // Get the directory name using ES modules approach
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const dbPath = path.join(__dirname, '../db/database.sqlite');

  return open({
    filename: dbPath,
    driver: sqlite3.Database
  });
}

async function cleanProjects() {
  try {
    console.log('Verwijderen van dummy projecten uit de database...');

    // Verbind met de database
    const db = await getDatabase();

    // Begin een transactie
    await db.run('BEGIN TRANSACTION');

    try {
      // Verwijder alle projecten
      console.log('Verwijderen van alle projecten uit de database...');
      await db.run('DELETE FROM projects');
      console.log('Alle projecten zijn verwijderd uit de database');

      // Commit de transactie
      await db.run('COMMIT');
      console.log('Database is succesvol opgeschoond');

    } catch (error) {
      // Rollback de transactie bij een fout
      await db.run('ROLLBACK');
      console.error('Fout bij opschonen van de database:', error);
      process.exit(1);
    }

  } catch (error) {
    console.error('Fout bij opschonen van de database:', error);
    process.exit(1);
  }
}

// Voer het opschonen uit
cleanProjects();
