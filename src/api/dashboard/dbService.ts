import type { GrippProject } from '../../types/gripp';
import { transformGrippProject } from './grippApi';
import { getDatabase } from '../../db/database';
import { Database } from 'sqlite';

/**
 * Dashboard Database Service
 *
 * Deze service biedt toegang tot de centrale SQLite database voor dashboard-gerelateerde data.
 * Dit vervangt de oude IndexedDB implementatie voor een uniforme datastructuur.
 */
export class DashboardDatabaseService {
  private db: Database | null = null;

  /**
   * Initialiseer de database connectie
   */
  async init(): Promise<void> {
    try {
      if (!this.db) {
        this.db = await getDatabase();
        console.log('SQLite database connection initialized for dashboard service');
      }
    } catch (error) {
      console.error('Error initializing SQLite database connection:', error);
      throw error;
    }
  }

  /**
   * Haal alle projecten op uit de database
   */
  async getAllProjects(): Promise<GrippProject[]> {
    console.log('dbService.getAllProjects called - Using SQLite database');
    try {
      await this.init();

      // Haal alle actieve projecten op uit de SQLite database
      const rawProjects = await this.db!.all(`
        SELECT * FROM projects
        WHERE archived = 0
        ORDER BY deadline ASC
      `);

      console.log('dbService.getAllProjects retrieved', rawProjects.length, 'raw projects from SQLite');

      // Transformeer de projecten om ervoor te zorgen dat alle velden correct zijn geparsed
      const projects = rawProjects.map(project => transformGrippProject(project));
      console.log('dbService.getAllProjects transformed', projects.length, 'projects from SQLite');

      // Log het eerste project om te controleren of de data correct is
      if (projects.length > 0) {
        console.log('First project from SQLite:', projects[0].id, projects[0].name);
      }

      return projects;
    } catch (error) {
      console.error('Error getting projects from SQLite database:', error);
      return [];
    }
  }

  /**
   * Slaat de projecten op in de database
   *
   * Deze methode is nu een wrapper rond de SQLite database operaties
   */
  async saveProjects(projects: GrippProject[]): Promise<void> {
    try {
      await this.init();

      // Begin een transactie
      await this.db!.run('BEGIN TRANSACTION');

      // Bewaar elk project in de database
      for (const project of projects) {
        await this.saveProject(project);
      }

      // Commit de transactie
      await this.db!.run('COMMIT');

      console.log('dbService.saveProjects saved', projects.length, 'projects to SQLite database');
    } catch (error) {
      // Rollback bij een fout
      if (this.db) {
        await this.db.run('ROLLBACK');
      }
      console.error('Error saving projects to SQLite database:', error);
      throw error;
    }
  }

  /**
   * Verwijdert alle projecten uit de database
   */
  async clearProjects(): Promise<void> {
    console.log('dbService.clearProjects called');
    try {
      await this.init();

      // Verwijder alle projecten uit de database
      await this.db!.run('DELETE FROM projects');

      console.log('Successfully cleared all projects from SQLite database');
    } catch (error) {
      console.error('Error clearing projects from SQLite database:', error);
      throw error;
    }
  }

  /**
   * Sla een enkel project op in de database
   */
  async saveProject(project: GrippProject): Promise<void> {
    console.log('dbService.saveProject called for project', project.id);
    try {
      await this.init();

      // Controleer of het project al bestaat
      const existingProject = await this.db!.get('SELECT id FROM projects WHERE id = ?', project.id);

      if (existingProject) {
        // Update het bestaande project
        await this.db!.run(`
          UPDATE projects
          SET
            name = ?,
            number = ?,
            company_id = ?,
            company_name = ?,
            deadline = ?,
            archived = ?,
            status_id = ?,
            status_name = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        project.name,
        project.number,
        project.company_id,
        project.company_name,
        project.deadline,
        project.archived ? 1 : 0,
        project.status_id,
        project.status_name,
        project.id
        );
      } else {
        // Voeg een nieuw project toe
        await this.db!.run(`
          INSERT INTO projects (
            id, name, number, company_id, company_name,
            deadline, archived, status_id, status_name,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        project.id,
        project.name,
        project.number,
        project.company_id,
        project.company_name,
        project.deadline,
        project.archived ? 1 : 0,
        project.status_id,
        project.status_name
        );
      }

      console.log('Project saved to SQLite database successfully', project.id);

      // Update de sync status
      await this.updateLastModified();
    } catch (error) {
      console.error('Error saving project to SQLite database:', error);
      throw error;
    }
  }

  /**
   * Update de laatste wijzigingstijd
   */
  private async updateLastModified(): Promise<void> {
    try {
      await this.init();

      // Update de sync status tabel
      await this.db!.run(`
        INSERT OR REPLACE INTO sync_status (endpoint, last_sync, status)
        VALUES ('projects', CURRENT_TIMESTAMP, 'success')
      `);
    } catch (error) {
      console.error('Error updating last modified timestamp:', error);
      throw error;
    }
  }

  /**
   * Haal de laatste wijzigingstijd op
   */
  async getLastModified(): Promise<string | null> {
    try {
      await this.init();

      // Haal de laatste sync tijd op uit de sync status tabel
      const result = await this.db!.get(`
        SELECT last_sync FROM sync_status
        WHERE endpoint = 'projects'
      `);

      return result ? result.last_sync : null;
    } catch (error) {
      console.error('Error getting last modified timestamp:', error);
      return null;
    }
  }

  /**
   * Sla een item op in de cache
   *
   * Deze methode is nu een wrapper rond de SQLite database operaties
   */
  async setItem<T>(key: string, value: T & { timestamp: number }): Promise<void> {
    try {
      await this.init();

      // Sla het item op in de cache tabel
      await this.db!.run(`
        INSERT OR REPLACE INTO cache (key, value, timestamp)
        VALUES (?, ?, ?)
      `, key, JSON.stringify(value), value.timestamp);
    } catch (error) {
      console.error('Error setting cache item:', error);
      throw error;
    }
  }

  /**
   * Haal een item op uit de cache
   *
   * Deze methode is nu een wrapper rond de SQLite database operaties
   */
  async getItem<T>(key: string): Promise<T | null> {
    try {
      await this.init();

      // Haal het item op uit de cache tabel
      const result = await this.db!.get(`
        SELECT value FROM cache
        WHERE key = ?
      `, key);

      if (result && result.value) {
        return JSON.parse(result.value) as T;
      }

      return null;
    } catch (error) {
      console.error('Error getting cache item:', error);
      return null;
    }
  }

  /**
   * Leeg de cache
   *
   * Deze methode is nu een wrapper rond de SQLite database operaties
   */
  async clearCache(): Promise<void> {
    try {
      await this.init();

      // Verwijder alle items uit de cache tabel
      await this.db!.run('DELETE FROM cache');
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  }

  /**
   * Leeg de database
   *
   * Deze methode is nu een wrapper rond de SQLite database operaties
   */
  async clearDatabase(): Promise<void> {
    try {
      await this.init();

      // Begin een transactie
      await this.db!.run('BEGIN TRANSACTION');

      // Verwijder alle projecten en cache items
      await this.db!.run('DELETE FROM projects');
      await this.db!.run('DELETE FROM cache');

      // Commit de transactie
      await this.db!.run('COMMIT');
    } catch (error) {
      // Rollback bij een fout
      if (this.db) {
        await this.db.run('ROLLBACK');
      }
      console.error('Error clearing database:', error);
      throw error;
    }
  }
}

export const dbService = new DashboardDatabaseService();