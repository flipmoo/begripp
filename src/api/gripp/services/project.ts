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
    try {
      // Controleer of de projects tabel bestaat
      const tableExists = await this.ensureProjectsTableExists(db);
      if (!tableExists) {
        await this.createProjectsTable(db);
      }

      // Haal projecten op van Gripp
      const projects = await this.client.getProjects();
      
      // Begin een transactie
      await db.run('BEGIN TRANSACTION');

      // Leeg de tabel
      await db.run('DELETE FROM projects');

      // Voeg projecten toe aan de database
      for (const project of projects) {
        await this.saveProject(db, project);
      }

      // Commit de transactie
      await db.run('COMMIT');

      console.log(`Synchronized ${projects.length} projects`);
    } catch (error) {
      // Rollback bij een fout
      await db.run('ROLLBACK');
      console.error('Error synchronizing projects:', error);
      throw error;
    }
  }

  /**
   * Sla een project op in de database
   */
  private async saveProject(db: Database, project: GrippProject): Promise<void> {
    try {
      // Converteer complexe objecten naar JSON strings
      const serializedProject = {
        ...project,
        createdon: JSON.stringify(project.createdon),
        updatedon: project.updatedon ? JSON.stringify(project.updatedon) : null,
        archivedon: project.archivedon ? JSON.stringify(project.archivedon) : null,
        startdate: project.startdate ? JSON.stringify(project.startdate) : null,
        deadline: project.deadline ? JSON.stringify(project.deadline) : null,
        deliverydate: project.deliverydate ? JSON.stringify(project.deliverydate) : null,
        enddate: project.enddate ? JSON.stringify(project.enddate) : null,
        templateset: JSON.stringify(project.templateset),
        validfor: project.validfor ? JSON.stringify(project.validfor) : null,
        accountmanager: project.accountmanager ? JSON.stringify(project.accountmanager) : null,
        phase: JSON.stringify(project.phase),
        company: JSON.stringify(project.company),
        contact: project.contact ? JSON.stringify(project.contact) : null,
        identity: JSON.stringify(project.identity),
        extrapdf1: project.extrapdf1 ? JSON.stringify(project.extrapdf1) : null,
        extrapdf2: project.extrapdf2 ? JSON.stringify(project.extrapdf2) : null,
        umbrellaproject: project.umbrellaproject ? JSON.stringify(project.umbrellaproject) : null,
        tags: JSON.stringify(project.tags),
        employees: JSON.stringify(project.employees),
        employees_starred: JSON.stringify(project.employees_starred),
        files: JSON.stringify(project.files),
        projectlines: JSON.stringify(project.projectlines),
        extendedproperties: project.extendedproperties ? JSON.stringify(project.extendedproperties) : null,
      };

      // Voeg het project toe aan de database
      await db.run(`
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
      `, [
        project.id, project.name, project.number, project.color, serializedProject.archivedon,
        project.clientreference, project.isbasis ? 1 : 0, project.archived ? 1 : 0,
        project.workdeliveraddress, serializedProject.createdon, serializedProject.updatedon,
        project.searchname, serializedProject.extendedproperties,
        project.totalinclvat, project.totalexclvat, serializedProject.startdate,
        serializedProject.deadline, serializedProject.deliverydate, serializedProject.enddate,
        project.addhoursspecification ? 1 : 0, project.description,
        project.filesavailableforclient ? 1 : 0, project.discr,
        serializedProject.templateset, serializedProject.validfor, serializedProject.accountmanager,
        serializedProject.phase, serializedProject.company, serializedProject.contact,
        serializedProject.identity, serializedProject.extrapdf1, serializedProject.extrapdf2,
        serializedProject.umbrellaproject, serializedProject.tags, serializedProject.employees,
        serializedProject.employees_starred, serializedProject.files, serializedProject.projectlines,
        project.viewonlineurl
      ]);
    } catch (error) {
      console.error(`Error saving project ${project.id}:`, error);
      throw error;
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