import { GrippRequest, GrippResponse, executeRequest } from '../client.ts';

export type Hour = {
  id: number;
  employee: {
    id: number;
    searchname: string;
  };
  date: {
    date: string;
    timezone_type: number;
    timezone: string;
  };
  amount: number;
  description: string;
  status: {
    id: number;
    searchname: string;
  };
};

// Define the actual response structure from the API
export type HourResponse = {
  rows: Hour[];
  count: number;
  start: number;
};

export type HourFilter = {
  field: string;
  operator: string;
  value: string | number | boolean;
  value2?: string;
};

export type GetHoursOptions = {
  filters?: HourFilter[];
  options?: {
    paging?: {
      firstresult: number;
      maxresults: number;
    };
  };
};

export const hourService = {
  async getByEmployeeIdsAndPeriod(
    employeeIds: number[],
    startDate: string,
    endDate: string
  ): Promise<GrippResponse<HourResponse>[]> {
    const requests = employeeIds.map(employeeId =>
      ({
        method: 'hour.get',
        params: [
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
          },
        ],
        id: Date.now(),
      } as GrippRequest)
    );

    return Promise.all(requests.map(request => executeRequest<HourResponse>(request)));
  },

  /**
   * Get all hours for a specific employee and period with pagination support
   * This function handles fetching all pages of data
   */
  async getAllHoursByEmployeeAndPeriod(
    employeeId: number,
    startDate: string,
    endDate: string
  ): Promise<Hour[]> {
    const PAGE_SIZE = 250;
    let allHours: Hour[] = [];
    let hasMoreResults = true;
    let offset = 0;

    console.log(`Fetching hours for employee ${employeeId} from ${startDate} to ${endDate}`);

    while (hasMoreResults) {
      const request: GrippRequest = {
        method: 'hour.get',
        params: [
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
              firstresult: offset,
              maxresults: PAGE_SIZE,
            },
          },
        ],
        id: Date.now(),
      };

      const response = await executeRequest<HourResponse>(request);
      
      // Check if the response has the expected structure
      if (!response.result || !response.result.rows) {
        console.error('Unexpected API response structure:', response);
        break;
      }
      
      const hours = response.result.rows || [];
      const totalCount = response.result.count || 0;
      
      console.log(`Fetched ${hours.length} hours for employee ${employeeId} (offset: ${offset}, total: ${totalCount})`);
      
      allHours = [...allHours, ...hours];
      
      // If we got fewer results than the page size or we've fetched all results, we've reached the end
      if (hours.length < PAGE_SIZE || allHours.length >= totalCount) {
        hasMoreResults = false;
      } else {
        offset += PAGE_SIZE;
      }
    }

    console.log(`Total hours fetched for employee ${employeeId}: ${allHours.length}`);
    return allHours;
  },
}; 