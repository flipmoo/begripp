export interface Invoice {
  id: number;
  number: string;
  date: {
    date: string;
    timezone_type: number;
    timezone: string;
  };
  expirydate: {
    date: string;
    timezone_type: number;
    timezone: string;
  };
  company: {
    id: number;
    searchname: string;
  };
  subject: string;
  totalincldiscountexclvat: number;
  totalinclvat: number;
  totalpayed: number;
  // Calculated fields
  openAmount?: number;
  isPaid?: boolean;
  isOverdue?: boolean;
}

export interface InvoiceData {
  rows: Invoice[];
  count: number;
  start: number;
  limit: number;
  next_start: number;
  more_items_in_collection: boolean;
} 