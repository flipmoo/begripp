/**
 * Synchroniseer offertes vanuit Gripp
 *
 * Dit script haalt alle offertes op uit Gripp en slaat ze op in de iris_offers tabel.
 * Het script kan worden uitgevoerd met: node src/scripts/sync-offers-commonjs.js
 */

const axios = require('axios');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const dotenv = require('dotenv');

// Laad environment variables
dotenv.config();

// Gripp API configuratie
const GRIPP_API_URL = process.env.GRIPP_API_URL || 'https://api.gripp.com/public/api3.php';
const GRIPP_API_KEY = process.env.GRIPP_API_KEY;

if (!GRIPP_API_KEY) {
  console.error('GRIPP_API_KEY is niet geconfigureerd in .env bestand');
  process.exit(1);
}

async function getDatabase() {
  const dbPath = path.join(__dirname, '../db/database.sqlite');

  return open({
    filename: dbPath,
    driver: sqlite3.verbose().Database
  });
}

async function syncOffers() {
  try {
    console.log('Synchroniseren van offertes vanuit Gripp...');

    // Verbind met de database
    const db = await getDatabase();

    // Haal alle offertes op uit Gripp
    console.log(`API URL: ${GRIPP_API_URL}`);
    console.log(`API Key: ${GRIPP_API_KEY.substring(0, 10)}...`);

    // Functie om Gripp API aan te roepen
    const callGrippApi = async (resource, params = {}) => {
      try {
        console.log('Making API request to:', GRIPP_API_URL);
        console.log('Request data:', {
          api_key: GRIPP_API_KEY.substring(0, 10) + '...',
          call: resource,
          params
        });

        // Gebruik exact dezelfde structuur als in src/api/routes/iris.ts
        const requestData = {
          api_key: GRIPP_API_KEY,
          call: resource,
          params
        };

        console.log('Request data (stringified):', JSON.stringify(requestData));

        // Gebruik dezelfde structuur als in src/api/routes/iris.ts
        const response = await axios.post(GRIPP_API_URL, requestData, {
          timeout: 10000 // 10 seconden timeout
        });

        if (response.data && response.data.response) {
          return response.data.response;
        }

        console.error('Invalid response from Gripp API:', response.data);
        return null;
      } catch (error) {
        console.error(`Fout bij aanroepen Gripp API (${resource}):`, error.message);
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
        }
        return null;
      }
    };

    let response;
    try {
      response = await callGrippApi('projects/list', {
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
    } catch (error) {
      console.error('Error bij aanroepen van Gripp API:', error.message);
      process.exit(1);
    }

    // Controleer of response een array is
    if (!Array.isArray(response)) {
      console.error('Onverwacht response formaat van Gripp API:', response);
      process.exit(1);
    }

    const offers = response;
    console.log(`${offers.length} offertes opgehaald uit Gripp`);

    // Maak een tabel aan voor offertes als deze nog niet bestaat
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

    // Begin een transactie
    await db.run('BEGIN TRANSACTION');

    let updatedCount = 0;
    let newCount = 0;

    try {
      // Verwerk elke offerte
      for (const offer of offers) {
        // Controleer of het een offerte is
        if (offer.discr !== 'offer') {
          console.warn(`Project ${offer.id} is geen offerte (discr=${offer.discr})`);
          continue;
        }

        // Haal bedrijfsnaam op
        const companyName = offer.company ? offer.company.searchname : 'Onbekend';
        const companyId = offer.company ? offer.company.id : null;

        // Controleer of de offerte al bestaat in de database
        const existingOffer = await db.get('SELECT id FROM iris_offers WHERE offer_id = ?', [offer.id]);

        if (existingOffer) {
          // Update bestaande offerte
          await db.run(`
            UPDATE iris_offers
            SET
              offer_name = ?,
              client_id = ?,
              client_name = ?,
              discr = ?,
              updated_at = datetime('now')
            WHERE offer_id = ?
          `, [
            offer.name,
            companyId,
            companyName,
            'offer',
            offer.id
          ]);

          console.log(`Offerte ${offer.id} (${offer.name}) bijgewerkt`);
          updatedCount++;
        } else {
          // Voeg nieuwe offerte toe
          await db.run(`
            INSERT INTO iris_offers (
              offer_id,
              offer_name,
              client_id,
              client_name,
              discr,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `, [
            offer.id,
            offer.name,
            companyId,
            companyName,
            'offer'
          ]);

          console.log(`Offerte ${offer.id} (${offer.name}) toegevoegd`);
          newCount++;
        }
      }

      // Commit de transactie
      await db.run('COMMIT');
      console.log(`Synchronisatie voltooid. ${newCount} nieuwe offertes toegevoegd, ${updatedCount} bestaande offertes bijgewerkt.`);

    } catch (error) {
      // Rollback de transactie bij een fout
      await db.run('ROLLBACK');
      console.error('Fout bij synchroniseren van offertes:', error);
      process.exit(1);
    }

    // Sluit de database verbinding
    await db.close();
    console.log('Database verbinding gesloten');

  } catch (error) {
    console.error('Fout bij synchroniseren van offertes:', error);
    process.exit(1);
  }
}

// Voer de synchronisatie uit
syncOffers();
