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
  ): Promise<GrippResponse<Hour>[]> {
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

    return Promise.all(requests.map(request => executeRequest<Hour>(request)));
  },
}; 