/**
 * Script om de tag van het project "Nood website" handmatig bij te werken
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Laad environment variables
dotenv.config();

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

async function updateNoodWebsiteTag() {
  try {
    console.log('Bijwerken van tag voor project "Nood website"...');

    // Verbind met de database
    const db = await getDatabase();

    // Controleer of het project bestaat
    const project = await db.get('SELECT id, name, number, tags FROM projects WHERE name = ? OR id = ?', ['Nood website', 5866]);

    if (!project) {
      console.error('Project "Nood website" niet gevonden in de database');
      process.exit(1);
    }

    console.log('Project gevonden:', project);

    // Definieer de tag voor "Verkeerde tag"
    const verkeerdeTags = [{ id: "78", searchname: "Verkeerde tag" }];

    // Update het project met de nieuwe tag
    await db.run(
      'UPDATE projects SET tags = ? WHERE id = ?',
      [JSON.stringify(verkeerdeTags), project.id]
    );

    console.log(`Project ${project.id} (${project.name}) bijgewerkt met tag "Verkeerde tag"`);

    // Controleer of de update succesvol was
    const updatedProject = await db.get('SELECT id, name, number, tags FROM projects WHERE id = ?', [project.id]);
    console.log('Bijgewerkt project:', updatedProject);

  } catch (error) {
    console.error('Fout bij bijwerken van tag voor project "Nood website":', error);
    process.exit(1);
  }
}

// Voer de update uit
updateNoodWebsiteTag();
