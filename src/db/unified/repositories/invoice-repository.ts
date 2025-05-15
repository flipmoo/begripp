import { Database } from 'better-sqlite3';
import { Invoice } from '../models/invoice';

interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  overdue?: boolean;
  isPaid?: number;
  isOverdue?: number;
  year?: string;
  search?: string;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class InvoiceRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  findAll(options?: PaginationOptions): PaginatedResult<Invoice> {
    console.log('Finding all invoices...');

    // Default options
    const page = options?.page || 1;
    const limit = options?.limit || 100;
    const orderBy = options?.orderBy || 'date';
    const orderDirection = options?.orderDirection || 'desc';
    const offset = (page - 1) * limit;

    // Build query
    let query = 'SELECT * FROM invoices';
    let countQuery = 'SELECT COUNT(*) as total FROM invoices';
    let whereConditions: string[] = [];
    const params: any[] = [];

    // Add filter for overdue invoices (legacy support)
    if (options?.overdue) {
      whereConditions.push('isOverdue = 1');
    }

    // Add filter for isPaid
    if (options?.isPaid !== undefined) {
      whereConditions.push('isPaid = ?');
      params.push(options.isPaid);
      console.log(`Adding isPaid filter: ${options.isPaid}`);
    }

    // Add filter for isOverdue
    if (options?.isOverdue !== undefined) {
      whereConditions.push('isOverdue = ?');
      params.push(options.isOverdue);
      console.log(`Adding isOverdue filter: ${options.isOverdue}`);
    }

    // Add filter for year
    if (options?.year && options.year !== 'all') {
      whereConditions.push("strftime('%Y', date) = ?");
      params.push(options.year);
    }

    // Add filter for search query
    if (options?.search) {
      // Convert search term to lowercase for case-insensitive search
      const searchTerm = `%${options.search.toLowerCase()}%`;
      whereConditions.push('(LOWER(number) LIKE ? OR LOWER(company_name) LIKE ?)');
      params.push(searchTerm, searchTerm);
      console.log(`Adding search filter for term: ${options.search}, searchTerm: ${searchTerm}`);
    }

    // Combine where conditions
    let whereClause = '';
    if (whereConditions.length > 0) {
      whereClause = ' WHERE ' + whereConditions.join(' AND ');
      countQuery += whereClause;
    }

    // Add order by and pagination
    query += `${whereClause} ORDER BY ${orderBy} ${orderDirection} LIMIT ? OFFSET ?`;

    console.log('Query:', query);
    console.log('Count Query:', countQuery);
    console.log('Params:', params);
    console.log('Pagination:', { limit, offset });

    try {
      // Get total count
      const countResult = this.db.prepare(countQuery).get(...params);
      const total = countResult ? (countResult as any).total : 0;
      console.log(`Total invoices: ${total}`);

      // Get paginated data
      console.log('Executing query with params:', [...params, limit, offset]);
      const rows = this.db.prepare(query).all(...params, limit, offset);
      console.log(`Found ${rows.length} invoices (page ${page} of ${Math.ceil(total / limit)}, total: ${total})`);

      if (rows.length > 0) {
        console.log('First invoice:', rows[0]);
      }

      return {
        data: rows as Invoice[],
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Error executing query:', error);

      // Return empty result on error
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0
      };
    }
  }

  findById(id: number): Invoice | null {
    const query = 'SELECT * FROM invoices WHERE id = ?';
    const row = this.db.prepare(query).get(id);
    return row as Invoice || null;
  }

  findByNumber(number: string): Invoice | null {
    const query = 'SELECT * FROM invoices WHERE number = ?';
    const row = this.db.prepare(query).get(number);
    return row as Invoice || null;
  }

  findByExternalId(externalId: string): Invoice | null {
    const query = 'SELECT * FROM invoices WHERE external_id = ?';
    const row = this.db.prepare(query).get(externalId);
    return row as Invoice || null;
  }

  findByGrippId(grippId: number): Invoice | null {
    const query = 'SELECT * FROM invoices WHERE grippId = ?';
    const row = this.db.prepare(query).get(grippId);
    return row as Invoice || null;
  }

  create(invoice: Invoice): number {
    const query = `
      INSERT INTO invoices (
        grippId, number, date, dueDate, due_date, company, company_id, company_name, totalAmount, totalInclVat, totalExclVat, status, subject, isPaid, isOverdue, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = this.db.prepare(query).run(
      invoice.grippId,
      invoice.number,
      invoice.date,
      invoice.dueDate,
      invoice.due_date,
      invoice.company,
      invoice.company_id,
      invoice.company_name || '',
      invoice.totalAmount || 0,
      invoice.totalInclVat || 0,
      invoice.totalExclVat || 0,
      invoice.status,
      invoice.subject || '',
      invoice.isPaid || 0,
      invoice.isOverdue || 0,
      invoice.createdAt,
      invoice.updatedAt
    );

    return result.lastInsertRowid as number;
  }

  update(invoice: Invoice): void {
    const query = `
      UPDATE invoices SET
        grippId = ?,
        number = ?,
        date = ?,
        dueDate = ?,
        due_date = ?,
        company = ?,
        company_id = ?,
        company_name = ?,
        totalAmount = ?,
        totalInclVat = ?,
        totalExclVat = ?,
        status = ?,
        subject = ?,
        isPaid = ?,
        isOverdue = ?,
        updatedAt = ?
      WHERE id = ?
    `;

    this.db.prepare(query).run(
      invoice.grippId,
      invoice.number,
      invoice.date,
      invoice.dueDate,
      invoice.due_date,
      invoice.company,
      invoice.company_id,
      invoice.company_name || '',
      invoice.totalAmount || 0,
      invoice.totalInclVat || 0,
      invoice.totalExclVat || 0,
      invoice.status,
      invoice.subject || '',
      invoice.isPaid || 0,
      invoice.isOverdue || 0,
      invoice.updatedAt,
      invoice.id
    );
  }

  delete(id: number): void {
    const query = 'DELETE FROM invoices WHERE id = ?';
    this.db.prepare(query).run(id);
  }
}
