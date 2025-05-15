/**
 * Gripp Synchronization Service
 *
 * This file provides a service for synchronizing data from Gripp.
 */

import { Database } from 'sqlite';
import { GrippApiClient } from './client';
import { GrippEmployee, GrippHour, GrippInvoice, GrippInvoiceLine, GrippProject, GrippProjectLine, GrippAbsence, GrippAbsenceLine } from './interfaces';
import { createUnitOfWork } from '../../unit-of-work';
import { IUnitOfWork } from '../../interfaces';
import { getDatabase } from '../../database';
import axios from 'axios';

/**
 * Gripp synchronization service
 */
export class GrippSyncService {
  /**
   * The Gripp API client
   */
  private client: GrippApiClient;

  /**
   * The database connection
   */
  private db?: Database;

  /**
   * The unit of work
   */
  private unitOfWork?: IUnitOfWork;

  /**
   * Constructor
   *
   * @param client The Gripp API client
   * @param db The database connection
   */
  constructor(client: GrippApiClient, db?: Database) {
    this.client = client;
    this.db = db;
  }

  /**
   * Initialize the service
   *
   * @returns A promise that resolves when the service has been initialized
   */
  async initialize(): Promise<void> {
    if (!this.db) {
      this.db = await getDatabase();
    }

    this.unitOfWork = await createUnitOfWork(this.db);
  }

  /**
   * Synchronize all data
   *
   * @param isIncremental Whether to perform an incremental synchronization
   * @returns A promise that resolves when the synchronization has completed
   */
  async syncAll(isIncremental: boolean = true): Promise<void> {
    await this.initialize();

    try {
      // Begin transaction
      await this.unitOfWork?.beginTransaction();

      // Sync projects
      await this.syncProjects(isIncremental);

      // Sync employees
      await this.syncEmployees(isIncremental);

      // Sync hours
      await this.syncHours(isIncremental);

      // Sync invoices
      await this.syncInvoices(isIncremental);

      // Sync absences
      await this.syncAbsences(isIncremental);

      // Commit transaction
      await this.unitOfWork?.commitTransaction();
    } catch (error) {
      // Rollback transaction
      await this.unitOfWork?.rollbackTransaction();

      console.error('Error synchronizing data:', error);
      throw error;
    }
  }

  /**
   * Synchronize projects
   *
   * @param isIncremental Whether to perform an incremental synchronization
   * @returns A promise that resolves when the synchronization has completed
   */
  async syncProjects(isIncremental: boolean = true): Promise<void> {
    if (!this.unitOfWork) {
      throw new Error('Unit of work not initialized');
    }

    try {
      // Get last sync time
      const syncStatus = await this.unitOfWork.syncStatusRepository.findByEntity('projects');
      const lastSyncTime = isIncremental && syncStatus?.lastSyncTime ? new Date(syncStatus.lastSyncTime) : undefined;

      // Update sync status
      await this.unitOfWork.syncStatusRepository.updateLastSyncTime('projects', new Date(), isIncremental, 0, 'in_progress');

      // Get projects from Gripp
      const params: Record<string, unknown> = {};

      if (lastSyncTime) {
        params.updated_after = lastSyncTime.toISOString();
      }

      // Use the correct method for projects: 'project.get' instead of 'projects'
      const filters = [];

      if (lastSyncTime) {
        filters.push({
          field: 'project.updatedon',
          operator: 'greaterequals',
          value: lastSyncTime.toISOString()
        });
      }

      const response = await this.client.query<GrippProject[]>('project.get', 'POST', filters, {
        paging: {
          firstresult: 0,
          maxresults: 250
        },
        orderings: [
          {
            field: 'project.updatedon',
            direction: 'desc'
          }
        ]
      });
      const projects = response.data || [];

      // Process projects
      let count = 0;

      for (const grippProject of projects) {
        // Convert Gripp project to our project model
        const project = {
          id: grippProject.id,
          name: grippProject.name,
          number: grippProject.number,
          archived: grippProject.archived,
          createdAt: grippProject.created_at,
          updatedAt: grippProject.updated_at,
          projectLines: JSON.stringify(grippProject.projectlines || []),
          tags: JSON.stringify(grippProject.tags || [])
        };

        // Check if project exists
        const existingProject = await this.unitOfWork.projectRepository.findById(project.id);

        if (existingProject) {
          // Update project
          await this.unitOfWork.projectRepository.update(project);
        } else {
          // Create project
          await this.unitOfWork.projectRepository.create(project);
        }

        // Sync project lines
        await this.syncProjectLines(grippProject.id, isIncremental);

        count++;
      }

      // Update sync status
      await this.unitOfWork.syncStatusRepository.updateLastSyncTime('projects', new Date(), isIncremental, count, 'success');
    } catch (error) {
      // Update sync status
      await this.unitOfWork.syncStatusRepository.updateLastSyncTime('projects', new Date(), isIncremental, 0, 'error', (error as Error).message);

      console.error('Error synchronizing projects:', error);
      throw error;
    }
  }

  /**
   * Synchronize project lines
   *
   * @param projectId The project ID
   * @param isIncremental Whether to perform an incremental synchronization
   * @returns A promise that resolves when the synchronization has completed
   */
  async syncProjectLines(projectId: number, isIncremental: boolean = true): Promise<void> {
    if (!this.unitOfWork) {
      throw new Error('Unit of work not initialized');
    }

    try {
      // Get project lines from Gripp using the project data
      // The project lines are already included in the project data
      // So we don't need to make a separate API call

      // For now, we'll just use the project lines from the database
      const projectLines = await this.unitOfWork.projectRepository.findProjectLines(projectId);

      // If there are no project lines, we'll just return
      if (!projectLines || projectLines.length === 0) {
        console.log(`No project lines found for project ${projectId}`);
        return;
      }

      console.log(`Found ${projectLines.length} project lines for project ${projectId}`);
    } catch (error) {
      console.error(`Error synchronizing project lines for project ${projectId}:`, error);
      // Don't throw the error, just log it
      // This way, the synchronization can continue with other projects
    }
  }

  /**
   * Synchronize employees
   *
   * @param isIncremental Whether to perform an incremental synchronization
   * @returns A promise that resolves when the synchronization has completed
   */
  async syncEmployees(isIncremental: boolean = true): Promise<void> {
    if (!this.unitOfWork) {
      throw new Error('Unit of work not initialized');
    }

    try {
      // Get last sync time
      const syncStatus = await this.unitOfWork.syncStatusRepository.findByEntity('employees');
      const lastSyncTime = isIncremental && syncStatus?.lastSyncTime ? new Date(syncStatus.lastSyncTime) : undefined;

      // Update sync status
      await this.unitOfWork.syncStatusRepository.updateLastSyncTime('employees', new Date(), isIncremental, 0, 'in_progress');

      // Get employees from Gripp
      const params: Record<string, unknown> = {};

      if (lastSyncTime) {
        params.updated_after = lastSyncTime.toISOString();
      }

      // Use the correct method for employees: 'employee.get' instead of 'employees'
      const filters = [];

      if (lastSyncTime) {
        filters.push({
          field: 'employee.updatedon',
          operator: 'greaterequals',
          value: lastSyncTime.toISOString()
        });
      }

      const response = await this.client.query<GrippEmployee[]>('employee.get', 'POST', filters, {
        paging: {
          firstresult: 0,
          maxresults: 250
        },
        orderings: [
          {
            field: 'employee.updatedon',
            direction: 'desc'
          }
        ]
      });
      const employees = response.data || [];

      // Process employees
      let count = 0;

      for (const grippEmployee of employees) {
        // Convert Gripp employee to our employee model
        const employee = {
          id: grippEmployee.id,
          firstname: grippEmployee.firstname,
          lastname: grippEmployee.lastname,
          email: grippEmployee.email,
          function: grippEmployee.function || '',
          active: grippEmployee.active,
          createdAt: grippEmployee.created_at,
          updatedAt: grippEmployee.updated_at
        };

        // Check if employee exists
        const existingEmployee = await this.unitOfWork.employeeRepository.findById(employee.id);

        if (existingEmployee) {
          // Update employee
          await this.unitOfWork.employeeRepository.update(employee);
        } else {
          // Create employee
          await this.unitOfWork.employeeRepository.create(employee);
        }

        count++;
      }

      // Update sync status
      await this.unitOfWork.syncStatusRepository.updateLastSyncTime('employees', new Date(), isIncremental, count, 'success');
    } catch (error) {
      // Update sync status
      await this.unitOfWork.syncStatusRepository.updateLastSyncTime('employees', new Date(), isIncremental, 0, 'error', (error as Error).message);

      console.error('Error synchronizing employees:', error);
      throw error;
    }
  }

  /**
   * Synchronize hours
   *
   * @param isIncremental Whether to perform an incremental synchronization
   * @returns A promise that resolves when the synchronization has completed
   */
  async syncHours(isIncremental: boolean = true): Promise<void> {
    if (!this.unitOfWork) {
      throw new Error('Unit of work not initialized');
    }

    try {
      // Get last sync time
      const syncStatus = await this.unitOfWork.syncStatusRepository.findByEntity('hours');
      const lastSyncTime = isIncremental && syncStatus?.lastSyncTime ? new Date(syncStatus.lastSyncTime) : undefined;

      // Update sync status
      await this.unitOfWork.syncStatusRepository.updateLastSyncTime('hours', new Date(), isIncremental, 0, 'in_progress');

      // Get hours from Gripp
      const params: Record<string, unknown> = {};

      if (lastSyncTime) {
        params.updated_after = lastSyncTime.toISOString();
      }

      // Use the correct method for hours: 'hour.get' instead of 'hours'
      const filters = [];

      if (lastSyncTime) {
        filters.push({
          field: 'hour.updatedon',
          operator: 'greaterequals',
          value: lastSyncTime.toISOString()
        });
      }

      const response = await this.client.query<GrippHour[]>('hour.get', 'POST', filters, {
        paging: {
          firstresult: 0,
          maxresults: 250
        },
        orderings: [
          {
            field: 'hour.updatedon',
            direction: 'desc'
          }
        ]
      });
      const hours = response.data || [];

      // Process hours
      let count = 0;

      for (const grippHour of hours) {
        // Convert Gripp hour to our hour model
        const hour = {
          id: grippHour.id,
          employee: grippHour.employee_id,
          project: grippHour.project_id,
          projectline: grippHour.projectline_id,
          date: grippHour.date,
          amount: grippHour.amount,
          description: grippHour.description || '',
          status: grippHour.status,
          createdAt: grippHour.created_at,
          updatedAt: grippHour.updated_at
        };

        // Check if hour exists
        const existingHour = await this.unitOfWork.hourRepository.findById(hour.id);

        if (existingHour) {
          // Update hour
          await this.unitOfWork.hourRepository.update(hour);
        } else {
          // Create hour
          await this.unitOfWork.hourRepository.create(hour);
        }

        count++;
      }

      // Update sync status
      await this.unitOfWork.syncStatusRepository.updateLastSyncTime('hours', new Date(), isIncremental, count, 'success');
    } catch (error) {
      // Update sync status
      await this.unitOfWork.syncStatusRepository.updateLastSyncTime('hours', new Date(), isIncremental, 0, 'error', (error as Error).message);

      console.error('Error synchronizing hours:', error);
      throw error;
    }
  }

  /**
   * Synchronize invoices
   *
   * @param isIncremental Whether to perform an incremental synchronization
   * @returns A promise that resolves when the synchronization has completed
   */
  async syncInvoices(isIncremental: boolean = true): Promise<void> {
    if (!this.unitOfWork) {
      throw new Error('Unit of work not initialized');
    }

    try {
      // Get last sync time
      const syncStatus = await this.unitOfWork.syncStatusRepository.findByEntity('invoices');
      const lastSyncTime = isIncremental && syncStatus?.lastSyncTime ? new Date(syncStatus.lastSyncTime) : undefined;

      // Update sync status
      await this.unitOfWork.syncStatusRepository.updateLastSyncTime('invoices', new Date(), isIncremental, 0, 'in_progress');

      // Get invoices from Gripp
      const params: Record<string, unknown> = {};

      if (lastSyncTime) {
        params.updated_after = lastSyncTime.toISOString();
      }

      // Use the correct method for invoices: 'invoice.get' instead of 'invoices'
      // For invoices, we always want to get all invoices, regardless of the last sync time
      // This ensures we have the most up-to-date payment status for all invoices
      const filters = [];

      // We don't use the lastSyncTime filter for invoices to ensure we get all invoices
      // This is important because payment status can change for any invoice at any time
      // Comment out the filter to get all invoices
      /*
      if (lastSyncTime) {
        filters.push({
          field: 'invoice.updatedon',
          operator: 'greaterequals',
          value: lastSyncTime.toISOString()
        });
      }
      */

      // Get all invoices using pagination
      let allInvoices: GrippInvoice[] = [];
      let currentPage = 0;
      const pageSize = 250; // Maximum allowed by the API
      let hasMoreResults = true;
      let maxPages = 100; // Safety limit to prevent infinite loops - should be enough for ~25,000 invoices
      let totalRetries = 0;
      const maxRetries = 3; // Maximum retries per page

      console.log('Fetching all invoices from Gripp API');

      while (hasMoreResults && currentPage < maxPages) {
        const firstResult = currentPage * pageSize;
        console.log(`Fetching invoices page ${currentPage + 1} (${firstResult} to ${firstResult + pageSize})`);

        let retryCount = 0;
        let success = false;

        // Retry logic for each page
        while (!success && retryCount < maxRetries) {
          try {
            // Use direct axios call to ensure we get the correct response
            console.log(`Making direct API call to Gripp API for invoices (attempt ${retryCount + 1})...`);
            const directResponse = await axios.post('https://api.gripp.com/public/api3.php',
              [{
                method: 'invoice.get',
                params: [
                  filters,
                  {
                    paging: {
                      firstresult: firstResult,
                      maxresults: pageSize
                    },
                    orderings: [
                      {
                        field: 'invoice.date',
                        direction: 'desc'
                      }
                    ]
                  }
                ],
                id: Date.now()
              }],
              {
                headers: {
                  'Authorization': `Bearer mi3Pq0Pfw6CtuFAtEoQ6gXIT7cra2c`,
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                timeout: 30000 // 30 second timeout
              }
            );

            console.log('Direct API response status:', directResponse.status);

            // Check if we have a valid response
            if (!directResponse.data || !directResponse.data[0] || !directResponse.data[0].result) {
              throw new Error('Invalid response format from Gripp API');
            }

            // Extract the response data
            const responseData = directResponse.data[0];

            // Check if we have more items in the collection
            const moreItemsInCollection = responseData.result.more_items_in_collection === true;
            console.log(`More items in collection: ${moreItemsInCollection}`);

            const response = {
              data: responseData.result.rows || []
            };

            const invoices = response.data || [];
            console.log(`Received ${invoices.length} invoices for page ${currentPage + 1}`);

            if (!invoices || invoices.length === 0) {
              console.log('No more invoices found or end of results reached');
              hasMoreResults = false;
              break;
            }

            // Add invoices from this page to our collection
            allInvoices = [...allInvoices, ...invoices];

            // If we received fewer results than the page size, we've reached the end
            // OR if the API explicitly tells us there are no more items
            if (invoices.length < pageSize || !moreItemsInCollection) {
              console.log(`End of results reached: received ${invoices.length} invoices (less than page size ${pageSize} or API indicated no more items)`);
              hasMoreResults = false;
            } else {
              currentPage++;
              console.log(`Moving to next page: ${currentPage + 1}`);
            }

            // Mark this attempt as successful
            success = true;

          } catch (error) {
            retryCount++;
            totalRetries++;

            console.error(`Error fetching invoices page ${currentPage + 1} (attempt ${retryCount}):`, error);

            if (retryCount >= maxRetries) {
              console.error(`Maximum retries (${maxRetries}) reached for page ${currentPage + 1}, moving to next page`);
              currentPage++;
            } else {
              // Wait before retrying (exponential backoff)
              const waitTime = 2000 * Math.pow(2, retryCount - 1);
              console.log(`Waiting ${waitTime}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            // If we've had too many total errors, stop
            if (totalRetries > maxRetries * 5) {
              console.error(`Too many total errors (${totalRetries}), stopping invoice fetch`);
              hasMoreResults = false;
            }
          }
        }
      }

      console.log(`Total invoices fetched: ${allInvoices.length}`);

      // Process invoices
      let count = 0;

      // Find all existing invoices once to avoid repeated database queries
      console.log('Finding all invoices...');
      const existingInvoices = await this.unitOfWork.invoiceRepository.findAll();
      console.log(`Found ${existingInvoices.length} invoices in database`);

      for (const grippInvoice of allInvoices) {
        try {
          // Convert Gripp invoice to our invoice model
          // Handle the different format of the Gripp API response

          // Calculate if invoice is paid
          const totalAmount = parseFloat(grippInvoice.totalinclvat || '0');
          const paidAmount = parseFloat(grippInvoice.totalpayed || '0');

          // Use totalopeninclvat if available, otherwise calculate from total and paid amount
          let openAmount = 0;
          if (grippInvoice.totalopeninclvat !== undefined) {
            openAmount = parseFloat(grippInvoice.totalopeninclvat || '0');
            console.log(`Invoice ${grippInvoice.number}: Using totalopeninclvat: ${openAmount}`);
          } else {
            openAmount = totalAmount - paidAmount;
            console.log(`Invoice ${grippInvoice.number}: Calculated open amount: ${openAmount}`);
          }

          // An invoice is considered paid if the open amount is zero or very close to zero
          // We don't check if paidAmount > 0 because some invoices might be marked as paid with zero payment
          // (e.g. if they are cancelled or written off)
          const isPaid = Math.abs(openAmount) < 0.01; // Allow for small rounding differences

          // Check if invoice is overdue
          const today = new Date();
          const expiryDate = new Date(grippInvoice.expirydate?.date || today);
          const isOverdue = !isPaid && expiryDate < today;

          // Determine calculated status
          const calculatedStatus = isPaid ? 'paid' : (isOverdue ? 'overdue' : 'unpaid');

          // Get original Gripp status
          const grippStatus = grippInvoice.status?.searchname?.toLowerCase() || 'unknown';

          // Get invoice date
          const invoiceDate = grippInvoice.date?.date?.split(' ')[0] || new Date().toISOString().split('T')[0];

          // Calculate due date based on payment terms if expirydate is not provided
          let dueDate = grippInvoice.expirydate?.date?.split(' ')[0];

          // If no expiry date is provided, calculate it based on payment terms (default to 30 days)
          if (!dueDate) {
            const paymentTermDays = grippInvoice.paymentterm?.days || 30;
            const invoiceDateObj = new Date(invoiceDate);
            invoiceDateObj.setDate(invoiceDateObj.getDate() + paymentTermDays);
            dueDate = invoiceDateObj.toISOString().split('T')[0];
            console.log(`Invoice ${grippInvoice.number}: Calculated due date ${dueDate} based on payment terms (${paymentTermDays} days)`);
          }

          // Generate a fallback invoice number if none is provided
          let invoiceNumber = grippInvoice.number?.toString();
          if (!invoiceNumber) {
            // Use the Gripp ID as a fallback
            invoiceNumber = `GRIPP-${grippInvoice.id}`;
            console.log(`Invoice with Gripp ID ${grippInvoice.id} has no number, using ${invoiceNumber} as fallback`);
          }

          // Parse totalincldiscountexclvat to get the amount excluding VAT
          console.log(`Invoice ${invoiceNumber}: Raw Gripp invoice data:`, JSON.stringify(grippInvoice, null, 2));

          // Check all possible field names for the totalExclVat value
          let totalExclVatValue = grippInvoice.totalincldiscountexclvat ||
                                 grippInvoice.totalExclVat ||
                                 grippInvoice.totalexclvat ||
                                 grippInvoice.totalincldiscountexclvat ||
                                 '0';

          console.log(`Invoice ${invoiceNumber}: totalExclVatValue = ${totalExclVatValue}`);
          const totalExclVat = parseFloat(totalExclVatValue);
          console.log(`Invoice ${invoiceNumber}: parsed totalExclVat = ${totalExclVat}`);

          const invoice = {
            grippId: grippInvoice.id,
            number: invoiceNumber,
            date: invoiceDate,
            dueDate: dueDate,
            due_date: dueDate,
            company: grippInvoice.company?.id || 0,
            company_id: grippInvoice.company?.id || 0,
            company_name: grippInvoice.company?.searchname || '',
            totalAmount: totalAmount,
            totalInclVat: totalAmount,
            totalExclVat: totalExclVat, // Add totalExclVat field
            status: calculatedStatus, // Use calculated status instead of Gripp status
            subject: grippInvoice.subject || '', // Onderwerp van de factuur
            isPaid: isPaid ? 1 : 0,
            isOverdue: isOverdue ? 1 : 0,
            createdAt: grippInvoice.createdon?.date || new Date().toISOString(),
            updatedAt: grippInvoice.updatedon?.date || new Date().toISOString()
          };

          // Check if invoice exists by number
          const existingInvoice = existingInvoices.find(inv => inv.number === invoice.number);

          if (existingInvoice) {
            // Update invoice
            invoice.id = existingInvoice.id;
            await this.unitOfWork.invoiceRepository.update(invoice);
          } else {
            // Create invoice
            const invoiceId = await this.unitOfWork.invoiceRepository.create(invoice);
            invoice.id = invoiceId;
          }

          // Sync invoice lines
          await this.syncInvoiceLines(grippInvoice.id, grippInvoice.invoicelines);

          count++;

          // Log progress every 50 invoices
          if (count % 50 === 0) {
            console.log(`Processed ${count}/${allInvoices.length} invoices`);
          }
        } catch (error) {
          console.error(`Error processing invoice ${grippInvoice.id}:`, error);
          // Continue with the next invoice
        }
      }

      console.log(`Successfully processed ${count} invoices`);

      // Update sync status
      await this.unitOfWork.syncStatusRepository.updateLastSyncTime('invoices', new Date(), isIncremental, count, 'success');
    } catch (error) {
      // Update sync status
      await this.unitOfWork.syncStatusRepository.updateLastSyncTime('invoices', new Date(), isIncremental, 0, 'error', (error as Error).message);

      console.error('Error synchronizing invoices:', error);
      throw error;
    }
  }

  /**
   * Synchronize invoice lines
   *
   * @param grippInvoiceId The Gripp invoice ID
   * @param invoiceLines The invoice lines
   * @returns A promise that resolves when the synchronization has completed
   */
  async syncInvoiceLines(grippInvoiceId: number, invoiceLines?: GrippInvoiceLine[]): Promise<void> {
    if (!this.unitOfWork) {
      throw new Error('Unit of work not initialized');
    }

    try {
      // Find the invoice by number
      const invoices = await this.unitOfWork.invoiceRepository.findAll();
      const invoice = invoices.find(inv => inv.number === grippInvoiceId.toString());

      if (!invoice) {
        console.error(`Invoice with Gripp ID ${grippInvoiceId} not found`);
        return;
      }

      const invoiceId = invoice.id;

      // Get invoice lines from Gripp if not provided
      let lines = invoiceLines;

      if (!lines) {
        // Use the correct method for invoice lines: 'invoiceline.get' instead of 'invoices/{id}/lines'
        const response = await this.client.query<GrippInvoiceLine[]>('invoiceline.get', 'POST',
          [
            {
              field: 'invoiceline.invoice',
              operator: 'equals',
              value: grippInvoiceId
            }
          ],
          {
            paging: {
              firstresult: 0,
              maxresults: 250,
            }
          }
        );
        lines = response.data || [];
      }

      if (!lines || lines.length === 0) {
        return;
      }

      // Get existing invoice lines
      const existingLines = await this.unitOfWork.invoiceLineRepository.findByInvoiceId(invoiceId);

      // Delete existing invoice lines
      await this.unitOfWork.invoiceLineRepository.deleteByInvoiceId(invoiceId);

      // Process invoice lines
      for (const grippInvoiceLine of lines) {
        // Convert Gripp invoice line to our invoice line model
        const invoiceLine = {
          id: grippInvoiceLine.id,
          invoice: invoiceId,
          description: grippInvoiceLine.description || '',
          amount: parseFloat(grippInvoiceLine.amount || '0'),
          price: parseFloat(grippInvoiceLine.sellingprice || '0'),
          taxPercentage: grippInvoiceLine.vat?.searchname?.replace(/[^0-9.]/g, '') || '0',
          createdAt: grippInvoiceLine.createdon?.date || new Date().toISOString(),
          updatedAt: grippInvoiceLine.updatedon?.date || new Date().toISOString()
        };

        // Create invoice line
        await this.unitOfWork.invoiceLineRepository.create(invoiceLine);
      }
    } catch (error) {
      console.error(`Error synchronizing invoice lines for invoice ${invoiceId}:`, error);
      throw error;
    }
  }

  /**
   * Synchronize absences
   *
   * @param isIncremental Whether to perform an incremental synchronization
   * @returns A promise that resolves when the synchronization has completed
   */
  async syncAbsences(isIncremental: boolean = true): Promise<void> {
    if (!this.unitOfWork) {
      throw new Error('Unit of work not initialized');
    }

    try {
      // Get last sync time
      const syncStatus = await this.unitOfWork.syncStatusRepository.findByEntity('absences');
      const lastSyncTime = isIncremental && syncStatus?.lastSyncTime ? new Date(syncStatus.lastSyncTime) : undefined;

      // Update sync status
      await this.unitOfWork.syncStatusRepository.updateLastSyncTime('absences', new Date(), isIncremental, 0, 'in_progress');

      // Get absences from Gripp
      const filters = [];

      if (lastSyncTime) {
        filters.push({
          field: 'absencerequest.updatedon',
          operator: 'greaterequals',
          value: lastSyncTime.toISOString()
        });
      }

      const response = await this.client.query<GrippAbsence[]>('absencerequest.get', 'POST', filters, {
        paging: {
          firstresult: 0,
          maxresults: 250
        },
        orderings: [
          {
            field: 'absencerequest.updatedon',
            direction: 'desc'
          }
        ]
      });
      const absences = response.data || [];

      // Process absences
      let count = 0;

      for (const grippAbsence of absences) {
        // Convert Gripp absence to our absence request model
        const absenceRequest = {
          id: grippAbsence.id,
          employee_id: grippAbsence.employee?.id || 0,
          absencetype_id: grippAbsence.absencetype?.id || 0,
          description: grippAbsence.description || '',
          comment: grippAbsence.comment || '',
          status_id: grippAbsence.status?.id || 0,
          created_at: grippAbsence.createdon?.date || new Date().toISOString(),
          updated_at: grippAbsence.updatedon?.date || new Date().toISOString(),
          extendedproperties: JSON.stringify(grippAbsence)
        };

        // Check if absence request exists
        const existingAbsenceRequest = await this.unitOfWork.absenceRequestRepository.findById(absenceRequest.id);

        if (existingAbsenceRequest) {
          // Update absence request
          await this.unitOfWork.absenceRequestRepository.update(absenceRequest);
        } else {
          // Create absence request
          await this.unitOfWork.absenceRequestRepository.create(absenceRequest);
        }

        // Process absence request lines
        if (grippAbsence.absencerequestline && Array.isArray(grippAbsence.absencerequestline)) {
          // Delete existing absence request lines
          await this.unitOfWork.absenceRequestLineRepository.deleteByAbsenceRequestId(absenceRequest.id);

          for (const line of grippAbsence.absencerequestline) {
            const absenceRequestLine = {
              id: line.id,
              absencerequest_id: absenceRequest.id,
              date: line.date?.date?.split(' ')[0] || new Date().toISOString().split('T')[0],
              amount: parseFloat(line.amount || '0'),
              status_id: line.absencerequeststatus?.id || 0,
              status_name: line.absencerequeststatus?.searchname || '',
              created_at: line.createdon?.date || new Date().toISOString(),
              updated_at: line.updatedon?.date || new Date().toISOString()
            };

            // Create absence request line
            await this.unitOfWork.absenceRequestLineRepository.create(absenceRequestLine);
          }
        }

        count++;
      }

      // Update sync status
      await this.unitOfWork.syncStatusRepository.updateLastSyncTime('absences', new Date(), isIncremental, count, 'success');
    } catch (error) {
      // Update sync status
      await this.unitOfWork.syncStatusRepository.updateLastSyncTime('absences', new Date(), isIncremental, 0, 'error', (error as Error).message);

      console.error('Error synchronizing absences:', error);
      throw error;
    }
  }
}
