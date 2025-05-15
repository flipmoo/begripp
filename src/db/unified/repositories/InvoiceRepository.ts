import { Database } from 'sqlite';
import { BaseRepository } from './BaseRepository';

/**
 * Invoice Repository
 *
 * This repository provides methods for working with invoices.
 */
export class InvoiceRepository extends BaseRepository {
  constructor(db: Database | null) {
    super(db, 'invoices');
  }

  /**
   * Get the database connection
   *
   * @returns The database connection or null
   */
  getDatabase(): Database | null {
    return this.db;
  }

  /**
   * Find all invoices
   *
   * @param query Query parameters
   * @returns Promise with the invoices
   */
  async findAll(query: any = {}): Promise<any[]> {
    try {
      if (!this.db) {
        console.log('Using mock data for invoices');
        return this.getMockInvoices();
      }

      // Build query
      let sql = 'SELECT * FROM invoices';
      const params: any[] = [];
      const conditions: string[] = [];

      // Add status filter
      if (query.status) {
        conditions.push('status = ?');
        params.push(query.status);
      }

      // Add company filter
      if (query.company) {
        conditions.push('company = ?');
        params.push(query.company);
      }

      // Add date range filter
      if (query.startDate) {
        conditions.push('date >= ?');
        params.push(query.startDate);
      }

      if (query.endDate) {
        conditions.push('date <= ?');
        params.push(query.endDate);
      }

      // Add conditions to query
      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      // Add order by
      sql += ' ORDER BY date DESC';

      // Add limit
      if (query.limit) {
        sql += ' LIMIT ?';
        params.push(Number(query.limit));
      }

      // Execute query
      console.log('SQL:', sql, 'Params:', params);
      const invoices = await this.db.all(sql, ...params);

      // Return invoices
      return invoices;
    } catch (error) {
      console.error('Error in InvoiceRepository.findAll:', error);
      throw error;
    }
  }

  /**
   * Find invoice by ID
   *
   * @param id Invoice ID
   * @returns Promise with the invoice
   */
  async findById(id: string | number): Promise<any> {
    try {
      if (!this.db) {
        console.error('No database connection available');
        throw new Error('Database connection not available');
      }

      // Execute optimized query with limited columns for better performance
      console.log(`Finding invoice with ID ${id} using optimized query...`);

      // First try with a more efficient query that selects only necessary columns
      const invoice = await this.db.get(
        `SELECT id, number, date, dueDate, due_date, company, company_id, company_name,
        companyName, totalExclVat, totalInclVat, amount, taxAmount, tax_amount,
        totalAmount, status, isPaid, isOverdue, totalOpenInclVat, subject
        FROM invoices WHERE id = ?`,
        id.toString()
      );

      if (invoice) {
        console.log(`Found invoice with ID ${id}: ${invoice.number}`);
      } else {
        console.log(`No invoice found with ID ${id}`);
      }

      // Return invoice
      return invoice;
    } catch (error) {
      console.error('Error in InvoiceRepository.findById:', error);
      throw error;
    }
  }

  /**
   * Create invoice
   *
   * @param data Invoice data
   * @returns Promise with the created invoice
   */
  async create(data: any): Promise<any> {
    try {
      if (!this.db) {
        console.log('Using mock data for invoice creation');
        return {
          id: Math.floor(Math.random() * 1000) + 1,
          ...data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      // Build query
      const columns = Object.keys(data).join(', ');
      const placeholders = Object.keys(data).map(() => '?').join(', ');
      const values = Object.values(data);

      // Execute query
      const result = await this.db.run(
        `INSERT INTO invoices (${columns}) VALUES (${placeholders})`,
        ...values
      );

      // Return created invoice
      return {
        id: result.lastID,
        ...data
      };
    } catch (error) {
      console.error('Error in InvoiceRepository.create:', error);
      throw error;
    }
  }

  /**
   * Update invoice
   *
   * @param id Invoice ID
   * @param data Invoice data
   * @returns Promise with the updated invoice
   */
  async update(id: string, data: any): Promise<any> {
    try {
      if (!this.db) {
        console.log('Using mock data for invoice update');
        return {
          id: Number(id),
          ...data,
          updatedAt: new Date().toISOString()
        };
      }

      // Build query
      const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(data), id];

      // Execute query
      await this.db.run(
        `UPDATE invoices SET ${setClause} WHERE id = ?`,
        ...values
      );

      // Return updated invoice
      return {
        id: Number(id),
        ...data
      };
    } catch (error) {
      console.error('Error in InvoiceRepository.update:', error);
      throw error;
    }
  }

  /**
   * Delete invoice
   *
   * @param id Invoice ID
   * @returns Promise with the result
   */
  async delete(id: string): Promise<boolean> {
    try {
      if (!this.db) {
        console.log('Using mock data for invoice deletion');
        return true;
      }

      // Execute query
      const result = await this.db.run('DELETE FROM invoices WHERE id = ?', id);

      // Return result
      return result.changes > 0;
    } catch (error) {
      console.error('Error in InvoiceRepository.delete:', error);
      throw error;
    }
  }

  /**
   * Get invoice lines
   *
   * @param id Invoice ID
   * @returns Promise with the invoice lines
   */
  async getInvoiceLines(id: string): Promise<any[]> {
    try {
      if (!this.db) {
        console.log('Using mock data for invoice lines');
        return this.getMockInvoiceLines(id);
      }

      console.log(`Getting invoice lines for invoice ${id}...`);

      // Execute query
      const lines = await this.db.all('SELECT * FROM invoice_lines WHERE invoice_id = ?', id);

      console.log(`Found ${lines.length} invoice lines for invoice ${id}`);

      // Return invoice lines
      return lines;
    } catch (error) {
      console.error('Error in InvoiceRepository.getInvoiceLines:', error);
      throw error;
    }
  }

  /**
   * Find invoice lines
   *
   * @param id Invoice ID
   * @returns Promise with the invoice lines
   */
  async findInvoiceLines(id: number): Promise<any[]> {
    console.log(`Finding invoice lines for invoice ${id}...`);
    try {
      const lines = await this.getInvoiceLines(id.toString());
      return lines;
    } catch (error) {
      console.error(`Error finding invoice lines for invoice ${id}:`, error);
      return [];
    }
  }

  /**
   * Create invoice line
   *
   * @param data Invoice line data
   * @returns Promise with the created invoice line
   */
  async createInvoiceLine(data: any): Promise<any> {
    try {
      if (!this.db) {
        console.log('Using mock data for invoice line creation');
        return {
          id: Math.floor(Math.random() * 1000) + 1,
          ...data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }

      // Build query
      const columns = Object.keys(data).join(', ');
      const placeholders = Object.keys(data).map(() => '?').join(', ');
      const values = Object.values(data);

      // Execute query
      const result = await this.db.run(
        `INSERT INTO invoice_lines (${columns}) VALUES (${placeholders})`,
        ...values
      );

      // Return created invoice line
      return {
        id: result.lastID,
        ...data
      };
    } catch (error) {
      console.error('Error in InvoiceRepository.createInvoiceLine:', error);
      throw error;
    }
  }

  /**
   * Delete invoice line
   *
   * @param id Invoice line ID
   * @returns Promise with the result
   */
  async deleteInvoiceLine(id: number): Promise<boolean> {
    try {
      if (!this.db) {
        console.log('Using mock data for invoice line deletion');
        return true;
      }

      // Execute query
      const result = await this.db.run('DELETE FROM invoice_lines WHERE id = ?', id);

      // Return result
      return result.changes > 0;
    } catch (error) {
      console.error('Error in InvoiceRepository.deleteInvoiceLine:', error);
      throw error;
    }
  }

  /**
   * Find invoices by company ID
   *
   * @param companyId Company ID
   * @returns Promise with the invoices
   */
  async findByCompanyId(companyId: string): Promise<any[]> {
    try {
      if (!this.db) {
        console.log('Using mock data for invoices by company');
        const mockInvoices = this.getMockInvoices();
        return mockInvoices.filter(invoice => invoice.company === Number(companyId));
      }

      // Execute query
      const invoices = await this.db.all('SELECT * FROM invoices WHERE company = ? ORDER BY date DESC', companyId);

      // Return invoices
      return invoices;
    } catch (error) {
      console.error('Error in InvoiceRepository.findByCompanyId:', error);
      throw error;
    }
  }

  /**
   * Get mock invoices
   *
   * @returns Empty array to avoid dummy data
   */
  private getMockInvoices(): any[] {
    console.log('Warning: Using empty mock invoices array instead of real data');
    return [];
  }

  /**
   * Get mock invoice lines
   *
   * @param invoiceId Invoice ID
   * @returns Empty array to avoid dummy data
   */
  private getMockInvoiceLines(invoiceId: string): any[] {
    console.log('Warning: Using empty mock invoice lines array instead of real data');
    return [];
  }
}
