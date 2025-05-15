/**
 * Script om projecten te importeren uit een JSON-bestand
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

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

async function importProjectsFromJson() {
  try {
    console.log('Importeren van projecten uit JSON-bestand...');

    // Verbind met de database
    const db = await getDatabase();

    // Controleer hoeveel projecten er zijn voor het importeren
    const countBefore = await db.get('SELECT COUNT(*) as count FROM projects');
    console.log(`Aantal projecten voor het importeren: ${countBefore.count}`);

    // Begin een transactie
    console.log('Begin transactie...');
    await db.run('BEGIN TRANSACTION');

    try {
      // Verwijder alle bestaande projecten
      console.log('Verwijderen van alle bestaande projecten...');
      await db.run('DELETE FROM projects');

      // Controleer hoeveel projecten er zijn na het verwijderen
      const countAfterDelete = await db.get('SELECT COUNT(*) as count FROM projects');
      console.log(`Aantal projecten na het verwijderen: ${countAfterDelete.count}`);

      // Lees het JSON-bestand
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const jsonPath = path.join(__dirname, '../db/sample-projects.json');

      if (!fs.existsSync(jsonPath)) {
        console.error(`JSON-bestand niet gevonden: ${jsonPath}`);

        // Maak een voorbeeld JSON-bestand aan
        const sampleProjects = [
          {
            id: 1,
            number: 3483,
            name: "Nood website",
            company_id: 1234,
            company_name: "Voorbeeld Bedrijf",
            tags: JSON.stringify([{ id: "78", searchname: "Verkeerde tag" }]),
            status: "active",
            start_date: "2023-01-01",
            deadline: "2023-12-31",
            budget_hours: 100,
            budget_costs: 10000,
            invoice_method: "fixed_price"
          },
          {
            id: 2,
            number: 3484,
            name: "Website redesign",
            company_id: 1235,
            company_name: "Ander Bedrijf",
            tags: JSON.stringify([{ id: "1", searchname: "Vaste Prijs" }]),
            status: "active",
            start_date: "2023-02-01",
            deadline: "2023-11-30",
            budget_hours: 200,
            budget_costs: 20000,
            invoice_method: "fixed_price"
          },
          {
            id: 3,
            number: 3485,
            name: "App development",
            company_id: 1236,
            company_name: "Derde Bedrijf",
            tags: JSON.stringify([{ id: "2", searchname: "Nacalculatie" }]),
            status: "active",
            start_date: "2023-03-01",
            deadline: "2023-10-31",
            budget_hours: 300,
            budget_costs: 30000,
            invoice_method: "hourly_rate"
          }
        ];

        fs.writeFileSync(jsonPath, JSON.stringify(sampleProjects, null, 2));
        console.log(`Voorbeeld JSON-bestand aangemaakt: ${jsonPath}`);
      }

      const projectsJson = fs.readFileSync(jsonPath, 'utf8');
      const projects = JSON.parse(projectsJson);

      console.log(`Aantal projecten in JSON-bestand: ${projects.length}`);

      // Importeer de projecten
      for (const project of projects) {
        // Maak een JSON object voor de company kolom
        const companyObj = {
          id: project.company_id,
          searchname: project.company_name
        };

        await db.run(
          `INSERT INTO projects (
            id, number, name, company, tags, archived,
            startdate, deadline, description
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            project.id,
            project.number,
            project.name,
            JSON.stringify(companyObj),
            project.tags,
            project.status === 'active' ? 0 : 1,
            project.start_date,
            project.deadline,
            `Geïmporteerd project (${project.invoice_method}, budget: ${project.budget_hours} uur, €${project.budget_costs})`
          ]
        );
      }

      // Controleer hoeveel projecten er zijn na het importeren
      const countAfterImport = await db.get('SELECT COUNT(*) as count FROM projects');
      console.log(`Aantal projecten na het importeren: ${countAfterImport.count}`);

      // Commit de transactie
      console.log('Commit transactie...');
      await db.run('COMMIT');

      // Controleer hoeveel projecten er zijn na de commit
      const countAfterCommit = await db.get('SELECT COUNT(*) as count FROM projects');
      console.log(`Aantal projecten na de commit: ${countAfterCommit.count}`);

      console.log('Alle projecten zijn succesvol geïmporteerd.');
    } catch (error) {
      // Rollback de transactie bij een fout
      console.error('Fout bij importeren van projecten, rollback transactie...');
      await db.run('ROLLBACK');
      throw error;
    } finally {
      // Sluit de database verbinding
      await db.close();
    }
  } catch (error) {
    console.error('Fout bij importeren van projecten:', error);
    process.exit(1);
  }
}

// Voer de functie uit
importProjectsFromJson();
