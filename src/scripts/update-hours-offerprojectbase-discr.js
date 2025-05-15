/**
 * Update offerprojectbase_discr in hours tabel
 *
 * Dit script vult de offerprojectbase_discr kolom in de hours tabel op basis van de iris_offers tabel.
 * Het script kan worden uitgevoerd met: node src/scripts/update-hours-offerprojectbase-discr.js
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getDatabase() {
  const dbPath = path.join(__dirname, '../db/database.sqlite');

  return open({
    filename: dbPath,
    driver: sqlite3.verbose().Database
  });
}

async function updateHoursOfferprojectbaseDiscr() {
  try {
    console.log('Bijwerken van offerprojectbase_discr in hours tabel...');

    // Verbind met de database
    const db = await getDatabase();

    // Controleer of de offerprojectbase_discr kolom bestaat
    const tableInfo = await db.all(`PRAGMA table_info(hours)`);
    const hasOfferprojectbaseDiscr = tableInfo.some((column) => column.name === 'offerprojectbase_discr');

    if (!hasOfferprojectbaseDiscr) {
      console.log('offerprojectbase_discr kolom bestaat niet, wordt toegevoegd...');
      await db.run(`ALTER TABLE hours ADD COLUMN offerprojectbase_discr TEXT`);
      console.log('offerprojectbase_discr kolom toegevoegd aan hours tabel');
    }

    // Haal alle offertes op uit de database
    const offers = await db.all(`
      SELECT
        offer_id as offerId,
        discr
      FROM iris_offers
    `);

    console.log(`${offers.length} offertes gevonden in de database`);

    // Begin een transactie
    await db.run('BEGIN TRANSACTION');

    try {
      // Bewaar de bestaande offerprojectbase_discr waarden
      const existingOfferHours = await db.all(`
        SELECT id, project_id, project_name, offerprojectbase_discr
        FROM hours
        WHERE offerprojectbase_discr = 'offer' OR offerprojectbase_discr = 'offerte'
      `);

      console.log(`${existingOfferHours.length} bestaande uren gevonden met offerprojectbase_discr = 'offer' of 'offerte'`);

      // Maak een set van project IDs die al als offertes zijn gemarkeerd
      const existingOfferProjectIds = new Set();
      for (const hour of existingOfferHours) {
        existingOfferProjectIds.add(hour.project_id);
        console.log(`Project ${hour.project_id} (${hour.project_name}) is al gemarkeerd als offerte`);
      }

      // Reset alle offerprojectbase_discr waarden
      await db.run(`UPDATE hours SET offerprojectbase_discr = NULL`);
      console.log('Alle offerprojectbase_discr waarden gereset');

      // Update offerprojectbase_discr voor elke offerte uit de iris_offers tabel
      for (const offer of offers) {
        // Controleer of het een offerte is (discr kan 'offer' of 'offerte' zijn)
        if (offer.discr === 'offer' || offer.discr === 'offerte') {
          const result = await db.run(`
            UPDATE hours
            SET offerprojectbase_discr = 'offerte'
            WHERE project_id = ?
          `, [offer.offerId]);

          console.log(`Offerte ${offer.offerId}: ${result.changes} uren bijgewerkt vanuit iris_offers tabel`);

          // Verwijder dit project ID uit de set omdat we het al hebben bijgewerkt
          existingOfferProjectIds.delete(offer.offerId);
        }
      }

      // Update offerprojectbase_discr voor de overige projecten die al als offertes waren gemarkeerd
      for (const projectId of existingOfferProjectIds) {
        const result = await db.run(`
          UPDATE hours
          SET offerprojectbase_discr = 'offerte'
          WHERE project_id = ?
        `, [projectId]);

        console.log(`Project ${projectId}: ${result.changes} uren bijgewerkt op basis van bestaande offerprojectbase_discr waarden`);
      }

      // Commit de transactie
      await db.run('COMMIT');

      // Tel het aantal uren met offerprojectbase_discr
      const count = await db.get(`
        SELECT COUNT(*) as count
        FROM hours
        WHERE offerprojectbase_discr IS NOT NULL
      `);

      console.log(`Totaal ${count.count} uren bijgewerkt met offerprojectbase_discr`);
      console.log('Bijwerken van offerprojectbase_discr voltooid');

    } catch (error) {
      // Rollback de transactie bij een fout
      await db.run('ROLLBACK');
      console.error('Fout bij bijwerken van offerprojectbase_discr:', error);
      process.exit(1);
    }

  } catch (error) {
    console.error('Fout bij bijwerken van offerprojectbase_discr:', error);
    process.exit(1);
  }
}

// Voer de update uit
updateHoursOfferprojectbaseDiscr();
