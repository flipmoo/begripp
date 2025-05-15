/**
 * Script om projectregels te synchroniseren vanuit Gripp naar de project_lines tabel
 */

import axios from 'axios';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

// ES modules fix voor __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Laad environment variables
dotenv.config();

// Gripp API configuratie
const GRIPP_API_URL = process.env.GRIPP_API_URL || 'https://api.gripp.com/public/api/';
const GRIPP_API_KEY = process.env.GRIPP_API_KEY;

if (!GRIPP_API_KEY) {
  console.error('GRIPP_API_KEY niet gevonden in .env bestand');
  process.exit(1);
}

// Database pad
const DB_PATH = path.join(__dirname, '../db/database.sqlite');

// Controleer of de database bestaat
if (!fs.existsSync(DB_PATH)) {
  console.error(`Database niet gevonden op pad: ${DB_PATH}`);
  process.exit(1);
}

/**
 * Functie om de Gripp API aan te roepen
 */
async function callGrippApi(method, params = [], options = {}) {
  try {
    const requestId = Math.floor(Math.random() * 10000000000);
    const requestData = [{
      method,
      params: [params, options],
      id: requestId
    }];

    console.log(`API aanroep: ${method}`, JSON.stringify(requestData, null, 2));

    const response = await axios.post(GRIPP_API_URL, requestData, {
      headers: {
        'Authorization': `Bearer ${GRIPP_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (response.data && Array.isArray(response.data) && response.data[0] && response.data[0].result) {
      return response.data[0].result;
    } else {
      console.error('Ongeldig response formaat van Gripp API:', response.data);
      return null;
    }
  } catch (error) {
    console.error(`Fout bij aanroepen van Gripp API (${method}):`, error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}

/**
 * Hoofdfunctie
 */
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    let specificProjectId = null;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--project-id' && i + 1 < args.length) {
        specificProjectId = parseInt(args[i + 1]);
        if (isNaN(specificProjectId)) {
          console.error('Ongeldige project ID:', args[i + 1]);
          process.exit(1);
        }
        console.log(`Synchroniseren van projectregels voor specifiek project ID: ${specificProjectId}`);
        break;
      }
    }

    console.log('Verbinding maken met database...');

    // Open de database
    const db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    console.log('Database verbinding succesvol');

    // Controleer of de project_lines tabel bestaat
    const tableExists = await db.get(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='project_lines'
    `);

    if (!tableExists) {
      console.error('project_lines tabel bestaat niet. Voer eerst create-project-lines-table.js uit');
      process.exit(1);
    }

    // Haal projecten op uit de database
    console.log('Ophalen van projecten uit de database...');

    let projects;
    if (specificProjectId) {
      // Haal alleen het specifieke project op
      projects = await db.all(`
        SELECT id, number
        FROM projects
        WHERE id = ?
        ORDER BY id
      `, [specificProjectId]);

      if (projects.length === 0) {
        console.error(`Project met ID ${specificProjectId} niet gevonden in de database`);
        process.exit(1);
      }
    } else {
      // Haal alle projecten op
      projects = await db.all(`
        SELECT id, number
        FROM projects
        ORDER BY id
      `);
    }

    console.log(`${projects.length} projecten gevonden in de database`);

    // Synchroniseer projectregels voor elk project
    let totalProjectLines = 0;
    let updatedProjects = 0;

    for (const project of projects) {
      try {
        console.log(`Synchroniseren van projectregels voor project ${project.id} (${project.number})...`);

        // Haal projectregels op uit Gripp
        const projectLines = await callGrippApi('projectline.get', {
          'offerprojectbase.id': project.id
        });

        if (!projectLines || !projectLines.rows || !Array.isArray(projectLines.rows)) {
          console.warn(`Geen projectregels gevonden voor project ${project.id}`);
          continue;
        }

        console.log(`${projectLines.rows.length} projectregels gevonden voor project ${project.id}`);

        // Begin een transactie
        await db.exec('BEGIN TRANSACTION');

        try {
          // Verwijder bestaande projectregels voor dit project
          await db.run(`
            DELETE FROM project_lines
            WHERE project_id = ?
          `, [project.id]);

          // Voeg nieuwe projectregels toe
          for (const line of projectLines.rows) {
            await db.run(`
              INSERT INTO project_lines (
                id,
                project_id,
                ordering,
                internal_note,
                amount,
                amount_written,
                hide_for_timewriting,
                selling_price,
                discount,
                buying_price,
                additional_subject,
                description,
                hide_details,
                created_on,
                updated_on,
                searchname,
                extended_properties,
                group_category,
                convert_to,
                unit_id,
                unit_name,
                invoice_basis_id,
                invoice_basis_name,
                vat_id,
                vat_name,
                row_type_id,
                row_type_name,
                offerprojectbase_id,
                offerprojectbase_name,
                offerprojectbase_discr,
                contract_line_id,
                product_id,
                product_name,
                product_discr
              ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?
              )
            `, [
              line.id,
              project.id,
              line._ordering || null,
              line.internalnote || null,
              line.amount || 0,
              line.amountwritten || 0,
              line.hidefortimewriting ? 1 : 0,
              parseFloat(line.sellingprice || 0),
              line.discount || 0,
              parseFloat(line.buyingprice || 0),
              line.additionalsubject || null,
              line.description || null,
              line.hidedetails ? 1 : 0,
              line.createdon ? (typeof line.createdon === 'object' ? line.createdon.date : line.createdon) : null,
              line.updatedon ? (typeof line.updatedon === 'object' ? line.updatedon.date : line.updatedon) : null,
              line.searchname || null,
              line.extendedproperties ? JSON.stringify(line.extendedproperties) : null,
              line.groupcategory ? JSON.stringify(line.groupcategory) : null,
              line.convertto ? JSON.stringify(line.convertto) : null,
              line.unit ? line.unit.id : null,
              line.unit ? line.unit.searchname : null,
              line.invoicebasis ? line.invoicebasis.id : null,
              line.invoicebasis ? line.invoicebasis.searchname : null,
              line.vat ? line.vat.id : null,
              line.vat ? line.vat.searchname : null,
              line.rowtype ? line.rowtype.id : null,
              line.rowtype ? line.rowtype.searchname : null,
              line.offerprojectbase ? line.offerprojectbase.id : null,
              line.offerprojectbase ? line.offerprojectbase.searchname : null,
              line.offerprojectbase ? line.offerprojectbase.discr : null,
              line.contractline ? line.contractline.id : null,
              line.product ? line.product.id : null,
              line.product ? line.product.searchname : null,
              line.product ? line.product.discr : null
            ]);

            totalProjectLines++;
          }

          // Commit de transactie
          await db.exec('COMMIT');

          updatedProjects++;
        } catch (error) {
          // Rollback de transactie bij een fout
          await db.exec('ROLLBACK');
          throw error;
        }
      } catch (error) {
        console.error(`Fout bij synchroniseren van projectregels voor project ${project.id}:`, error);
      }

      // Wacht even om de API niet te overbelasten
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`Synchronisatie voltooid: ${totalProjectLines} projectregels gesynchroniseerd voor ${updatedProjects} projecten`);
  } catch (error) {
    console.error('Fout bij uitvoeren van script:', error);
    process.exit(1);
  }
}

// Voer het script uit
main();
