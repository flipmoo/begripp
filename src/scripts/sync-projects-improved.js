/**
 * Verbeterde versie van het sync-projects script met rate limiting
 *
 * Dit script haalt projecten op uit Gripp en slaat ze op in de projects tabel.
 * Het script kan worden uitgevoerd met: node src/scripts/sync-projects-improved.js
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

// Rate limiting configuratie
const BATCH_SIZE = 10; // Aantal projecten per batch
const DELAY_BETWEEN_REQUESTS = 500; // Milliseconden tussen API requests
const DELAY_BETWEEN_BATCHES = 2000; // Milliseconden tussen batches

if (!GRIPP_API_KEY) {
  console.error('GRIPP_API_KEY is niet geconfigureerd in .env bestand');
  process.exit(1);
}

console.log('Using Gripp API URL:', GRIPP_API_URL);
console.log('Using Gripp API Key:', GRIPP_API_KEY);

// Helper functie om een vertraging toe te voegen
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

// Helper functie om tags te loggen voor debugging
function logTags(projectId, projectName, tags) {
  console.log(`Tags voor project ${projectId} (${projectName}):`, JSON.stringify(tags));
}

async function syncProjects() {
  try {
    console.log('Synchroniseren van projecten vanuit Gripp...');

    // Verbind met de database
    const db = await getDatabase();

    // Haal alle projecten op uit Gripp
    console.log('Ophalen van projecten uit Gripp...');
    const requestData = {
      api_key: GRIPP_API_KEY,
      call: 'project.list',
      params: {
        limit: 1000, // Maximaal aantal projecten om op te halen
        offset: 0
      }
    };

    console.log('Request data:', JSON.stringify(requestData, null, 2));

    const response = await axios({
      method: 'post',
      url: GRIPP_API_URL,
      data: requestData,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    let projects = [];

    if (!response.data || !response.data.response) {
      console.error('Geen geldige response van Gripp API');
      console.log('Fallback naar sample-projects.json...');

      // Lees het sample-projects.json bestand als fallback
      const fs = await import('fs');
      const sampleProjectsPath = path.join(path.dirname(__dirname), 'db/sample-projects.json');

      if (fs.existsSync(sampleProjectsPath)) {
        try {
          const sampleProjectsJson = fs.readFileSync(sampleProjectsPath, 'utf8');
          const sampleProjects = JSON.parse(sampleProjectsJson);

          // Converteer sample projecten naar het juiste formaat
          projects = sampleProjects.map(project => {
            return {
              id: project.id,
              name: project.name,
              number: project.number,
              company: {
                id: project.company_id,
                searchname: project.company_name
              },
              tags: project.tags,
              archived: project.status === 'active' ? 0 : 1,
              startdate: project.start_date,
              deadline: project.deadline,
              description: `Geïmporteerd project (${project.invoice_method}, budget: ${project.budget_hours} uur, €${project.budget_costs})`
            };
          });

          console.log(`${projects.length} projecten opgehaald uit sample-projects.json`);
        } catch (error) {
          console.error('Fout bij lezen van sample-projects.json:', error);
          process.exit(1);
        }
      } else {
        console.error('sample-projects.json niet gevonden');
        process.exit(1);
      }
    } else {
      projects = response.data.response;
      console.log(`${projects.length} projecten opgehaald uit Gripp API`);
    }

    // Begin een transactie
    await db.run('BEGIN TRANSACTION');

    try {
      // Verwijder eerst alle bestaande projecten
      console.log('Verwijderen van alle bestaande projecten uit de database...');
      await db.run('DELETE FROM projects');
      console.log('Alle bestaande projecten zijn verwijderd uit de database');

      // Haal alle tags op uit Gripp voor debugging
      console.log('Ophalen van alle tags uit Gripp...');
      const tagsRequestData = {
        api_key: GRIPP_API_KEY,
        call: 'tag.list',
        params: {
          limit: 1000,
          offset: 0
        }
      };

      console.log('Tags request data:', JSON.stringify(tagsRequestData, null, 2));

      const tagsResponse = await axios({
        method: 'post',
        url: GRIPP_API_URL,
        data: tagsRequestData,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      let allTags = [];
      if (tagsResponse.data && tagsResponse.data.response) {
        allTags = tagsResponse.data.response;
        console.log(`${allTags.length} tags opgehaald uit Gripp`);

        // Maak een map van tag ID naar tag naam voor snelle lookup
        const tagMap = new Map();
        allTags.forEach(tag => {
          tagMap.set(tag.id, tag.searchname);
        });

        console.log('Beschikbare tags in Gripp:');
        allTags.forEach(tag => {
          console.log(`- Tag ID ${tag.id}: ${tag.searchname}`);
        });
      } else {
        console.warn('Geen tags opgehaald uit Gripp');
      }

      // Verwerk projecten in batches om rate limiting te voorkomen
      for (let i = 0; i < projects.length; i += BATCH_SIZE) {
        const batch = projects.slice(i, i + BATCH_SIZE);
        console.log(`Verwerken van batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(projects.length / BATCH_SIZE)} (${batch.length} projecten)`);

        // Verwerk elk project in de batch met een vertraging tussen requests
        for (let j = 0; j < batch.length; j++) {
          const project = batch[j];

          try {
            // Haal meer details op over het project
            const projectDetailRequestData = {
              api_key: GRIPP_API_KEY,
              call: 'project.get',
              params: {
                id: project.id
              }
            };

            console.log(`Ophalen van details voor project ${project.id}...`);
            console.log('Project detail request data:', JSON.stringify(projectDetailRequestData, null, 2));

            const projectDetailResponse = await axios({
              method: 'post',
              url: GRIPP_API_URL,
              data: projectDetailRequestData,
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              }
            });

            if (!projectDetailResponse.data || !projectDetailResponse.data.response) {
              console.warn(`Geen geldige details voor project ${project.id}`);
              continue;
            }

            const projectDetail = projectDetailResponse.data.response;

            // Log de tags voor debugging
            if (projectDetail.tags && Array.isArray(projectDetail.tags)) {
              logTags(project.id, projectDetail.name, projectDetail.tags);
            } else {
              console.log(`Project ${project.id} (${projectDetail.name}) heeft geen tags`);
            }

            // Controleer of het project al bestaat in de database
            const existingProject = await db.get('SELECT id, tags FROM projects WHERE id = ?', [project.id]);

            // Bereid de project data voor
            const projectData = {
              id: project.id,
              name: projectDetail.name || '',
              number: projectDetail.number || 0,
              color: projectDetail.color || '',
              archivedon: projectDetail.archivedon || null,
              clientreference: projectDetail.clientreference || '',
              isbasis: projectDetail.isbasis ? 1 : 0,
              archived: projectDetail.archived ? 1 : 0,
              workdeliveraddress: JSON.stringify(projectDetail.workdeliveraddress || {}),
              createdon: projectDetail.createdon || null,
              updatedon: projectDetail.updatedon || null,
              searchname: projectDetail.searchname || '',
              extendedproperties: JSON.stringify(projectDetail.extendedproperties || {}),
              totalinclvat: projectDetail.totalinclvat || 0,
              totalexclvat: projectDetail.totalexclvat || 0,
              startdate: projectDetail.startdate || null,
              deadline: projectDetail.deadline || null,
              deliverydate: projectDetail.deliverydate || null,
              enddate: projectDetail.enddate || null,
              addhoursspecification: projectDetail.addhoursspecification ? 1 : 0,
              description: projectDetail.description || '',
              filesavailableforclient: projectDetail.filesavailableforclient ? 1 : 0,
              discr: projectDetail.discr || '',
              company_id: projectDetail.company?.id || null,
              company_name: projectDetail.company?.searchname || '',
              phase_id: projectDetail.phase?.id || null,
              phase_name: projectDetail.phase?.searchname || '',
              tags: JSON.stringify(projectDetail.tags || [])
            };

            if (existingProject) {
              // Log de huidige en nieuwe tags voor debugging
              if (existingProject.tags) {
                try {
                  const currentTags = JSON.parse(existingProject.tags);
                  console.log(`Huidige tags voor project ${project.id} (${projectDetail.name}):`, JSON.stringify(currentTags));
                  console.log(`Nieuwe tags voor project ${project.id} (${projectDetail.name}):`, JSON.stringify(projectDetail.tags || []));
                } catch (e) {
                  console.warn(`Kon huidige tags niet parsen voor project ${project.id}:`, e.message);
                }
              }

              // Update bestaand project
              const columns = Object.keys(projectData).map(key => `${key} = ?`).join(', ');
              const values = Object.values(projectData);

              await db.run(`
                UPDATE projects
                SET ${columns}
                WHERE id = ?
              `, [...values, project.id]);

              console.log(`Project ${project.id} (${projectDetail.name}) bijgewerkt`);
            } else {
              // Voeg nieuw project toe
              const columns = Object.keys(projectData).join(', ');
              const placeholders = Object.keys(projectData).map(() => '?').join(', ');

              await db.run(`
                INSERT INTO projects (${columns})
                VALUES (${placeholders})
              `, Object.values(projectData));

              console.log(`Project ${project.id} (${projectDetail.name}) toegevoegd`);
            }

            // Voeg een vertraging toe tussen API requests om rate limiting te voorkomen
            if (j < batch.length - 1) {
              await delay(DELAY_BETWEEN_REQUESTS);
            }
          } catch (error) {
            console.error(`Fout bij verwerken van project ${project.id}:`, error);
            // Ga door met het volgende project
          }
        }

        // Voeg een langere vertraging toe tussen batches
        if (i + BATCH_SIZE < projects.length) {
          console.log(`Wachten ${DELAY_BETWEEN_BATCHES}ms voor de volgende batch...`);
          await delay(DELAY_BETWEEN_BATCHES);
        }
      }

      // Commit de transactie
      await db.run('COMMIT');
      console.log('Alle projecten zijn succesvol gesynchroniseerd');

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
syncProjects();
