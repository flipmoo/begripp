import { GrippRequest, GrippResponse, executeRequest } from '../client.ts';
import { Invoice } from '../../../types/invoice';

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
    
    // Get current year for filtering
    const startDate = new Date(2024, 0, 1); // Start from January 1, 2024
    
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
            firstresult: 0,
            maxresults: 250,
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
    console.log(`Received ${response?.result?.rows?.length || 0} invoices from Gripp API`);
    
    return response;
  },

  async get(options: GetInvoicesOptions = {}): Promise<GrippResponse<Invoice>> {
    console.log('Fetching invoices with options:', JSON.stringify(options, null, 2));
    
    // Ensure we're only getting invoices from 2024 onwards if no date filter is provided
    const filters = options.filters || [];
    const hasDateFilter = filters.some(filter => filter.field === 'invoice.date');
    
    if (!hasDateFilter) {
      const startDate = new Date(2024, 0, 1); // Start from January 1, 2024
      
      filters.push({
        field: 'invoice.date',
        operator: 'greaterequals',
        value: startDate.toISOString().split('T')[0]
      });
    }
    
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
    
    const request: GrippRequest = {
      method: 'invoice.get',
      params: [
        filters,
        {
          paging: options.options?.paging || {
            firstresult: 0,
            maxresults: 250,
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

    console.log('Sending invoice request to Gripp API:', JSON.stringify(request, null, 2));
    const response = await executeRequest<Invoice>(request);
    console.log(`Received ${response?.result?.rows?.length || 0} invoices from Gripp API`);
    
    // Post-process the response to identify unpaid invoices
    if (response?.result?.rows) {
      response.result.rows = response.result.rows.map(invoice => {
        // Convert string amounts to numbers for reliable comparison
        invoice.totalinclvat = typeof invoice.totalinclvat === 'string' 
          ? parseFloat(invoice.totalinclvat) 
          : invoice.totalinclvat;
          
        invoice.totalpayed = typeof invoice.totalpayed === 'string' 
          ? parseFloat(invoice.totalpayed) 
          : invoice.totalpayed;
          
        return invoice;
      });
    }
    
    return response;
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
    } else {
      // Default to 2024 onwards
      filters.push({
        field: 'invoice.date',
        operator: 'greaterequals',
        value: '2024-01-01'
      });
    }
    
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
    } else {
      // Default to 2024 onwards
      filters.push({
        field: 'invoice.date',
        operator: 'greaterequals',
        value: '2024-01-01'
      });
    }
    
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
        const expiryDate = new Date(invoice.expirydate.date);
        const isOverdue = isUnpaid && expiryDate < today;
        
        return isOverdue;
      });
      
      response.result.rows = filteredRows;
      response.result.count = filteredRows.length;
    }
    
    return response;
  }
}; 