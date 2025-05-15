/**
 * Unified data structure types
 */

export interface Invoice {
  id: number;
  grippId?: number;
  number: string;
  date: string;
  dueDate: string;
  due_date?: string;
  company: number;
  company_id?: number;
  companyName?: string;
  company_name?: string;
  amount: number;        // Maps to totalExclVat in the database
  taxAmount: number;      // Maps to totalVat in the database
  totalAmount: number;    // Maps to total in the database
  status: string;
  subject?: string;      // Onderwerp van de factuur
  createdAt: string;
  updatedAt: string;
  // Calculated fields
  openAmount?: number;
  isPaid?: boolean | number;  // Can be boolean from frontend or number (0/1) from API
  isOverdue?: boolean | number; // Can be boolean from frontend or number (0/1) from API
  // Formatted fields from API
  formattedDate?: string;
  formattedDueDate?: string;
  daysOverdue?: number;
}

export interface InvoiceLine {
  id: number;
  invoice: number;
  description: string;
  amount: number;
  price: number;
  taxPercentage: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: number;
  name: string;
  number: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectLine {
  id: number;
  project_id: number;
  name: string;
  budget: number;
  rate: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  function: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Hour {
  id: number;
  employee: number;
  project: number;
  projectline: number;
  date: string;
  amount: number;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
