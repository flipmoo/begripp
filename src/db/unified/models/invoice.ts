export interface Invoice {
  id?: number;
  grippId?: number;
  number: string;
  date: string;
  dueDate: string;
  due_date?: string;
  company: number;
  company_id?: number;
  company_name?: string;
  totalAmount?: number;
  totalInclVat?: number;
  totalExclVat?: number; // Add totalExclVat field
  status: string;
  isPaid?: number;
  isOverdue?: number;
  subject?: string; // Onderwerp van de factuur
  createdAt: string;
  updatedAt: string;
}
