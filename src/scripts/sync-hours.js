/**
 * Synchroniseer uren vanuit Gripp
 *
 * Dit script haalt uren op uit Gripp voor een specifiek jaar en slaat ze op in de hours tabel.
 * Het script kan worden uitgevoerd met: node src/scripts/sync-hours.js [jaar]
 */

import axios from 'axios';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

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
  // Get the directory name using ES modules approach
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const dbPath = path.join(__dirname, '../db/database.sqlite');
  console.log('Database path:', dbPath);

  return open({
    filename: dbPath,
    driver: sqlite3.Database
  });
}

async function syncHours(year) {
  try {
    // Als geen jaar is opgegeven, gebruik het huidige jaar
    if (!year) {
      year = new Date().getFullYear();
    }

    console.log(`Synchroniseren van uren voor jaar ${year} vanuit Gripp...`);
    console.log(`LET OP: Omdat Gripp alleen testdata uit 2018 bevat, worden de uren uit 2018 opgehaald`);
    console.log(`en wordt het jaartal aangepast naar ${year}. Dit is een tijdelijke oplossing`);
    console.log(`totdat er echte data voor ${year} beschikbaar is in Gripp.`);

    // Verbind met de database
    const db = await getDatabase();

    // Controleer of de hours tabel de benodigde kolommen heeft
    const tableInfo = await db.all(`PRAGMA table_info(hours)`);
    const hasProjectId = tableInfo.some((column) => column.name === 'project_id');
    const hasProjectName = tableInfo.some((column) => column.name === 'project_name');
    const hasProjectLineId = tableInfo.some((column) => column.name === 'project_line_id');
    const hasProjectLineName = tableInfo.some((column) => column.name === 'project_line_name');
    const hasOfferprojectbaseDiscr = tableInfo.some((column) => column.name === 'offerprojectbase_discr');

    if (!hasProjectId) {
      console.log('project_id kolom bestaat niet, wordt toegevoegd...');
      await db.run(`ALTER TABLE hours ADD COLUMN project_id INTEGER`);
    }

    if (!hasProjectName) {
      console.log('project_name kolom bestaat niet, wordt toegevoegd...');
      await db.run(`ALTER TABLE hours ADD COLUMN project_name TEXT`);
    }

    if (!hasProjectLineId) {
      console.log('project_line_id kolom bestaat niet, wordt toegevoegd...');
      await db.run(`ALTER TABLE hours ADD COLUMN project_line_id INTEGER`);
    }

    if (!hasProjectLineName) {
      console.log('project_line_name kolom bestaat niet, wordt toegevoegd...');
      await db.run(`ALTER TABLE hours ADD COLUMN project_line_name TEXT`);
    }

    if (!hasOfferprojectbaseDiscr) {
      console.log('offerprojectbase_discr kolom bestaat niet, wordt toegevoegd...');
      await db.run(`ALTER TABLE hours ADD COLUMN offerprojectbase_discr TEXT`);
    }

    // Haal uren op uit Gripp voor het opgegeven jaar
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    console.log(`Ophalen van uren tussen ${startDate} en ${endDate}...`);

    // Implementeer paginering om alle uren op te halen
    let allHours = [];
    let currentPage = 0;
    const pageSize = 250; // Maximum toegestaan door Gripp API
    const maxPages = 25; // Maximaal 25 pagina's (6250 uren) ophalen
    let hasMoreResults = true;

    console.log('Ophalen van uren met paginering (maximaal 25 pagina\'s)...');

    while (hasMoreResults && currentPage < maxPages) {
      const firstResult = currentPage * pageSize;
      const requestId = Math.floor(Math.random() * 10000000000);

      // Gebruik het huidige jaar voor de filter
      const currentYear = new Date().getFullYear();
      const filterStartDate = `${currentYear}-01-01`;
      const filterEndDate = `${currentYear}-12-31`;

      console.log(`Filtering hours for current year: ${currentYear} (${filterStartDate} to ${filterEndDate})`);

      const requestData = [{
        method: 'hour.get',
        params: [
          {
            // Filter op het huidige jaar
            "hour.date": {
              "field": "hour.date",
              "operator": "between",
              "value": filterStartDate,
              "value2": filterEndDate
            }
          },
          {
            paging: {
              firstresult: firstResult,
              maxresults: pageSize
            }
          }
        ],
        id: requestId
      }];

      console.log(`Ophalen van pagina ${currentPage + 1} (resultaten ${firstResult} - ${firstResult + pageSize})...`);

      try {
        const response = await axios.post(GRIPP_API_URL, requestData, {
          headers: {
            'Authorization': `Bearer ${GRIPP_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        });

        if (!response.data || !Array.isArray(response.data) || !response.data[0]) {
          console.error('Geen geldige response van Gripp API:', response.data);
          break;
        }

        // Check of er een foutmelding is
        if (response.data[0].error) {
          console.error(`API fout: ${response.data[0].error}`);
          break;
        }

        // Check of er resultaten zijn
        if (!response.data[0].result || !response.data[0].result.rows) {
          console.error('Geen resultaten in response:', response.data);
          break;
        }

        const pageHours = response.data[0].result.rows;
        console.log(`${pageHours.length} uren opgehaald op pagina ${currentPage + 1}`);

        // Voeg de uren van deze pagina toe aan de totale lijst
        allHours = [...allHours, ...pageHours];

        // Als we minder resultaten krijgen dan de pageSize, zijn we klaar
        if (pageHours.length < pageSize) {
          hasMoreResults = false;
          console.log('Laatste pagina bereikt.');
        } else {
          // Ga naar de volgende pagina
          currentPage++;
        }
      } catch (error) {
        console.error('Fout bij ophalen van uren:', error);
        break;
      }
    }

    const hours = allHours;
    console.log(`Totaal ${hours.length} uren opgehaald uit Gripp voor jaar ${year}`);

    // Begin een transactie
    await db.run('BEGIN TRANSACTION');

    try {
      // Controleer of er al uren bestaan voor dit jaar
      const existingHours = await db.get(`
        SELECT COUNT(*) as count FROM hours
        WHERE date BETWEEN ? AND ?
      `, [startDate, endDate]);

      console.log(`${existingHours.count} bestaande uren gevonden voor jaar ${year}`);

      // Verwijder bestaande uren voor dit jaar om dubbele entries te voorkomen
      // Maar behoud uren voor andere jaren
      await db.run(`
        DELETE FROM hours
        WHERE strftime('%Y', date) = ?
      `, [year.toString()]);

      console.log(`Bestaande uren voor jaar ${year} verwijderd`);

      // Verwerk alle uren
      const hoursToProcess = hours;
      console.log(`Verwerken van ${hoursToProcess.length} uren...`);

      for (const hour of hoursToProcess) {
        // Verwerk elk uur

        // Haal project informatie op
        let projectId = null;
        let projectName = null;
        let projectLineId = null;
        let projectLineName = null;
        let offerprojectbaseDiscr = null;

        if (hour.offerprojectbase && hour.offerprojectbase.id) {
          projectId = hour.offerprojectbase.id;
          projectName = hour.offerprojectbase.searchname || hour.offerprojectbase.name;

          // Sla het type op (offerte of opdracht)
          if (hour.offerprojectbase.discr) {
            offerprojectbaseDiscr = hour.offerprojectbase.discr;
            console.log(`Setting offerprojectbase_discr to ${offerprojectbaseDiscr} for hour ${hour.id}`);
          }
        }

        if (hour.offerprojectline && hour.offerprojectline.id) {
          projectLineId = hour.offerprojectline.id;
          projectLineName = hour.offerprojectline.searchname || hour.offerprojectline.name;
        }

        // Haal de datum op
        let hourDate = hour.date && typeof hour.date === 'object' && hour.date.date ? hour.date.date.split(' ')[0] : (hour.date && typeof hour.date === 'string' ? hour.date : null);

        // Als een specifiek jaar is opgegeven, vervang het jaar in de datum
        if (hourDate && year) {
          // Vervang het jaar in de datum alleen als een specifiek jaar is opgegeven
          const dateParts = hourDate.split('-');
          if (dateParts.length === 3) {
            hourDate = `${year}-${dateParts[1]}-${dateParts[2]}`;
            console.log(`Datum aangepast van ${dateParts.join('-')} naar ${hourDate}`);
          }

          // Voeg uur toe aan de database of update bestaande uur
          await db.run(`
            INSERT OR REPLACE INTO hours (
              id,
              date,
              employee_id,
              amount,
              description,
              status_id,
              status_name,
              project_id,
              project_name,
              project_line_id,
              project_line_name,
              offerprojectbase_discr
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            hour.id,
            hourDate, // Datum met aangepast jaar
            hour.employee ? hour.employee.id : null,
            hour.amount,
            hour.description,
            hour.status ? hour.status.id : null,
            hour.status ? hour.status.searchname : null,
            projectId,
            projectName,
            projectLineId,
            projectLineName,
            offerprojectbaseDiscr
          ]);
        }
      }

      // Commit de transactie
      await db.run('COMMIT');
      console.log(`${hoursToProcess.length} uren succesvol gesynchroniseerd voor jaar ${year}`);

    } catch (error) {
      // Rollback de transactie bij een fout
      await db.run('ROLLBACK');
      console.error('Fout bij synchroniseren van uren:', error);
      process.exit(1);
    }

  } catch (error) {
    console.error('Fout bij synchroniseren van uren:', error);
    process.exit(1);
  }
}

// Haal het jaar op uit de command line arguments
const year = process.argv[2] ? parseInt(process.argv[2]) : null;

// Voer de synchronisatie uit
syncHours(year).catch(error => {
  console.error('Error in syncHours:', error);
  process.exit(1);
});
