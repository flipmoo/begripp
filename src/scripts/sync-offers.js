/**
 * Synchroniseer offertes vanuit Gripp
 *
 * Dit script haalt alle offertes op uit Gripp en slaat ze op in de iris_offers tabel.
 * Het script kan worden uitgevoerd met: node src/scripts/sync-offers.js
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

    try {
      console.log('Sending request to Gripp API...');

      // Bereid de request data voor
      const requestData = {
        api_key: GRIPP_API_KEY,
        call: 'offer.list',
        params: {
          limit: 1000,
          offset: 0
        }
      };

      console.log('Request data:', {
        ...requestData,
        api_key: GRIPP_API_KEY.substring(0, 10) + '...'
      });

      // Probeer nu de echte API call
      console.log('Sending POST request to Gripp API...');

      // Gebruik dezelfde structuur als in src/api/routes/iris.ts
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

          console.log('Response status:', response.status);
          console.log('Response headers:', response.headers);
          console.log('Response data (raw):', response.data);

          if (response.data && response.data.response) {
            return response.data.response;
          }

          console.log('Response data (type):', typeof response.data);
          console.log('Response data (stringified):', JSON.stringify(response.data));
          return null;
        } catch (error) {
          console.error(`Fout bij aanroepen Gripp API (${resource}):`, error.message);
          if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
            console.error('Response data:', error.response.data);
          } else if (error.request) {
            console.error('Geen response ontvangen. Request:', error.request._header);
          } else {
            console.error('Error bij maken van request:', error.message);
          }
          return null;
        }
      };

      // Haal alle offertes op uit Gripp met paginering
      console.log('Fetching all offers from Gripp with pagination...');

      let allOffers = [];
      let currentPage = 0;
      const pageSize = 250;
      let hasMoreResults = true;

      while (hasMoreResults) {
        console.log(`Fetching offers page ${currentPage + 1} (offset: ${currentPage * pageSize})...`);

        // Gebruik de aanpak uit src/api/routes/iris.ts
        const requestId = Math.floor(Math.random() * 10000000000);
        const requestData = [{
          method: 'offer.get',
          params: [
            {}, // filters
            {   // options
              paging: {
                firstresult: currentPage * pageSize,
                maxresults: pageSize,
              }
            }
          ],
          id: requestId
        }];

        console.log('Request data:', JSON.stringify(requestData, null, 2));

        const response = await axios.post(GRIPP_API_URL, requestData, {
          headers: {
            'Authorization': `Bearer ${GRIPP_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        console.log('Response status:', response.status);

        if (response.data && Array.isArray(response.data) && response.data[0] && response.data[0].result && response.data[0].result.rows) {
          const pageOffers = response.data[0].result.rows;
          console.log(`Found ${pageOffers.length} offers on page ${currentPage + 1}`);

          // Voeg de offertes van deze pagina toe aan de totale lijst
          allOffers = [...allOffers, ...pageOffers];

          // Controleer of er nog meer pagina's zijn
          if (pageOffers.length < pageSize) {
            hasMoreResults = false;
            console.log('No more offers to fetch');
          } else {
            // Ga naar de volgende pagina
            currentPage++;

            // Wacht even om de API niet te overbelasten
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } else {
          console.error('Invalid response from Gripp API:', response.data);
          hasMoreResults = false;
        }
      }

      console.log(`Total offers fetched: ${allOffers.length}`);

      if (allOffers.length === 0) {
        console.error('Geen offertes gevonden in Gripp API');
        process.exit(1);
      }

      // Gebruik de verzamelde offertes voor verdere verwerking
      const offers = allOffers;
    } catch (error) {
      console.error('Error bij aanroepen van Gripp API:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response headers:', error.response.headers);
        console.error('Response data:', error.response.data);
      } else if (error.request) {
        console.error('Geen response ontvangen. Request:', error.request);
      } else {
        console.error('Error bij maken van request:', error.message);
      }
      process.exit(1);
    }
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
        // We hebben nu direct alle informatie van de offerte
        // Controleer of de offerte al bestaat in de database
        const existingOffer = await db.get('SELECT id FROM iris_offers WHERE offer_id = ?', [offer.id]);

        // Haal bedrijfsnaam op
        const companyName = offer.company ? offer.company.searchname : 'Onbekend';
        const companyId = offer.company ? offer.company.id : null;

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
            'offer', // Gebruik consistent 'offer' als discr
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
            'offer' // Gebruik consistent 'offer' als discr
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
