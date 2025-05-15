import { GrippRequest, GrippResponse, executeRequest } from '../client.ts';
import { Invoice } from '../../../types/invoice';
import fs from 'fs';
import path from 'path';

// Cache voor facturen
interface InvoiceCache {
  data: GrippResponse<Invoice> | null;
  timestamp: number;
  expiresIn: number; // in milliseconds
}

// Cache bestandspaden
const CACHE_DIR = path.join(process.cwd(), 'cache');
const INVOICES_CACHE_FILE = path.join(CACHE_DIR, 'invoices.json');
const UNPAID_INVOICES_CACHE_FILE = path.join(CACHE_DIR, 'unpaid-invoices.json');
const OVERDUE_INVOICES_CACHE_FILE = path.join(CACHE_DIR, 'overdue-invoices.json');

// Zorg ervoor dat de cache directory bestaat
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Helper functie om cache naar bestand te schrijven
function saveCacheToFile(filePath: string, cache: InvoiceCache): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(cache, null, 2));
    console.log(`Cache saved to ${filePath}`);
  } catch (error) {
    console.error(`Error saving cache to ${filePath}:`, error);
  }
}

// Helper functie om cache uit bestand te lezen
function loadCacheFromFile(filePath: string): InvoiceCache | null {
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Error loading cache from ${filePath}:`, error);
  }
  return null;
}

// Globale cache instanties
const invoiceCache: InvoiceCache = loadCacheFromFile(INVOICES_CACHE_FILE) || {
  data: null,
  timestamp: 0,
  expiresIn: 24 * 60 * 60 * 1000, // 24 uur cache
};

const unpaidInvoicesCache: InvoiceCache = loadCacheFromFile(UNPAID_INVOICES_CACHE_FILE) || {
  data: null,
  timestamp: 0,
  expiresIn: 24 * 60 * 60 * 1000, // 24 uur cache
};

const overdueInvoicesCache: InvoiceCache = loadCacheFromFile(OVERDUE_INVOICES_CACHE_FILE) || {
  data: null,
  timestamp: 0,
  expiresIn: 24 * 60 * 60 * 1000, // 24 uur cache
};

export type InvoiceFilter = {
  field: string;
  operator: string;
  value: string | number | boolean | Date;
};

export type GetInvoicesOptions = {
  filters?: InvoiceFilter[];
  options?: {
    paging?: {
      firstresult: number;
      maxresults: number;
    };
    orderings?: Array<{
      field: string;
      direction: 'asc' | 'desc';
    }>;
  };
};

export const invoiceService = {
  async getAll(): Promise<GrippResponse<Invoice>> {
    console.log('Fetching all invoices from Gripp API');

    // Controleer of we de cache kunnen gebruiken
    const now = Date.now();
    const cacheIsValid = invoiceCache.data &&
                         (now - invoiceCache.timestamp < invoiceCache.expiresIn);

    // Als we een geldige cache hebben, gebruik deze
    if (cacheIsValid && invoiceCache.data && invoiceCache.data.result && invoiceCache.data.result.rows) {
      console.log('Using cached invoice data for getAll, age:', Math.round((now - invoiceCache.timestamp) / 1000), 'seconds');

      // Maak een kopie van de cache data om te voorkomen dat we de cache wijzigen
      const cachedData = JSON.parse(JSON.stringify(invoiceCache.data));

      console.log(`Using cached data: ${cachedData.result.rows.length} total invoices`);

      return cachedData;
    }

    // Als we geen geldige cache hebben, haal de data op van de API
    console.log('No valid cache available for getAll, fetching from API');

    // Get all invoices using pagination
    let allInvoices: Invoice[] = [];
    let currentPage = 0;
    const pageSize = 250; // Maximum allowed by the API
    let hasMoreResults = true;

    // Get all invoices from 2000 onwards to ensure we get everything
    const startDate = new Date(2000, 0, 1); // Start from January 1, 2000 to get all historical data

    while (hasMoreResults) {
      const firstResult = currentPage * pageSize;
      console.log(`Fetching invoices page ${currentPage + 1} (${firstResult} to ${firstResult + pageSize})`);

      try {
        const request: GrippRequest = {
          method: 'invoice.get',
          params: [
            [
              {
                field: 'invoice.date',
                operator: 'greaterequals',
                value: startDate.toISOString().split('T')[0]
              }
            ],
            {
              paging: {
                firstresult: firstResult,
                maxresults: pageSize,
              },
              orderings: [
                {
                  field: 'invoice.date',
                  direction: 'desc',
                },
              ],
            },
          ],
          id: Date.now(),
        };

        console.log('Sending invoice request to Gripp API:', JSON.stringify(request, null, 2));
        const response = await executeRequest<Invoice>(request);

        if (!response?.result?.rows || response.result.rows.length === 0) {
          console.log('No more invoices found or end of results reached');
          hasMoreResults = false;
          break;
        }

        const invoices = response.result.rows;
        console.log(`Received ${invoices.length} invoices for page ${currentPage + 1}`);

        // Process invoices to ensure consistent data types
        const processedInvoices = invoices.map(invoice => {
          // Convert string amounts to numbers for reliable comparison
          invoice.totalinclvat = typeof invoice.totalinclvat === 'string'
            ? parseFloat(invoice.totalinclvat)
            : invoice.totalinclvat;

          invoice.totalpayed = typeof invoice.totalpayed === 'string'
            ? parseFloat(invoice.totalpayed)
            : invoice.totalpayed;

          invoice.totalexclvat = typeof invoice.totalexclvat === 'string'
            ? parseFloat(invoice.totalexclvat)
            : invoice.totalexclvat;

          // Calculate if invoice is paid
          const totalAmount = parseFloat(invoice.totalinclvat.toString());
          const paidAmount = parseFloat(invoice.totalpayed.toString());

          // Debug payment information for specific invoices
          if (invoice.number === '24010248') {
            console.log(`PAYMENT DEBUG - Invoice ${invoice.id} (${invoice.number}): Total: ${totalAmount}, Paid: ${paidAmount}, Difference: ${totalAmount - paidAmount}, Status: ${invoice.status?.searchname}`);
          }

          // An invoice is only considered paid if the paid amount equals or exceeds the total amount
          const isPaid = Math.abs(totalAmount - paidAmount) < 0.01; // Allow for small rounding differences

          // Add payment status
          invoice.isPaid = isPaid;

          // Check if invoice is overdue
          const today = new Date();
          const expiryDate = invoice.expirydate && invoice.expirydate.date ? new Date(invoice.expirydate.date) : null;
          invoice.isOverdue = !isPaid && expiryDate && expiryDate < today;

          // Add status field for unified data structure
          invoice.status = isPaid ? 'paid' : (invoice.isOverdue ? 'overdue' : 'unpaid');

          return invoice;
        });

        // Add invoices from this page to our collection
        allInvoices = [...allInvoices, ...processedInvoices];

        // If we received fewer results than the page size, we've reached the end
        if (invoices.length < pageSize) {
          hasMoreResults = false;
        } else {
          currentPage++;
        }
      } catch (error) {
        console.error(`Error fetching invoices page ${currentPage + 1}:`, error);
        // Try to continue with the next page
        currentPage++;

        // If we've had too many errors, stop
        if (currentPage > 10) {
          console.error('Too many errors, stopping invoice fetch');
          hasMoreResults = false;
        }
      }
    }

    console.log(`Total invoices fetched: ${allInvoices.length}`);

    // Create a response object with all the invoices
    const combinedResponse: GrippResponse<Invoice> = {
      id: Date.now(),
      thread: '',
      result: {
        rows: allInvoices,
        count: allInvoices.length,
        start: 0,
        limit: allInvoices.length,
        next_start: 0,
        more_items_in_collection: false
      },
      error: null
    };

    // Update de cache met de nieuwe data
    if (allInvoices.length > 0) {
      console.log('Updating invoice cache with', allInvoices.length, 'invoices from getAll');
      invoiceCache.data = JSON.parse(JSON.stringify(combinedResponse));
      invoiceCache.timestamp = Date.now();

      // Sla de cache op in een bestand
      saveCacheToFile(INVOICES_CACHE_FILE, invoiceCache);
    }

    return combinedResponse;
  },

  async get(options: GetInvoicesOptions = {}): Promise<GrippResponse<Invoice>> {
    console.log('Fetching invoices with options:', JSON.stringify(options, null, 2));

    // Controleer of we de cache kunnen gebruiken
    const now = Date.now();
    const cacheIsValid = invoiceCache.data &&
                         (now - invoiceCache.timestamp < invoiceCache.expiresIn);

    // Als we een geldige cache hebben, gebruik deze
    if (cacheIsValid && invoiceCache.data) {
      console.log('Using cached invoice data, age:', Math.round((now - invoiceCache.timestamp) / 1000), 'seconds');

      // Maak een kopie van de cache data om te voorkomen dat we de cache wijzigen
      const cachedData = JSON.parse(JSON.stringify(invoiceCache.data));

      // Pas filters toe op de gecachte data
      if (cachedData.result && cachedData.result.rows) {
        let filteredRows = cachedData.result.rows;

        // Pas filters toe
        const filters = options.filters || [];
        if (filters.length > 0) {
          console.log('Applying filters to cached data:', JSON.stringify(filters, null, 2));

          // Filter op jaar als dat is opgegeven
          filters.forEach(filter => {
            if (filter.field === 'invoice.date') {
              if (filter.operator === 'greaterequals' || filter.operator === 'after') {
                const startDate = new Date(filter.value.toString());
                filteredRows = filteredRows.filter(invoice => {
                  const invoiceDate = invoice.date && invoice.date.date
                    ? new Date(invoice.date.date)
                    : null;
                  return invoiceDate && invoiceDate >= startDate;
                });
              } else if (filter.operator === 'less' || filter.operator === 'before') {
                const endDate = new Date(filter.value.toString());
                filteredRows = filteredRows.filter(invoice => {
                  const invoiceDate = invoice.date && invoice.date.date
                    ? new Date(invoice.date.date)
                    : null;
                  return invoiceDate && invoiceDate < endDate;
                });
              }
            }
          });
        }

        // Sorteer de resultaten
        if (options.options?.orderings && options.options.orderings.length > 0) {
          const ordering = options.options.orderings[0];
          const direction = ordering.direction === 'asc' ? 1 : -1;

          filteredRows.sort((a, b) => {
            let valueA, valueB;

            if (ordering.field === 'invoice.date') {
              valueA = a.date && a.date.date ? new Date(a.date.date).getTime() : 0;
              valueB = b.date && b.date.date ? new Date(b.date.date).getTime() : 0;
            } else if (ordering.field === 'invoice.expirydate') {
              valueA = a.expirydate && a.expirydate.date ? new Date(a.expirydate.date).getTime() : 0;
              valueB = b.expirydate && b.expirydate.date ? new Date(b.expirydate.date).getTime() : 0;
            } else {
              valueA = a[ordering.field] || 0;
              valueB = b[ordering.field] || 0;
            }

            return direction * (valueA - valueB);
          });
        }

        // Pas paginering toe
        const page = options.options?.paging?.firstresult
          ? Math.floor(options.options.paging.firstresult / (options.options.paging.maxresults || 100)) + 1
          : 1;
        const limit = options.options?.paging?.maxresults || 100;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;

        const paginatedRows = filteredRows.slice(startIndex, Math.min(endIndex, filteredRows.length));

        console.log(`Using cached data: ${paginatedRows.length} invoices after filtering and pagination`);

        // Maak een nieuwe response met de gefilterde en gepagineerde data
        return {
          result: {
            rows: paginatedRows,
            count: filteredRows.length,
            start: startIndex,
            limit: limit,
            next_start: endIndex < filteredRows.length ? endIndex : 0,
            more_items_in_collection: endIndex < filteredRows.length
          }
        };
      }
    }

    // Als we geen geldige cache hebben, haal de data op van de API
    console.log('No valid cache available, fetching from API');

    // Use the filters provided by the caller, or an empty array if none provided
    // We no longer add a default date filter to ensure we get ALL invoices
    const filters = options.filters || [];

    // Update any date filters to use the correct operators
    filters.forEach(filter => {
      if (filter.field === 'invoice.date' || filter.field === 'invoice.expirydate') {
        if (filter.operator === 'after') {
          filter.operator = 'greaterequals';
        } else if (filter.operator === 'before') {
          filter.operator = 'less';
        }
      }
    });

    // Set up paging parameters
    const maxResultsPerPage = 250; // Maximum allowed by Gripp API
    const requestedFirstResult = options.options?.paging?.firstresult || 0;
    const requestedMaxResults = options.options?.paging?.maxresults || 2500; // Default to 2500 to get all invoices

    console.log(`Requested paging: firstresult=${requestedFirstResult}, maxresults=${requestedMaxResults}`);

    // Initialize result container
    let allRows: Invoice[] = [];
    let totalCount = 0;
    let hasMoreResults = true;
    let currentFirstResult = requestedFirstResult;

    // Fetch all pages until we have all results or reach the requested limit
    while (hasMoreResults && allRows.length < requestedMaxResults) {
      const request: GrippRequest = {
        method: 'invoice.get',
        params: [
          filters,
          {
            paging: {
              firstresult: currentFirstResult,
              maxresults: Math.min(maxResultsPerPage, requestedMaxResults - allRows.length),
            },
            orderings: options.options?.orderings || [
              {
                field: 'invoice.date',
                direction: 'desc',
              },
            ],
          },
        ],
        id: Date.now(),
      };

      console.log(`Sending invoice request to Gripp API (page ${currentFirstResult / maxResultsPerPage + 1})...`);
      const response = await executeRequest<Invoice>(request);

      if (!response?.result?.rows) {
        console.log('No rows returned from Gripp API');
        hasMoreResults = false;
        break;
      }

      const pageRows = response.result.rows;
      console.log(`Received ${pageRows.length} invoices from page ${currentFirstResult / maxResultsPerPage + 1}`);

      // Process the invoices in this page
      const processedRows = pageRows.map(invoice => {
        // Convert string amounts to numbers for reliable comparison
        invoice.totalinclvat = typeof invoice.totalinclvat === 'string'
          ? parseFloat(invoice.totalinclvat)
          : invoice.totalinclvat;

        invoice.totalpayed = typeof invoice.totalpayed === 'string'
          ? parseFloat(invoice.totalpayed)
          : invoice.totalpayed;

        // Calculate if invoice is paid
        const totalAmount = parseFloat(invoice.totalinclvat.toString());
        const paidAmount = parseFloat(invoice.totalpayed.toString());
        const isPaid = Math.abs(totalAmount - paidAmount) < 0.01; // Allow for small rounding differences

        // Add payment status
        invoice.isPaid = isPaid;

        // Check if invoice is overdue
        const today = new Date();
        const expiryDate = invoice.expirydate && invoice.expirydate.date ? new Date(invoice.expirydate.date) : null;
        invoice.isOverdue = !isPaid && expiryDate && expiryDate < today;

        // Add status field for unified data structure
        invoice.status = isPaid ? 'paid' : (invoice.isOverdue ? 'overdue' : 'unpaid');

        return invoice;
      });

      // Add the processed rows to our collection
      allRows = [...allRows, ...processedRows];

      // Update total count if available
      if (response.result.count !== undefined) {
        totalCount = response.result.count;
      }

      // Check if we need to fetch more pages
      if (pageRows.length < maxResultsPerPage) {
        // We got fewer rows than the maximum, so there are no more results
        hasMoreResults = false;
      } else {
        // Move to the next page
        currentFirstResult += pageRows.length;
      }

      console.log(`Progress: ${allRows.length}/${totalCount || 'unknown'} invoices fetched`);
    }

    console.log(`Finished fetching invoices: ${allRows.length} total invoices fetched`);

    // Create a combined response with all the rows
    const combinedResponse: GrippResponse<Invoice> = {
      result: {
        rows: allRows,
        count: totalCount || allRows.length,
        start: requestedFirstResult,
        limit: requestedMaxResults,
        next_start: requestedFirstResult + allRows.length,
        more_items_in_collection: allRows.length === requestedMaxResults
      }
    };

    // Update de cache met de nieuwe data
    // We slaan alleen de volledige dataset op als we alle facturen hebben opgehaald
    if (filters.length === 0 && requestedFirstResult === 0 && allRows.length > 0) {
      console.log('Updating invoice cache with', allRows.length, 'invoices');
      invoiceCache.data = JSON.parse(JSON.stringify(combinedResponse));
      invoiceCache.timestamp = Date.now();

      // Sla de cache op in een bestand
      saveCacheToFile(INVOICES_CACHE_FILE, invoiceCache);
    }

    return combinedResponse;
  },

  async getUnpaid(year?: number): Promise<GrippResponse<Invoice>> {
    console.log('Fetching unpaid invoices from Gripp API', year ? `for year ${year}` : 'for all years');

    // Create filters based on the year parameter
    const filters: InvoiceFilter[] = [];

    if (year) {
      // Filter for specific year
      const startDate = `${year}-01-01`;
      const endDate = `${year + 1}-01-01`;

      filters.push({
        field: 'invoice.date',
        operator: 'greaterequals',
        value: startDate
      });

      filters.push({
        field: 'invoice.date',
        operator: 'less',
        value: endDate
      });
    }

    // Controleer of we de cache kunnen gebruiken
    const now = Date.now();
    const cacheIsValid = unpaidInvoicesCache.data &&
                         (now - unpaidInvoicesCache.timestamp < unpaidInvoicesCache.expiresIn);

    // Als we een geldige cache hebben, gebruik deze
    if (cacheIsValid && unpaidInvoicesCache.data && unpaidInvoicesCache.data.result && unpaidInvoicesCache.data.result.rows) {
      console.log('Using cached invoice data for unpaid invoices, age:', Math.round((now - unpaidInvoicesCache.timestamp) / 1000), 'seconds');

      // Maak een kopie van de cache data om te voorkomen dat we de cache wijzigen
      const cachedData = JSON.parse(JSON.stringify(unpaidInvoicesCache.data));
      let filteredRows = cachedData.result.rows;

      // Pas jaar filter toe indien nodig
      if (year) {
        const startDate = new Date(`${year}-01-01`);
        const endDate = new Date(`${year + 1}-01-01`);

        filteredRows = filteredRows.filter(invoice => {
          const invoiceDate = invoice.date && invoice.date.date
            ? new Date(invoice.date.date)
            : null;
          return invoiceDate && invoiceDate >= startDate && invoiceDate < endDate;
        });
      }

      // Filter op onbetaalde facturen
      filteredRows = filteredRows.filter(invoice => {
        // Gebruik de isPaid property als die beschikbaar is
        if (invoice.isPaid !== undefined) {
          return !invoice.isPaid;
        }

        // Anders bereken of de factuur betaald is
        const totalInclVat = typeof invoice.totalinclvat === 'string'
          ? parseFloat(invoice.totalinclvat)
          : invoice.totalinclvat;

        const totalPayed = typeof invoice.totalpayed === 'string'
          ? parseFloat(invoice.totalpayed)
          : invoice.totalpayed;

        // Check if there is an unpaid amount (with small tolerance for floating point comparison)
        return (totalInclVat - totalPayed) > 0.01;
      });

      // Sorteer op vervaldatum
      filteredRows.sort((a, b) => {
        const dateA = a.expirydate && a.expirydate.date ? new Date(a.expirydate.date).getTime() : 0;
        const dateB = b.expirydate && b.expirydate.date ? new Date(b.expirydate.date).getTime() : 0;
        return dateA - dateB;
      });

      console.log(`Using cached data: ${filteredRows.length} unpaid invoices after filtering`);

      // Maak een nieuwe response met de gefilterde data
      return {
        result: {
          rows: filteredRows,
          count: filteredRows.length
        }
      };
    }

    // Als we geen geldige cache hebben, haal de data op via de normale methode
    console.log('No valid cache available for unpaid invoices, fetching from API');

    // We'll fetch invoices and filter client-side
    const response = await this.get({
      filters: filters,
      options: {
        orderings: [
          {
            field: 'invoice.expirydate',
            direction: 'asc',
          },
        ],
      }
    });

    // Filter unpaid invoices client-side for more reliable results
    if (response?.result?.rows) {
      // Convert string values to numbers for reliable comparison
      const filteredRows = response.result.rows.filter(invoice => {
        const totalInclVat = typeof invoice.totalinclvat === 'string'
          ? parseFloat(invoice.totalinclvat)
          : invoice.totalinclvat;

        const totalPayed = typeof invoice.totalpayed === 'string'
          ? parseFloat(invoice.totalpayed)
          : invoice.totalpayed;

        // Check if there is an unpaid amount (with small tolerance for floating point comparison)
        return (totalInclVat - totalPayed) > 0.01;
      });

      response.result.rows = filteredRows;
      response.result.count = filteredRows.length;

      // Update de cache met de nieuwe data
      if (filteredRows.length > 0) {
        console.log('Updating unpaid invoice cache with', filteredRows.length, 'invoices');
        unpaidInvoicesCache.data = JSON.parse(JSON.stringify(response));
        unpaidInvoicesCache.timestamp = Date.now();

        // Sla de cache op in een bestand
        saveCacheToFile(UNPAID_INVOICES_CACHE_FILE, unpaidInvoicesCache);
      }
    }

    return response;
  },

  async getOverdue(year?: number): Promise<GrippResponse<Invoice>> {
    console.log('Fetching overdue invoices from Gripp API', year ? `for year ${year}` : 'for all years');

    const today = new Date();

    // Create filters based on the year parameter
    const filters: InvoiceFilter[] = [];

    if (year) {
      // Filter for specific year
      const startDate = `${year}-01-01`;
      const endDate = `${year + 1}-01-01`;

      filters.push({
        field: 'invoice.date',
        operator: 'greaterequals',
        value: startDate
      });

      filters.push({
        field: 'invoice.date',
        operator: 'less',
        value: endDate
      });
    }

    // Controleer of we de cache kunnen gebruiken
    const now = Date.now();
    const cacheIsValid = overdueInvoicesCache.data &&
                         (now - overdueInvoicesCache.timestamp < overdueInvoicesCache.expiresIn);

    // Als we een geldige cache hebben, gebruik deze
    if (cacheIsValid && overdueInvoicesCache.data && overdueInvoicesCache.data.result && overdueInvoicesCache.data.result.rows) {
      console.log('Using cached invoice data for overdue invoices, age:', Math.round((now - overdueInvoicesCache.timestamp) / 1000), 'seconds');

      // Maak een kopie van de cache data om te voorkomen dat we de cache wijzigen
      const cachedData = JSON.parse(JSON.stringify(overdueInvoicesCache.data));
      let filteredRows = cachedData.result.rows;

      // Pas jaar filter toe indien nodig
      if (year) {
        const startDate = new Date(`${year}-01-01`);
        const endDate = new Date(`${year + 1}-01-01`);

        filteredRows = filteredRows.filter(invoice => {
          const invoiceDate = invoice.date && invoice.date.date
            ? new Date(invoice.date.date)
            : null;
          return invoiceDate && invoiceDate >= startDate && invoiceDate < endDate;
        });
      }

      // Filter op verlopen facturen
      filteredRows = filteredRows.filter(invoice => {
        // Gebruik de isOverdue property als die beschikbaar is
        if (invoice.isOverdue !== undefined) {
          return invoice.isOverdue;
        }

        // Anders bereken of de factuur verlopen is
        // Controleer eerst of de factuur onbetaald is
        const totalInclVat = typeof invoice.totalinclvat === 'string'
          ? parseFloat(invoice.totalinclvat)
          : invoice.totalinclvat;

        const totalPayed = typeof invoice.totalpayed === 'string'
          ? parseFloat(invoice.totalpayed)
          : invoice.totalpayed;

        const isUnpaid = (totalInclVat - totalPayed) > 0.01;

        // Controleer of de factuur verlopen is
        const expiryDate = invoice.expirydate && invoice.expirydate.date ? new Date(invoice.expirydate.date) : null;
        return isUnpaid && expiryDate && expiryDate < today;
      });

      // Sorteer op vervaldatum
      filteredRows.sort((a, b) => {
        const dateA = a.expirydate && a.expirydate.date ? new Date(a.expirydate.date).getTime() : 0;
        const dateB = b.expirydate && b.expirydate.date ? new Date(b.expirydate.date).getTime() : 0;
        return dateA - dateB;
      });

      console.log(`Using cached data: ${filteredRows.length} overdue invoices after filtering`);

      // Maak een nieuwe response met de gefilterde data
      return {
        result: {
          rows: filteredRows,
          count: filteredRows.length
        }
      };
    }

    // Als we geen geldige cache hebben, haal de data op via de normale methode
    console.log('No valid cache available for overdue invoices, fetching from API');

    // We'll fetch all invoices and filter client-side for more reliable results
    const response = await this.get({
      filters: filters,
      options: {
        orderings: [
          {
            field: 'invoice.expirydate',
            direction: 'asc',
          },
        ],
      }
    });

    // Filter overdue invoices client-side
    if (response?.result?.rows) {
      const filteredRows = response.result.rows.filter(invoice => {
        // Convert string values to numbers for reliable comparison
        const totalInclVat = typeof invoice.totalinclvat === 'string'
          ? parseFloat(invoice.totalinclvat)
          : invoice.totalinclvat;

        const totalPayed = typeof invoice.totalpayed === 'string'
          ? parseFloat(invoice.totalpayed)
          : invoice.totalpayed;

        // Check if there is an unpaid amount
        const isUnpaid = (totalInclVat - totalPayed) > 0.01;

        // Check if it's overdue
        const expiryDate = invoice.expirydate && invoice.expirydate.date ? new Date(invoice.expirydate.date) : null;
        const isOverdue = isUnpaid && expiryDate && expiryDate < today;

        return isOverdue;
      });

      response.result.rows = filteredRows;
      response.result.count = filteredRows.length;

      // Update de cache met de nieuwe data
      if (filteredRows.length > 0) {
        console.log('Updating overdue invoice cache with', filteredRows.length, 'invoices');
        overdueInvoicesCache.data = JSON.parse(JSON.stringify(response));
        overdueInvoicesCache.timestamp = Date.now();

        // Sla de cache op in een bestand
        saveCacheToFile(OVERDUE_INVOICES_CACHE_FILE, overdueInvoicesCache);
      }
    }

    return response;
  }
};