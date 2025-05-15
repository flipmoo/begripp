/**
 * Employee Repository Mock Implementation
 *
 * This class provides a mock implementation of the employee repository.
 */

import { IEmployeeRepository, Employee } from '../interfaces';

/**
 * Employee repository mock implementation
 */
export class EmployeeRepository implements IEmployeeRepository {
  /**
   * Find entities by a filter
   *
   * @param filter The filter to apply
   * @returns A promise that resolves to an array of entities
   */
  async findBy(filter: Partial<Employee>): Promise<Employee[]> {
    return this.employees
      .filter(employee => {
        return Object.entries(filter).every(([key, value]) => {
          // @ts-ignore
          return employee[key] === value;
        });
      })
      .map(employee => ({ ...employee }));
  }

  /**
   * Count entities
   *
   * @param filter Optional filter to apply
   * @returns A promise that resolves to the number of entities
   */
  async count(filter?: Partial<Employee>): Promise<number> {
    if (!filter || Object.keys(filter).length === 0) {
      return this.employees.length;
    }

    return this.findBy(filter).then(employees => employees.length);
  }

  /**
   * Check if an entity exists
   *
   * @param id The entity ID
   * @returns A promise that resolves to true if the entity exists
   */
  async exists(id: number): Promise<boolean> {
    return this.employees.some(employee => employee.id === id);
  }

  /**
   * Update an entity
   *
   * @param id The entity ID
   * @param entity The entity data to update
   * @returns A promise that resolves to the updated entity
   */
  async update(id: number, entity: Partial<Employee>): Promise<Employee> {
    const index = this.employees.findIndex(employee => employee.id === id);

    if (index === -1) {
      throw new Error(`Employee with ID ${id} not found`);
    }

    const updatedEmployee = {
      ...this.employees[index],
      ...entity,
      updatedAt: new Date().toISOString()
    };

    this.employees[index] = updatedEmployee;

    return { ...updatedEmployee };
  }

  /**
   * Update an entity (legacy method)
   *
   * @param employee The employee to update
   * @returns A promise that resolves to the updated employee
   */
  async updateEntity(employee: Employee): Promise<Employee> {
    const index = this.employees.findIndex(e => e.id === employee.id);

    if (index === -1) {
      throw new Error(`Employee with ID ${employee.id} not found`);
    }

    const updatedEmployee = {
      ...employee,
      updatedAt: new Date().toISOString()
    };

    this.employees[index] = updatedEmployee;

    return { ...updatedEmployee };
  }

  /**
   * The employees - sample data
   */
  private employees: Employee[] = [
    {
      id: 1,
      grippId: 1001,
      firstname: 'John',
      lastname: 'Doe',
      email: 'john.doe@example.com',
      function: 'Developer',
      active: true,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z'
    },
    {
      id: 2,
      grippId: 1002,
      firstname: 'Jane',
      lastname: 'Smith',
      email: 'jane.smith@example.com',
      function: 'Designer',
      active: true,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z'
    },
    {
      id: 3,
      grippId: 1003,
      firstname: 'Bob',
      lastname: 'Johnson',
      email: 'bob.johnson@example.com',
      function: 'Project Manager',
      active: true,
      createdAt: '2023-01-01T00:00:00.000Z',
      updatedAt: '2023-01-01T00:00:00.000Z'
    }
  ];

  /**
   * Find all employees
   *
   * @returns A promise that resolves to an array of employees
   */
  async findAll(): Promise<Employee[]> {
    return [...this.employees];
  }

  /**
   * Find an employee by ID
   *
   * @param id The employee ID
   * @returns A promise that resolves to the employee or null if not found
   */
  async findById(id: number): Promise<Employee | null> {
    const employee = this.employees.find(employee => employee.id === id);
    return employee ? { ...employee } : null;
  }

  /**
   * Find employee by Gripp ID
   *
   * @param grippId The Gripp ID
   * @returns A promise that resolves to the employee or null if not found
   */
  async findByGrippId(grippId: number): Promise<Employee | null> {
    const employee = this.employees.find(employee => employee.grippId === grippId);
    return employee ? { ...employee } : null;
  }

  /**
   * Create a new employee
   *
   * @param employee The employee to create
   * @returns A promise that resolves to the created employee
   */
  async create(employee: Employee): Promise<Employee> {
    const newEmployee = {
      ...employee,
      id: this.employees.length > 0 ? Math.max(...this.employees.map(employee => employee.id)) + 1 : 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.employees.push(newEmployee);

    return { ...newEmployee };
  }

  /**
   * Delete an employee
   *
   * @param id The employee ID
   * @returns A promise that resolves to true if the employee was deleted
   */
  async delete(id: number): Promise<boolean> {
    const index = this.employees.findIndex(employee => employee.id === id);

    if (index === -1) {
      return false;
    }

    this.employees.splice(index, 1);

    return true;
  }

  /**
   * Find active employees
   *
   * @returns A promise that resolves to an array of active employees
   */
  async findActive(): Promise<Employee[]> {
    return this.employees.filter(employee => employee.active).map(employee => ({ ...employee }));
  }

  /**
   * Find employees by function
   *
   * @param functionName The function name
   * @returns A promise that resolves to an array of employees
   */
  async findByFunction(functionName: string): Promise<Employee[]> {
    return this.employees.filter(employee => employee.function === functionName).map(employee => ({ ...employee }));
  }
}
