/**
 * Project Corrections Service
 * 
 * Deze service biedt functies voor het ophalen en toepassen van project correcties.
 * Project correcties worden gebruikt om projectgegevens te corrigeren die niet correct zijn in Gripp.
 */

import { getDatabase } from '../../db/database';

/**
 * Interface voor project correcties
 */
export interface ProjectCorrection {
  id: number;
  project_id: number;
  project_name: string;
  client_name: string;
  project_type: string;
  budget: number;
  previous_year_budget_used: number;
  created_at: string;
  updated_at: string;
}

/**
 * Haalt alle project correcties op uit de database
 */
export async function getAllProjectCorrections(): Promise<ProjectCorrection[]> {
  try {
    const db = await getDatabase();
    
    // Controleer of de tabel bestaat
    const tableExists = await db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='project_corrections'`
    );
    
    if (!tableExists) {
      console.warn('project_corrections table does not exist');
      return [];
    }
    
    // Haal alle correcties op
    const corrections = await db.all('SELECT * FROM project_corrections');
    return corrections;
  } catch (error) {
    console.error('Error getting project corrections:', error);
    return [];
  }
}

/**
 * Haalt een specifieke project correctie op uit de database
 */
export async function getProjectCorrection(projectId: number): Promise<ProjectCorrection | null> {
  try {
    const db = await getDatabase();
    
    // Controleer of de tabel bestaat
    const tableExists = await db.get(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='project_corrections'`
    );
    
    if (!tableExists) {
      console.warn('project_corrections table does not exist');
      return null;
    }
    
    // Haal de correctie op
    const correction = await db.get(
      'SELECT * FROM project_corrections WHERE project_id = ?',
      [projectId]
    );
    
    return correction || null;
  } catch (error) {
    console.error(`Error getting project correction for project ${projectId}:`, error);
    return null;
  }
}

/**
 * Corrigeert projectgegevens op basis van de opgeslagen correcties
 */
export async function applyProjectCorrection(project: any): Promise<any> {
  if (!project || !project.id) {
    return project;
  }
  
  try {
    // Haal de correctie op
    const correction = await getProjectCorrection(project.id);
    
    if (!correction) {
      return project;
    }
    
    // Maak een kopie van het project
    const correctedProject = { ...project };
    
    // Pas de correcties toe
    if (correction.project_type) {
      correctedProject.projectType = correction.project_type;
    }
    
    if (correction.client_name) {
      // Als het project een company object heeft, update dat
      if (correctedProject.company) {
        correctedProject.company.searchname = correction.client_name;
      } else {
        // Anders maak een nieuw company object
        correctedProject.company = { searchname: correction.client_name };
      }
      
      // Update ook de clientName als die bestaat
      if ('clientName' in correctedProject) {
        correctedProject.clientName = correction.client_name;
      }
    }
    
    if (correction.budget !== null && correction.budget !== undefined) {
      correctedProject.projectBudget = correction.budget;
      
      // Update ook totalexclvat als die bestaat
      if ('totalexclvat' in correctedProject) {
        correctedProject.totalexclvat = correction.budget;
      }
    }
    
    if (correction.previous_year_budget_used !== null && correction.previous_year_budget_used !== undefined) {
      correctedProject.previousYearBudgetUsed = correction.previous_year_budget_used;
    }
    
    console.log(`Applied correction for project ${project.id} (${project.name || 'Unknown'})`);
    return correctedProject;
  } catch (error) {
    console.error(`Error applying project correction for project ${project.id}:`, error);
    return project;
  }
}

/**
 * Haalt alle project correcties op en zet ze om in een map voor snelle lookup
 */
export async function getProjectCorrectionsMap(): Promise<Map<number, ProjectCorrection>> {
  const corrections = await getAllProjectCorrections();
  const correctionsMap = new Map<number, ProjectCorrection>();
  
  corrections.forEach(correction => {
    correctionsMap.set(correction.project_id, correction);
  });
  
  return correctionsMap;
}
