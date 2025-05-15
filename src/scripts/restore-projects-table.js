/**
 * Herstel de projecten tabel naar de oorspronkelijke structuur
 * 
 * Dit script herstelt de projecten tabel naar de oorspronkelijke structuur.
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Laad environment variables
dotenv.config();

// Get the directory name using ES modules approach
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pad naar de database
const dbPath = path.join(__dirname, '../db/database.sqlite');

async function restoreProjectsTable() {
  try {
    console.log('Herstellen van de projecten tabel...');
    
    // Open de database
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Begin een transactie
    await db.run('BEGIN TRANSACTION');

    try {
      // Controleer of er een backup tabel bestaat
      const backupExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='projects_backup'");
      
      if (backupExists) {
        console.log('Backup tabel gevonden, herstellen van de projecten tabel...');
        
        // Verwijder de bestaande projecten tabel
        await db.run('DROP TABLE IF EXISTS projects');
        console.log('Bestaande projecten tabel verwijderd');
        
        // Herstel de projecten tabel vanuit de backup
        await db.run('CREATE TABLE projects AS SELECT * FROM projects_backup');
        console.log('Projecten tabel hersteld vanuit backup');
        
        // Commit de transactie
        await db.run('COMMIT');
        console.log('Projecten tabel succesvol hersteld');
      } else {
        console.log('Geen backup tabel gevonden, maken van een nieuwe projecten tabel...');
        
        // Verwijder de bestaande projecten tabel
        await db.run('DROP TABLE IF EXISTS projects');
        console.log('Bestaande projecten tabel verwijderd');
        
        // Maak de projecten tabel opnieuw aan met de oorspronkelijke structuur
        await db.run(`
          CREATE TABLE projects (
            id INTEGER PRIMARY KEY,
            name TEXT,
            number INTEGER,
            color TEXT,
            archivedon TEXT,
            clientreference TEXT,
            isbasis INTEGER,
            archived INTEGER,
            workdeliveraddress TEXT,
            createdon TEXT,
            updatedon TEXT,
            searchname TEXT,
            extendedproperties TEXT,
            totalinclvat TEXT,
            totalexclvat TEXT,
            startdate TEXT,
            deadline TEXT,
            deliverydate TEXT,
            enddate TEXT,
            addhoursspecification INTEGER,
            description TEXT,
            filesavailableforclient INTEGER,
            discr TEXT,
            templateset TEXT,
            validfor TEXT,
            accountmanager TEXT,
            phase TEXT,
            company TEXT,
            contact TEXT,
            identity TEXT,
            extrapdf1 TEXT,
            extrapdf2 TEXT,
            umbrellaproject TEXT,
            tags TEXT,
            employees TEXT,
            employees_starred TEXT,
            files TEXT,
            projectlines TEXT,
            viewonlineurl TEXT,
            custom_type TEXT,
            type TEXT
          )
        `);
        console.log('Nieuwe projecten tabel aangemaakt met de oorspronkelijke structuur');
        
        // Herstel de indexen
        console.log('Herstellen van de indexen...');
        await db.run('CREATE INDEX idx_projects_archived ON projects(archived)');
        await db.run('CREATE INDEX idx_projects_number ON projects(number)');
        await db.run('CREATE INDEX idx_projects_deadline ON projects(deadline)');
        await db.run('CREATE INDEX idx_projects_name ON projects(name)');
        await db.run('CREATE INDEX idx_projects_searchname ON projects(searchname)');
        console.log('Indexen hersteld');
        
        // Commit de transactie
        await db.run('COMMIT');
        console.log('Projecten tabel succesvol hersteld');
      }
      
      // Herstel de project_corrections tabel
      console.log('Herstellen van de project_corrections tabel...');
      
      // Controleer of de project_corrections tabel al bestaat
      const correctionsExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='project_corrections'");
      
      if (!correctionsExists) {
        // Maak de project_corrections tabel aan
        await db.run(`
          CREATE TABLE IF NOT EXISTS project_corrections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            project_name TEXT,
            client_name TEXT,
            project_type TEXT,
            budget REAL,
            previous_year_budget_used REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(project_id)
          )
        `);
        
        // Maak de index aan
        await db.run('CREATE INDEX IF NOT EXISTS idx_project_corrections_project_id ON project_corrections (project_id)');
        
        // Voeg de initiële correcties toe
        await db.run(`
          INSERT OR IGNORE INTO project_corrections (project_id, project_name, client_name, project_type, budget, previous_year_budget_used)
          VALUES
            (5368, 'Internal hours 2024', 'Bravoure', 'Intern', 0, 0),
            (5520, 'Boer & Croon - Bullhorn koppeling', 'Boer & Croon Management Solutions B.V..', 'Vaste Prijs', 13093, 0),
            (5787, 'Dynamics Koppeling - Courses', 'Ebbinge B.V.', 'Vaste Prijs', 13093, 0),
            (5632, 'OLM - Phase 3A', 'Limburgs Museum', 'Vaste Prijs', 154154, 142757)
        `);
        
        console.log('Project_corrections tabel hersteld met initiële correcties');
      } else {
        console.log('Project_corrections tabel bestaat al');
      }
      
      console.log('Alle tabellen zijn succesvol hersteld');
      
    } catch (error) {
      // Rollback de transactie bij een fout
      await db.run('ROLLBACK');
      console.error('Fout bij herstellen van de tabellen:', error);
      
      process.exit(1);
    }
  } catch (error) {
    console.error('Fout bij herstellen van de tabellen:', error);
    process.exit(1);
  }
}

// Voer het script uit
restoreProjectsTable();
