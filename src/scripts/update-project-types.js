/**
 * Script om projecttypes te updaten op basis van tags
 *
 * Dit script doorloopt alle projecten in de database en bepaalt het projecttype
 * op basis van de tags. De volgende regels worden toegepast:
 *
 * - [{"id":"30","searchname":"Intern"}] = Type: Intern
 * - [{"id":"29","searchname":"Contract"}] = Type: Contract
 * - [{"id":"28","searchname":"Vaste prijs"}] = Type: Vaste Prijs
 * - [{"id":"26","searchname":"Nacalculatie"}] = Type: Nacalculatie
 * - Alle overige of leeg = Type: Verkeerde Tag
 *
 * Het script voegt een nieuwe kolom 'type' toe aan de projects tabel als deze nog niet bestaat.
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

// Definieer de tag IDs en searchnames
const TAG_MAPPING = {
  '30': PROJECT_TYPES.INTERN,        // Intern
  '29': PROJECT_TYPES.CONTRACT,      // Contract
  '28': PROJECT_TYPES.VASTE_PRIJS,   // Vaste prijs
  '26': PROJECT_TYPES.NACALCULATIE   // Nacalculatie
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

/**
 * Bepaal het projecttype op basis van tags
 * @param {string} tagsJson - JSON string met tags
 * @returns {string} - Projecttype
 */
function determineProjectType(tagsJson) {
  // Als tags leeg is of geen geldige JSON, gebruik Verkeerde tag
  if (!tagsJson || tagsJson === '[]') {
    return PROJECT_TYPES.VERKEERDE_TAG;
  }

  try {
    // Parse de tags JSON
    const tags = JSON.parse(tagsJson);

    // Als er geen tags zijn, gebruik Verkeerde tag
    if (!Array.isArray(tags) || tags.length === 0) {
      return PROJECT_TYPES.VERKEERDE_TAG;
    }

    // Zoek naar specifieke tags
    for (const tag of tags) {
      if (tag && tag.id && TAG_MAPPING[tag.id]) {
        return TAG_MAPPING[tag.id];
      }
    }

    // Als geen specifieke tag is gevonden, gebruik Verkeerde tag
    return PROJECT_TYPES.VERKEERDE_TAG;
  } catch (error) {
    console.error('Error parsing tags JSON:', error);
    return PROJECT_TYPES.VERKEERDE_TAG;
  }
}

async function updateProjectTypes() {
  try {
    console.log('Updating project types based on tags...');

    // Verbind met de database
    const db = await getDatabase();

    // Controleer of de type kolom bestaat, zo niet, voeg deze toe
    const tableInfo = await db.all("PRAGMA table_info(projects)");
    const typeColumnExists = tableInfo.some(column => column.name === 'type');

    if (!typeColumnExists) {
      console.log('Adding type column to projects table...');
      await db.run('ALTER TABLE projects ADD COLUMN type TEXT');
    }

    // Controleer of de type kolom bestaat in de iris_offers tabel, zo niet, voeg deze toe
    const offersTableInfo = await db.all("PRAGMA table_info(iris_offers)");
    const offersTypeColumnExists = offersTableInfo.some(column => column.name === 'type');

    if (!offersTypeColumnExists) {
      console.log('Adding type column to iris_offers table...');
      await db.run('ALTER TABLE iris_offers ADD COLUMN type TEXT');
    }

    // Begin een transactie
    await db.run('BEGIN TRANSACTION');

    try {
      // Haal alle projecten op
      const projects = await db.all('SELECT id, name, tags FROM projects');
      console.log(`Found ${projects.length} projects in database`);

      // Update het type voor elk project
      let updatedCount = 0;
      let typeStats = {
        [PROJECT_TYPES.INTERN]: 0,
        [PROJECT_TYPES.CONTRACT]: 0,
        [PROJECT_TYPES.VASTE_PRIJS]: 0,
        [PROJECT_TYPES.NACALCULATIE]: 0,
        [PROJECT_TYPES.OFFERTE]: 0,
        [PROJECT_TYPES.VERKEERDE_TAG]: 0
      };

      for (const project of projects) {
        const projectType = determineProjectType(project.tags);

        // Update het project type
        await db.run('UPDATE projects SET type = ? WHERE id = ?', [projectType, project.id]);

        // Bijhouden van statistieken
        typeStats[projectType]++;
        updatedCount++;

        // Log voortgang
        if (updatedCount % 100 === 0) {
          console.log(`Updated ${updatedCount}/${projects.length} projects`);
        }
      }

      // Haal alle offertes op
      const offers = await db.all('SELECT id, offer_id, offer_name, tags FROM iris_offers');
      console.log(`\nFound ${offers.length} offers in database`);

      // Update het type voor elke offerte
      let updatedOffersCount = 0;
      let offerTypeStats = {
        [PROJECT_TYPES.INTERN]: 0,
        [PROJECT_TYPES.CONTRACT]: 0,
        [PROJECT_TYPES.VASTE_PRIJS]: 0,
        [PROJECT_TYPES.NACALCULATIE]: 0,
        [PROJECT_TYPES.OFFERTE]: 0,
        [PROJECT_TYPES.VERKEERDE_TAG]: 0
      };

      for (const offer of offers) {
        // Voor offertes gebruiken we standaard het type 'Offerte', tenzij de tags anders aangeven
        const offerType = offer.tags && offer.tags !== '[]' ? determineProjectType(offer.tags) : PROJECT_TYPES.OFFERTE;

        // Update het offerte type
        await db.run('UPDATE iris_offers SET type = ? WHERE id = ?', [offerType, offer.id]);

        // Bijhouden van statistieken
        offerTypeStats[offerType]++;
        updatedOffersCount++;

        // Log voortgang
        if (updatedOffersCount % 100 === 0) {
          console.log(`Updated ${updatedOffersCount}/${offers.length} offers`);
        }
      }

      // Commit de transactie
      await db.run('COMMIT');

      // Toon statistieken voor projecten
      console.log('\nProject type statistics:');
      for (const [type, count] of Object.entries(typeStats)) {
        console.log(`${type}: ${count} projects (${(count / projects.length * 100).toFixed(2)}%)`);
      }

      // Toon statistieken voor offertes
      console.log('\nOffer type statistics:');
      for (const [type, count] of Object.entries(offerTypeStats)) {
        console.log(`${type}: ${count} offers (${(count / offers.length * 100).toFixed(2)}%)`);
      }

      console.log(`\nSuccessfully updated types for ${updatedCount} projects and ${updatedOffersCount} offers`);

    } catch (error) {
      // Rollback de transactie bij een fout
      await db.run('ROLLBACK');
      console.error('Error updating types:', error);
      process.exit(1);
    }

    // Sluit de database verbinding
    await db.close();
    console.log('Database connection closed');

  } catch (error) {
    console.error('Error updating types:', error);
    process.exit(1);
  }
}

// Voer de update uit
updateProjectTypes();
