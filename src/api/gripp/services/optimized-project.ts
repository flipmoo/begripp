/**
 * Optimized Project Service
 * 
 * Een geoptimaliseerde versie van de project service met betere performance.
 */
import { Database } from 'sqlite';
import { GrippClient } from '../client';
import { GrippProject } from '../../../types/gripp';
import { dbOptimizer } from '../../../lib/db-optimizer';
import { enhancedCache, CacheLevel } from '../../../lib/enhanced-cache';

// Cache keys
const CACHE_KEYS = {
  ALL_PROJECTS: 'projects:all',
  ACTIVE_PROJECTS: 'projects:active',
  PROJECT_BY_ID: (id: number) => `projects:id:${id}`,
  PROJECTS_BY_COMPANY: (companyId: number) => `projects:company:${companyId}`,
  PROJECTS_BY_PHASE: (phaseId: number) => `projects:phase:${phaseId}`,
};

// TTL values in seconds
const CACHE_TTL = {
  PROJECTS: 3600, // 1 hour
  ACTIVE_PROJECTS: 1800, // 30 minutes
  PROJECT_DETAILS: 3600, // 1 hour
};

/**
 * Optimized Project Service
 */
export class OptimizedProjectService {
  private client: GrippClient;
  private indexesCreated: boolean = false;

  /**
   * Constructor
   */
  constructor() {
    this.client = new GrippClient();
  }

  /**
   * Initialiseer de service
   * @param db Database connectie
   */
  async initialize(db: Database): Promise<void> {
    // Initialiseer de database optimizer
    dbOptimizer.initialize(db);
    
    // Controleer of de projects tabel bestaat
    const tableExists = await this.ensureProjectsTableExists(db);
    if (!tableExists) {
      console.log('Projects table does not exist, creating and syncing...');
      await this.createProjectsTable(db);
      await this.syncProjects(db);
    }
    
    // Maak indexen aan als ze nog niet bestaan
    if (!this.indexesCreated) {
      await this.createIndexes(db);
      this.indexesCreated = true;
    }
  }

  /**
   * Haal alle actieve projecten op
   * @param db Database connectie
   * @returns Array van actieve projecten
   */
  async getActiveProjects(db: Database): Promise<GrippProject[]> {
    try {
      // Probeer eerst uit de cache te halen
      const cachedProjects = enhancedCache.get<GrippProject[]>(CACHE_KEYS.ACTIVE_PROJECTS);
      if (cachedProjects) {
        return cachedProjects;
      }
      
      // Controleer of de projects tabel bestaat
      const tableExists = await this.ensureProjectsTableExists(db);
      if (!tableExists) {
        console.log('Projects table does not exist, creating and syncing...');
        await this.createProjectsTable(db);
        await this.syncProjects(db);
      }

      // Gebruik de database optimizer voor de query
      const projects = await dbOptimizer.query<GrippProject>(`
        SELECT * FROM projects 
        WHERE archived = 0 
        AND name NOT LIKE '#0%' 
        AND name NOT LIKE '#1%'
        AND number != 0
        AND number != 1
        ORDER BY deadline IS NULL, deadline ASC
      `);

      console.log(`Retrieved ${projects.length} active projects (excluding template projects)`);
      
      // Sla op in de cache
      enhancedCache.set(CACHE_KEYS.ACTIVE_PROJECTS, projects, CACHE_TTL.ACTIVE_PROJECTS, CacheLevel.MEMORY);
      
      return projects;
    } catch (error) {
      console.error('Error fetching active projects:', error);
      return [];
    }
  }

  /**
   * Haal een project op op basis van ID
   * @param db Database connectie
   * @param id Project ID
   * @returns Het project of null
   */
  async getProjectById(db: Database, id: number): Promise<GrippProject | null> {
    try {
      // Probeer eerst uit de cache te halen
      const cacheKey = CACHE_KEYS.PROJECT_BY_ID(id);
      const cachedProject = enhancedCache.get<GrippProject>(cacheKey);
      if (cachedProject) {
        return cachedProject;
      }
      
      // Controleer of de projects tabel bestaat
      const tableExists = await this.ensureProjectsTableExists(db);
      if (!tableExists) {
        console.log('Projects table does not exist, creating and syncing...');
        await this.createProjectsTable(db);
        await this.syncProjects(db);
      }

      // Gebruik de database optimizer voor de query
      const project = await dbOptimizer.queryOne<GrippProject>(`
        SELECT * FROM projects WHERE id = ?
      `, [id]);

      // Sla op in de cache als het project bestaat
      if (project) {
        enhancedCache.set(cacheKey, project, CACHE_TTL.PROJECT_DETAILS, CacheLevel.MEMORY);
      }
      
      return project || null;
    } catch (error) {
      console.error(`Error fetching project ${id}:`, error);
      return null;
    }
  }

  /**
   * Haal projecten op op basis van bedrijf ID
   * @param db Database connectie
   * @param companyId Bedrijf ID
   * @returns Array van projecten
   */
  async getProjectsByCompany(db: Database, companyId: number): Promise<GrippProject[]> {
    try {
      // Probeer eerst uit de cache te halen
      const cacheKey = CACHE_KEYS.PROJECTS_BY_COMPANY(companyId);
      const cachedProjects = enhancedCache.get<GrippProject[]>(cacheKey);
      if (cachedProjects) {
        return cachedProjects;
      }
      
      // Controleer of de projects tabel bestaat
      const tableExists = await this.ensureProjectsTableExists(db);
      if (!tableExists) {
        console.log('Projects table does not exist, creating and syncing...');
        await this.createProjectsTable(db);
        await this.syncProjects(db);
      }

      // Gebruik de database optimizer voor de query
      const projects = await dbOptimizer.query<GrippProject>(`
        SELECT * FROM projects 
        WHERE json_extract(company, '$.id') = ?
        ORDER BY deadline IS NULL, deadline ASC
      `, [companyId]);

      console.log(`Retrieved ${projects.length} projects for company ${companyId}`);
      
      // Sla op in de cache
      enhancedCache.set(cacheKey, projects, CACHE_TTL.PROJECTS, CacheLevel.MEMORY);
      
      return projects;
    } catch (error) {
      console.error(`Error fetching projects for company ${companyId}:`, error);
      return [];
    }
  }

  /**
   * Haal projecten op op basis van fase ID
   * @param db Database connectie
   * @param phaseId Fase ID
   * @returns Array van projecten
   */
  async getProjectsByPhase(db: Database, phaseId: number): Promise<GrippProject[]> {
    try {
      // Probeer eerst uit de cache te halen
      const cacheKey = CACHE_KEYS.PROJECTS_BY_PHASE(phaseId);
      const cachedProjects = enhancedCache.get<GrippProject[]>(cacheKey);
      if (cachedProjects) {
        return cachedProjects;
      }
      
      // Controleer of de projects tabel bestaat
      const tableExists = await this.ensureProjectsTableExists(db);
      if (!tableExists) {
        console.log('Projects table does not exist, creating and syncing...');
        await this.createProjectsTable(db);
        await this.syncProjects(db);
      }

      // Gebruik de database optimizer voor de query
      const projects = await dbOptimizer.query<GrippProject>(`
        SELECT * FROM projects 
        WHERE json_extract(phase, '$.id') = ?
        ORDER BY deadline IS NULL, deadline ASC
      `, [phaseId]);

      console.log(`Retrieved ${projects.length} projects for phase ${phaseId}`);
      
      // Sla op in de cache
      enhancedCache.set(cacheKey, projects, CACHE_TTL.PROJECTS, CacheLevel.MEMORY);
      
      return projects;
    } catch (error) {
      console.error(`Error fetching projects for phase ${phaseId}:`, error);
      return [];
    }
  }

  /**
   * Synchroniseer projecten met Gripp
   * @param db Database connectie
   */
  async syncProjects(db: Database): Promise<void> {
    let transactionStarted = false;
    
    try {
      console.log('Starting project synchronization');
      
      // Controleer of de database verbinding geldig is
      if (!db) {
        throw new Error('Database connection is not valid');
      }
      
      // Test de database verbinding met een eenvoudige query
      try {
        await db.get('SELECT 1');
        console.log('Database connection is valid');
      } catch (dbTestError) {
        console.error('Database connection test failed:', dbTestError);
        throw new Error(`Database connection test failed: ${dbTestError instanceof Error ? dbTestError.message : String(dbTestError)}`);
      }
      
      // Controleer of de projects tabel bestaat
      const tableExists = await this.ensureProjectsTableExists(db);
      console.log('Projects table exists:', tableExists);
      
      if (!tableExists) {
        console.log('Creating projects table...');
        await this.createProjectsTable(db);
        console.log('Projects table created successfully');
      }

      // Haal projecten op van Gripp
      console.log('Fetching projects from Gripp API...');
      let projects;
      try {
        projects = await this.client.getProjects();
        console.log(`Retrieved ${projects.length} projects from Gripp API`);
      } catch (grippError) {
        console.error('Error fetching projects from Gripp API:', grippError);
        throw new Error(`Failed to fetch projects from Gripp API: ${grippError instanceof Error ? grippError.message : String(grippError)}`);
      }
      
      if (!projects || projects.length === 0) {
        console.warn('No projects retrieved from Gripp API');
        return;
      }
      
      // Begin een transactie
      console.log('Starting database transaction');
      await db.run('BEGIN TRANSACTION');
      transactionStarted = true;

      try {
        // Leeg de tabel
        console.log('Clearing existing projects from database');
        await db.run('DELETE FROM projects');
        console.log('Projects table cleared successfully');
      } catch (clearError) {
        console.error('Error clearing projects table:', clearError);
        throw new Error(`Failed to clear projects table: ${clearError instanceof Error ? clearError.message : String(clearError)}`);
      }

      // Voeg projecten toe aan de database
      console.log(`Saving ${projects.length} projects to database`);
      let savedCount = 0;
      let errorCount = 0;
      const errors = [];
      
      // Gebruik prepared statement voor betere performance
      const stmt = await db.prepare(`
        INSERT INTO projects (
          id, name, number, color, archivedon, clientreference, isbasis, archived,
          workdeliveraddress, createdon, updatedon, searchname, extendedproperties,
          totalinclvat, totalexclvat, startdate, deadline, deliverydate, enddate,
          addhoursspecification, description, filesavailableforclient, discr,
          templateset, validfor, accountmanager, phase, company, contact, identity,
          extrapdf1, extrapdf2, umbrellaproject, tags, employees, employees_starred,
          files, projectlines, viewonlineurl
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?
        )
      `);
      
      for (const project of projects) {
        try {
          // Valideer project
          if (!this.validateProject(project)) {
            console.warn(`Skipping invalid project (id: ${project.id || 'unknown'})`);
            errorCount++;
            continue;
          }
          
          // Converteer complexe objecten naar JSON strings
          const serializedProject = this.serializeProject(project);
          
          // Voeg het project toe aan de database
          await stmt.run(
            project.id, 
            project.name || '', 
            project.number || 0, 
            project.color, 
            serializedProject.archivedon,
            project.clientreference || '', 
            project.isbasis ? 1 : 0, 
            project.archived ? 1 : 0,
            project.workdeliveraddress || '',
            serializedProject.createdon, 
            serializedProject.updatedon,
            project.searchname || '',
            serializedProject.extendedproperties,
            project.totalinclvat || '0', 
            project.totalexclvat || '0', 
            serializedProject.startdate,
            serializedProject.deadline, 
            serializedProject.deliverydate, 
            serializedProject.enddate,
            project.addhoursspecification ? 1 : 0, 
            project.description || '',
            project.filesavailableforclient ? 1 : 0, 
            project.discr || '',
            serializedProject.templateset, 
            serializedProject.validfor, 
            serializedProject.accountmanager,
            serializedProject.phase, 
            serializedProject.company, 
            serializedProject.contact,
            serializedProject.identity, 
            serializedProject.extrapdf1, 
            serializedProject.extrapdf2,
            serializedProject.umbrellaproject, 
            serializedProject.tags, 
            serializedProject.employees,
            serializedProject.employees_starred, 
            serializedProject.files, 
            serializedProject.projectlines,
            project.viewonlineurl || ''
          );
          
          savedCount++;
          
          if (savedCount % 100 === 0) {
            console.log(`Saved ${savedCount}/${projects.length} projects`);
          }
        } catch (saveError) {
          const errorMsg = `Error saving project ${project.id || 'unknown'}: ${saveError instanceof Error ? saveError.message : String(saveError)}`;
          console.error(errorMsg);
          errors.push({
            projectId: project.id,
            error: saveError instanceof Error ? saveError.message : String(saveError)
          });
          errorCount++;
          // Continue with next project instead of failing the entire process
        }
      }
      
      // Finaliseer de prepared statement
      await stmt.finalize();

      // Commit de transactie alleen als we minimaal één project hebben opgeslagen
      if (savedCount > 0) {
        console.log('Committing transaction');
        await db.run('COMMIT');
        transactionStarted = false;
        
        console.log(`Successfully synchronized ${savedCount}/${projects.length} projects (${errorCount} errors)`);
        
        if (errors.length > 0) {
          console.error('Errors during project synchronization:', errors);
        }
        
        // Maak indexen aan als ze nog niet bestaan
        if (!this.indexesCreated) {
          await this.createIndexes(db);
          this.indexesCreated = true;
        }
        
        // Leeg de cache
        this.clearCache();
      } else {
        // Geen projecten opgeslagen, rollback de transactie
        console.warn('No projects were saved, rolling back transaction');
        await db.run('ROLLBACK');
        transactionStarted = false;
        throw new Error(`Failed to save any projects. ${errorCount} errors occurred.`);
      }
    } catch (error) {
      console.error('Error in syncProjects:', error);
      
      // Rollback bij een fout indien nodig
      if (transactionStarted && db) {
        try {
          console.log('Rolling back transaction due to error');
          await db.run('ROLLBACK');
          console.log('Transaction rolled back successfully');
        } catch (rollbackError) {
          console.error('Error during rollback:', rollbackError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Leeg de project cache
   */
  clearCache(): void {
    console.log('Clearing project cache');
    enhancedCache.deleteByPrefix('projects:');
  }

  /**
   * Valideer een project
   * @param project Het project om te valideren
   * @returns True als het project geldig is
   */
  private validateProject(project: GrippProject): boolean {
    // Minimale validatie - controleer of het project een ID heeft
    if (!project.id) {
      console.warn('Project missing required ID');
      return false;
    }
    
    return true;
  }

  /**
   * Serialiseer een project voor opslag in de database
   * @param project Het project om te serialiseren
   * @returns Het geserialiseerde project
   */
  private serializeProject(project: GrippProject): Record<string, any> {
    return {
      ...project,
      createdon: project.createdon ? JSON.stringify(project.createdon) : null,
      updatedon: project.updatedon ? JSON.stringify(project.updatedon) : null,
      archivedon: project.archivedon ? JSON.stringify(project.archivedon) : null,
      startdate: project.startdate ? JSON.stringify(project.startdate) : null,
      deadline: project.deadline ? JSON.stringify(project.deadline) : null,
      deliverydate: project.deliverydate ? JSON.stringify(project.deliverydate) : null,
      enddate: project.enddate ? JSON.stringify(project.enddate) : null,
      templateset: project.templateset ? JSON.stringify(project.templateset) : null,
      validfor: project.validfor ? JSON.stringify(project.validfor) : null,
      accountmanager: project.accountmanager ? JSON.stringify(project.accountmanager) : null,
      phase: project.phase ? JSON.stringify(project.phase) : null,
      company: project.company ? JSON.stringify(project.company) : null,
      contact: project.contact ? JSON.stringify(project.contact) : null,
      identity: project.identity ? JSON.stringify(project.identity) : null,
      extrapdf1: project.extrapdf1 ? JSON.stringify(project.extrapdf1) : null,
      extrapdf2: project.extrapdf2 ? JSON.stringify(project.extrapdf2) : null,
      umbrellaproject: project.umbrellaproject ? JSON.stringify(project.umbrellaproject) : null,
      tags: project.tags ? JSON.stringify(project.tags) : null,
      employees: project.employees ? JSON.stringify(project.employees) : null,
      employees_starred: project.employees_starred ? JSON.stringify(project.employees_starred) : null,
      files: project.files ? JSON.stringify(project.files) : null,
      projectlines: project.projectlines ? JSON.stringify(project.projectlines) : null,
      extendedproperties: project.extendedproperties ? JSON.stringify(project.extendedproperties) : null,
    };
  }

  /**
   * Controleer of de projects tabel bestaat
   * @param db Database connectie
   * @returns True als de tabel bestaat
   */
  private async ensureProjectsTableExists(db: Database): Promise<boolean> {
    try {
      const result = await db.get(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='projects'
      `);
      return !!result;
    } catch (error) {
      console.error('Error checking if projects table exists:', error);
      return false;
    }
  }

  /**
   * Maak de projects tabel aan
   * @param db Database connectie
   */
  private async createProjectsTable(db: Database): Promise<void> {
    try {
      await db.run(`
        CREATE TABLE IF NOT EXISTS projects (
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
          viewonlineurl TEXT
        )
      `);
      console.log('Projects table created');
    } catch (error) {
      console.error('Error creating projects table:', error);
      throw error;
    }
  }

  /**
   * Maak indexen aan voor de projects tabel
   * @param db Database connectie
   */
  private async createIndexes(db: Database): Promise<void> {
    try {
      console.log('Creating indexes for projects table...');
      
      // Index voor archived
      await db.run('CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived)');
      
      // Index voor number
      await db.run('CREATE INDEX IF NOT EXISTS idx_projects_number ON projects(number)');
      
      // Index voor deadline
      await db.run('CREATE INDEX IF NOT EXISTS idx_projects_deadline ON projects(deadline)');
      
      // Index voor name
      await db.run('CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name)');
      
      // Index voor searchname
      await db.run('CREATE INDEX IF NOT EXISTS idx_projects_searchname ON projects(searchname)');
      
      console.log('Indexes created successfully');
    } catch (error) {
      console.error('Error creating indexes:', error);
    }
  }

  /**
   * Analyseer de database en optimaliseer queries
   * @param db Database connectie
   */
  async analyzeAndOptimize(db: Database): Promise<void> {
    try {
      console.log('Analyzing and optimizing database...');
      
      // Gebruik de database optimizer
      await dbOptimizer.analyzeAndOptimize();
      
      console.log('Database analysis and optimization completed');
    } catch (error) {
      console.error('Error analyzing and optimizing database:', error);
    }
  }
}

// Singleton instance
export const optimizedProjectService = new OptimizedProjectService();
