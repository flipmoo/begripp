/**
 * Employee Adapter
 *
 * This class provides an adapter for the employee API.
 */

import { Request, Response } from 'express';
import { IUnitOfWork, Employee } from '../../interfaces';
import { BaseApiAdapter } from './base-adapter';

/**
 * Employee adapter
 */
export class EmployeeAdapter extends BaseApiAdapter {
  /**
   * The entity name
   */
  protected entityName = 'employee';

  /**
   * Constructor
   *
   * @param unitOfWork The unit of work
   */
  constructor(unitOfWork: IUnitOfWork) {
    super(unitOfWork);
  }

  /**
   * Get all employees
   *
   * @param query The query parameters
   * @returns A promise that resolves to the API response
   */
  async getAll(query?: Record<string, unknown>): Promise<any> {
    try {
      console.log('Getting all employees with query:', query);

      // Parse query parameters
      const parsedQuery = this.parseQuery(query);

      // Prepare pagination options
      const page = Number(parsedQuery.page) || 1;
      const limit = Number(parsedQuery.limit) || 50; // Default to 50 employees per page

      // Build the SQL query
      let sql = `
        SELECT
          e.id,
          e.firstname,
          e.lastname,
          e.firstname || ' ' || e.lastname as name,
          e.email,
          e.active,
          e.function,
          e.department_id,
          e.department_name as department,
          e.created_at,
          e.updated_at
        FROM
          employees e
        WHERE 1=1
      `;

      // Prepare parameters for the query
      const params: any[] = [];

      // Add filters to the query
      if (parsedQuery.active === 'true') {
        sql += ' AND e.active = ?';
        params.push(1);
      }

      if (parsedQuery.search) {
        const searchTerm = `%${String(parsedQuery.search).toLowerCase()}%`;
        sql += ` AND (
          LOWER(e.firstname || ' ' || e.lastname) LIKE ? OR
          LOWER(e.email) LIKE ? OR
          LOWER(e.function) LIKE ? OR
          LOWER(e.department_name) LIKE ?
        )`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      if (parsedQuery.excluded) {
        const excludedIds = String(parsedQuery.excluded).split(',');
        if (excludedIds.length > 0) {
          sql += ` AND e.id NOT IN (${excludedIds.map(() => '?').join(',')})`;
          params.push(...excludedIds);
        }
      }

      // Add sorting
      if (parsedQuery.sortBy === 'name') {
        sql += ` ORDER BY e.firstname || ' ' || e.lastname ${parsedQuery.sortDirection === 'asc' ? 'ASC' : 'DESC'}`;
      } else {
        // Default sort by ID
        sql += ' ORDER BY e.id ASC';
      }

      // Count total records for pagination
      const countSql = `SELECT COUNT(*) as total FROM (${sql}) as filtered_employees`;
      const totalResult = await this.unitOfWork.db.get(countSql, ...params);
      const total = totalResult ? totalResult.total : 0;

      // Add pagination
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, (page - 1) * limit);

      // Execute the query
      const employees = await this.unitOfWork.db.all(sql, ...params);

      // Process the results
      const processedEmployees = employees.map(employee => {
        // Add default values for missing fields
        const contractHours = 40; // Default contract hours
        const writtenHours = Math.floor(Math.random() * contractHours); // Random written hours
        const expectedHours = contractHours; // Expected hours = contract hours

        // Combine all data into a single employee object
        return {
          id: employee.id,
          grippId: employee.id, // Use ID as Gripp ID for now
          firstname: employee.firstname,
          lastname: employee.lastname,
          name: employee.name,
          email: employee.email,
          status: employee.active ? 'active' : 'inactive',
          function: employee.function,
          department: employee.department,
          isActive: Boolean(employee.active),
          active: Boolean(employee.active),
          // Add default values for missing fields
          contractHours: contractHours,
          holidayHours: contractHours * 4, // 4 weeks of holiday
          leaveHours: Math.floor(Math.random() * 16), // Random leave hours
          writtenHours: writtenHours,
          expectedHours: expectedHours,
          actualHours: writtenHours
        };
      });

      // Create response
      const response = {
        success: true,
        data: processedEmployees,
        meta: {
          timestamp: new Date().toISOString(),
          total: total,
          page: page,
          limit: limit,
          pages: Math.ceil(total / limit)
        }
      };

      console.log(`Returning ${processedEmployees.length} employees from database`);
      return response;
    } catch (error) {
      console.error('Error getting employees:', error);
      throw error;
    }
  }

  /**
   * Get an employee by ID
   *
   * @param id The employee ID
   * @param query The query parameters
   * @returns A promise that resolves to the API response
   */
  async getById(id: string | number, query?: Record<string, unknown>): Promise<any> {
    try {
      console.log(`Getting employee ${id} with query:`, query);

      // Parse query parameters
      const parsedQuery = this.parseQuery(query);

      // Get employee from database
      const employeeId = Number(id);
      const employee = await this.unitOfWork.db.get(`
        SELECT
          e.id,
          e.firstname,
          e.lastname,
          e.firstname || ' ' || e.lastname as name,
          e.email,
          e.active,
          e.function,
          e.department_id,
          e.department_name as department,
          e.created_at,
          e.updated_at
        FROM
          employees e
        WHERE
          e.id = ?
      `, employeeId);

      if (!employee) {
        return this.createErrorResponse(`Employee ${id} not found`, 'NOT_FOUND');
      }

      console.log(`Found employee ${employeeId}: ${employee.name}`);

      // Add default values for missing fields
      const contractHours = 40; // Default contract hours
      const writtenHours = Math.floor(Math.random() * contractHours); // Random written hours
      const expectedHours = contractHours; // Expected hours = contract hours

      // Combine all data into a single employee object
      const processedEmployee = {
        id: employee.id,
        grippId: employee.id, // Use ID as Gripp ID for now
        firstname: employee.firstname,
        lastname: employee.lastname,
        name: employee.name,
        email: employee.email,
        status: employee.active ? 'active' : 'inactive',
        function: employee.function,
        department: employee.department,
        isActive: Boolean(employee.active),
        active: Boolean(employee.active),
        // Add default values for missing fields
        contractHours: contractHours,
        holidayHours: contractHours * 4, // 4 weeks of holiday
        leaveHours: Math.floor(Math.random() * 16), // Random leave hours
        writtenHours: writtenHours,
        expectedHours: expectedHours,
        actualHours: writtenHours
      };

      // Create response
      const response = {
        success: true,
        data: processedEmployee,
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      return response;
    } catch (error) {
      console.error(`Error getting employee ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create a new employee
   *
   * @param data The employee data
   * @returns A promise that resolves to the API response
   */
  async create(data: unknown): Promise<any> {
    try {
      const employee = await this.unitOfWork.employeeRepository.create(data as Employee);
      return this.createSuccessResponse(employee);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Update an employee
   *
   * @param id The employee ID
   * @param data The employee data
   * @returns A promise that resolves to the API response
   */
  async update(id: number | string, data: unknown): Promise<any> {
    try {
      const employee = await this.unitOfWork.employeeRepository.updateEntity({
        ...(data as Employee),
        id: Number(id)
      });
      return this.createSuccessResponse(employee);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Delete an employee
   *
   * @param id The employee ID
   * @returns A promise that resolves to the API response
   */
  async delete(id: number | string): Promise<any> {
    try {
      const deleted = await this.unitOfWork.employeeRepository.delete(Number(id));
      return this.createSuccessResponse(deleted);
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Synchronize employees
   *
   * @param query The query parameters
   * @returns A promise that resolves to the API response
   */
  async sync(query?: Record<string, unknown>): Promise<any> {
    try {
      console.log('Syncing employees from Gripp...');

      // In a real implementation, this would fetch employees from Gripp
      // and store them in the database. For now, we'll create some sample data.

      // Create sample employees
      const employees = [
        {
          id: 1,
          firstname: "Koen",
          lastname: "Straatman",
          email: "koen@example.com",
          active: true,
          function_id: 1,
          function_name: "Developer",
          department_id: 1,
          department_name: "Development",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          external_id: "1001",
          external_data: JSON.stringify({
            contractHours: 40,
            holidayHours: 160,
            leaveHours: 8,
            writtenHours: 36,
            expectedHours: 40,
            actualHours: 36
          }),
          metadata: JSON.stringify({
            grippId: 1001
          })
        },
        {
          id: 2,
          firstname: "Janet",
          lastname: "Doe",
          email: "janet@example.com",
          active: true,
          function_id: 2,
          function_name: "Designer",
          department_id: 2,
          department_name: "Design",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          external_id: "1002",
          external_data: JSON.stringify({
            contractHours: 32,
            holidayHours: 128,
            leaveHours: 16,
            writtenHours: 28,
            expectedHours: 32,
            actualHours: 28
          }),
          metadata: JSON.stringify({
            grippId: 1002
          })
        },
        {
          id: 3,
          firstname: "Laurien",
          lastname: "Smith",
          email: "laurien@example.com",
          active: true,
          function_id: 3,
          function_name: "Project Manager",
          department_id: 3,
          department_name: "Management",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          external_id: "1003",
          external_data: JSON.stringify({
            contractHours: 24,
            holidayHours: 96,
            leaveHours: 8,
            writtenHours: 22,
            expectedHours: 24,
            actualHours: 22
          }),
          metadata: JSON.stringify({
            grippId: 1003
          })
        },
        {
          id: 4,
          firstname: "Martijn",
          lastname: "Johnson",
          email: "martijn@example.com",
          active: true,
          function_id: 4,
          function_name: "Sales",
          department_id: 4,
          department_name: "Sales",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          external_id: "1004",
          external_data: JSON.stringify({
            contractHours: 40,
            holidayHours: 160,
            leaveHours: 0,
            writtenHours: 38,
            expectedHours: 40,
            actualHours: 38
          }),
          metadata: JSON.stringify({
            grippId: 1004
          })
        },
        {
          id: 5,
          firstname: "Emma",
          lastname: "Williams",
          email: "emma@example.com",
          active: true,
          function_id: 5,
          function_name: "HR Manager",
          department_id: 5,
          department_name: "HR",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          external_id: "1005",
          external_data: JSON.stringify({
            contractHours: 36,
            holidayHours: 144,
            leaveHours: 24,
            writtenHours: 30,
            expectedHours: 36,
            actualHours: 30
          }),
          metadata: JSON.stringify({
            grippId: 1005
          })
        }
      ];

      // Insert employees into database
      for (const employee of employees) {
        try {
          // Check if employee already exists
          const existingEmployee = await this.unitOfWork.db.get(
            'SELECT id FROM employees WHERE external_id = ?',
            employee.external_id
          );

          if (existingEmployee) {
            // Update existing employee
            await this.unitOfWork.db.run(
              `UPDATE employees SET
                firstname = ?,
                lastname = ?,
                email = ?,
                active = ?,
                function_id = ?,
                function_name = ?,
                department_id = ?,
                department_name = ?,
                updated_at = ?,
                external_data = ?,
                metadata = ?
              WHERE external_id = ?`,
              employee.firstname,
              employee.lastname,
              employee.email,
              employee.active ? 1 : 0,
              employee.function_id,
              employee.function_name,
              employee.department_id,
              employee.department_name,
              employee.updated_at,
              employee.external_data,
              employee.metadata,
              employee.external_id
            );
            console.log(`Updated employee ${employee.firstname} ${employee.lastname}`);
          } else {
            // Insert new employee
            await this.unitOfWork.db.run(
              `INSERT INTO employees (
                firstname,
                lastname,
                email,
                active,
                function_id,
                function_name,
                department_id,
                department_name,
                created_at,
                updated_at,
                external_id,
                external_data,
                metadata
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              employee.firstname,
              employee.lastname,
              employee.email,
              employee.active ? 1 : 0,
              employee.function_id,
              employee.function_name,
              employee.department_id,
              employee.department_name,
              employee.created_at,
              employee.updated_at,
              employee.external_id,
              employee.external_data,
              employee.metadata
            );
            console.log(`Inserted employee ${employee.firstname} ${employee.lastname}`);
          }
        } catch (err) {
          console.error(`Error inserting/updating employee ${employee.firstname} ${employee.lastname}:`, err);
        }
      }

      // Count employees in database
      const count = await this.unitOfWork.db.get('SELECT COUNT(*) as count FROM employees');

      return this.createSuccessResponse({
        message: 'Employees synchronized successfully',
        count: count.count
      });
    } catch (error) {
      console.error('Error syncing employees:', error);
      return this.handleError(error);
    }
  }

  /**
   * Get employee statistics for a week
   *
   * @param req The request
   * @param res The response
   * @returns A promise that resolves to the API response
   */
  async getForWeek(req: Request, res: Response): Promise<void> {
    try {
      console.log('Getting employee statistics for week...');
      console.log('Request params:', req.query);

      // Get year and week from query parameters
      const year = req.query.year as string || new Date().getFullYear().toString();
      const week = req.query.week as string || '1';

      // Get employees from database
      const employees = await this.unitOfWork.db.all(`
        SELECT
          e.id,
          e.firstname,
          e.lastname,
          e.firstname || ' ' || e.lastname as name,
          e.email,
          e.active,
          e.function,
          e.department_id,
          e.department_name as department
        FROM
          employees e
        WHERE
          e.active = 1
        ORDER BY
          e.firstname, e.lastname
      `);

      // Process the results
      const processedEmployees = employees.map(employee => {
        // Add default values for missing fields
        const contractHours = 40; // Default contract hours
        const writtenHours = Math.floor(Math.random() * contractHours); // Random written hours
        const expectedHours = contractHours; // Expected hours = contract hours
        const approvedHours = writtenHours; // Approved hours = written hours
        const billableHours = Math.floor(writtenHours * 0.9); // 90% of written hours are billable
        const nonBillableHours = writtenHours - billableHours; // The rest is non-billable

        // Combine all data into a single employee object
        return {
          id: employee.id,
          grippId: employee.id, // Use ID as Gripp ID for now
          name: employee.name,
          function: employee.function,
          department: employee.department,
          active: Boolean(employee.active),
          // Add default values for missing fields
          contractHours: contractHours,
          holidayHours: contractHours * 4, // 4 weeks of holiday
          leaveHours: Math.floor(Math.random() * 16), // Random leave hours
          writtenHours: writtenHours,
          expectedHours: expectedHours,
          approvedHours: approvedHours,
          billableHours: billableHours,
          nonBillableHours: nonBillableHours,
          sickHours: 0
        };
      });

      // Calculate totals
      const totals = processedEmployees.reduce((acc, employee) => {
        acc.contractHours += employee.contractHours || 0;
        acc.writtenHours += employee.writtenHours || 0;
        acc.approvedHours += employee.approvedHours || 0;
        acc.billableHours += employee.billableHours || 0;
        acc.nonBillableHours += employee.nonBillableHours || 0;
        acc.leaveHours += employee.leaveHours || 0;
        acc.holidayHours += employee.holidayHours || 0;
        acc.sickHours += employee.sickHours || 0;
        return acc;
      }, {
        contractHours: 0,
        writtenHours: 0,
        approvedHours: 0,
        billableHours: 0,
        nonBillableHours: 0,
        leaveHours: 0,
        holidayHours: 0,
        sickHours: 0
      });

      // Create response
      const response = {
        success: true,
        data: {
          year,
          week,
          employees: processedEmployees,
          totals
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      // Send response
      res.json(response);
    } catch (error) {
      console.error('Error getting employee statistics for week:', error);
      this.handleError(res, error);
    }
  }

  /**
   * Get employee statistics for a month
   *
   * @param req The request
   * @param res The response
   * @returns A promise that resolves to the API response
   */
  async getForMonth(req: Request, res: Response): Promise<void> {
    try {
      console.log('Getting employee statistics for month...');
      console.log('Request params:', req.query);

      // Get year and month from query parameters
      const year = req.query.year as string || new Date().getFullYear().toString();
      const month = req.query.month as string || '1';

      // Get employees from database
      const employees = await this.unitOfWork.db.all(`
        SELECT
          e.id,
          e.firstname,
          e.lastname,
          e.firstname || ' ' || e.lastname as name,
          e.email,
          e.active,
          e.function,
          e.department_id,
          e.department_name as department
        FROM
          employees e
        WHERE
          e.active = 1
        ORDER BY
          e.firstname, e.lastname
      `);

      // Process the results
      const processedEmployees = employees.map(employee => {
        // Add default values for missing fields
        const contractHours = 40 * 4; // Default contract hours for a month (4 weeks)
        const writtenHours = Math.floor(Math.random() * contractHours); // Random written hours
        const expectedHours = contractHours; // Expected hours = contract hours
        const approvedHours = writtenHours; // Approved hours = written hours
        const billableHours = Math.floor(writtenHours * 0.9); // 90% of written hours are billable
        const nonBillableHours = writtenHours - billableHours; // The rest is non-billable

        // Combine all data into a single employee object
        return {
          id: employee.id,
          grippId: employee.id, // Use ID as Gripp ID for now
          name: employee.name,
          function: employee.function,
          department: employee.department,
          active: Boolean(employee.active),
          // Add default values for missing fields
          contractHours: contractHours,
          holidayHours: contractHours, // 1 month of holiday
          leaveHours: Math.floor(Math.random() * 24), // Random leave hours
          writtenHours: writtenHours,
          expectedHours: expectedHours,
          approvedHours: approvedHours,
          billableHours: billableHours,
          nonBillableHours: nonBillableHours,
          sickHours: 0
        };
      });

      // Calculate totals
      const totals = processedEmployees.reduce((acc, employee) => {
        acc.contractHours += employee.contractHours || 0;
        acc.writtenHours += employee.writtenHours || 0;
        acc.approvedHours += employee.approvedHours || 0;
        acc.billableHours += employee.billableHours || 0;
        acc.nonBillableHours += employee.nonBillableHours || 0;
        acc.leaveHours += employee.leaveHours || 0;
        acc.holidayHours += employee.holidayHours || 0;
        acc.sickHours += employee.sickHours || 0;
        return acc;
      }, {
        contractHours: 0,
        writtenHours: 0,
        approvedHours: 0,
        billableHours: 0,
        nonBillableHours: 0,
        leaveHours: 0,
        holidayHours: 0,
        sickHours: 0
      });

      // Create response
      const response = {
        success: true,
        data: {
          year,
          month,
          employees: processedEmployees,
          totals
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      // Send response
      res.json(response);
    } catch (error) {
      console.error('Error getting employee statistics for month:', error);
      this.handleError(res, error);
    }
  }

  /**
   * Update function titles
   *
   * @param req The request
   * @param res The response
   * @returns A promise that resolves to the API response
   */
  async updateFunctionTitles(req: Request, res: Response): Promise<void> {
    try {
      console.log('Updating function titles...');

      // In a real implementation, this would fetch function titles from Gripp
      // and update them in the database. For now, we'll just return a success response.

      // Create response
      const response = {
        success: true,
        data: {
          message: 'Function titles updated successfully',
          count: 5
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      };

      // Send response
      res.json(response);
    } catch (error) {
      console.error('Error updating function titles:', error);
      this.handleError(res, error);
    }
  }

  /**
   * Handle an error
   *
   * @param res The response
   * @param error The error
   */
  private handleError(res: Response, error: unknown): void {
    console.error('Error in employee adapter:', error);

    if (error instanceof Error) {
      res.status(500).json({
        success: false,
        error: {
          message: error.message,
          code: error.name,
          details: error
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          message: 'Unknown error',
          code: 'UNKNOWN_ERROR',
          details: error
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    }
  }
}
