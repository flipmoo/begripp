/**
 * Unit of Work Interface
 *
 * This interface defines the Unit of Work pattern, which is responsible for
 * managing transactions and repositories.
 */

import { Database } from 'sqlite';
import type { IProjectRepository } from './repositories/project-repository';
import type { IEmployeeRepository } from './repositories/employee-repository';
import type { IHourRepository } from './repositories/hour-repository';
import type { ISyncStatusRepository } from './repositories/sync-status-repository';
import type { IInvoiceRepository } from './invoice';
import type { IInvoiceLineRepository } from './invoice-line-repository';
import type { IContractRepository } from './repositories/contract-repository';
import type { IAbsenceRequestRepository, IAbsenceRequestLineRepository } from './repositories';

/**
 * Unit of Work interface
 */
export interface IUnitOfWork {
  /**
   * Project repository
   */
  projectRepository: IProjectRepository;

  /**
   * Employee repository
   */
  employeeRepository: IEmployeeRepository;

  /**
   * Hour repository
   */
  hourRepository: IHourRepository;

  /**
   * Sync status repository
   */
  syncStatusRepository: ISyncStatusRepository;

  /**
   * Invoice repository
   */
  invoiceRepository: IInvoiceRepository;

  /**
   * Invoice line repository
   */
  invoiceLineRepository: IInvoiceLineRepository;

  /**
   * Contract repository
   */
  contractRepository: IContractRepository;

  /**
   * Absence request repository
   */
  absenceRequestRepository: IAbsenceRequestRepository;

  /**
   * Absence request line repository
   */
  absenceRequestLineRepository: IAbsenceRequestLineRepository;

  /**
   * Begin a transaction
   *
   * @returns A promise that resolves when the transaction has started
   */
  beginTransaction(): Promise<void>;

  /**
   * Commit a transaction
   *
   * @returns A promise that resolves when the transaction has been committed
   */
  commitTransaction(): Promise<void>;

  /**
   * Rollback a transaction
   *
   * @returns A promise that resolves when the transaction has been rolled back
   */
  rollbackTransaction(): Promise<void>;

  /**
   * Execute a function within a transaction
   *
   * @param fn The function to execute
   * @returns A promise that resolves to the result of the function
   */
  withTransaction<T>(fn: () => Promise<T>): Promise<T>;

  /**
   * Complete all operations and release resources
   *
   * @returns A promise that resolves when all operations are complete
   */
  complete(): Promise<void>;

  /**
   * Get the database instance
   *
   * @returns The database instance
   */
  getDatabase(): Database;
}
