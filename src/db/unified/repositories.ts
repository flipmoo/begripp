/**
 * Repositories Module
 *
 * This module exports all repository classes for the unified data structure.
 */

import { Database } from 'sqlite';

/**
 * Base Repository class
 */
export class BaseRepository {
  protected db: Database;

  constructor(db: Database) {
    this.db = db;
  }
}

/**
 * Employee Repository
 */
export class EmployeeRepository extends BaseRepository {
  async getAll() {
    return this.db.all('SELECT * FROM employees');
  }

  async getById(id: number) {
    return this.db.get('SELECT * FROM employees WHERE id = ?', [id]);
  }

  async getActive() {
    return this.db.all('SELECT * FROM employees WHERE active = 1');
  }
}

/**
 * Project Repository
 */
export class ProjectRepository extends BaseRepository {
  async getAll() {
    return this.db.all('SELECT * FROM projects');
  }

  async getById(id: number) {
    return this.db.get('SELECT * FROM projects WHERE id = ?', [id]);
  }

  async getActive() {
    return this.db.all('SELECT * FROM projects WHERE active = 1');
  }
}

/**
 * Hour Repository
 */
export class HourRepository extends BaseRepository {
  async getAll() {
    return this.db.all('SELECT * FROM hours');
  }

  async getByEmployeeId(employeeId: number) {
    return this.db.all('SELECT * FROM hours WHERE employee_id = ?', [employeeId]);
  }

  async getByProjectId(projectId: number) {
    return this.db.all('SELECT * FROM hours WHERE project_id = ?', [projectId]);
  }
}

/**
 * Invoice Repository
 */
export class InvoiceRepository extends BaseRepository {
  async getAll() {
    return this.db.all('SELECT * FROM invoices');
  }

  async getById(id: number) {
    return this.db.get('SELECT * FROM invoices WHERE id = ?', [id]);
  }

  async getOverdue() {
    const now = new Date().toISOString().split('T')[0];
    return this.db.all(
      'SELECT * FROM invoices WHERE expirydate < ? AND totalopeninclvat != "0.00"',
      [now]
    );
  }
}

/**
 * Invoice Line Repository
 */
export class InvoiceLineRepository extends BaseRepository {
  async getAll() {
    return this.db.all('SELECT * FROM invoice_lines');
  }

  async getById(id: number) {
    return this.db.get('SELECT * FROM invoice_lines WHERE id = ?', [id]);
  }

  async getByInvoiceId(invoiceId: number) {
    return this.db.all('SELECT * FROM invoice_lines WHERE invoice_id = ?', [invoiceId]);
  }
}

/**
 * Contract Repository
 */
export class ContractRepository extends BaseRepository {
  async getAll() {
    return this.db.all('SELECT * FROM contracts');
  }

  async getById(id: number) {
    return this.db.get('SELECT * FROM contracts WHERE id = ?', [id]);
  }

  async getByEmployeeId(employeeId: number) {
    return this.db.all('SELECT * FROM contracts WHERE employee_id = ?', [employeeId]);
  }
}

/**
 * Sync Status Repository
 */
export class SyncStatusRepository extends BaseRepository {
  async getAll() {
    return this.db.all('SELECT * FROM sync_status');
  }

  async getByEndpoint(endpoint: string) {
    return this.db.get('SELECT * FROM sync_status WHERE endpoint = ?', [endpoint]);
  }

  async updateStatus(endpoint: string, status: string, message?: string) {
    const now = new Date().toISOString();

    const existing = await this.getByEndpoint(endpoint);

    if (existing) {
      return this.db.run(
        'UPDATE sync_status SET status = ?, message = ?, updated_at = ? WHERE endpoint = ?',
        [status, message || null, now, endpoint]
      );
    } else {
      return this.db.run(
        'INSERT INTO sync_status (endpoint, status, message, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [endpoint, status, message || null, now, now]
      );
    }
  }
}

/**
 * Hours Repository
 */
export class HoursRepository extends BaseRepository {
  async getAll() {
    return this.db.all('SELECT * FROM hours');
  }

  async getByEmployeeId(employeeId: number) {
    return this.db.all('SELECT * FROM hours WHERE employee_id = ?', [employeeId]);
  }

  async getByProjectId(projectId: number) {
    return this.db.all('SELECT * FROM hours WHERE project_id = ?', [projectId]);
  }
}

/**
 * Absence Repository
 */
export class AbsenceRepository extends BaseRepository {
  async getAll() {
    return this.db.all('SELECT * FROM absence_requests');
  }

  async getById(id: number) {
    return this.db.get('SELECT * FROM absence_requests WHERE id = ?', [id]);
  }

  async getByEmployeeId(employeeId: number) {
    return this.db.all('SELECT * FROM absence_requests WHERE employee_id = ?', [employeeId]);
  }
}

/**
 * Absence Request Repository
 */
export class AbsenceRequestRepository extends BaseRepository {
  async getAll() {
    return this.db.all('SELECT * FROM absence_requests');
  }

  async getById(id: number) {
    return this.db.get('SELECT * FROM absence_requests WHERE id = ?', [id]);
  }

  async getByEmployeeId(employeeId: number) {
    return this.db.all('SELECT * FROM absence_requests WHERE employee_id = ?', [employeeId]);
  }
}

/**
 * Absence Request Line Repository
 */
export class AbsenceRequestLineRepository extends BaseRepository {
  async getAll() {
    return this.db.all('SELECT * FROM absence_request_lines');
  }

  async getById(id: number) {
    return this.db.get('SELECT * FROM absence_request_lines WHERE id = ?', [id]);
  }

  async getByRequestId(requestId: number) {
    return this.db.all('SELECT * FROM absence_request_lines WHERE absencerequest_id = ?', [requestId]);
  }
}

/**
 * Holiday Repository
 */
export class HolidayRepository extends BaseRepository {
  async getAll() {
    return this.db.all('SELECT * FROM holidays');
  }

  async getById(id: number) {
    return this.db.get('SELECT * FROM holidays WHERE id = ?', [id]);
  }

  async getByYear(year: number) {
    return this.db.all('SELECT * FROM holidays WHERE strftime("%Y", date) = ?', [year.toString()]);
  }
}

/**
 * Sync Repository
 */
export class SyncRepository extends BaseRepository {
  async getAll() {
    return this.db.all('SELECT * FROM sync_status');
  }

  async getByEndpoint(endpoint: string) {
    return this.db.get('SELECT * FROM sync_status WHERE endpoint = ?', [endpoint]);
  }

  async updateStatus(endpoint: string, status: string, message?: string) {
    const now = new Date().toISOString();

    const existing = await this.getByEndpoint(endpoint);

    if (existing) {
      return this.db.run(
        'UPDATE sync_status SET status = ?, message = ?, updated_at = ? WHERE endpoint = ?',
        [status, message || null, now, endpoint]
      );
    } else {
      return this.db.run(
        'INSERT INTO sync_status (endpoint, status, message, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [endpoint, status, message || null, now, now]
      );
    }
  }
}
