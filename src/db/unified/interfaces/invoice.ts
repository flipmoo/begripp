/**
 * Invoice Interfaces
 *
 * This file defines the interfaces for invoices.
 */

/**
 * Invoice
 */
export interface Invoice {
  /**
   * The invoice ID
   */
  id: number;

  /**
   * The Gripp ID
   */
  grippId?: number;

  /**
   * The invoice number
   */
  number: string;

  /**
   * The invoice date
   */
  date: string;

  /**
   * The invoice due date
   */
  dueDate: string;

  /**
   * The invoice company ID
   */
  company: number;

  /**
   * The invoice company name
   */
  companyName?: string;

  /**
   * The invoice total amount (including VAT)
   */
  total?: number;

  /**
   * The invoice amount excluding VAT
   */
  totalExclVat?: number;

  /**
   * The invoice VAT amount
   */
  totalVat?: number;

  /**
   * The invoice paid amount
   */
  paidAmount?: number;

  /**
   * For compatibility with the frontend
   */
  amount?: number;

  /**
   * For compatibility with the frontend
   */
  taxAmount?: number;

  /**
   * For compatibility with the frontend
   */
  totalAmount?: number;

  /**
   * The invoice status (paid, unpaid, overdue)
   */
  status: string;

  /**
   * The original status from Gripp
   */
  grippStatus?: string;

  /**
   * Whether the invoice is paid (1 = true, 0 = false)
   */
  isPaid?: number;

  /**
   * Whether the invoice is overdue (1 = true, 0 = false)
   */
  isOverdue?: number;

  /**
   * The invoice created at date
   */
  createdAt: string;

  /**
   * The invoice updated at date
   */
  updatedAt: string;
}

/**
 * Invoice line
 */
export interface InvoiceLine {
  /**
   * The invoice line ID
   */
  id: number;

  /**
   * The invoice ID
   */
  invoice: number;

  /**
   * The invoice line description
   */
  description: string;

  /**
   * The invoice line amount
   */
  amount: number;

  /**
   * The invoice line price
   */
  price: number;

  /**
   * The invoice line tax percentage
   */
  taxPercentage: number;

  /**
   * The invoice line created at date
   */
  createdAt: string;

  /**
   * The invoice line updated at date
   */
  updatedAt: string;
}

/**
 * Invoice repository
 */
export interface IInvoiceRepository {
  /**
   * Find entities by a filter
   *
   * @param filter The filter to apply
   * @returns A promise that resolves to an array of entities
   */
  findBy(filter: Partial<Invoice>): Promise<Invoice[]>;

  /**
   * Count entities
   *
   * @param filter Optional filter to apply
   * @returns A promise that resolves to the number of entities
   */
  count(filter?: Partial<Invoice>): Promise<number>;

  /**
   * Check if an entity exists
   *
   * @param id The entity ID
   * @returns A promise that resolves to true if the entity exists
   */
  exists(id: number): Promise<boolean>;

  /**
   * Update an entity
   *
   * @param id The entity ID
   * @param entity The entity data to update
   * @returns A promise that resolves to the updated entity
   */
  update(id: number, entity: Partial<Invoice>): Promise<Invoice>;

  /**
   * Update an entity (legacy method)
   *
   * @param invoice The invoice to update
   * @returns A promise that resolves to the updated invoice
   */
  updateEntity(invoice: Invoice): Promise<Invoice>;
  /**
   * Find all invoices
   *
   * @returns A promise that resolves to an array of invoices
   */
  findAll(): Promise<Invoice[]>;

  /**
   * Find an invoice by ID
   *
   * @param id The invoice ID
   * @returns A promise that resolves to the invoice or null if not found
   */
  findById(id: number): Promise<Invoice | null>;

  /**
   * Find invoices by company ID
   *
   * @param companyId The company ID
   * @returns A promise that resolves to an array of invoices
   */
  findByCompanyId(companyId: number): Promise<Invoice[]>;

  /**
   * Find invoices by status
   *
   * @param status The status
   * @returns A promise that resolves to an array of invoices
   */
  findByStatus(status: string): Promise<Invoice[]>;

  /**
   * Find invoice by Gripp ID
   *
   * @param grippId The Gripp ID
   * @returns A promise that resolves to the invoice or null if not found
   */
  findByGrippId(grippId: number): Promise<Invoice | null>;

  /**
   * Find invoices by date range
   *
   * @param startDate The start date
   * @param endDate The end date
   * @returns A promise that resolves to an array of invoices
   */
  findByDateRange(startDate: Date, endDate: Date): Promise<Invoice[]>;

  /**
   * Create a new invoice
   *
   * @param invoice The invoice to create
   * @returns A promise that resolves to the created invoice
   */
  create(invoice: Invoice): Promise<Invoice>;

  /**
   * Legacy update method (to be removed)
   *
   * @deprecated Use update(id, entity) instead
   * @param invoice The invoice to update
   * @returns A promise that resolves to the updated invoice
   */
  _update?(invoice: Invoice): Promise<Invoice>;

  /**
   * Delete an invoice
   *
   * @param id The invoice ID
   * @returns A promise that resolves to true if the invoice was deleted
   */
  delete(id: number): Promise<boolean>;

  /**
   * Find all invoice lines for an invoice
   *
   * @param invoiceId The invoice ID
   * @returns A promise that resolves to an array of invoice lines
   */
  findInvoiceLines(invoiceId: number): Promise<InvoiceLine[]>;

  /**
   * Find an invoice line by ID
   *
   * @param id The invoice line ID
   * @returns A promise that resolves to the invoice line or null if not found
   */
  findInvoiceLineById(id: number): Promise<InvoiceLine | null>;

  /**
   * Create a new invoice line
   *
   * @param invoiceLine The invoice line to create
   * @returns A promise that resolves to the created invoice line
   */
  createInvoiceLine(invoiceLine: InvoiceLine): Promise<InvoiceLine>;

  /**
   * Update an invoice line
   *
   * @param invoiceLine The invoice line to update
   * @returns A promise that resolves to the updated invoice line
   */
  updateInvoiceLine(invoiceLine: InvoiceLine): Promise<InvoiceLine>;

  /**
   * Delete an invoice line
   *
   * @param id The invoice line ID
   * @returns A promise that resolves to true if the invoice line was deleted
   */
  deleteInvoiceLine(id: number): Promise<boolean>;
}
