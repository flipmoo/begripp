/**
 * Script om een nieuwe tabel voor projectregels aan te maken en de bestaande projectregels
 * uit de JSON-string in de projects tabel te extraheren en in de nieuwe tabel op te slaan.
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// ES modules fix voor __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database pad
const DB_PATH = path.join(__dirname, '../db/database.sqlite');

// Controleer of de database bestaat
if (!fs.existsSync(DB_PATH)) {
  console.error(`Database niet gevonden op pad: ${DB_PATH}`);
  process.exit(1);
}

async function main() {
  try {
    console.log('Verbinding maken met database...');

    // Open de database
    const db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    });

    console.log('Database verbinding succesvol');

    // Maak de project_lines tabel aan
    console.log('Aanmaken van project_lines tabel...');

    await db.exec(`
      CREATE TABLE IF NOT EXISTS project_lines (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL,
        ordering INTEGER,
        internal_note TEXT,
        amount REAL,
        amount_written REAL,
        hide_for_timewriting BOOLEAN DEFAULT 0,
        selling_price REAL,
        discount REAL,
        buying_price REAL,
        additional_subject TEXT,
        description TEXT,
        hide_details BOOLEAN DEFAULT 0,
        created_on TEXT,
        updated_on TEXT,
        searchname TEXT,
        extended_properties TEXT,
        group_category TEXT,
        convert_to TEXT,
        unit_id INTEGER,
        unit_name TEXT,
        invoice_basis_id INTEGER,
        invoice_basis_name TEXT,
        vat_id INTEGER,
        vat_name TEXT,
        row_type_id INTEGER,
        row_type_name TEXT,
        offerprojectbase_id INTEGER,
        offerprojectbase_name TEXT,
        offerprojectbase_discr TEXT,
        contract_line_id INTEGER,
        product_id INTEGER,
        product_name TEXT,
        product_discr TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `);

    // Maak indexen aan voor snellere lookups
    console.log('Aanmaken van indexen...');

    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_project_lines_project_id ON project_lines(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_lines_product_id ON project_lines(product_id);
      CREATE INDEX IF NOT EXISTS idx_project_lines_searchname ON project_lines(searchname);
    `);

    // Haal alle projecten op met hun projectregels
    console.log('Ophalen van projecten met projectregels...');

    const projects = await db.all(`
      SELECT id, projectlines
      FROM projects
      WHERE projectlines IS NOT NULL AND projectlines != ''
    `);

    console.log(`${projects.length} projecten gevonden met projectregels`);

    // Begin een transactie
    await db.exec('BEGIN TRANSACTION');

    try {
      // Verwerk elk project
      let totalProjectLines = 0;

      for (const project of projects) {
        try {
          // Parse de projectregels JSON
          const projectLines = JSON.parse(project.projectlines);

          if (!Array.isArray(projectLines)) {
            console.warn(`Project ${project.id}: projectlines is geen array, wordt overgeslagen`);
            continue;
          }

          // Verwerk elke projectregel
          for (const line of projectLines) {
            try {
              // Voeg de projectregel toe aan de nieuwe tabel
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
            } catch (lineError) {
              console.error(`Fout bij verwerken van projectregel ${line.id} voor project ${project.id}:`, lineError);
            }
          }
        } catch (projectError) {
          console.error(`Fout bij verwerken van project ${project.id}:`, projectError);
        }
      }

      // Commit de transactie
      await db.exec('COMMIT');

      console.log(`Totaal ${totalProjectLines} projectregels verwerkt en opgeslagen in de nieuwe tabel`);
    } catch (error) {
      // Rollback de transactie bij een fout
      await db.exec('ROLLBACK');
      throw error;
    }

    console.log('Script succesvol uitgevoerd');
  } catch (error) {
    console.error('Fout bij uitvoeren van script:', error);
    process.exit(1);
  }
}

// Voer het script uit
main();
