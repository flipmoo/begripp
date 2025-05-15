import { GrippClient } from '../api/gripp/client';
import * as dotenv from 'dotenv';
import { exec } from 'child_process';
import { promisify } from 'util';

// Load environment variables
dotenv.config();

// Promisify exec
const execAsync = promisify(exec);

async function simpleProjectSync() {
  try {
    console.log('Starting simple project synchronization...');

    // Create Gripp client
    const client = new GrippClient();

    // Get all projects with pagination
    console.log('Fetching all projects from Gripp API...');
    const allProjects = await client.getProjects();
    console.log(`Retrieved ${allProjects.length} projects from Gripp API`);

    // Count archived projects
    const archivedProjects = allProjects.filter(p => p.archived);
    console.log(`Of which ${archivedProjects.length} are archived projects`);

    // Count projects with IDs in 4000-4999 range
    const projectsIn4000Range = allProjects.filter(p => p.id >= 4000 && p.id < 5000);
    console.log(`Projects with IDs in 4000-4999 range: ${projectsIn4000Range.length}`);

    // Show some projects with IDs in 4000-4999 range
    console.log('First 10 projects in 4000-4999 range:');
    for (let i = 0; i < Math.min(10, projectsIn4000Range.length); i++) {
      console.log(`ID: ${projectsIn4000Range[i].id}, Name: ${projectsIn4000Range[i].name}, Archived: ${projectsIn4000Range[i].archived}`);
    }

    // Count projects in database
    console.log('Counting projects in database...');
    const { stdout: countOutput } = await execAsync('sqlite3 ./src/db/database.sqlite "SELECT COUNT(*) FROM projects;"');
    console.log(`Current projects in database: ${countOutput.trim()}`);

    // Check if specific projects exist in database
    console.log('Checking if specific projects exist in database...');
    const projectIdsToCheck = [4058, 4060, 4063, 4065, 4068, 4071, 4073, 4075, 4078, 4081, 4084];
    for (const id of projectIdsToCheck) {
      try {
        const { stdout } = await execAsync(`sqlite3 ./src/db/database.sqlite "SELECT id, name FROM projects WHERE id = ${id};"`)
        if (stdout.trim()) {
          console.log(`Project ${id} exists in database: ${stdout.trim()}`);
        } else {
          console.log(`Project ${id} does not exist in database`);

          // Find project in allProjects
          const project = allProjects.find(p => p.id === id);
          if (project) {
            console.log(`Project ${id} exists in Gripp API: ${project.name}, Archived: ${project.archived}`);
          } else {
            console.log(`Project ${id} does not exist in Gripp API`);
          }
        }
      } catch (error) {
        console.error(`Error checking project ${id}:`, error);
      }
    }

  } catch (error) {
    console.error('Error in simpleProjectSync:', error);
  }
}

// Run the script
simpleProjectSync();
