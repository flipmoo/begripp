import { GrippRequest, GrippResponse, executeRequest } from '../client.ts';

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
    console.log('Fetching all employees from Gripp API');
    
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

    console.log('Sending employee request to Gripp API:', JSON.stringify(request, null, 2));
    const response = await executeRequest<Employee>(request);
    console.log(`Received ${response?.result?.rows?.length || 0} employees from Gripp API`);
    
    return response;
  },

  async get(options: GetEmployeesOptions = {}): Promise<GrippResponse<Employee>> {
    console.log('Fetching employees with options:', JSON.stringify(options, null, 2));
    
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

    console.log('Sending employee request to Gripp API:', JSON.stringify(request, null, 2));
    const response = await executeRequest<Employee>(request);
    console.log(`Received ${response?.result?.rows?.length || 0} employees from Gripp API`);
    
    return response;
  },
}; 