/**
 * Script om projecten uit Gripp te exporteren naar een JSON-bestand
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Laad environment variables
dotenv.config();

// Gripp API configuratie
const GRIPP_API_URL = process.env.GRIPP_API_URL || 'https://api.gripp.com/public/api3.php';
const GRIPP_API_KEY = process.env.GRIPP_API_KEY;

console.log('Using Gripp API URL:', GRIPP_API_URL);
console.log('Using Gripp API Key:', GRIPP_API_KEY ? GRIPP_API_KEY.substring(0, 10) + '...' : 'Not set');

// Functie om Gripp API aan te roepen
async function callGrippApi(resource, params = {}) {
  try {
    console.log(`Calling Gripp API: ${resource}`);
    console.log('Params:', JSON.stringify(params, null, 2));

    const response = await axios.post(GRIPP_API_URL, {
      api_key: GRIPP_API_KEY,
      call: resource,
      params
    });

    if (response.data && response.data.response) {
      return response.data.response;
    }

    console.error('Invalid response from Gripp API:', response.data);
    return null;
  } catch (error) {
    console.error(`Error calling Gripp API (${resource}):`, error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    return null;
  }
}

// Functie om projecten op te halen uit Gripp
async function getProjectsFromGripp() {
  try {
    console.log('Getting projects from Gripp...');
    
    // Haal projecten op uit Gripp
    const projects = await callGrippApi('project.list', {
      limit: 1000,
      offset: 0,
      sort: { id: 'ASC' }
    });
    
    if (!projects || !Array.isArray(projects)) {
      console.error('No projects found in Gripp or invalid response');
      return [];
    }
    
    console.log(`Found ${projects.length} projects in Gripp`);
    
    // Converteer projecten naar het gewenste formaat
    const formattedProjects = projects.map(project => {
      // Bepaal de company_id en company_name
      let company_id = null;
      let company_name = 'Onbekend';
      
      if (project.company) {
        company_id = project.company.id;
        company_name = project.company.searchname || 'Onbekend';
      }
      
      // Bepaal de tags
      let tags = [];
      if (project.tags && Array.isArray(project.tags)) {
        tags = project.tags.map(tagId => {
          return { id: tagId, searchname: 'Onbekend' };
        });
      }
      
      // Bepaal de status
      let status = 'active';
      if (project.archived === 1 || project.archived === true) {
        status = 'archived';
      }
      
      // Bepaal de invoice_method
      let invoice_method = 'hourly_rate';
      if (project.invoicebasis && project.invoicebasis.searchname) {
        const invoiceBasisName = project.invoicebasis.searchname.toLowerCase();
        if (invoiceBasisName.includes('fixed') || invoiceBasisName.includes('vast')) {
          invoice_method = 'fixed_price';
        }
      }
      
      return {
        id: project.id,
        number: project.number || 0,
        name: project.name || 'Onbekend project',
        company_id,
        company_name,
        tags: JSON.stringify(tags),
        status,
        start_date: project.startdate || null,
        deadline: project.deadline || null,
        budget_hours: project.budgethours || 0,
        budget_costs: project.totalexclvat || 0,
        invoice_method
      };
    });
    
    return formattedProjects;
  } catch (error) {
    console.error('Error getting projects from Gripp:', error);
    return [];
  }
}

// Functie om tags op te halen uit Gripp
async function getTagsFromGripp() {
  try {
    console.log('Getting tags from Gripp...');
    
    // Haal tags op uit Gripp
    const tags = await callGrippApi('tag.list', {
      limit: 1000,
      offset: 0
    });
    
    if (!tags || !Array.isArray(tags)) {
      console.error('No tags found in Gripp or invalid response');
      return new Map();
    }
    
    console.log(`Found ${tags.length} tags in Gripp`);
    
    // Maak een map van tag ID naar tag
    const tagMap = new Map();
    tags.forEach(tag => {
      tagMap.set(tag.id, tag);
    });
    
    return tagMap;
  } catch (error) {
    console.error('Error getting tags from Gripp:', error);
    return new Map();
  }
}

// Functie om projecten te exporteren naar een JSON-bestand
async function exportProjectsToJson() {
  try {
    // Haal projecten op uit Gripp
    const projects = await getProjectsFromGripp();
    
    if (projects.length === 0) {
      console.error('No projects found in Gripp');
      return;
    }
    
    // Haal tags op uit Gripp
    const tagMap = await getTagsFromGripp();
    
    // Update de tags in de projecten
    for (const project of projects) {
      try {
        const tags = JSON.parse(project.tags);
        
        // Update de tags met de juiste searchname
        for (const tag of tags) {
          if (tagMap.has(tag.id)) {
            tag.searchname = tagMap.get(tag.id).searchname;
          }
        }
        
        project.tags = JSON.stringify(tags);
      } catch (error) {
        console.error(`Error updating tags for project ${project.id}:`, error);
      }
    }
    
    // Bepaal het pad naar het JSON-bestand
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const jsonPath = path.join(__dirname, '../db/all-projects.json');
    
    // Schrijf de projecten naar het JSON-bestand
    fs.writeFileSync(jsonPath, JSON.stringify(projects, null, 2));
    
    console.log(`Exported ${projects.length} projects to ${jsonPath}`);
  } catch (error) {
    console.error('Error exporting projects to JSON:', error);
  }
}

// Voer de functie uit
exportProjectsToJson();
