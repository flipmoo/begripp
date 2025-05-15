import { GrippClient } from '../api/gripp/client';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testProjectPagination() {
  try {
    console.log('Testing project pagination...');
    
    const client = new GrippClient();
    
    console.log('Calling getProjects with pagination...');
    const projects = await client.getProjects();
    
    console.log(`Total projects retrieved: ${projects.length}`);
    
    // Toon de eerste 5 projecten
    console.log('\nFirst 5 projects:');
    for (let i = 0; i < Math.min(5, projects.length); i++) {
      console.log(`ID: ${projects[i].id}, Name: ${projects[i].name}, Archived: ${projects[i].archived}`);
    }
    
    // Toon de laatste 5 projecten
    console.log('\nLast 5 projects:');
    for (let i = Math.max(0, projects.length - 5); i < projects.length; i++) {
      console.log(`ID: ${projects[i].id}, Name: ${projects[i].name}, Archived: ${projects[i].archived}`);
    }
    
    // Tel hoeveel gearchiveerde projecten er zijn
    const archivedProjects = projects.filter(p => p.archived);
    console.log(`\nArchived projects: ${archivedProjects.length}`);
    
    // Toon de eerste 5 gearchiveerde projecten
    console.log('\nFirst 5 archived projects:');
    for (let i = 0; i < Math.min(5, archivedProjects.length); i++) {
      console.log(`ID: ${archivedProjects[i].id}, Name: ${archivedProjects[i].name}`);
    }
    
    // Controleer of er projecten zijn met ID's in de 4000-reeks
    const projectsIn4000Range = projects.filter(p => p.id >= 4000 && p.id < 5000);
    console.log(`\nProjects with IDs in 4000-4999 range: ${projectsIn4000Range.length}`);
    
    // Toon de eerste 10 projecten in de 4000-reeks
    console.log('\nFirst 10 projects in 4000-4999 range:');
    for (let i = 0; i < Math.min(10, projectsIn4000Range.length); i++) {
      console.log(`ID: ${projectsIn4000Range[i].id}, Name: ${projectsIn4000Range[i].name}, Archived: ${projectsIn4000Range[i].archived}`);
    }
    
  } catch (error) {
    console.error('Error testing project pagination:', error);
  }
}

// Run the test
testProjectPagination();
