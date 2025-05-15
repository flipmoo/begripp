/**
 * Script om alle projecten te verwijderen uit de database
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

async function getDatabase() {
  // Get the directory name using ES modules approach
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const dbPath = path.join(__dirname, '../db/database.sqlite');
  console.log('Database path:', dbPath);

  return open({
    filename: dbPath,
    driver: sqlite3.Database
  });
}

async function clearProjects() {
  try {
    console.log('Verbinden met de database...');
    const db = await getDatabase();

    // Controleer hoeveel projecten er zijn voor het verwijderen
    const countBefore = await db.get('SELECT COUNT(*) as count FROM projects');
    console.log(`Aantal projecten voor het verwijderen: ${countBefore.count}`);

    // Begin een transactie
    console.log('Begin transactie...');
    await db.run('BEGIN TRANSACTION');

    try {
      // Verwijder alle projecten
      console.log('Verwijderen van alle projecten...');
      await db.run('DELETE FROM projects');

      // Controleer hoeveel projecten er zijn na het verwijderen
      const countAfterDelete = await db.get('SELECT COUNT(*) as count FROM projects');
      console.log(`Aantal projecten na het verwijderen: ${countAfterDelete.count}`);

      // Commit de transactie
      console.log('Commit transactie...');
      await db.run('COMMIT');

      // Controleer hoeveel projecten er zijn na de commit
      const countAfterCommit = await db.get('SELECT COUNT(*) as count FROM projects');
      console.log(`Aantal projecten na de commit: ${countAfterCommit.count}`);

      console.log('Alle projecten zijn succesvol verwijderd.');
    } catch (error) {
      // Rollback de transactie bij een fout
      console.error('Fout bij verwijderen van projecten, rollback transactie...');
      await db.run('ROLLBACK');
      throw error;
    } finally {
      // Sluit de database verbinding
      await db.close();
    }
  } catch (error) {
    console.error('Fout bij verwijderen van projecten:', error);
    process.exit(1);
  }
}

// Voer de functie uit
clearProjects();
