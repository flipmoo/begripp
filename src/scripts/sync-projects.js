/**
 * Synchroniseer projecten vanuit Gripp
 *
 * Dit script haalt projecten op uit Gripp en slaat ze op in de projects tabel.
 * Het script kan worden uitgevoerd met: node src/scripts/sync-projects.js
 */

import axios from 'axios';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { markSyncStarted, markSyncCompleted } from './sync-status.js';

// Helper functie om te wachten
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

async function syncProjects() {
  try {
    console.log('Synchroniseren van projecten vanuit Gripp...');

    // Markeer dat de synchronisatie is gestart
    markSyncStarted('projects');

    // Verbind met de database
    const db = await getDatabase();

    // Haal alle projecten op uit Gripp met paginering
    console.log('Ophalen van ALLE projecten uit Gripp met paginering...');

    let projects = [];
    let hasMoreProjects = true;
    let firstResult = 0;
    const maxResults = 250; // Maximaal 250 resultaten per pagina volgens API documentatie
    let pageNumber = 1;

    try {
      while (hasMoreProjects) {
        console.log(`Ophalen van pagina ${pageNumber} (resultaten ${firstResult} tot ${firstResult + maxResults})...`);

        // Gebruik JSON-RPC formaat zoals in de rest van de applicatie
        const requestId = Date.now();
        const request = {
          method: 'project.get',
          params: [
            [], // geen filters, we willen ALLES
            {   // options
              paging: {
                firstresult: firstResult,
                maxresults: maxResults
              }
            }
          ],
          id: requestId
        };

        console.log('Request data:', JSON.stringify([request], null, 2));

        // Wacht 2 seconden om rate limiting te voorkomen
        console.log('Wachten 2 seconden om rate limiting te voorkomen...');
        await sleep(2000);

        console.log('Making request to Gripp API using JSON-RPC format');
        let response = await axios({
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
          console.error('Synchronisatie wordt afgebroken. Controleer de Gripp API configuratie.');
          process.exit(1);
        } else {
          // In JSON-RPC formaat zitten de projecten in result.rows
          const pageProjects = response.data[0].result.rows;
          console.log(`${pageProjects.length} projecten opgehaald uit Gripp (pagina ${pageNumber})`);

          // Voeg de projecten toe aan de lijst
          projects = projects.concat(pageProjects);

          // Controleer of er nog meer projecten zijn
          if (pageProjects.length < maxResults) {
            hasMoreProjects = false;
            console.log('Alle projecten zijn opgehaald');
          } else {
            // Ga naar de volgende pagina
            firstResult += maxResults;
            pageNumber++;
          }
        }
      }

      console.log(`Totaal ${projects.length} projecten opgehaald uit Gripp`);

      // Als er geen projecten zijn opgehaald, geef een foutmelding
      if (projects.length === 0) {
        console.error('Geen projecten opgehaald uit Gripp. Synchronisatie wordt afgebroken.');
        process.exit(1);
      }
    } catch (error) {
      console.error('Fout bij ophalen van projecten uit Gripp:', error);
      console.error('Synchronisatie wordt afgebroken. Controleer de Gripp API configuratie.');
      process.exit(1);
    }

    // Begin een transactie
    await db.run('BEGIN TRANSACTION');

    try {
      // Maak een backup van de bestaande projecten
      console.log('Maken van een backup van bestaande projecten...');
      await db.run('DROP TABLE IF EXISTS projects_backup');
      await db.run('CREATE TABLE projects_backup AS SELECT * FROM projects');
      console.log('Backup van bestaande projecten gemaakt');

      // Verwijder alle bestaande projecten
      console.log('Verwijderen van alle bestaande projecten...');
      await db.run('DELETE FROM projects');
      console.log('Alle bestaande projecten zijn verwijderd');

      // Verwerk projecten in batches van 50 om rate limiting te voorkomen
      const batchSize = 50;
      const projectBatches = [];

      // Verdeel projecten in batches
      for (let i = 0; i < projects.length; i += batchSize) {
        projectBatches.push(projects.slice(i, i + batchSize));
      }

      console.log(`Verwerken van ${projectBatches.length} batches van maximaal ${batchSize} projecten...`);

      // Verwerk elke batch
      for (let batchIndex = 0; batchIndex < projectBatches.length; batchIndex++) {
        const batch = projectBatches[batchIndex];
        console.log(`Verwerken van batch ${batchIndex + 1} van ${projectBatches.length} (${batch.length} projecten)...`);

        // Verwerk elk project in de batch
        for (const project of batch) {
          try {
            // Wacht 100ms om de database niet te overbelasten
            await sleep(100);

            // Gebruik de projecten die we al hebben opgehaald
            // De basis projectgegevens zijn al beschikbaar in het project object
            const projectDetail = project;

            // Bepaal het type op basis van tags
            let projectType = 'Verkeerde tag';
            let budget = null;

            if (projectDetail.tags && projectDetail.tags.length > 0) {
              const tagName = projectDetail.tags[0].searchname;
              if (tagName === 'Intern') {
                projectType = 'Intern';
              } else if (tagName === 'Contract') {
                projectType = 'Contract';
              } else if (tagName === 'Vaste prijs') {
                projectType = 'Vaste Prijs';
                // Voor vaste prijs projecten, gebruik totalexclvat als budget
                budget = projectDetail.totalexclvat || null;
              } else if (tagName === 'Nacalculatie') {
                projectType = 'Nacalculatie';
              }
            }

            // Bereid de project data voor
            const projectData = {
              id: project.id,
              name: projectDetail.name,
              number: projectDetail.number,
              color: projectDetail.color,
              archivedon: projectDetail.archivedon,
              clientreference: projectDetail.clientreference,
              isbasis: projectDetail.isbasis,
              archived: projectDetail.archived,
              workdeliveraddress: JSON.stringify(projectDetail.workdeliveraddress),
              createdon: projectDetail.createdon,
              updatedon: projectDetail.updatedon,
              searchname: projectDetail.searchname,
              extendedproperties: JSON.stringify(projectDetail.extendedproperties),
              totalinclvat: projectDetail.totalinclvat,
              totalexclvat: projectDetail.totalexclvat,
              startdate: projectDetail.startdate,
              deadline: projectDetail.deadline,
              deliverydate: projectDetail.deliverydate,
              enddate: projectDetail.enddate,
              addhoursspecification: projectDetail.addhoursspecification,
              description: projectDetail.description,
              filesavailableforclient: projectDetail.filesavailableforclient,
              discr: projectDetail.discr,
              templateset: JSON.stringify(projectDetail.templateset),
              validfor: JSON.stringify(projectDetail.validfor),
              accountmanager: JSON.stringify(projectDetail.accountmanager),
              phase: JSON.stringify(projectDetail.phase),
              company: JSON.stringify(projectDetail.company),
              contact: JSON.stringify(projectDetail.contact),
              identity: JSON.stringify(projectDetail.identity),
              extrapdf1: JSON.stringify(projectDetail.extrapdf1),
              extrapdf2: JSON.stringify(projectDetail.extrapdf2),
              umbrellaproject: JSON.stringify(projectDetail.umbrellaproject),
              tags: JSON.stringify(projectDetail.tags),
              employees: JSON.stringify(projectDetail.employees),
              employees_starred: JSON.stringify(projectDetail.employees_starred),
              files: JSON.stringify(projectDetail.files),
              projectlines: JSON.stringify(projectDetail.projectlines),
              viewonlineurl: projectDetail.viewonlineurl,
              type: projectType,
              budget: budget
            };

            // Voeg nieuw project toe
            const columns = Object.keys(projectData).join(', ');
            const placeholders = Object.keys(projectData).map(() => '?').join(', ');

            await db.run(`
              INSERT INTO projects (${columns})
              VALUES (${placeholders})
            `, Object.values(projectData));

            console.log(`Project ${project.id} (${projectDetail.name}) toegevoegd`);
          } catch (projectError) {
            console.error(`Fout bij verwerken van project ${project.id}:`, projectError);
            // Ga door met het volgende project
          }
        }
      }

      // Controleer of er projecten zijn toegevoegd
      const projectCount = await db.get('SELECT COUNT(*) as count FROM projects');

      if (projectCount.count === 0) {
        console.error('Geen projecten toegevoegd. Synchronisatie mislukt.');
        await db.run('ROLLBACK');
        process.exit(1);
      }

      // Commit de transactie
      await db.run('COMMIT');
      console.log('Alle projecten zijn succesvol gesynchroniseerd');

      // Markeer dat de synchronisatie is voltooid
      markSyncCompleted('projects');

    } catch (error) {
      // Rollback de transactie bij een fout
      await db.run('ROLLBACK');
      console.error('Fout bij synchroniseren van projecten:', error);

      // Markeer dat de synchronisatie is voltooid (met fout)
      markSyncCompleted('projects');

      process.exit(1);
    }
  } catch (error) {
    console.error('Fout bij synchroniseren van projecten:', error);

    // Markeer dat de synchronisatie is voltooid (met fout)
    markSyncCompleted('projects');

    process.exit(1);
  }
}

// Voer de synchronisatie uit
syncProjects();
