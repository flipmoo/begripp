export interface Invoice {
  id: number;
  number: string;

  // Support both old and new API formats
  // Old API format
  date?: {
    date: string;
    timezone_type: number;
    timezone: string;
  };
  expirydate?: {
    date: string;
    timezone_type: number;
    timezone: string;
  };
  company?: {
    id: number;
    searchname: string;
  };
  totalincldiscountexclvat?: number;
  totalinclvat?: number;
  totalpayed?: number;

  // New API format
  date?: string;
  dueDate?: string;
  companyName?: string;
  company_id?: number;
  totalExclVat?: number;
  total?: number;
  totalAmount?: number;
  paidAmount?: number;
  amount?: number;
  status?: string;
  isPaid?: number;
  isOverdue?: number;

  // Common fields
  subject?: string;

  // Calculated fields
  openAmount?: number;
}

// Old API response format
export interface InvoiceData {
  rows?: Invoice[];
  count?: number;
  start?: number;
  limit?: number;
  next_start?: number;
  more_items_in_collection?: boolean;

  // New API response format
  success?: boolean;
  data?: Invoice[];
  meta?: {
    count: number;
    timestamp: string;
    [key: string]: any;
  };
}