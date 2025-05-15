/**
 * Synchroniseer ALLE projecten vanuit Gripp
 *
 * Dit script haalt ALLE projecten op uit Gripp en slaat ze op in de projects tabel.
 * Het script gebruikt paginering om alle projecten op te halen, niet alleen de eerste 250.
 * Het script kan worden uitgevoerd met: node src/scripts/sync-all-projects.js
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

async function getAllProjects() {
  console.log('Ophalen van ALLE projecten uit Gripp met paginering...');
  
  const allProjects = [];
  let hasMoreProjects = true;
  let firstResult = 0;
  const MAX_RESULTS = 250; // Gripp API limiet is 250
  
  while (hasMoreProjects) {
    console.log(`Ophalen van projecten batch startend bij ${firstResult}...`);
    
    // Gebruik JSON-RPC formaat zoals in de rest van de applicatie
    const requestId = Date.now();
    const request = {
      method: 'project.get',
      params: [
        [
          // Expliciet filter om zowel actieve als gearchiveerde projecten op te halen
          {
            field: 'project.id',
            operator: 'isnotnull',
            value: true
          }
        ],
        {   // options
          paging: {
            firstresult: firstResult,
            maxresults: MAX_RESULTS
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
      
      // In JSON-RPC formaat zitten de projecten in result.rows
      const batchProjects = response.data[0].result.rows;
      console.log(`${batchProjects.length} projecten opgehaald in huidige batch`);
      
      // Voeg de projecten toe aan de totale lijst
      allProjects.push(...batchProjects);
      
      // Controleer of er meer projecten zijn
      if (batchProjects.length < MAX_RESULTS || !response.data[0].result.more_items_in_collection) {
        hasMoreProjects = false;
        console.log('Geen projecten meer om op te halen');
      } else {
        // Update de firstResult voor de volgende batch
        firstResult += MAX_RESULTS;
        console.log(`Meer projecten beschikbaar, volgende batch start bij ${firstResult}`);
      }
    } catch (error) {
      console.error('Fout bij ophalen van projecten uit Gripp:', error);
      hasMoreProjects = false;
    }
  }
  
  console.log(`Totaal ${allProjects.length} projecten opgehaald uit Gripp API`);
  
  // Tel hoeveel gearchiveerde projecten er zijn
  const archivedCount = allProjects.filter(p => p.archived).length;
  console.log(`Waarvan ${archivedCount} gearchiveerde projecten`);
  
  return allProjects;
}

async function syncAllProjects() {
  try {
    console.log('Synchroniseren van ALLE projecten vanuit Gripp...');

    // Verbind met de database
    const db = await getDatabase();
    
    // Haal alle projecten op uit Gripp met paginering
    const allProjects = await getAllProjects();
    
    if (allProjects.length === 0) {
      console.error('Geen projecten opgehaald uit Gripp. Synchronisatie wordt afgebroken.');
      process.exit(1);
    }

    // Begin een transactie
    await db.run('BEGIN TRANSACTION');

    try {
      // Verwijder eerst alle bestaande projecten
      console.log('Verwijderen van alle bestaande projecten uit de database...');
      await db.run('DELETE FROM projects');
      console.log('Alle bestaande projecten zijn verwijderd uit de database');

      // Voeg alle projecten toe aan de database
      console.log(`Toevoegen van ${allProjects.length} projecten aan de database...`);
      let savedCount = 0;
      
      for (const project of allProjects) {
        try {
          // Bereid de project data voor
          // Converteer complexe objecten naar JSON strings
          const projectData = {
            id: project.id,
            name: project.name || '',
            number: project.number || 0,
            color: project.color,
            archivedon: JSON.stringify(project.archivedon),
            clientreference: project.clientreference || '',
            isbasis: project.isbasis ? 1 : 0,
            archived: project.archived ? 1 : 0,
            workdeliveraddress: JSON.stringify(project.workdeliveraddress),
            createdon: JSON.stringify(project.createdon),
            updatedon: JSON.stringify(project.updatedon),
            searchname: project.searchname || '',
            extendedproperties: JSON.stringify(project.extendedproperties),
            totalinclvat: project.totalinclvat || '0',
            totalexclvat: project.totalexclvat || '0',
            startdate: JSON.stringify(project.startdate),
            deadline: JSON.stringify(project.deadline),
            deliverydate: JSON.stringify(project.deliverydate),
            enddate: JSON.stringify(project.enddate),
            addhoursspecification: project.addhoursspecification ? 1 : 0,
            description: project.description || '',
            filesavailableforclient: project.filesavailableforclient ? 1 : 0,
            discr: project.discr || '',
            templateset: JSON.stringify(project.templateset),
            validfor: JSON.stringify(project.validfor),
            accountmanager: JSON.stringify(project.accountmanager),
            phase: JSON.stringify(project.phase),
            company: JSON.stringify(project.company),
            contact: JSON.stringify(project.contact),
            identity: JSON.stringify(project.identity),
            extrapdf1: JSON.stringify(project.extrapdf1),
            extrapdf2: JSON.stringify(project.extrapdf2),
            umbrellaproject: JSON.stringify(project.umbrellaproject),
            tags: JSON.stringify(project.tags),
            employees: JSON.stringify(project.employees),
            employees_starred: JSON.stringify(project.employees_starred),
            files: JSON.stringify(project.files),
            projectlines: JSON.stringify(project.projectlines),
            viewonlineurl: project.viewonlineurl || ''
          };

          // Voeg project toe
          const columns = Object.keys(projectData).join(', ');
          const placeholders = Object.keys(projectData).map(() => '?').join(', ');

          await db.run(`
            INSERT INTO projects (${columns})
            VALUES (${placeholders})
          `, Object.values(projectData));

          savedCount++;
          
          if (savedCount % 100 === 0) {
            console.log(`${savedCount}/${allProjects.length} projecten opgeslagen`);
          }
        } catch (projectError) {
          console.error(`Fout bij verwerken van project ${project.id}:`, projectError);
          // Ga door met het volgende project
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
      console.log(`Synchronisatie voltooid: ${savedCount}/${allProjects.length} projecten succesvol gesynchroniseerd`);
      
      // Toon statistieken
      const activeCount = await db.get('SELECT COUNT(*) as count FROM projects WHERE archived = 0');
      const archivedCount = await db.get('SELECT COUNT(*) as count FROM projects WHERE archived = 1');
      
      console.log('Statistieken:');
      console.log(`- Totaal aantal projecten in database: ${projectCount.count}`);
      console.log(`- Actieve projecten: ${activeCount.count}`);
      console.log(`- Gearchiveerde projecten: ${archivedCount.count}`);
      
      // Toon enkele projecten met ID's in de 4000-reeks
      const projectsIn4000Range = await db.all('SELECT id, name, archived FROM projects WHERE id >= 4000 AND id < 5000 LIMIT 10');
      console.log('Projecten met ID\'s in 4000-4999 bereik:');
      for (const p of projectsIn4000Range) {
        console.log(`- ID: ${p.id}, Naam: ${p.name}, Gearchiveerd: ${p.archived ? 'Ja' : 'Nee'}`);
      }

    } catch (error) {
      // Rollback de transactie bij een fout
      await db.run('ROLLBACK');
      console.error('Fout bij synchroniseren van projecten:', error);
      process.exit(1);
    }

  } catch (error) {
    console.error('Fout bij synchroniseren van projecten:', error);
    process.exit(1);
  }
}

// Voer de synchronisatie uit
syncAllProjects();
