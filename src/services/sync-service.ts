/**
 * Sync Service
 * 
 * Deze service centraliseert alle synchronisatie logica tussen de API en de database.
 * Het biedt verbeterde foutafhandeling, transactiebeheer en logging.
 */
import { Database } from 'sqlite';
import { getDatabase, updateSyncStatus } from '../db/database';
import { employeeService } from '../api/gripp/services/employee';
import { contractService } from '../api/gripp/services/contract';
import { hourService } from '../api/gripp/services/hour';
import { projectService } from '../api/gripp/services/project';
import { absenceService } from '../api/gripp/services/absence';

// Configuratie voor synchronisatie
const SYNC_CONFIG = {
  // Aantal items per pagina bij het ophalen van data
  PAGE_SIZE: 250,
  
  // Aantal items per batch bij het opslaan in de database
  BATCH_SIZE: 100,
  
  // Maximum aantal parallelle verzoeken
  MAX_CONCURRENT_REQUESTS: 5,
  
  // Timeout voor synchronisatie in milliseconden (10 minuten)
  SYNC_TIMEOUT: 10 * 60 * 1000,
  
  // Vertraging tussen API verzoeken in milliseconden
  API_REQUEST_DELAY: 100
};

// Helper functie om een vertraging in te bouwen
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper functie om items in batches te verwerken
async function processBatch<T>(
  items: T[],
  batchSize: number,
  processFn: (batch: T[]) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await processFn(batch);
  }
}

// Helper functie om items parallel te verwerken met een limiet
async function processParallel<T, R>(
  items: T[],
  processFn: (item: T) => Promise<R>,
  maxConcurrent: number = SYNC_CONFIG.MAX_CONCURRENT_REQUESTS
): Promise<R[]> {
  const results: R[] = [];
  
  // Verwerk items in groepen van maxConcurrent
  for (let i = 0; i < items.length; i += maxConcurrent) {
    const batch = items.slice(i, i + maxConcurrent);
    const batchPromises = batch.map(processFn);
    
    // Wacht tot alle beloftes in deze batch zijn afgehandeld
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Voeg een kleine vertraging toe om de API niet te overbelasten
    if (i + maxConcurrent < items.length) {
      await delay(SYNC_CONFIG.API_REQUEST_DELAY);
    }
  }
  
  return results;
}

// Klasse voor synchronisatie service
class SyncService {
  /**
   * Synchroniseer medewerkers
   */
  async syncEmployees(): Promise<boolean> {
    const db = await getDatabase();
    let transactionStarted = false;
    
    try {
      console.log('Starting employee synchronization');
      
      // Begin transactie
      await db.run('BEGIN TRANSACTION');
      transactionStarted = true;
      
      // Haal alle medewerkers op met paginering
      const employees = await this.fetchAllEmployees();
      console.log(`Retrieved ${employees.length} employees from API`);
      
      if (employees.length === 0) {
        console.warn('No employees retrieved from API, rolling back transaction');
        await db.run('ROLLBACK');
        transactionStarted = false;
        return false;
      }
      
      // Verwijder bestaande medewerkers
      await db.run('DELETE FROM employees');
      console.log('Deleted existing employees from database');
      
      // Sla medewerkers op in batches
      let savedCount = 0;
      await processBatch(employees, SYNC_CONFIG.BATCH_SIZE, async (batch) => {
        const stmt = await db.prepare(`
          INSERT INTO employees (
            id, firstname, lastname, email, active, function, department_id, department_name
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const employee of batch) {
          try {
            await stmt.run([
              employee.id,
              employee.firstname,
              employee.lastname,
              employee.email,
              employee.active ? 1 : 0,
              employee.function?.searchname || '',
              employee.department?.id || null,
              employee.department?.zoeknaam || ''
            ]);
            savedCount++;
          } catch (error) {
            console.error(`Error saving employee ${employee.id}:`, error);
          }
        }
        
        await stmt.finalize();
      });
      
      console.log(`Saved ${savedCount}/${employees.length} employees to database`);
      
      // Commit transactie
      await db.run('COMMIT');
      transactionStarted = false;
      
      // Update sync status
      await updateSyncStatus('employee.get', 'success');
      
      return true;
    } catch (error) {
      console.error('Error syncing employees:', error);
      
      // Rollback bij fout
      if (transactionStarted) {
        try {
          await db.run('ROLLBACK');
        } catch (rollbackError) {
          console.error('Error during rollback:', rollbackError);
        }
      }
      
      // Update sync status
      if (error instanceof Error) {
        await updateSyncStatus('employee.get', 'error', error.message);
      } else {
        await updateSyncStatus('employee.get', 'error', 'Unknown error occurred');
      }
      
      return false;
    }
  }
  
  /**
   * Haal alle medewerkers op met paginering
   */
  private async fetchAllEmployees(): Promise<any[]> {
    let allEmployees: any[] = [];
    let currentPage = 0;
    let hasMoreResults = true;
    
    while (hasMoreResults) {
      const firstResult = currentPage * SYNC_CONFIG.PAGE_SIZE;
      
      console.log(`Fetching employees page ${currentPage + 1} (${firstResult} to ${firstResult + SYNC_CONFIG.PAGE_SIZE})`);
      
      try {
        const response = await employeeService.get({
          options: {
            paging: {
              firstresult: firstResult,
              maxresults: SYNC_CONFIG.PAGE_SIZE
            }
          }
        });
        
        if (!response?.result?.rows || response.result.rows.length === 0) {
          console.log('No more employees found or end of results reached');
          hasMoreResults = false;
          break;
        }
        
        allEmployees = [...allEmployees, ...response.result.rows];
        
        // Als we minder resultaten krijgen dan de paginagrootte, zijn we klaar
        if (response.result.rows.length < SYNC_CONFIG.PAGE_SIZE) {
          hasMoreResults = false;
        } else {
          currentPage++;
        }
      } catch (error) {
        console.error(`Error fetching employees page ${currentPage + 1}:`, error);
        throw error;
      }
    }
    
    return allEmployees;
  }
  
  /**
   * Synchroniseer contracten
   */
  async syncContracts(): Promise<boolean> {
    const db = await getDatabase();
    let transactionStarted = false;
    
    try {
      console.log('Starting contract synchronization');
      
      // Begin transactie
      await db.run('BEGIN TRANSACTION');
      transactionStarted = true;
      
      // Haal actieve medewerkers op
      const employees = await db.all('SELECT id FROM employees WHERE active = 1');
      console.log(`Found ${employees.length} active employees to fetch contracts for`);
      
      if (employees.length === 0) {
        console.warn('No active employees found, rolling back transaction');
        await db.run('ROLLBACK');
        transactionStarted = false;
        return false;
      }
      
      // Verwijder bestaande contracten
      await db.run('DELETE FROM contracts');
      console.log('Deleted existing contracts from database');
      
      // Haal contracten op voor elke medewerker (parallel met limiet)
      let allContracts: any[] = [];
      
      await processParallel(employees, async (employee) => {
        try {
          const contracts = await contractService.getByEmployeeId(employee.id);
          
          if (contracts && contracts.result && contracts.result.rows) {
            console.log(`Retrieved ${contracts.result.rows.length} contracts for employee ${employee.id}`);
            allContracts = [...allContracts, ...contracts.result.rows];
          }
        } catch (error) {
          console.error(`Error fetching contracts for employee ${employee.id}:`, error);
        }
      });
      
      console.log(`Retrieved ${allContracts.length} contracts in total`);
      
      // Sla contracten op in batches
      let savedCount = 0;
      
      await processBatch(allContracts, SYNC_CONFIG.BATCH_SIZE, async (batch) => {
        const stmt = await db.prepare(`
          INSERT INTO contracts (
            id, employee_id, startdate, enddate,
            hours_monday_even, hours_tuesday_even, hours_wednesday_even, hours_thursday_even, hours_friday_even,
            hours_monday_odd, hours_tuesday_odd, hours_wednesday_odd, hours_thursday_odd, hours_friday_odd
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const contract of batch) {
          try {
            await stmt.run([
              contract.id,
              contract.employee?.id,
              contract.startdate?.date,
              contract.enddate?.date || null,
              contract.hours_monday_even || 0,
              contract.hours_tuesday_even || 0,
              contract.hours_wednesday_even || 0,
              contract.hours_thursday_even || 0,
              contract.hours_friday_even || 0,
              contract.hours_monday_odd || 0,
              contract.hours_tuesday_odd || 0,
              contract.hours_wednesday_odd || 0,
              contract.hours_thursday_odd || 0,
              contract.hours_friday_odd || 0
            ]);
            savedCount++;
          } catch (error) {
            console.error(`Error saving contract ${contract.id}:`, error);
          }
        }
        
        await stmt.finalize();
      });
      
      console.log(`Saved ${savedCount}/${allContracts.length} contracts to database`);
      
      // Commit transactie
      await db.run('COMMIT');
      transactionStarted = false;
      
      // Update sync status
      await updateSyncStatus('contract.get', 'success');
      
      return true;
    } catch (error) {
      console.error('Error syncing contracts:', error);
      
      // Rollback bij fout
      if (transactionStarted) {
        try {
          await db.run('ROLLBACK');
        } catch (rollbackError) {
          console.error('Error during rollback:', rollbackError);
        }
      }
      
      // Update sync status
      if (error instanceof Error) {
        await updateSyncStatus('contract.get', 'error', error.message);
      } else {
        await updateSyncStatus('contract.get', 'error', 'Unknown error occurred');
      }
      
      return false;
    }
  }
  
  /**
   * Synchroniseer projecten
   */
  async syncProjects(): Promise<boolean> {
    const db = await getDatabase();
    
    try {
      console.log('Starting project synchronization');
      
      // Gebruik de bestaande projectService voor synchronisatie
      await projectService.syncProjects(db);
      
      // Update sync status
      await updateSyncStatus('project.get', 'success');
      
      return true;
    } catch (error) {
      console.error('Error syncing projects:', error);
      
      // Update sync status
      if (error instanceof Error) {
        await updateSyncStatus('project.get', 'error', error.message);
      } else {
        await updateSyncStatus('project.get', 'error', 'Unknown error occurred');
      }
      
      return false;
    }
  }
  
  /**
   * Synchroniseer uren voor een specifieke periode
   */
  async syncHours(startDate: string, endDate: string): Promise<boolean> {
    const db = await getDatabase();
    let transactionStarted = false;
    
    try {
      console.log(`Starting hours synchronization for period ${startDate} to ${endDate}`);
      
      // Haal actieve medewerkers op
      const employees = await db.all('SELECT id FROM employees WHERE active = 1');
      console.log(`Found ${employees.length} active employees to fetch hours for`);
      
      if (employees.length === 0) {
        console.warn('No active employees found');
        return false;
      }
      
      // Begin transactie
      await db.run('BEGIN TRANSACTION');
      transactionStarted = true;
      
      // Verwijder bestaande uren in de periode
      await db.run(
        'DELETE FROM hours WHERE date BETWEEN ? AND ?',
        [startDate, endDate]
      );
      console.log(`Deleted existing hours from ${startDate} to ${endDate}`);
      
      // Haal uren op voor elke medewerker (parallel met limiet)
      let totalHoursSynced = 0;
      
      await processParallel(employees, async (employee) => {
        try {
          // Gebruik de functie met paginering
          const hours = await hourService.getAllHoursByEmployeeAndPeriod(
            employee.id,
            startDate,
            endDate
          );
          
          console.log(`Processing ${hours.length} hours for employee ${employee.id}`);
          
          // Sla uren op in batches
          await processBatch(hours, SYNC_CONFIG.BATCH_SIZE, async (batch) => {
            const stmt = await db.prepare(`
              INSERT OR REPLACE INTO hours (
                id, employee_id, date, amount,
                description, status_id, status_name
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            for (const hour of batch) {
              try {
                await stmt.run([
                  hour.id,
                  hour.employee?.id,
                  hour.date?.date,
                  hour.amount || 0,
                  hour.description || '',
                  hour.status?.id || null,
                  hour.status?.searchname || ''
                ]);
                totalHoursSynced++;
              } catch (error) {
                console.error(`Error saving hour ${hour.id}:`, error);
              }
            }
            
            await stmt.finalize();
          });
        } catch (error) {
          console.error(`Error processing hours for employee ${employee.id}:`, error);
        }
      });
      
      console.log(`Total hours synced: ${totalHoursSynced}`);
      
      // Commit transactie
      await db.run('COMMIT');
      transactionStarted = false;
      
      // Update sync status
      await updateSyncStatus('hour.get', 'success');
      
      return true;
    } catch (error) {
      console.error('Error syncing hours:', error);
      
      // Rollback bij fout
      if (transactionStarted) {
        try {
          await db.run('ROLLBACK');
        } catch (rollbackError) {
          console.error('Error during rollback:', rollbackError);
        }
      }
      
      // Update sync status
      if (error instanceof Error) {
        await updateSyncStatus('hour.get', 'error', error.message);
      } else {
        await updateSyncStatus('hour.get', 'error', 'Unknown error occurred');
      }
      
      return false;
    }
  }
  
  /**
   * Synchroniseer afwezigheidsverzoeken voor een specifieke periode
   */
  async syncAbsenceRequests(startDate: string, endDate: string): Promise<boolean> {
    const db = await getDatabase();
    let transactionStarted = false;
    
    try {
      console.log(`Starting absence request synchronization for period ${startDate} to ${endDate}`);
      
      // Begin transactie
      await db.run('BEGIN TRANSACTION');
      transactionStarted = true;
      
      // Verwijder bestaande afwezigheidsverzoeken in de periode
      await db.run(
        'DELETE FROM absences WHERE startdate <= ? AND enddate >= ?',
        [endDate, startDate]
      );
      console.log(`Deleted existing absence requests from ${startDate} to ${endDate}`);
      
      // Haal afwezigheidsverzoeken op
      const absenceRequests = await absenceService.getByPeriod(startDate, endDate);
      
      if (!absenceRequests || !absenceRequests.result || !absenceRequests.result.rows) {
        console.warn('No absence requests retrieved or invalid response');
        await db.run('ROLLBACK');
        transactionStarted = false;
        return false;
      }
      
      console.log(`Retrieved ${absenceRequests.result.rows.length} absence requests`);
      
      // Sla afwezigheidsverzoeken op in batches
      let savedCount = 0;
      
      await processBatch(absenceRequests.result.rows, SYNC_CONFIG.BATCH_SIZE, async (batch) => {
        const stmt = await db.prepare(`
          INSERT INTO absences (
            id, employee_id, startdate, enddate, hours_per_day,
            type_id, type_name, description, status_id, status_name
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const absence of batch) {
          try {
            await stmt.run([
              absence.id,
              absence.employee?.id,
              absence.startdate?.date,
              absence.enddate?.date,
              absence.hours_per_day || 0,
              absence.type?.id || null,
              absence.type?.searchname || '',
              absence.description || '',
              absence.status?.id || null,
              absence.status?.searchname || ''
            ]);
            savedCount++;
          } catch (error) {
            console.error(`Error saving absence request ${absence.id}:`, error);
          }
        }
        
        await stmt.finalize();
      });
      
      console.log(`Saved ${savedCount}/${absenceRequests.result.rows.length} absence requests to database`);
      
      // Commit transactie
      await db.run('COMMIT');
      transactionStarted = false;
      
      // Update sync status
      await updateSyncStatus('absencerequest.get', 'success');
      
      return true;
    } catch (error) {
      console.error('Error syncing absence requests:', error);
      
      // Rollback bij fout
      if (transactionStarted) {
        try {
          await db.run('ROLLBACK');
        } catch (rollbackError) {
          console.error('Error during rollback:', rollbackError);
        }
      }
      
      // Update sync status
      if (error instanceof Error) {
        await updateSyncStatus('absencerequest.get', 'error', error.message);
      } else {
        await updateSyncStatus('absencerequest.get', 'error', 'Unknown error occurred');
      }
      
      return false;
    }
  }
  
  /**
   * Synchroniseer alle data voor een specifieke periode
   */
  async syncAllData(startDate: string, endDate: string): Promise<{
    success: boolean;
    results: {
      employees: boolean;
      contracts: boolean;
      projects: boolean;
      absences: boolean;
      hours: boolean;
    };
  }> {
    console.log(`Starting full data synchronization for period ${startDate} to ${endDate}`);
    
    const results = {
      employees: false,
      contracts: false,
      projects: false,
      absences: false,
      hours: false
    };
    
    // Synchroniseer medewerkers
    console.log('Syncing employees...');
    try {
      results.employees = await this.syncEmployees();
    } catch (error) {
      console.error('Error syncing employees:', error);
    }
    
    // Synchroniseer contracten
    console.log('Syncing contracts...');
    try {
      results.contracts = await this.syncContracts();
    } catch (error) {
      console.error('Error syncing contracts:', error);
    }
    
    // Synchroniseer projecten
    console.log('Syncing projects...');
    try {
      results.projects = await this.syncProjects();
    } catch (error) {
      console.error('Error syncing projects:', error);
    }
    
    // Synchroniseer afwezigheidsverzoeken
    console.log(`Syncing absence requests for period ${startDate} to ${endDate}...`);
    try {
      results.absences = await this.syncAbsenceRequests(startDate, endDate);
    } catch (error) {
      console.error('Error syncing absence requests:', error);
    }
    
    // Synchroniseer uren
    console.log(`Syncing hours for period ${startDate} to ${endDate}...`);
    try {
      results.hours = await this.syncHours(startDate, endDate);
    } catch (error) {
      console.error('Error syncing hours:', error);
    }
    
    // Bepaal of de synchronisatie succesvol was
    // We beschouwen het als succesvol als ten minste medewerkers en contracten zijn gesynchroniseerd
    const success = results.employees && results.contracts;
    
    console.log('Synchronization completed with results:', results);
    
    return {
      success,
      results
    };
  }
  
  /**
   * Synchroniseer een specifiek project
   */
  async syncProjectById(projectId: number): Promise<boolean> {
    try {
      console.log(`Syncing project ${projectId}`);
      
      // Gebruik de bestaande API functie om een project te synchroniseren
      const { syncProjectById } = await import('../api/dashboard/grippApi');
      const project = await syncProjectById(projectId);
      
      if (!project) {
        console.error(`Failed to sync project ${projectId}`);
        return false;
      }
      
      console.log(`Successfully synced project ${projectId}`);
      return true;
    } catch (error) {
      console.error(`Error syncing project ${projectId}:`, error);
      return false;
    }
  }
}

// Exporteer singleton instance
export const syncService = new SyncService();
export default syncService;
