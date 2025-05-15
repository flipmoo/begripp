/**
 * Invoice Repository Mock Implementation
 *
 * This class provides a mock implementation of the invoice repository.
 */

import { IInvoiceRepository, Invoice, InvoiceLine } from '../interfaces';

/**
 * Invoice repository mock implementation
 */
export class InvoiceRepository implements IInvoiceRepository {
  /**
   * Find entities by a filter
   *
   * @param filter The filter to apply
   * @returns A promise that resolves to an array of entities
   */
  async findBy(filter: Partial<Invoice>): Promise<Invoice[]> {
    return this.invoices
      .filter(invoice => {
        return Object.entries(filter).every(([key, value]) => {
          // @ts-ignore
          return invoice[key] === value;
        });
      })
      .map(invoice => ({ ...invoice }));
  }

  /**
   * Count entities
   *
   * @param filter Optional filter to apply
   * @returns A promise that resolves to the number of entities
   */
  async count(filter?: Partial<Invoice>): Promise<number> {
    if (!filter || Object.keys(filter).length === 0) {
      return this.invoices.length;
    }

    return this.findBy(filter).then(invoices => invoices.length);
  }

  /**
   * Check if an entity exists
   *
   * @param id The entity ID
   * @returns A promise that resolves to true if the entity exists
   */
  async exists(id: number): Promise<boolean> {
    return this.invoices.some(invoice => invoice.id === id);
  }

  /**
   * Update an entity
   *
   * @param id The entity ID
   * @param entity The entity data to update
   * @returns A promise that resolves to the updated entity
   */
  async update(id: number, entity: Partial<Invoice>): Promise<Invoice> {
    const index = this.invoices.findIndex(invoice => invoice.id === id);

    if (index === -1) {
      throw new Error(`Invoice with ID ${id} not found`);
    }

    const updatedInvoice = {
      ...this.invoices[index],
      ...entity,
      updatedAt: new Date().toISOString()
    };

    this.invoices[index] = updatedInvoice;

    return { ...updatedInvoice };
  }

  /**
   * Update an entity (legacy method)
   *
   * @param invoice The invoice to update
   * @returns A promise that resolves to the updated invoice
   */
  async updateEntity(invoice: Invoice): Promise<Invoice> {
    const index = this.invoices.findIndex(i => i.id === invoice.id);

    if (index === -1) {
      throw new Error(`Invoice with ID ${invoice.id} not found`);
    }

    const updatedInvoice = {
      ...invoice,
      updatedAt: new Date().toISOString()
    };

    this.invoices[index] = updatedInvoice;

    return { ...updatedInvoice };
  }

  /**
   * The invoices - sample data
   */
  private invoices: Invoice[] = [
    {
      id: 1,
      grippId: 2001,
      number: 'INV-2023-001',
      date: '2023-01-15',
      expirydate: '2023-02-15',
      company: 101,
      companyName: 'Example Company A',
      status: 'paid',
      subject: 'Website Development',
      amount: 5000,
      taxAmount: 1050,
      totalAmount: 6050,
      totalOpenInclVat: '0.00',
      isPaid: true,
      isOverdue: false,
      createdAt: '2023-01-15T00:00:00.000Z',
      updatedAt: '2023-01-15T00:00:00.000Z'
    },
    {
      id: 2,
      grippId: 2002,
      number: 'INV-2023-002',
      date: '2023-02-15',
      expirydate: '2023-03-15',
      company: 102,
      companyName: 'Example Company B',
      status: 'unpaid',
      subject: 'Mobile App Development',
      amount: 8000,
      taxAmount: 1680,
      totalAmount: 9680,
      totalOpenInclVat: '9680.00',
      isPaid: false,
      isOverdue: false,
      createdAt: '2023-02-15T00:00:00.000Z',
      updatedAt: '2023-02-15T00:00:00.000Z'
    },
    {
      id: 3,
      grippId: 2003,
      number: 'INV-2023-003',
      date: '2023-03-15',
      expirydate: '2023-04-15',
      company: 103,
      companyName: 'Example Company C',
      status: 'overdue',
      subject: 'UI/UX Design',
      amount: 3000,
      taxAmount: 630,
      totalAmount: 3630,
      totalOpenInclVat: '3630.00',
      isPaid: false,
      isOverdue: true,
      createdAt: '2023-03-15T00:00:00.000Z',
      updatedAt: '2023-03-15T00:00:00.000Z'
    }
  ];

  /**
   * The invoice lines - sample data
   */
  private invoiceLines: InvoiceLine[] = [
    {
      id: 1,
      invoice: 1,
      description: 'Website Development - Frontend',
      amount: 3000,
      taxAmount: 630,
      totalAmount: 3630,
      createdAt: '2023-01-15T00:00:00.000Z',
      updatedAt: '2023-01-15T00:00:00.000Z'
    },
    {
      id: 2,
      invoice: 1,
      description: 'Website Development - Backend',
      amount: 2000,
      taxAmount: 420,
      totalAmount: 2420,
      createdAt: '2023-01-15T00:00:00.000Z',
      updatedAt: '2023-01-15T00:00:00.000Z'
    },
    {
      id: 3,
      invoice: 2,
      description: 'Mobile App Development - iOS',
      amount: 4000,
      taxAmount: 840,
      totalAmount: 4840,
      createdAt: '2023-02-15T00:00:00.000Z',
      updatedAt: '2023-02-15T00:00:00.000Z'
    },
    {
      id: 4,
      invoice: 2,
      description: 'Mobile App Development - Android',
      amount: 4000,
      taxAmount: 840,
      totalAmount: 4840,
      createdAt: '2023-02-15T00:00:00.000Z',
      updatedAt: '2023-02-15T00:00:00.000Z'
    },
    {
      id: 5,
      invoice: 3,
      description: 'UI/UX Design',
      amount: 3000,
      taxAmount: 630,
      totalAmount: 3630,
      createdAt: '2023-03-15T00:00:00.000Z',
      updatedAt: '2023-03-15T00:00:00.000Z'
    }
  ];

  /**
   * Find all invoices
   *
   * @returns A promise that resolves to an array of invoices
   */
  async findAll(): Promise<Invoice[]> {
    return [...this.invoices];
  }

  /**
   * Find an invoice by ID
   *
   * @param id The invoice ID
   * @returns A promise that resolves to the invoice or null if not found
   */
  async findById(id: number): Promise<Invoice | null> {
    const invoice = this.invoices.find(invoice => invoice.id === id);
    return invoice ? { ...invoice } : null;
  }

  /**
   * Find invoices by company ID
   *
   * @param companyId The company ID
   * @returns A promise that resolves to an array of invoices
   */
  async findByCompanyId(companyId: number): Promise<Invoice[]> {
    return this.invoices.filter(invoice => invoice.company === companyId).map(invoice => ({ ...invoice }));
  }

  /**
   * Find invoices by status
   *
   * @param status The status
   * @returns A promise that resolves to an array of invoices
   */
  async findByStatus(status: string): Promise<Invoice[]> {
    return this.invoices.filter(invoice => invoice.status === status).map(invoice => ({ ...invoice }));
  }

  /**
   * Find invoice by Gripp ID
   *
   * @param grippId The Gripp ID
   * @returns A promise that resolves to the invoice or null if not found
   */
  async findByGrippId(grippId: number): Promise<Invoice | null> {
    const invoice = this.invoices.find(invoice => invoice.grippId === grippId);
    return invoice ? { ...invoice } : null;
  }

  /**
   * Find invoices by date range
   *
   * @param startDate The start date
   * @param endDate The end date
   * @returns A promise that resolves to an array of invoices
   */
  async findByDateRange(startDate: Date, endDate: Date): Promise<Invoice[]> {
    return this.invoices
      .filter(invoice => {
        const invoiceDate = new Date(invoice.date);
        return invoiceDate >= startDate && invoiceDate <= endDate;
      })
      .map(invoice => ({ ...invoice }));
  }

  /**
   * Create a new invoice
   *
   * @param invoice The invoice to create
   * @returns A promise that resolves to the created invoice
   */
  async create(invoice: Invoice): Promise<Invoice> {
    const newInvoice = {
      ...invoice,
      id: this.invoices.length > 0 ? Math.max(...this.invoices.map(invoice => invoice.id)) + 1 : 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.invoices.push(newInvoice);

    return { ...newInvoice };
  }

  /**
   * Legacy update method (to be removed)
   *
   * @deprecated Use update(id, entity) instead
   * @param invoice The invoice to update
   * @returns A promise that resolves to the updated invoice
   */
  async _update(invoice: Invoice): Promise<Invoice> {
    return this.updateEntity(invoice);
  }

  /**
   * Delete an invoice
   *
   * @param id The invoice ID
   * @returns A promise that resolves to true if the invoice was deleted
   */
  async delete(id: number): Promise<boolean> {
    const index = this.invoices.findIndex(invoice => invoice.id === id);

    if (index === -1) {
      return false;
    }

    this.invoices.splice(index, 1);

    // Delete invoice lines
    this.invoiceLines = this.invoiceLines.filter(invoiceLine => invoiceLine.invoice !== id);

    return true;
  }

  /**
   * Find all invoice lines for an invoice
   *
   * @param invoiceId The invoice ID
   * @returns A promise that resolves to an array of invoice lines
   */
  async findInvoiceLines(invoiceId: number): Promise<InvoiceLine[]> {
    return this.invoiceLines
      .filter(invoiceLine => invoiceLine.invoice === invoiceId)
      .map(invoiceLine => ({ ...invoiceLine }));
  }

  /**
   * Find an invoice line by ID
   *
   * @param id The invoice line ID
   * @returns A promise that resolves to the invoice line or null if not found
   */
  async findInvoiceLineById(id: number): Promise<InvoiceLine | null> {
    const invoiceLine = this.invoiceLines.find(invoiceLine => invoiceLine.id === id);
    return invoiceLine ? { ...invoiceLine } : null;
  }

  /**
   * Create a new invoice line
   *
   * @param invoiceLine The invoice line to create
   * @returns A promise that resolves to the created invoice line
   */
  async createInvoiceLine(invoiceLine: InvoiceLine): Promise<InvoiceLine> {
    const newInvoiceLine = {
      ...invoiceLine,
      id: this.invoiceLines.length > 0 ? Math.max(...this.invoiceLines.map(invoiceLine => invoiceLine.id)) + 1 : 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.invoiceLines.push(newInvoiceLine);

    return { ...newInvoiceLine };
  }

  /**
   * Update an invoice line
   *
   * @param invoiceLine The invoice line to update
   * @returns A promise that resolves to the updated invoice line
   */
  async updateInvoiceLine(invoiceLine: InvoiceLine): Promise<InvoiceLine> {
    const index = this.invoiceLines.findIndex(i => i.id === invoiceLine.id);

    if (index === -1) {
      throw new Error(`Invoice line with ID ${invoiceLine.id} not found`);
    }

    const updatedInvoiceLine = {
      ...invoiceLine,
      updatedAt: new Date().toISOString()
    };

    this.invoiceLines[index] = updatedInvoiceLine;

    return { ...updatedInvoiceLine };
  }

  /**
   * Delete an invoice line
   *
   * @param id The invoice line ID
   * @returns A promise that resolves to true if the invoice line was deleted
   */
  async deleteInvoiceLine(id: number): Promise<boolean> {
    const index = this.invoiceLines.findIndex(invoiceLine => invoiceLine.id === id);

    if (index === -1) {
      return false;
    }

    this.invoiceLines.splice(index, 1);

    return true;
  }
}
