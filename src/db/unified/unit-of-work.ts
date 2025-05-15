/**
 * Unit of Work Implementation
 *
 * This file provides implementations of the Unit of Work pattern, which is responsible for
 * managing transactions and repositories.
 */

import { Database } from 'sqlite';
import type { IUnitOfWork } from './interfaces';
import type {
  IProjectRepository,
  IEmployeeRepository,
  IHourRepository,
  ISyncStatusRepository,
  IInvoiceRepository,
  IInvoiceLineRepository,
  IContractRepository
} from './interfaces';
import {
  ProjectRepository,
  EmployeeRepository,
  HourRepository,
  InvoiceRepository,
  InvoiceLineRepository,
  SyncStatusRepository,
  ContractRepository,
  AbsenceRequestRepository,
  AbsenceRequestLineRepository
} from './repositories';

/**
 * Create a new Unit of Work
 *
 * @param db The database connection
 * @param useMock Whether to use mock repositories
 * @returns A new Unit of Work instance
 */
export async function createUnitOfWork(db?: Database, useMock: boolean = false): Promise<IUnitOfWork> {
  // We don't use mock repositories anymore, always use real database
  if (!db) {
    throw new Error('Database connection is required');
  }

  // Create a new Unit of Work with the provided database
  return new UnitOfWork(db);
}

/**
 * Unit of Work implementation
 */
export class UnitOfWork implements IUnitOfWork {
  /**
   * The database connection
   */
  private db: Database;

  /**
   * Whether a transaction is active
   */
  private isTransactionActive: boolean = false;

  /**
   * Project repository
   */
  private _projectRepository: ProjectRepository;

  /**
   * Employee repository
   */
  private _employeeRepository: EmployeeRepository;

  /**
   * Hour repository
   */
  private _hourRepository: HourRepository;

  /**
   * Invoice repository
   */
  private _invoiceRepository: InvoiceRepository;

  /**
   * Invoice line repository
   */
  private _invoiceLineRepository: InvoiceLineRepository;

  /**
   * Sync status repository
   */
  private _syncStatusRepository: SyncStatusRepository;

  /**
   * Contract repository
   */
  private _contractRepository: ContractRepository;

  /**
   * Absence request repository
   */
  private _absenceRequestRepository: AbsenceRequestRepository;

  /**
   * Absence request line repository
   */
  private _absenceRequestLineRepository: AbsenceRequestLineRepository;

  /**
   * Constructor
   *
   * @param db The database connection
   */
  constructor(db: Database | undefined) {
    if (!db) {
      throw new Error('Database connection is required');
    }
    this.db = db;

    // Initialize repositories
    this._projectRepository = new ProjectRepository(db);
    this._employeeRepository = new EmployeeRepository(db);
    this._hourRepository = new HourRepository(db);
    this._invoiceRepository = new InvoiceRepository(db);
    this._invoiceLineRepository = new InvoiceLineRepository(db);
    this._syncStatusRepository = new SyncStatusRepository(db);
    this._contractRepository = new ContractRepository(db);
    this._absenceRequestRepository = new AbsenceRequestRepository(db);
    this._absenceRequestLineRepository = new AbsenceRequestLineRepository(db);
  }

  /**
   * Project repository
   */
  get projectRepository(): IProjectRepository {
    return this._projectRepository;
  }

  /**
   * Employee repository
   */
  get employeeRepository(): IEmployeeRepository {
    return this._employeeRepository;
  }

  /**
   * Hour repository
   */
  get hourRepository(): IHourRepository {
    return this._hourRepository;
  }

  /**
   * Invoice repository
   */
  get invoiceRepository(): IInvoiceRepository {
    return this._invoiceRepository;
  }

  /**
   * Invoice line repository
   */
  get invoiceLineRepository(): IInvoiceLineRepository {
    return this._invoiceLineRepository;
  }

  /**
   * Sync status repository
   */
  get syncStatusRepository(): ISyncStatusRepository {
    return this._syncStatusRepository;
  }

  /**
   * Contract repository
   */
  get contractRepository(): IContractRepository {
    return this._contractRepository;
  }

  /**
   * Absence request repository
   */
  get absenceRequestRepository(): IAbsenceRequestRepository {
    return this._absenceRequestRepository;
  }

  /**
   * Absence request line repository
   */
  get absenceRequestLineRepository(): IAbsenceRequestLineRepository {
    return this._absenceRequestLineRepository;
  }

  /**
   * Begin a transaction
   *
   * @returns A promise that resolves when the transaction has started
   */
  async beginTransaction(): Promise<void> {
    if (this.isTransactionActive) {
      throw new Error('Transaction already active');
    }

    await this.db.exec('BEGIN TRANSACTION');
    this.isTransactionActive = true;
  }

  /**
   * Commit a transaction
   *
   * @returns A promise that resolves when the transaction has been committed
   */
  async commitTransaction(): Promise<void> {
    if (!this.isTransactionActive) {
      throw new Error('No active transaction to commit');
    }

    await this.db.exec('COMMIT');
    this.isTransactionActive = false;
  }

  /**
   * Rollback a transaction
   *
   * @returns A promise that resolves when the transaction has been rolled back
   */
  async rollbackTransaction(): Promise<void> {
    if (!this.isTransactionActive) {
      throw new Error('No active transaction to rollback');
    }

    await this.db.exec('ROLLBACK');
    this.isTransactionActive = false;
  }

  /**
   * Execute a function within a transaction
   *
   * @param fn The function to execute
   * @returns A promise that resolves to the result of the function
   */
  async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    const wasTransactionActive = this.isTransactionActive;

    if (!wasTransactionActive) {
      await this.beginTransaction();
    }

    try {
      const result = await fn();

      if (!wasTransactionActive) {
        await this.commitTransaction();
      }

      return result;
    } catch (error) {
      if (!wasTransactionActive) {
        await this.rollbackTransaction();
      }

      throw error;
    }
  }

  /**
   * Complete all operations and release resources
   *
   * @returns A promise that resolves when all operations are complete
   */
  async complete(): Promise<void> {
    if (this.isTransactionActive) {
      await this.commitTransaction();
    }
  }

  /**
   * Get the database instance
   *
   * @returns The database instance
   */
  getDatabase(): Database {
    return this.db;
  }
}
