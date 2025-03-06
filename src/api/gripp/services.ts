import { createRequest, executeRequest } from './client';

// Helper function to batch requests
export async function batchRequests<T>(
  requests: Array<() => Promise<T>>,
  batchSize = 3
): Promise<(T | null)[]> {
  const results: (T | null)[] = [];
  
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(request => 
        request().catch(error => {
          console.error('Error in batch request:', error);
          return null;
        })
      )
    );
    results.push(...batchResults);
    
    // Wait briefly between batches to avoid overloading the server
    if (i + batchSize < requests.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

export type GrippFilter = {
  field: string;
  operator: string;
  value: string | number | boolean;
};

export type GrippPaging = {
  firstresult: number;
  maxresults: number;
};

export type GrippOrdering = {
  field: string;
  direction: 'asc' | 'desc';
};

export type GrippOptions = {
  paging?: GrippPaging;
  orderings?: GrippOrdering[];
};

export const employeeService = {
  async getAll() {
    const request = createRequest(
      'employee.get',
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
      }
    );

    return executeRequest(request);
  },
};

export const contractService = {
  async getByEmployeeIds(employeeIds: number[]) {
    // Use batchRequests to avoid overwhelming the API
    return batchRequests(
      employeeIds.map(employeeId => () =>
        executeRequest(
          createRequest(
            'employmentcontract.get',
            [
              {
                field: 'employmentcontract.employee',
                operator: 'equals',
                value: employeeId,
              }
            ],
            {
              paging: {
                firstresult: 0,
                maxresults: 250, // Fetch all contracts
              },
              orderings: [
                {
                  field: 'employmentcontract.startdate',
                  direction: 'asc',
                },
              ],
            }
          )
        )
      ),
      3 // Process 3 employees at a time
    );
  },
};

export const hourService = {
  async getByEmployeeIdsAndPeriod(employeeIds: number[], startDate: string, endDate: string) {
    const requests = employeeIds.map(employeeId =>
      createRequest(
        'hour.get',
        [
          {
            field: 'hour.employee',
            operator: 'equals',
            value: employeeId,
          },
          {
            field: 'hour.date',
            operator: 'between',
            value: startDate,
            value2: endDate,
          },
        ],
        {
          paging: {
            firstresult: 0,
            maxresults: 250,
          },
        }
      )
    );

    return Promise.all(requests.map(request => executeRequest(request)));
  },
};

export const leaveService = {
  async getByEmployeeIdsAndPeriod(employeeIds: number[], startDate: string, endDate: string) {
    // Use batchRequests to avoid overwhelming the API
    return batchRequests(
      employeeIds.map(employeeId => () =>
        executeRequest(
          createRequest(
            'leave.get',
            [
              {
                field: 'leave.employee',
                operator: 'equals',
                value: employeeId,
              },
              {
                field: 'leave.startdate',
                operator: 'between',
                value: startDate,
                value2: endDate,
              },
              {
                field: 'leave.status',
                operator: 'equals',
                value: 'approved', // Only get approved leave requests
              }
            ],
            {
              paging: {
                firstresult: 0,
                maxresults: 250,
              },
              orderings: [
                {
                  field: 'leave.startdate',
                  direction: 'asc',
                },
              ],
            }
          )
        )
      ),
      3 // Process 3 employees at a time
    );
  },
}; 