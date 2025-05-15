/**
 * Synchroniseer ALLE offertes vanuit Gripp
 *
 * Dit script haalt ALLE offertes op uit Gripp en slaat ze op in de iris_offers tabel.
 * Het script gebruikt paginering om alle offertes op te halen, niet alleen de eerste 250.
 * Het script kan worden uitgevoerd met: node src/scripts/sync-all-offers.js
 */

import axios from 'axios';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Laad environment variables
dotenv.config();

// Gripp API configuratie
const GRIPP_API_URL = process.env.GRIPP_API_URL || 'https://api.gripp.com/public/api3.php';
const GRIPP_API_KEY = process.env.GRIPP_API_KEY;

if (!GRIPP_API_KEY) {
  console.error('GRIPP_API_KEY is niet geconfigureerd in .env bestand');
  process.exit(1);
}

console.log('Using Gripp API URL:', GRIPP_API_URL);
console.log('Using Gripp API Key:', GRIPP_API_KEY ? `${GRIPP_API_KEY.substring(0, 5)}...` : 'Not set');

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

async function getAllOffers() {
  console.log('Ophalen van ALLE offertes uit Gripp met paginering...');

  const allOffers = [];
  let hasMoreOffers = true;
  let firstResult = 0;
  const MAX_RESULTS = 250; // Gripp API limiet is 250

  while (hasMoreOffers) {
    console.log(`Ophalen van offertes batch startend bij ${firstResult}...`);

    // Gebruik JSON-RPC formaat zoals in de rest van de applicatie
    const requestId = Date.now();
    const request = {
      method: 'offer.get',
      params: [
        [], // Geen filters, we willen alle offertes
        {   // options
          paging: {
            firstresult: firstResult,
            maxresults: MAX_RESULTS
          },
          // Vraag ook tags op als deze beschikbaar zijn
          with: {
            tags: true
          }
        }
      ],
      id: requestId
    };

    try {
      console.log('Making request to Gripp API...');
      const response = await axios({
        method: 'post',
        url: GRIPP_API_URL,
        data: [request],
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${GRIPP_API_KEY}`
        }
      });

      // Controleer of de response geldig is (JSON-RPC formaat)
      if (!response.data || !response.data[0] || !response.data[0].result || !response.data[0].result.rows) {
        console.error('Geen geldige response van Gripp API');
        console.error('Response data:', JSON.stringify(response.data, null, 2));
        break;
      }

      // In JSON-RPC formaat zitten de offertes in result.rows
      const batchOffers = response.data[0].result.rows;
      console.log(`${batchOffers.length} offertes opgehaald in huidige batch`);

      // Voeg de offertes toe aan de totale lijst
      allOffers.push(...batchOffers);

      // Controleer of er meer offertes zijn
      if (batchOffers.length < MAX_RESULTS || !response.data[0].result.more_items_in_collection) {
        hasMoreOffers = false;
        console.log('Geen offertes meer om op te halen');
      } else {
        // Update de firstResult voor de volgende batch
        firstResult += MAX_RESULTS;
        console.log(`Meer offertes beschikbaar, volgende batch start bij ${firstResult}`);
      }
    } catch (error) {
      console.error('Fout bij ophalen van offertes uit Gripp:', error);
      hasMoreOffers = false;
    }
  }

  console.log(`Totaal ${allOffers.length} offertes opgehaald uit Gripp API`);
  return allOffers;
}

async function syncAllOffers() {
  try {
    console.log('Synchroniseren van ALLE offertes vanuit Gripp...');

    // Verbind met de database
    const db = await getDatabase();

    // Haal alle offertes op uit Gripp met paginering
    const allOffers = await getAllOffers();

    if (allOffers.length === 0) {
      console.error('Geen offertes opgehaald uit Gripp. Synchronisatie wordt afgebroken.');
      process.exit(1);
    }

    // Begin een transactie
    await db.run('BEGIN TRANSACTION');

    try {
      // Verwijder eerst alle bestaande offertes
      console.log('Verwijderen van alle bestaande offertes uit de database...');
      await db.run('DELETE FROM iris_offers');
      console.log('Alle bestaande offertes zijn verwijderd uit de database');

      // Voeg alle offertes toe aan de database
      console.log(`Toevoegen van ${allOffers.length} offertes aan de database...`);
      let savedCount = 0;

      for (const offer of allOffers) {
        try {
          // Haal de client informatie op
          const companyId = offer.company?.id || null;
          const companyName = offer.company?.searchname || 'Onbekende klant';

          // Verwerk tags als deze beschikbaar zijn
          let tagsJson = '[]';
          if (offer.tags && Array.isArray(offer.tags)) {
            // Converteer tags naar hetzelfde formaat als in de projects tabel
            const formattedTags = offer.tags.map(tagId => {
              // Zoek de tag naam op basis van ID (als we die hebben)
              // In dit geval hebben we alleen de ID, dus we gebruiken een placeholder
              return {
                id: tagId.toString(),
                searchname: `Tag ${tagId}` // Placeholder, wordt later bijgewerkt
              };
            });
            tagsJson = JSON.stringify(formattedTags);
          }

          // Voeg offerte toe
          await db.run(`
            INSERT INTO iris_offers (
              offer_id,
              offer_name,
              client_id,
              client_name,
              discr,
              tags,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `, [
            offer.id,
            offer.name || `Offerte ${offer.id}`,
            companyId,
            companyName,
            'offer', // Gebruik consistent 'offer' als discr
            tagsJson
          ]);

          savedCount++;

          if (savedCount % 100 === 0) {
            console.log(`${savedCount}/${allOffers.length} offertes opgeslagen`);
          }
        } catch (offerError) {
          console.error(`Fout bij verwerken van offerte ${offer.id}:`, offerError);
          // Ga door met de volgende offerte
        }
      }

      // Controleer of er offertes zijn toegevoegd
      const offerCount = await db.get('SELECT COUNT(*) as count FROM iris_offers');

      if (offerCount.count === 0) {
        console.error('Geen offertes toegevoegd. Synchronisatie mislukt.');
        await db.run('ROLLBACK');
        process.exit(1);
      }

      // Commit de transactie
      await db.run('COMMIT');
      console.log(`Synchronisatie voltooid: ${savedCount}/${allOffers.length} offertes succesvol gesynchroniseerd`);

      // Toon enkele offertes als voorbeeld
      const sampleOffers = await db.all('SELECT * FROM iris_offers LIMIT 5');
      console.log('Voorbeeld offertes:');
      for (const offer of sampleOffers) {
        console.log(`- ID: ${offer.offer_id}, Naam: ${offer.offer_name}, Klant: ${offer.client_name}, Tags: ${offer.tags}`);
      }

    } catch (error) {
      // Rollback de transactie bij een fout
      await db.run('ROLLBACK');
      console.error('Fout bij synchroniseren van offertes:', error);
      process.exit(1);
    }

  } catch (error) {
    console.error('Fout bij synchroniseren van offertes:', error);
    process.exit(1);
  }
}

// Voer de synchronisatie uit
syncAllOffers();
