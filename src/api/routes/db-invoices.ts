/**
 * Database Invoice Routes
 *
 * Dit bestand bevat routes voor het werken met facturen uit de lokale database.
 */
import express, { Request, Response, NextFunction } from 'express';
import { getDatabase } from '../../db/database';
import { successResponse } from '../utils/response';

// Simple in-memory cache
interface CacheEntry {
  data: any;
  timestamp: number;
  key: string;
}

const cache: Record<string, CacheEntry> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Function to generate a cache key based on request parameters
const generateCacheKey = (req: Request): string => {
  const { page, limit, year, status, search, isPaid, isOverdue } = req.query;
  return `invoices_${page || 1}_${limit || 250}_${year || 'all'}_${status || 'all'}_${search || ''}_${isPaid || ''}_${isOverdue || ''}`;
};

const router = express.Router();

/**
 * GET /api/v1/db-invoices
 *
 * Haal alle facturen op uit de lokale database
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Fetching invoices from database');

    // Check cache first
    const cacheKey = generateCacheKey(req);
    console.log(`Generated cache key: ${cacheKey}`);
    const cachedData = cache[cacheKey];

    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
      console.log(`Using cached data for key: ${cacheKey}`);
      // Update the fromCache flag in the metadata
      cachedData.data.meta.fromCache = true;
      return res.json(successResponse(cachedData.data));
    }

    const db = await getDatabase();

    // Parse query parameters
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 250; // Default to 250 items per page
    const year = req.query.year ? req.query.year as string : 'all';
    const status = req.query.status ? req.query.status as string : 'all';
    const search = req.query.search ? req.query.search as string : '';

    // Parse isPaid and isOverdue parameters (used by the frontend)
    const isPaid = req.query.isPaid !== undefined ? parseInt(req.query.isPaid as string) : undefined;
    const isOverdue = req.query.isOverdue !== undefined ? parseInt(req.query.isOverdue as string) : undefined;

    console.log('Query parameters:', { page, limit, year, status, search, isPaid, isOverdue });

    // Calculate offset
    const offset = (page - 1) * limit;

    // Build query
    let query = 'SELECT * FROM invoices';
    let countQuery = 'SELECT COUNT(*) as total FROM invoices';
    const queryParams: any[] = [];
    const conditions: string[] = [];

    // Add year filter
    if (year !== 'all') {
      const startDate = `${year}-01-01`;
      const endDate = `${parseInt(year as string) + 1}-01-01`;
      conditions.push('(date >= ? AND date < ?)');
      queryParams.push(startDate, endDate);
    }

    // Add status filter
    if (status !== 'all') {
      switch (status) {
        case 'paid':
          conditions.push('isPaid = 1');
          break;
        case 'unpaid':
          conditions.push('isPaid = 0 AND isOverdue = 0');
          break;
        case 'overdue':
          conditions.push('isOverdue = 1');
          break;
      }
      console.log(`Added status filter: ${status}`);
    } else if (isPaid !== undefined) {
      // Use isPaid parameter directly if provided
      conditions.push(`isPaid = ${isPaid}`);
      console.log(`Added isPaid filter: ${isPaid}`);
    } else if (req.query.isPaid !== undefined) {
      // Also check for isPaid in the query parameters (string format)
      const isPaidValue = parseInt(req.query.isPaid as string);
      conditions.push(`isPaid = ${isPaidValue}`);
      console.log(`Added isPaid filter from query params: ${isPaidValue}`);
    }

    // Add isOverdue filter if provided and not already filtered by status
    if (status === 'all') {
      if (isOverdue !== undefined) {
        conditions.push(`isOverdue = ${isOverdue}`);
        console.log(`Added isOverdue filter: ${isOverdue}`);
      } else if (req.query.isOverdue !== undefined) {
        // Also check for isOverdue in the query parameters (string format)
        const isOverdueValue = parseInt(req.query.isOverdue as string);
        conditions.push(`isOverdue = ${isOverdueValue}`);
        console.log(`Added isOverdue filter from query params: ${isOverdueValue}`);
      }
    }

    // Add search filter
    if (search) {
      conditions.push('(number LIKE ? OR subject LIKE ? OR company_name LIKE ?)');
      const searchParam = `%${search}%`;
      queryParams.push(searchParam, searchParam, searchParam);
      console.log(`Added search filter: ${search}`);
    }

    // Add conditions to query
    if (conditions.length > 0) {
      const whereClause = conditions.join(' AND ');
      query += ' WHERE ' + whereClause;
      countQuery += ' WHERE ' + whereClause;
    }

    // Add order by
    query += ' ORDER BY date DESC';

    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(limit, offset);

    // Execute count query to get total number of invoices that match the filters
    console.log('Getting total number of invoices that match the filters');
    let total = 0;
    try {
      // Use the countQuery with all the filters applied
      const countParams = queryParams.slice(0, queryParams.length - 2); // Remove limit and offset
      console.log('Executing count query:', countQuery, 'with params:', countParams);
      const countResult = await db.get(countQuery, ...countParams);
      total = countResult ? countResult.total : 0;
      console.log(`Total invoices in database that match the filters: ${total}`);
    } catch (error) {
      console.error('Error getting filtered invoice count:', error);
    }

    // Execute main query
    console.log('Executing query:', query, 'with params:', queryParams);
    let invoices;
    try {
      invoices = await db.all(query, ...queryParams);
      console.log(`Retrieved ${invoices.length} invoices from database`);

      // Log the first invoice for debugging
      if (invoices.length > 0) {
        console.log('First invoice:', JSON.stringify(invoices[0], null, 2));
      }
    } catch (error) {
      console.error('Error executing main query:', error);
      invoices = [];
    }

    // Process invoices to ensure consistent data types
    const processedInvoices = invoices.map((invoice: any) => {
      // Convert string amounts to numbers for reliable comparison
      invoice.totalInclVat = typeof invoice.totalInclVat === 'string'
        ? parseFloat(invoice.totalInclVat)
        : invoice.totalInclVat;

      invoice.totalExclVat = typeof invoice.totalExclVat === 'string'
        ? parseFloat(invoice.totalExclVat)
        : invoice.totalExclVat;

      invoice.totalAmount = typeof invoice.totalAmount === 'string'
        ? parseFloat(invoice.totalAmount)
        : invoice.totalAmount;

      // Ensure boolean fields are consistent
      invoice.isPaid = invoice.isPaid === 1 || invoice.isPaid === true;
      invoice.isOverdue = invoice.isOverdue === 1 || invoice.isOverdue === true;

      return invoice;
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    // Prepare response data
    const responseData = {
      rows: processedInvoices,
      count: total,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPreviousPage,
        fromCache: false
      }
    };

    // Store in cache
    cache[cacheKey] = {
      data: responseData,
      timestamp: Date.now(),
      key: cacheKey
    };

    // Log cache status
    const cacheKeys = Object.keys(cache);
    console.log(`Stored data in cache with key: ${cacheKey}`);
    console.log(`Cache now contains ${cacheKeys.length} entries`);

    // Clean up old cache entries if there are too many
    if (cacheKeys.length > 100) {
      console.log('Cache is getting large, cleaning up old entries...');
      const now = Date.now();
      let cleanedCount = 0;

      for (const key of cacheKeys) {
        if ((now - cache[key].timestamp) > CACHE_TTL) {
          delete cache[key];
          cleanedCount++;
        }
      }

      console.log(`Cleaned up ${cleanedCount} old cache entries`);
    }

    // Return response
    res.json(successResponse(responseData));
  } catch (error) {
    console.error('Error fetching invoices from database:', error);
    next(error);
  }
});

export default router;
