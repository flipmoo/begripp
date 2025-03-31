import { Database } from 'sqlite';
import { GrippClient } from '../client';
import { GrippProject } from '../../../types/gripp';

export class ProjectService {
  private client: GrippClient;

  constructor() {
    this.client = new GrippClient();
  }

  /**
   * Haal alle actieve projecten op uit de database
   */
  async getActiveProjects(db: Database): Promise<GrippProject[]> {
    try {
      // Controleer of de projects tabel bestaat
      const tableExists = await this.ensureProjectsTableExists(db);
      if (!tableExists) {
        console.log('Projects table does not exist, creating and syncing...');
        await this.createProjectsTable(db);
        await this.syncProjects(db);
      }

      const projects = await db.all<GrippProject[]>(`
        SELECT * FROM projects 
        WHERE archived = 0 
        ORDER BY deadline IS NULL, deadline ASC
      `);

      return projects;
    } catch (error) {
      console.error('Error fetching active projects:', error);
      return [];
    }
  }

  /**
   * Haal een project op op basis van ID
   */
  async getProjectById(db: Database, id: number): Promise<GrippProject | null> {
    try {
      // Controleer of de projects tabel bestaat
      const tableExists = await this.ensureProjectsTableExists(db);
      if (!tableExists) {
        console.log('Projects table does not exist, creating and syncing...');
        await this.createProjectsTable(db);
        await this.syncProjects(db);
      }

      const project = await db.get<GrippProject>(`
        SELECT * FROM projects WHERE id = ?
      `, [id]);

      return project || null;
    } catch (error) {
      console.error(`Error fetching project ${id}:`, error);
      return null;
    }
  }

  /**
   * Synchroniseer projecten met Gripp
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
        
        // Log gedetailleerde informatie over de fout
        let errorDetails = 'Unknown error';
        if (grippError instanceof Error) {
          errorDetails = {
            message: grippError.message,
            stack: grippError.stack,
            name: grippError.name,
            // Additional properties for specific error types
            code: (grippError as any).code,
            errno: (grippError as any).errno,
            cause: grippError.cause,
            status: (grippError as any).response?.status,
            statusText: (grippError as any).response?.statusText,
            responseData: (grippError as any).response?.data
          };
          console.error('Gripp API error details:', errorDetails);
        }
        
        throw new Error(`Failed to fetch projects from Gripp API: ${grippError instanceof Error ? grippError.message : String(grippError)}`);
      }
      
      if (!projects || projects.length === 0) {
        console.warn('No projects retrieved from Gripp API');
        return;
      }
      
      // Begin een transactie - markeer dat we een transactie hebben gestart
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
      
      for (const project of projects) {
        try {
          // Valideer project
          if (!this.validateProject(project)) {
            console.warn(`Skipping invalid project (id: ${project.id || 'unknown'})`);
            errorCount++;
            continue;
          }
          
          await this.saveProject(db, project);
          savedCount++;
          
          if (savedCount % 10 === 0) {
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

      // Commit de transactie alleen als we minimaal één project hebben opgeslagen
      if (savedCount > 0) {
        console.log('Committing transaction');
        await db.run('COMMIT');
        transactionStarted = false;
        
        console.log(`Successfully synchronized ${savedCount}/${projects.length} projects (${errorCount} errors)`);
        
        if (errors.length > 0) {
          console.error('Errors during project synchronization:', errors);
        }
      } else {
        // Geen projecten opgeslagen, rollback de transactie
        console.warn('No projects were saved, rolling back transaction');
        await db.run('ROLLBACK');
        transactionStarted = false;
        throw new Error(`Failed to save any projects. ${errorCount} errors occurred.`);
      }
    } catch (error) {
      console.error('Error in syncProjects:', error);
      
      // Gedetailleerde logging van fout
      if (error instanceof Error) {
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          // Include additional properties for specific error types
          code: (error as any).code,
          errno: (error as any).errno,
          cause: error.cause
        });
      }
      
      // Rollback bij een fout indien nodig
      if (transactionStarted && db) {
        try {
          console.log('Rolling back transaction due to error');
          await db.run('ROLLBACK');
          console.log('Transaction rolled back successfully');
        } catch (rollbackError) {
          console.error('Error during rollback:', rollbackError);
          // We voegen deze fout niet toe aan de originele fout omdat we de originele fout willen behouden
        }
      }
      
      throw error;
    }
  }

  /**
   * Valideer een project
   */
  private validateProject(project: GrippProject): boolean {
    // Minimale validatie - controleer of het project een ID heeft en of name niet null is
    if (!project.id) {
      console.warn('Project missing required ID');
      return false;
    }
    
    // Controleer of verplichte velden aanwezig zijn
    if (project.name === null || project.name === undefined) {
      console.warn(`Project ${project.id} missing required name field`);
      // We zetten name op een lege string in saveProject, dus dit is niet fataal
    }
    
    // Controleer of complexe objecten correct geformatteerd zijn
    // Dit helpt voorkomen dat er null-waarden worden geserialiseerd
    const objectFields = ['company', 'contact', 'accountmanager', 'phase'];
    for (const field of objectFields) {
      if (project[field] !== null && project[field] !== undefined) {
        if (typeof project[field] !== 'object') {
          console.warn(`Project ${project.id} has non-object value for ${field}`);
          // Dit is niet fataal, maar kan wel problemen veroorzaken bij serialisatie
        }
      }
    }
    
    return true;
  }

  /**
   * Sla een project op in de database
   */
  private async saveProject(db: Database, project: GrippProject): Promise<void> {
    try {
      // Check if project has required ID
      if (!project.id) {
        console.warn('Skipping project without ID');
        return;
      }
      
      // Converteer complexe objecten naar JSON strings, alleen als ze bestaan
      const serializedProject = {
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

      // Voeg het project toe aan de database met prepared statements voor betere veiligheid en performance
      try {
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
      
        await stmt.finalize();
      } catch (sqlError) {
        // Log details about the SQL error
        console.error(`SQL Error saving project ${project.id}:`, sqlError);
        
        // Handle specific SQLite errors
        if (sqlError instanceof Error) {
          const errMsg = sqlError.message;
          const errCode = (sqlError as any).code;
          const errErrno = (sqlError as any).errno;
          
          console.error('SQL Error details:', {
            message: errMsg,
            code: errCode,
            errno: errErrno,
            stack: sqlError.stack
          });
          
          // Better error categorization
          if (errMsg.includes('SQLITE_CONSTRAINT') || errCode === 'SQLITE_CONSTRAINT') {
            throw new Error(`Constraint violation saving project ${project.id}. Possible duplicate key or invalid reference.`);
          } else if (errMsg.includes('SQLITE_IOERR') || errCode === 'SQLITE_IOERR') {
            throw new Error(`I/O error saving project ${project.id}. Check if database file is accessible and not corrupted.`);
          } else if (errMsg.includes('SQLITE_FULL') || errCode === 'SQLITE_FULL') {
            throw new Error(`Database or disk is full when saving project ${project.id}.`);
          } else if (errMsg.includes('SQLITE_CORRUPT') || errCode === 'SQLITE_CORRUPT') {
            throw new Error(`Database may be corrupted when saving project ${project.id}.`);
          } else if (errMsg.includes('SQLITE_READONLY') || errCode === 'SQLITE_READONLY') {
            throw new Error(`Database is in read-only mode when saving project ${project.id}. Check permissions.`);
          } else {
            throw new Error(`SQL error saving project ${project.id}: ${errMsg}`);
          }
        } else {
          throw new Error(`Unknown SQL error saving project ${project.id}`);
        }
      }
    } catch (error) {
      console.error(`Error saving project ${project.id}:`, error);
      // Rethrow with clean message
      throw new Error(`Failed to save project ${project.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Controleer of de projects tabel bestaat
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
}

export const projectService = new ProjectService(); 