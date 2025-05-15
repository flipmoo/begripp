/**
 * Invoice Adapter
 *
 * This class provides an adapter for the invoice API.
 */

import { Request, Response } from 'express';
import { IUnitOfWork, Invoice, InvoiceLine } from '../../interfaces';
import { BaseApiAdapter } from './base-adapter';
import { IGrippApiClient } from '../interfaces';

/**
 * Invoice adapter
 */
export class InvoiceAdapter extends BaseApiAdapter {
  /**
   * The entity name
   */
  protected entityName = 'invoice';

  /**
   * The API client
   */
  private apiClient?: IGrippApiClient | null;

  /**
   * Constructor
   *
   * @param unitOfWork The unit of work
   * @param apiClient The Gripp API client
   */
  constructor(unitOfWork: IUnitOfWork, apiClient?: IGrippApiClient | null) {
    super(unitOfWork);
    this.apiClient = apiClient;
  }

  /**
   * Parse query parameters
   *
   * @param query The query parameters
   * @returns The parsed query parameters
   */
  protected parseQuery(query: Record<string, unknown>): Record<string, unknown> {
    const parsedQuery: Record<string, unknown> = {};

    // Parse status
    if (query.status) {
      parsedQuery.status = query.status;
    }

    // Parse isPaid
    if (query.isPaid !== undefined) {
      parsedQuery.isPaid = Number(query.isPaid);
    }

    // Parse isOverdue
    if (query.isOverdue !== undefined) {
      parsedQuery.isOverdue = Number(query.isOverdue);
    }

    // Parse company
    if (query.company) {
      parsedQuery.company = Number(query.company);
    }

    // Parse year
    if (query.year) {
      parsedQuery.year = query.year;
    }

    // Parse search
    if (query.search) {
      parsedQuery.search = query.search;
    }

    // Parse date range
    if (query.startDate) {
      parsedQuery.startDate = query.startDate;
    }

    if (query.endDate) {
      parsedQuery.endDate = query.endDate;
    }

    // Parse pagination
    if (query.page) {
      parsedQuery.page = Number(query.page);
    }

    if (query.limit) {
      parsedQuery.limit = Number(query.limit);
    }

    // Parse sorting
    if (query.sort) {
      parsedQuery.sort = query.sort;
    }

    // Parse overdue flag
    if (query.overdue !== undefined) {
      parsedQuery.overdue = query.overdue === 'true' || query.overdue === true || query.overdue === 1;
    }

    return parsedQuery;
  }

  /**
   * Get all invoices
   *
   * @param query The query parameters
   * @returns A promise that resolves to the response data
   */
  async getAll(query: Record<string, unknown> = {}): Promise<any> {
    try {
      console.log('Finding all invoices...');

      // Parse query parameters
      const parsedQuery = this.parseQuery(query);
      console.log('Parsed query:', parsedQuery);

      // Create cache key
      const cacheKey = `${this.entityName}_all_${this.safeStringify(parsedQuery || {})}`;

      // Always disable cache for invoices to ensure fresh data
      const useCache = false;
      const forceRefresh = true;

      console.log(`Disabled cache for invoices, useCache: ${useCache}, forceRefresh: ${forceRefresh}`);

      // Prepare pagination options
      const page = Number(parsedQuery.page) || 1;
      // Increase default limit to handle more invoices per page
      const limit = Number(parsedQuery.limit) || 100; // Default to 100 invoices per page
      // Set a maximum limit to prevent performance issues
      const maxLimit = 500;
      const effectiveLimit = Math.min(limit, maxLimit);

      // Prepare sorting options
      let orderBy = 'date';
      let orderDirection: 'asc' | 'desc' = 'desc';

      if (parsedQuery.sort) {
        const [field, direction] = (parsedQuery.sort as string).split(':');
        orderBy = field;
        orderDirection = direction === 'asc' ? 'asc' : 'desc';
      }

      // Prepare filter options
      const isOverdue = parsedQuery.overdue === true;
      let isPaid = parsedQuery.isPaid !== undefined ? Number(parsedQuery.isPaid) : undefined;
      let isOverdueFilter = parsedQuery.isOverdue !== undefined ? Number(parsedQuery.isOverdue) : undefined;
      const year = parsedQuery.year as string;
      const search = parsedQuery.search as string;

      // Map status to isPaid and isOverdue if status is provided
      if (parsedQuery.status) {
        console.log(`Mapping status ${parsedQuery.status} to isPaid and isOverdue`);
        switch (parsedQuery.status) {
          case 'paid':
            isPaid = 1;
            break;
          case 'unpaid':
            isPaid = 0;
            isOverdueFilter = 0;
            break;
          case 'overdue':
            isPaid = 0;
            isOverdueFilter = 1;
            break;
          default:
            // No specific filter for 'all'
            break;
        }
      }

      // Get invoices from repository with pagination
      console.log('Fetching invoices from database with pagination...');
      console.log(`Pagination: page=${page}, limit=${limit}, orderBy=${orderBy}, orderDirection=${orderDirection}`);
      console.log(`Filters: overdue=${isOverdue}, isPaid=${isPaid}, isOverdue=${isOverdueFilter}, year=${year}, search=${search}`);

      // Use direct database query to get invoices
      const db = this.unitOfWork.getDatabase();
      console.log('Using direct database query to get invoices');

      // Build WHERE clause for filters
      const whereConditions = [];
      const queryParams: any[] = [];

      // Add isPaid filter
      if (isPaid !== undefined) {
        whereConditions.push('isPaid = ?');
        queryParams.push(isPaid);
      }

      // Add isOverdue filter
      if (isOverdueFilter !== undefined) {
        whereConditions.push('isOverdue = ?');
        queryParams.push(isOverdueFilter);
      }

      // Add year filter
      if (year && year !== 'all') {
        whereConditions.push('date LIKE ?');
        queryParams.push(`${year}%`);
      }

      // Add search filter
      if (search) {
        whereConditions.push('(number LIKE ? OR company_name LIKE ? OR subject LIKE ?)');
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
      }

      // Build WHERE clause
      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
      console.log('WHERE clause:', whereClause);
      console.log('Query params:', queryParams);

      // Count total invoices with filters
      let countQuery = `SELECT COUNT(*) as total FROM invoices ${whereClause}`;
      const countResult = await this.unitOfWork.getDatabase().get(countQuery, ...queryParams);
      const total = countResult ? countResult.total : 0;
      console.log(`Total invoices in database with filters: ${total}`);

      // Get paginated invoices with filters
      const offset = (page - 1) * effectiveLimit;
      const sqlQuery = `SELECT * FROM invoices ${whereClause} ORDER BY ${orderBy} ${orderDirection} LIMIT ${effectiveLimit} OFFSET ${offset}`;
      console.log('SQL Query:', sqlQuery);
      console.log('SQL Params:', queryParams);
      console.log(`Pagination: page=${page}, limit=${effectiveLimit}, offset=${offset}`);

      const rows = await this.unitOfWork.getDatabase().all(sqlQuery, ...queryParams);
      console.log(`Found ${rows.length} invoices using direct query`);

      if (rows.length > 0) {
        console.log('First invoice from direct query:', rows[0]);
      }

      // Map database fields to frontend fields for compatibility
      const mappedInvoices = rows.map(invoice => {
        // Ensure isPaid and isOverdue are correctly set based on status if they are NULL
        let isPaid = invoice.isPaid !== undefined ? invoice.isPaid : 0;
        let isOverdue = invoice.isOverdue !== undefined ? invoice.isOverdue : 0;

        // Check if the invoice is paid based on isPaid field
        if (isPaid === null || isPaid === undefined) {
          isPaid = invoice.status === 'paid' ? 1 : 0;
        }

        // Check if the invoice is overdue
        if (isOverdue === null || isOverdue === undefined) {
          if (!isPaid && invoice.dueDate && new Date(invoice.dueDate) < new Date()) {
            isOverdue = 1;
          } else if (invoice.status === 'overdue') {
            isOverdue = 1;
          } else {
            isOverdue = 0;
          }
        }

        // Create a consistent invoice object with all required fields
        return {
          id: invoice.id,
          grippId: invoice.grippId,
          number: invoice.number,
          date: invoice.date,
          dueDate: invoice.dueDate || invoice.due_date,
          company: invoice.company,
          company_id: invoice.company_id,
          company_name: invoice.company_name,
          totalAmount: invoice.totalAmount || invoice.totalInclVat || 0,
          totalExclVat: invoice.totalExclVat || 0, // Add totalExclVat field
          // Add subject field
          subject: invoice.subject || '',
          // Add formatted date fields
          formattedDate: new Date(invoice.date).toLocaleDateString(),
          formattedDueDate: new Date(invoice.dueDate || invoice.due_date).toLocaleDateString(),
          // Add days overdue if applicable
          daysOverdue: isOverdue ?
            Math.floor((new Date().getTime() - new Date(invoice.dueDate || invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)) : 0,
          // Ensure status fields are set
          status: invoice.status,
          isPaid,
          isOverdue
        };
      });

      // Create response
      const response = {
        success: true,
        data: mappedInvoices,
        meta: {
          timestamp: new Date().toISOString(),
          total: total,
          page: page,
          limit: effectiveLimit,
          pages: Math.ceil(total / effectiveLimit),
          hasNextPage: page < Math.ceil(total / effectiveLimit),
          hasPreviousPage: page > 1
        }
      };

      console.log(`Returning ${mappedInvoices.length} real invoices from database`);
      return response;
    } catch (error) {
      console.error('Error getting invoices:', error);
      throw error;
    }
  }

  /**
   * Get an invoice by ID
   *
   * @param req The request
   * @param res The response
   * @returns A promise that resolves when the response has been sent
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      // Convert ID to number
      const invoiceId = Number(req.params.id);
      console.log(`Getting invoice with ID ${invoiceId}...`);

      // Get invoice from repository
      console.log(`Using repository to get invoice ${invoiceId}...`);
      const invoice = await this.unitOfWork.invoiceRepository.findById(invoiceId);

      if (!invoice) {
        console.log(`Invoice with ID ${invoiceId} not found`);
        return res.status(404).json({
          success: false,
          error: {
            message: `Invoice with ID ${invoiceId} not found`,
            code: 'NOT_FOUND',
            details: { id: invoiceId }
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      console.log(`Found invoice ${invoiceId}: ${invoice.number}`);

      // Create a simplified invoice object
      const mappedInvoice = {
        id: invoice.id,
        number: invoice.number,
        date: invoice.date,
        dueDate: invoice.dueDate || invoice.due_date,
        company: invoice.company,
        company_id: invoice.company_id || invoice.company,
        company_name: invoice.company_name,
        totalAmount: invoice.totalAmount || invoice.totalInclVat || 0,
        totalExclVat: invoice.totalExclVat || 0, // Add totalExclVat field
        status: invoice.status,
        isPaid: invoice.isPaid || 0,
        isOverdue: invoice.isOverdue || 0,
        subject: invoice.subject || ''
      };

      // Create response
      const response = {
        success: true,
        data: mappedInvoice,
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      // Send response
      console.log(`Sending response for invoice ${invoiceId}`);
      res.json(response);
    } catch (error) {
      console.error(`Error getting invoice with ID ${req.params.id}:`, error);
      this.handleError(res, error);
    }
  }

  /**
   * Create a new invoice
   *
   * @param req The request
   * @param res The response
   * @returns A promise that resolves when the response has been sent
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      // Get invoice data and lines
      const invoiceData = req.body as Invoice;
      const invoiceLines = req.body.lines as InvoiceLine[];

      // Validate invoice data
      if (!invoiceData.number || !invoiceData.date || !invoiceData.due_date || !invoiceData.company_id) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Invalid invoice data',
            code: 'INVALID_DATA',
            details: { invoiceData }
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      // Create invoice
      // Map fields to ensure compatibility
      const mappedInvoiceData = {
        ...invoiceData,
        // Map frontend fields to database fields if they exist
        totalAmount: invoiceData.totalAmount !== undefined ? invoiceData.totalAmount : invoiceData.total_amount,
        // Add created_at and updated_at
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const invoice = await this.unitOfWork.invoiceRepository.create(mappedInvoiceData);

      // Create invoice lines
      const lines: InvoiceLine[] = [];

      if (invoiceLines && invoiceLines.length > 0) {
        for (const lineData of invoiceLines) {
          const line = await this.unitOfWork.invoiceRepository.createInvoiceLine({
            ...lineData,
            invoice: invoice.id
          });

          lines.push(line);
        }
      }

      // Clear cache
      await this.clearCache();

      // Create response
      const response = {
        success: true,
        data: {
          ...invoice,
          lines
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      // Send response
      res.status(201).json(response);
    } catch (error) {
      console.error('Error creating invoice:', error);
      this.handleError(res, error);
    }
  }

  /**
   * Update an invoice
   *
   * @param req The request
   * @param res The response
   * @returns A promise that resolves when the response has been sent
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      // Convert ID to number
      const invoiceId = Number(req.params.id);

      // Get invoice data and lines
      const invoiceData = req.body as Invoice;
      const invoiceLines = req.body.lines as InvoiceLine[];

      // Get invoice from repository
      const invoice = await this.unitOfWork.invoiceRepository.findById(invoiceId);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: {
            message: `Invoice with ID ${invoiceId} not found`,
            code: 'NOT_FOUND',
            details: { id: invoiceId }
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      // Update invoice
      // Map fields to ensure compatibility
      const mappedInvoiceData = {
        ...invoiceData,
        // Map frontend fields to database fields if they exist
        totalAmount: invoiceData.totalAmount !== undefined ? invoiceData.totalAmount : invoiceData.total_amount,
        // Update updated_at
        updatedAt: new Date().toISOString()
      };

      const updatedInvoice = await this.unitOfWork.invoiceRepository.update(invoiceId, mappedInvoiceData);

      // Update invoice lines
      const lines: InvoiceLine[] = [];

      if (invoiceLines && invoiceLines.length > 0) {
        // Get existing invoice lines
        const existingLines = await this.unitOfWork.invoiceRepository.findInvoiceLines(invoiceId);

        // Delete existing invoice lines
        for (const line of existingLines) {
          await this.unitOfWork.invoiceRepository.deleteInvoiceLine(line.id);
        }

        // Create new invoice lines
        for (const lineData of invoiceLines) {
          const line = await this.unitOfWork.invoiceRepository.createInvoiceLine({
            ...lineData,
            invoice: invoiceId
          });

          lines.push(line);
        }
      }

      // Clear cache
      await this.clearCache();

      // Create response
      const response = {
        success: true,
        data: {
          ...updatedInvoice,
          lines
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      // Send response
      res.json(response);
    } catch (error) {
      console.error(`Error updating invoice with ID ${req.params.id}:`, error);
      this.handleError(res, error);
    }
  }

  /**
   * Delete an invoice
   *
   * @param req The request
   * @param res The response
   * @returns A promise that resolves when the response has been sent
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      // Convert ID to number
      const invoiceId = Number(req.params.id);

      // Get invoice from repository
      const invoice = await this.unitOfWork.invoiceRepository.findById(invoiceId);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: {
            message: `Invoice with ID ${invoiceId} not found`,
            code: 'NOT_FOUND',
            details: { id: invoiceId }
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      // Delete invoice
      const deleted = await this.unitOfWork.invoiceRepository.delete(invoiceId);

      if (!deleted) {
        return res.status(500).json({
          success: false,
          error: {
            message: `Failed to delete invoice with ID ${invoiceId}`,
            code: 'DELETE_FAILED',
            details: { id: invoiceId }
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      // Clear cache
      await this.clearCache();

      // Create response
      const response = {
        success: true,
        data: true,
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      // Send response
      res.json(response);
    } catch (error) {
      console.error(`Error deleting invoice with ID ${req.params.id}:`, error);
      this.handleError(res, error);
    }
  }

  /**
   * Get invoice lines for an invoice
   *
   * @param req The request
   * @param res The response
   * @returns A promise that resolves when the response has been sent
   */
  async getInvoiceLines(req: Request, res: Response): Promise<void> {
    try {
      // Get invoice ID from request
      const id = Number(req.params.id);

      // Create cache key
      const cacheKey = `${this.entityName}_${id}_lines`;

      // Check cache
      const cachedData = await this.getFromCache(cacheKey);

      if (cachedData) {
        return res.json(cachedData);
      }

      // Get invoice from repository
      const invoice = await this.unitOfWork.invoiceRepository.findById(id);

      if (!invoice) {
        return res.status(404).json({
          success: false,
          error: {
            message: `Invoice with ID ${id} not found`,
            code: 'NOT_FOUND',
            details: { id }
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        });
      }

      // Get invoice lines
      const invoiceLines = await this.unitOfWork.invoiceRepository.findInvoiceLines(id);

      // Create response
      const response = {
        success: true,
        data: invoiceLines,
        meta: {
          timestamp: new Date().toISOString(),
          total: invoiceLines.length
        }
      };

      // Cache response
      await this.setInCache(cacheKey, response);

      // Send response
      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Get invoices by company ID
   *
   * @param req The request
   * @param res The response
   * @returns A promise that resolves when the response has been sent
   */
  async getByCompanyId(req: Request, res: Response): Promise<void> {
    try {
      // Get company ID from request
      const companyId = Number(req.params.id);

      // Parse query parameters
      const query = this.parseQuery(req.query);

      // Create cache key
      const cacheKey = `${this.entityName}_company_${companyId}_${this.safeStringify(query || {})}`;

      // Check cache
      const cachedData = await this.getFromCache(cacheKey);

      if (cachedData) {
        return res.json(cachedData);
      }

      // Get invoices from repository
      let invoices = await this.unitOfWork.invoiceRepository.findByCompanyId(companyId);

      // Apply filters
      if (query.status) {
        invoices = invoices.filter(invoice => invoice.status === query.status);
      }

      if (query.startDate && query.endDate) {
        const startDate = new Date(query.startDate as string);
        const endDate = new Date(query.endDate as string);

        invoices = invoices.filter(invoice => {
          const invoiceDate = new Date(invoice.date);
          return invoiceDate >= startDate && invoiceDate <= endDate;
        });
      }

      // Apply sorting
      if (query.sort) {
        const [field, direction] = (query.sort as string).split(':');
        const isAsc = direction !== 'desc';

        invoices = invoices.sort((a, b) => {
          // @ts-ignore
          const valueA = a[field];
          // @ts-ignore
          const valueB = b[field];

          if (valueA < valueB) {
            return isAsc ? -1 : 1;
          }

          if (valueA > valueB) {
            return isAsc ? 1 : -1;
          }

          return 0;
        });
      }

      // Apply pagination
      const page = Number(query.page) || 1;
      const limit = Number(query.limit) || 20;
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const total = invoices.length;

      const paginatedInvoices = invoices.slice(startIndex, endIndex);

      // Create response
      const response = {
        success: true,
        data: paginatedInvoices,
        meta: {
          timestamp: new Date().toISOString(),
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };

      // Cache response
      await this.setInCache(cacheKey, response);

      // Send response
      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Get all items (this method is intentionally commented out to avoid overriding the first getAll method)
   *
   * @param query The query parameters
   * @returns A promise that resolves to the API response
   */
  // async getAll(query?: Record<string, unknown>): Promise<any> {
  //   try {
  //     const invoices = await this.unitOfWork.invoiceRepository.findAll();
  //     return this.createSuccessResponse(invoices, { total: invoices.length });
  //   } catch (error) {
  //     return this.handleError(error);
  //   }
  // }

  /**
   * Get an item by ID
   *
   * @param id The item ID
   * @param query The query parameters
   * @returns A promise that resolves to the API response
   */
  async getById(id: number | string, query?: Record<string, unknown>): Promise<any> {
    try {
      const invoice = await this.unitOfWork.invoiceRepository.findById(Number(id));
      if (!invoice) {
        return this.createErrorResponse(`Invoice with ID ${id} not found`, 'NOT_FOUND', { id });
      }
      return this.createSuccessResponse(invoice);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Create a new item
   *
   * @param data The item data
   * @returns A promise that resolves to the API response
   */
  async create(data: unknown): Promise<any> {
    try {
      const invoice = await this.unitOfWork.invoiceRepository.create(data as Invoice);
      return this.createSuccessResponse(invoice);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Update an item
   *
   * @param id The item ID
   * @param data The item data
   * @returns A promise that resolves to the API response
   */
  async update(id: number | string, data: unknown): Promise<any> {
    try {
      const invoice = await this.unitOfWork.invoiceRepository.updateEntity({
        ...(data as Invoice),
        id: Number(id)
      });
      return this.createSuccessResponse(invoice);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Delete an item
   *
   * @param id The item ID
   * @returns A promise that resolves to the API response
   */
  async delete(id: number | string): Promise<any> {
    try {
      const deleted = await this.unitOfWork.invoiceRepository.delete(Number(id));
      return this.createSuccessResponse(deleted);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Synchronize invoices
   *
   * @param query The query parameters
   * @returns A promise that resolves to the API response
   */
  async sync(query?: Record<string, unknown>): Promise<any> {
    try {
      console.log('Syncing invoices...');

      // Get the API client
      if (!this.apiClient) {
        return this.createErrorResponse('API client not available', 'API_CLIENT_NOT_AVAILABLE');
      }

      // Get pagination parameters
      const startPage = query?.page ? Number(query.page) : 1;
      const limit = query?.limit ? Number(query.limit) : 250;
      const forceRefresh = query?.forceRefresh === true || query?.forceRefresh === 'true';

      // Set a higher limit to get all invoices (Gripp has ~2330 invoices)
      const apiLimit = 250; // Maximum allowed by Gripp API

      // Track overall stats
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalErrors = 0;
      let totalProcessed = 0;

      // Start transaction
      await this.unitOfWork.beginTransaction();

      try {
        // Process pages until we have all invoices
        let currentPage = startPage;
        let hasMorePages = true;

        while (hasMorePages) {
          console.log(`Syncing invoices page ${currentPage} with limit=${limit}`);

          // Get invoices from Gripp API
          // Create request for invoice.get
          const request = this.apiClient.createRequest(
            'invoice.get',
            [],
            {
              paging: {
                firstresult: (currentPage - 1) * apiLimit,
                maxresults: apiLimit
              }
            }
          );

          // Execute request
          console.log(`Requesting invoices from Gripp API: firstresult=${(currentPage - 1) * apiLimit}, maxresults=${apiLimit}`);
          const response = await this.apiClient.executeRequest(request);

          if (!response || !response.result || !response.result.rows || !Array.isArray(response.result.rows) || response.result.rows.length === 0) {
            console.log('No more invoices found or end of results reached');
            hasMorePages = false;
            break;
          }

          const invoices = response.result.rows;
          console.log(`Got ${invoices.length} invoices from Gripp API for page ${currentPage}`);

          // Process invoices
          let pageCreated = 0;
          let pageUpdated = 0;
          let pageErrors = 0;

          for (const invoiceData of invoices) {
            try {
              // Check if invoice already exists
              const existingInvoice = await this.unitOfWork.invoiceRepository.findByGrippId(invoiceData.id);

              if (existingInvoice) {
                // Update existing invoice
                // Ensure date fields are valid strings
                let date = null;
                if (typeof invoiceData.date === 'string') {
                  date = invoiceData.date;
                } else if (invoiceData.date && typeof invoiceData.date === 'object' && invoiceData.date.date) {
                  date = invoiceData.date.date;
                }

                let dueDate = null;
                if (typeof invoiceData.duedate === 'string') {
                  dueDate = invoiceData.duedate;
                } else if (invoiceData.duedate && typeof invoiceData.duedate === 'object' && invoiceData.duedate.date) {
                  dueDate = invoiceData.duedate.date;
                } else if (invoiceData.expirydate && typeof invoiceData.expirydate === 'object' && invoiceData.expirydate.date) {
                  dueDate = invoiceData.expirydate.date;
                }

                // Check if due date is valid
                let isOverdue = 0;
                if (dueDate) {
                  try {
                    const dueDateObj = new Date(dueDate);
                    if (!isNaN(dueDateObj.getTime())) {
                      isOverdue = dueDateObj < new Date() && invoiceData.totalopeninclvat !== '0.00' ? 1 : 0;
                    }
                  } catch (e) {
                    console.error('Invalid due date:', dueDate);
                  }
                }

                const mappedInvoice = {
                  id: existingInvoice.id,
                  grippId: invoiceData.id,
                  number: invoiceData.number,
                  date: date,
                  dueDate: dueDate,
                  company: invoiceData.companyid || (invoiceData.company && typeof invoiceData.company === 'object' ? invoiceData.company.id : null),
                  amount: invoiceData.totalexclvat,
                  taxAmount: invoiceData.totalinclvat - invoiceData.totalexclvat,
                  totalAmount: invoiceData.totalinclvat,
                  status: typeof invoiceData.status === 'string' ? invoiceData.status :
                          (invoiceData.status && typeof invoiceData.status === 'object' && invoiceData.status.searchname ?
                           invoiceData.status.searchname : 'unknown'),
                  updatedAt: new Date().toISOString(),
                  isPaid: invoiceData.totalopeninclvat === '0.00' ? 1 : 0,
                  isOverdue: isOverdue,
                  totalExclVat: invoiceData.totalexclvat,
                  totalInclVat: invoiceData.totalinclvat,
                  tax_amount: invoiceData.totalinclvat - invoiceData.totalexclvat,
                  company_id: invoiceData.companyid || (invoiceData.company && typeof invoiceData.company === 'object' ? invoiceData.company.id : null),
                  company_name: invoiceData.companyname || (invoiceData.company && typeof invoiceData.company === 'object' ? invoiceData.company.searchname : null),
                  due_date: dueDate,
                  subject: invoiceData.subject || ''
                };

                await this.unitOfWork.invoiceRepository.update(existingInvoice.id, mappedInvoice);
                pageUpdated++;
              } else {
                // Create new invoice
                // Ensure date fields are valid strings
                let date = null;
                if (typeof invoiceData.date === 'string') {
                  date = invoiceData.date;
                } else if (invoiceData.date && typeof invoiceData.date === 'object' && invoiceData.date.date) {
                  date = invoiceData.date.date;
                }

                let dueDate = null;
                if (typeof invoiceData.duedate === 'string') {
                  dueDate = invoiceData.duedate;
                } else if (invoiceData.duedate && typeof invoiceData.duedate === 'object' && invoiceData.duedate.date) {
                  dueDate = invoiceData.duedate.date;
                } else if (invoiceData.expirydate && typeof invoiceData.expirydate === 'object' && invoiceData.expirydate.date) {
                  dueDate = invoiceData.expirydate.date;
                }

                // Check if due date is valid
                let isOverdue = 0;
                if (dueDate) {
                  try {
                    const dueDateObj = new Date(dueDate);
                    if (!isNaN(dueDateObj.getTime())) {
                      isOverdue = dueDateObj < new Date() && invoiceData.totalopeninclvat !== '0.00' ? 1 : 0;
                    }
                  } catch (e) {
                    console.error('Invalid due date:', dueDate);
                  }
                }

                const mappedInvoice = {
                  grippId: invoiceData.id,
                  number: invoiceData.number,
                  date: date,
                  dueDate: dueDate,
                  company: invoiceData.companyid || (invoiceData.company && typeof invoiceData.company === 'object' ? invoiceData.company.id : null),
                  amount: invoiceData.totalexclvat,
                  taxAmount: invoiceData.totalinclvat - invoiceData.totalexclvat,
                  totalAmount: invoiceData.totalinclvat,
                  status: typeof invoiceData.status === 'string' ? invoiceData.status :
                          (invoiceData.status && typeof invoiceData.status === 'object' && invoiceData.status.searchname ?
                           invoiceData.status.searchname : 'unknown'),
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  isPaid: invoiceData.totalopeninclvat === '0.00' ? 1 : 0,
                  isOverdue: isOverdue,
                  totalExclVat: invoiceData.totalexclvat,
                  totalInclVat: invoiceData.totalinclvat,
                  tax_amount: invoiceData.totalinclvat - invoiceData.totalexclvat,
                  company_id: invoiceData.companyid || (invoiceData.company && typeof invoiceData.company === 'object' ? invoiceData.company.id : null),
                  company_name: invoiceData.companyname || (invoiceData.company && typeof invoiceData.company === 'object' ? invoiceData.company.searchname : null),
                  due_date: dueDate,
                  subject: invoiceData.subject || ''
                };

                await this.unitOfWork.invoiceRepository.create(mappedInvoice);
                pageCreated++;
              }
            } catch (error) {
              console.error(`Error processing invoice ${invoiceData.id}:`, error);
              pageErrors++;
            }
          }

          // Update totals
          totalCreated += pageCreated;
          totalUpdated += pageUpdated;
          totalErrors += pageErrors;
          totalProcessed += invoices.length;

          console.log(`Page ${currentPage} stats: Created=${pageCreated}, Updated=${pageUpdated}, Errors=${pageErrors}`);

          // Check if there are more pages
          hasMorePages = invoices.length === apiLimit;
          console.log(`Page ${currentPage} has ${invoices.length} invoices, apiLimit=${apiLimit}, hasMorePages=${hasMorePages}`);

          if (hasMorePages) {
            currentPage++;
          }
        }

        // Commit transaction
        await this.unitOfWork.commitTransaction();

        // Clear cache
        await this.clearCache();

        // Create response
        return {
          success: true,
          data: {
            total: totalProcessed,
            created: totalCreated,
            updated: totalUpdated,
            errors: totalErrors,
            pages: currentPage - startPage + 1
          },
          meta: {
            timestamp: new Date().toISOString()
          }
        };
      } catch (error) {
        // Rollback transaction
        await this.unitOfWork.rollbackTransaction();
        throw error;
      }
    } catch (error) {
      console.error('Error syncing invoices:', error);
      return this.handleError(error);
    }
  }
}
