/**
 * Script om uren te updaten met het juiste type op basis van het gekoppelde project
 * 
 * Dit script doorloopt alle uren in de database en bepaalt het type op basis van
 * het gekoppelde project. Als het project een offerte is, wordt het type 'Offerte'.
 * Anders wordt het type bepaald op basis van de tags van het project.
 * 
 * Het script voegt een nieuwe kolom 'type' toe aan de hours tabel als deze nog niet bestaat.
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Laad environment variables
dotenv.config();

// Definieer de projecttypes
const PROJECT_TYPES = {
  INTERN: 'Intern',
  CONTRACT: 'Contract',
  VASTE_PRIJS: 'Vaste Prijs',
  NACALCULATIE: 'Nacalculatie',
  OFFERTE: 'Offerte',
  VERKEERDE_TAG: 'Verkeerde tag'
};

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

async function updateHoursTypes() {
  try {
    console.log('Updating hours types based on linked projects...');

    // Verbind met de database
    const db = await getDatabase();

    // Controleer of de type kolom bestaat, zo niet, voeg deze toe
    const tableInfo = await db.all("PRAGMA table_info(hours)");
    const typeColumnExists = tableInfo.some(column => column.name === 'type');

    if (!typeColumnExists) {
      console.log('Adding type column to hours table...');
      await db.run('ALTER TABLE hours ADD COLUMN type TEXT');
    }

    // Begin een transactie
    await db.run('BEGIN TRANSACTION');

    try {
      // Haal alle uren op
      const hours = await db.all(`
        SELECT 
          id, 
          project_id, 
          project_name, 
          offerprojectbase_discr
        FROM hours
      `);
      console.log(`Found ${hours.length} hours in database`);

      // Haal alle projecten op met hun type
      const projects = await db.all(`
        SELECT 
          id, 
          name, 
          type
        FROM projects
      `);
      console.log(`Found ${projects.length} projects in database`);

      // Maak een map van project ID naar project type
      const projectTypeMap = new Map();
      for (const project of projects) {
        projectTypeMap.set(project.id, project.type);
      }

      // Haal alle offertes op met hun type
      const offers = await db.all(`
        SELECT 
          offer_id, 
          type
        FROM iris_offers
      `);
      console.log(`Found ${offers.length} offers in database`);

      // Maak een map van offerte ID naar offerte type
      const offerTypeMap = new Map();
      for (const offer of offers) {
        offerTypeMap.set(offer.offer_id, offer.type);
      }

      // Update het type voor elk uur
      let updatedCount = 0;
      let typeStats = {
        [PROJECT_TYPES.INTERN]: 0,
        [PROJECT_TYPES.CONTRACT]: 0,
        [PROJECT_TYPES.VASTE_PRIJS]: 0,
        [PROJECT_TYPES.NACALCULATIE]: 0,
        [PROJECT_TYPES.OFFERTE]: 0,
        [PROJECT_TYPES.VERKEERDE_TAG]: 0
      };

      for (const hour of hours) {
        let hourType;

        // Controleer of het uur gekoppeld is aan een offerte
        if (hour.offerprojectbase_discr === 'offer' || hour.offerprojectbase_discr === 'offerte') {
          hourType = PROJECT_TYPES.OFFERTE;
        } else {
          // Zoek het type van het gekoppelde project
          const projectType = projectTypeMap.get(hour.project_id);
          hourType = projectType || PROJECT_TYPES.VERKEERDE_TAG;
        }

        // Update het uur type
        await db.run('UPDATE hours SET type = ? WHERE id = ?', [hourType, hour.id]);

        // Bijhouden van statistieken
        typeStats[hourType]++;
        updatedCount++;

        // Log voortgang
        if (updatedCount % 1000 === 0) {
          console.log(`Updated ${updatedCount}/${hours.length} hours`);
        }
      }

      // Commit de transactie
      await db.run('COMMIT');

      // Toon statistieken
      console.log('\nHours type statistics:');
      for (const [type, count] of Object.entries(typeStats)) {
        console.log(`${type}: ${count} hours (${(count / hours.length * 100).toFixed(2)}%)`);
      }

      console.log(`\nSuccessfully updated types for ${updatedCount} hours`);

    } catch (error) {
      // Rollback de transactie bij een fout
      await db.run('ROLLBACK');
      console.error('Error updating hours types:', error);
      process.exit(1);
    }

    // Sluit de database verbinding
    await db.close();
    console.log('Database connection closed');

  } catch (error) {
    console.error('Error updating hours types:', error);
    process.exit(1);
  }
}

// Voer de update uit
updateHoursTypes();
