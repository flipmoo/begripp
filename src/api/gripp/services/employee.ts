import { GrippRequest, GrippResponse, executeRequest } from '../client';

export type Employee = {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  active: boolean;
  function: string;
  department: {
    id: number;
    zoeknaam: string;
  };
  // Add other fields as needed
};

export type EmployeeFilter = {
  field: string;
  operator: string;
  value: string | number | boolean;
};

export type GetEmployeesOptions = {
  filters?: EmployeeFilter[];
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

export const employeeService = {
  async getAll(): Promise<GrippResponse<Employee>> {
    const request: GrippRequest = {
      method: 'employee.get',
      params: [
        [], // filters
        {   // options
          paging: {
            firstresult: 0,
            maxresults: 250,
          },
          orderings: [
            {
              field: 'employee.firstname',
              direction: 'asc',
            },
          ],
        },
      ],
      id: Date.now(),
    };

    return executeRequest<Employee>(request);
  },

  async get(options: GetEmployeesOptions = {}): Promise<GrippResponse<Employee>> {
    const request: GrippRequest = {
      method: 'employee.get',
      params: [
        options.filters || [],
        {
          paging: options.options?.paging || {
            firstresult: 0,
            maxresults: 250,
          },
          orderings: options.options?.orderings || [
            {
              field: 'employee.firstname',
              direction: 'asc',
            },
          ],
        },
      ],
      id: Date.now(),
    };

    return executeRequest<Employee>(request);
  },
}; 