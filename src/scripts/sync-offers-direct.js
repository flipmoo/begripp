/**
 * Synchroniseer offertes vanuit Gripp (ES modules versie)
 *
 * Dit script haalt alle offertes op uit Gripp en slaat ze op in de iris_offers tabel.
 * Het script kan worden uitgevoerd met: node src/scripts/sync-offers-direct.js
 */

import axios from 'axios';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Laad environment variables
dotenv.config();

// __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Gripp API configuratie
const GRIPP_API_URL = process.env.GRIPP_API_URL || 'https://api.gripp.com/public/api3.php';
const GRIPP_API_KEY = process.env.GRIPP_API_KEY;

console.log('Using Gripp API server:', GRIPP_API_URL);
console.log('Using Gripp API key:', GRIPP_API_KEY ? GRIPP_API_KEY.substring(0, 10) + '...' : 'Not set');

// Database configuratie
const DB_PATH = path.join(__dirname, '../db/database.sqlite');

console.log('Database path:', DB_PATH);

/**
 * Hoofdfunctie om offertes te synchroniseren
 */
async function syncOffers() {
  if (!GRIPP_API_KEY) {
    console.error('API key not supplied. Please set GRIPP_API_KEY in .env file.');
    process.exit(1);
  }

  try {
    // Open database connectie
    console.log('Initializing database connection...');
    const db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });
    console.log('Database connection established');

    // Controleer of de iris_offers tabel bestaat, zo niet, maak deze aan
    await db.exec(`
      CREATE TABLE IF NOT EXISTS iris_offers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        offer_id INTEGER NOT NULL,
        offer_name TEXT,
        client_id INTEGER,
        client_name TEXT,
        discr TEXT DEFAULT 'offer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Maak een index aan op offer_id als deze nog niet bestaat
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_iris_offers_offer_id ON iris_offers(offer_id)
    `);

    // Functie om Gripp API aan te roepen
    const callGrippApi = async (resource, params = {}) => {
      try {
        console.log('Making API request to:', GRIPP_API_URL);
        console.log('Request data:', {
          api_key: GRIPP_API_KEY.substring(0, 10) + '...',
          call: resource,
          params
        });

        const response = await axios.post(GRIPP_API_URL, {
          api_key: GRIPP_API_KEY,
          call: resource,
          params
        });

        if (response.data && response.data.response) {
          return response.data.response;
        }

        console.error('Invalid response from Gripp API:', response.data);
        return null;
      } catch (error) {
        console.error('Error calling Gripp API:', error.message);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
        }
        return null;
      }
    };

    // Haal alle offertes op uit Gripp
    console.log('Fetching offers from Gripp...');
    const response = await callGrippApi('projects/list', {
      options: {
        limit: 1000,
        offset: 0,
        sort: { id: 'ASC' },
        filter: {
          discr: 'offer'
        }
      }
    });

    if (!response) {
      console.error('Geen response van Gripp API');
      process.exit(1);
    }

    console.log(`Found ${response.length} offers in Gripp`);

    // Verwerk elke offerte
    let updatedCount = 0;
    let newCount = 0;

    // Begin een transactie
    await db.run('BEGIN TRANSACTION');

    try {
      for (const offer of response) {
        console.log(`Processing offer ${offer.id}: ${offer.name}`);

        try {
          // Controleer of het een offerte is
          if (offer.discr !== 'offer') {
            console.warn(`Project ${offer.id} is geen offerte (discr=${offer.discr})`);
            continue;
          }

          // Haal bedrijfsnaam op
          const companyName = offer.company ? offer.company.searchname : 'Onbekend';
          const companyId = offer.company ? offer.company.id : null;

          // Controleer of de offerte al in de database staat
          const existingOffer = await db.get('SELECT * FROM iris_offers WHERE offer_id = ?', [offer.id]);

          if (existingOffer) {
            // Update bestaande offerte
            await db.run(`
              UPDATE iris_offers
              SET
                offer_name = ?,
                client_id = ?,
                client_name = ?,
                discr = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE offer_id = ?
            `, [
              offer.name,
              companyId,
              companyName,
              'offer',
              offer.id
            ]);
            updatedCount++;
            console.log(`Updated offer ${offer.id}: ${offer.name} (${companyName})`);
          } else {
            // Voeg nieuwe offerte toe
            await db.run(`
              INSERT INTO iris_offers (
                offer_id,
                offer_name,
                client_id,
                client_name,
                discr
              ) VALUES (?, ?, ?, ?, ?)
            `, [
              offer.id,
              offer.name,
              companyId,
              companyName,
              'offer'
            ]);
            newCount++;
            console.log(`Added new offer ${offer.id}: ${offer.name} (${companyName})`);
          }
        } catch (error) {
          console.error(`Error processing offer ${offer.id}:`, error.message);
        }
      }

      // Commit de transactie
      await db.run('COMMIT');
      console.log(`Sync completed. Added ${newCount} new offers, updated ${updatedCount} existing offers.`);
    } catch (error) {
      // Rollback bij een fout
      await db.run('ROLLBACK');
      console.error('Error in transaction:', error);
      process.exit(1);
    }

    await db.close();
  } catch (error) {
    console.error('Error in syncOffers:', error);
    process.exit(1);
  }
}

// Start de synchronisatie
syncOffers();
