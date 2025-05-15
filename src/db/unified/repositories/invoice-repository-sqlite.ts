/**
 * Invoice Repository SQLite Implementation
 *
 * This class provides an implementation of the invoice repository using SQLite.
 */

import { Database } from 'sqlite';
import { IInvoiceRepository, Invoice, InvoiceLine } from '../interfaces';
import { SQLiteRepository } from './sqlite-repository';

/**
 * Invoice repository SQLite implementation
 */
export class InvoiceRepository extends SQLiteRepository<Invoice> implements IInvoiceRepository {
  /**
   * The table name
   */
  protected tableName = 'invoices';

  /**
   * Constructor
   *
   * @param db The database connection
   */
  constructor(db?: Database) {
    super(db);
  }

  /**
   * Find invoices by company ID
   *
   * @param companyId The company ID
   * @returns A promise that resolves to an array of invoices
   */
  async findByCompanyId(companyId: number): Promise<Invoice[]> {
    if (!this.db) {
      throw new Error('Database connection not available');
    }

    try {
      const query = `SELECT * FROM ${this.tableName} WHERE company = ?`;
      return await this.db.all<Invoice[]>(query, [companyId]);
    } catch (error) {
      console.error(`Error finding invoices for company ${companyId}:`, error);
      throw error;
    }
  }

  /**
   * Find invoices by status
   *
   * @param status The status
   * @returns A promise that resolves to an array of invoices
   */
  async findByStatus(status: string): Promise<Invoice[]> {
    if (!this.db) {
      throw new Error('Database connection not available');
    }

    try {
      const query = `SELECT * FROM ${this.tableName} WHERE status = ?`;
      return await this.db.all<Invoice[]>(query, [status]);
    } catch (error) {
      console.error(`Error finding invoices with status ${status}:`, error);
      throw error;
    }
  }

  /**
   * Find invoice by Gripp ID
   *
   * @param grippId The Gripp ID
   * @returns A promise that resolves to the invoice or null if not found
   */
  async findByGrippId(grippId: number): Promise<Invoice | null> {
    if (!this.db) {
      throw new Error('Database connection not available');
    }

    try {
      const query = `SELECT * FROM ${this.tableName} WHERE grippId = ?`;
      return await this.db.get<Invoice>(query, [grippId]) || null;
    } catch (error) {
      console.error(`Error finding invoice with Gripp ID ${grippId}:`, error);
      throw error;
    }
  }

  /**
   * Find invoices by date range
   *
   * @param startDate The start date
   * @param endDate The end date
   * @returns A promise that resolves to an array of invoices
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<Invoice[]> {
    if (!this.db) {
      throw new Error('Database connection not available');
    }

    try {
      const query = `
        SELECT * FROM ${this.tableName}
        WHERE date >= ? AND date <= ?
      `;
      return await this.db.all<Invoice[]>(query, [
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      ]);
    } catch (error) {
      console.error(`Error finding invoices between ${startDate} and ${endDate}:`, error);
      throw error;
    }
  }

  /**
   * Find all invoice lines for an invoice
   *
   * @param invoiceId The invoice ID
   * @returns A promise that resolves to an array of invoice lines
   */
  async findInvoiceLines(invoiceId: number): Promise<InvoiceLine[]> {
    if (!this.db) {
      throw new Error('Database connection not available');
    }

    try {
      const query = `SELECT * FROM invoice_lines WHERE invoice = ?`;
      return await this.db.all<InvoiceLine[]>(query, [invoiceId]);
    } catch (error) {
      console.error(`Error finding invoice lines for invoice ${invoiceId}:`, error);
      throw error;
    }
  }

  /**
   * Find an invoice line by ID
   *
   * @param id The invoice line ID
   * @returns A promise that resolves to the invoice line or null if not found
   */
  async findInvoiceLineById(id: number): Promise<InvoiceLine | null> {
    if (!this.db) {
      throw new Error('Database connection not available');
    }

    try {
      const query = `SELECT * FROM invoice_lines WHERE id = ?`;
      return await this.db.get<InvoiceLine>(query, [id]) || null;
    } catch (error) {
      console.error(`Error finding invoice line with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new invoice line
   *
   * @param invoiceLine The invoice line to create
   * @returns A promise that resolves to the created invoice line
   */
  async createInvoiceLine(invoiceLine: InvoiceLine): Promise<InvoiceLine> {
    if (!this.db) {
      throw new Error('Database connection not available');
    }

    try {
      // Extract keys and values, excluding id if it's undefined
      const { id, ...data } = invoiceLine;
      const keys = Object.keys(data);
      const values = Object.values(data);

      // Build the query
      const placeholders = keys.map(() => '?').join(', ');
      const query = `INSERT INTO invoice_lines (${keys.join(', ')}) VALUES (${placeholders})`;

      // Execute the query
      const result = await this.db.run(query, values);

      // Get the inserted ID
      const newId = result.lastID;

      // Return the created invoice line
      return this.findInvoiceLineById(newId as number) as Promise<InvoiceLine>;
    } catch (error) {
      console.error('Error creating invoice line:', error);
      throw error;
    }
  }

  /**
   * Update an invoice line
   *
   * @param invoiceLine The invoice line to update
   * @returns A promise that resolves to the updated invoice line
   */
  async updateInvoiceLine(invoiceLine: InvoiceLine): Promise<InvoiceLine> {
    if (!this.db) {
      throw new Error('Database connection not available');
    }

    if (!invoiceLine.id) {
      throw new Error('Cannot update invoice line without ID');
    }

    try {
      // Extract ID and data
      const { id, ...data } = invoiceLine;

      // Add updated timestamp if not provided
      const updateData = {
        ...data,
        updatedAt: data.updatedAt || new Date().toISOString()
      };

      // Extract keys and values
      const keys = Object.keys(updateData);
      const values = Object.values(updateData);

      // Build the SET clause
      const setClause = keys.map(key => `${key} = ?`).join(', ');

      // Build the query
      const query = `UPDATE invoice_lines SET ${setClause} WHERE id = ?`;

      // Execute the query
      await this.db.run(query, [...values, id]);

      // Return the updated invoice line
      return this.findInvoiceLineById(id) as Promise<InvoiceLine>;
    } catch (error) {
      console.error(`Error updating invoice line with ID ${invoiceLine.id}:`, error);
      throw error;
    }
  }

  /**
   * Delete an invoice line
   *
   * @param id The invoice line ID
   * @returns A promise that resolves to true if the invoice line was deleted
   */
  async deleteInvoiceLine(id: number): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database connection not available');
    }

    try {
      const query = `DELETE FROM invoice_lines WHERE id = ?`;
      const result = await this.db.run(query, [id]);
      return result.changes !== undefined && result.changes > 0;
    } catch (error) {
      console.error(`Error deleting invoice line with ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Update an entity
   *
   * @param id The entity ID
   * @param entity The entity data to update
   * @returns A promise that resolves to the updated entity
   */
  async update(id: number, entity: Partial<Invoice>): Promise<Invoice> {
    return super.update(id, entity);
  }

  /**
   * Update an invoice (legacy method)
   *
   * @param invoice The invoice to update
   * @returns A promise that resolves to the updated invoice
   */
  async updateEntity(invoice: Invoice): Promise<Invoice> {
    if (!invoice.id) {
      throw new Error('Cannot update invoice without ID');
    }

    return super.updateEntity(invoice);
  }
}
