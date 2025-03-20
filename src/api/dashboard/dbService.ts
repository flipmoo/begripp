import type { GrippProject } from '../../types/gripp';
import { transformGrippProject } from './grippApi';

const DB_NAME = 'bravoure-dashboard';
const DB_VERSION = 2;
const PROJECTS_STORE = 'projects';
const CACHE_STORE = 'cache';

export class DashboardDatabaseService {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
          const store = db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
          store.createIndex('lastModified', 'lastModified', { unique: false });
        }

        if (!db.objectStoreNames.contains(CACHE_STORE)) {
          const store = db.createObjectStore(CACHE_STORE, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Haal alle projecten op uit de database
   */
  async getAllProjects(): Promise<GrippProject[]> {
    console.log('dbService.getAllProjects called');
    try {
      await this.init();
      const transaction = this.db!.transaction(PROJECTS_STORE, 'readonly');
      const store = transaction.objectStore(PROJECTS_STORE);
      const request = store.getAll();
      
      return new Promise<GrippProject[]>((resolve, reject) => {
        request.onerror = () => {
          console.error('Error getting projects from IndexedDB:', request.error);
          reject(request.error);
        };
        request.onsuccess = () => {
          const rawProjects = request.result;
          console.log('dbService.getAllProjects retrieved', rawProjects.length, 'raw projects');
          
          // Transformeer de projecten om ervoor te zorgen dat alle velden correct zijn geparsed
          const projects = rawProjects.map(project => transformGrippProject(project));
          console.log('dbService.getAllProjects transformed', projects.length, 'projects');
          
          resolve(projects);
        };
      });
    } catch (error) {
      console.error('Error getting projects from IndexedDB:', error);
      return [];
    }
  }

  /**
   * Sla projecten op in de database
   */
  async saveProjects(projects: GrippProject[]): Promise<void> {
    console.log('dbService.saveProjects called with', projects.length, 'projects');
    try {
      await this.init();
      const transaction = this.db!.transaction(PROJECTS_STORE, 'readwrite');
      const store = transaction.objectStore(PROJECTS_STORE);
      
      // Leeg de store eerst
      const clearRequest = store.clear();
      await new Promise<void>((resolve, reject) => {
        clearRequest.onerror = () => reject(clearRequest.error);
        clearRequest.onsuccess = () => {
          console.log('dbService.saveProjects cleared projects store');
          resolve();
        };
      });
      
      // Voeg alle projecten toe
      for (const project of projects) {
        const addRequest = store.add(project);
        await new Promise<void>((resolve, reject) => {
          addRequest.onerror = () => reject(addRequest.error);
          addRequest.onsuccess = () => resolve();
        });
      }
      
      // Update de timestamp voor cache invalidatie
      const timestamp = new Date().toISOString();
      await this.updateLastModified();
      
      console.log('dbService.saveProjects saved', projects.length, 'projects and updated timestamp to', timestamp);
    } catch (error) {
      console.error('Error saving projects to IndexedDB:', error);
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
      const transaction = this.db!.transaction(PROJECTS_STORE, 'readwrite');
      const store = transaction.objectStore(PROJECTS_STORE);
      
      // Voeg het project toe of update indien het al bestaat
      const putRequest = store.put(project);
      
      await new Promise<void>((resolve, reject) => {
        putRequest.onerror = () => {
          console.error('Error saving project to IndexedDB:', putRequest.error);
          reject(putRequest.error);
        };
        putRequest.onsuccess = () => {
          console.log('Project saved to IndexedDB successfully', project.id);
          resolve();
        };
      });
      
      // Update de timestamp voor cache invalidatie
      await this.updateLastModified();
    } catch (error) {
      console.error('Error saving project to IndexedDB:', error);
      throw error;
    }
  }

  /**
   * Update de laatste wijzigingstijd
   */
  private async updateLastModified(): Promise<void> {
    try {
      await this.setItem('lastModified', { timestamp: Date.now() });
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
      const result = await this.getItem<{ timestamp: string }>('lastModified');
      return result ? result.timestamp : null;
    } catch (error) {
      console.error('Error getting last modified timestamp:', error);
      return null;
    }
  }

  async setItem<T>(key: string, value: T & { timestamp: number }): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(CACHE_STORE, 'readwrite');
      const store = transaction.objectStore(CACHE_STORE);
      
      store.put({
        key,
        ...value
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getItem<T>(key: string): Promise<T | null> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(CACHE_STORE, 'readonly');
      const store = transaction.objectStore(CACHE_STORE);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (request.result) {
          // Gebruik een tijdelijke variabele om de key te destructuren
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { key: _, ...rest } = request.result;
          resolve(rest as T);
        } else {
          resolve(null);
        }
      };
    });
  }

  async clearCache(): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(CACHE_STORE, 'readwrite');
      const store = transaction.objectStore(CACHE_STORE);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clearDatabase(): Promise<void> {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PROJECTS_STORE, CACHE_STORE], 'readwrite');
      
      const projectsStore = transaction.objectStore(PROJECTS_STORE);
      const cacheStore = transaction.objectStore(CACHE_STORE);
      
      projectsStore.clear();
      cacheStore.clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export const dbService = new DashboardDatabaseService(); 