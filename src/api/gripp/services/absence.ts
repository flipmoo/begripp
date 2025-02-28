import { GrippRequest, GrippResponse, executeRequest } from '../client.ts';

export type AbsenceType = {
  id: number;
  searchname: string;
};

export type AbsenceRequest = {
  id: number;
  employee: {
    id: number;
    searchname: string;
  };
  startdate: {
    date: string;
    timezone_type: number;
    timezone: string;
  };
  enddate: {
    date: string;
    timezone_type: number;
    timezone: string;
  };
  type: AbsenceType;
  hours_per_day: number;
  description: string;
  status: {
    id: number;
    searchname: string;
  };
};

export type AbsenceFilter = {
  field: string;
  operator: string;
  value: string | number | boolean;
  value2?: string;
};

export const absenceService = {
  async getByEmployeeIdsAndPeriod(
    employeeIds: number[],
    startDate: string,
    endDate: string
  ): Promise<GrippResponse<AbsenceRequest>[]> {
    const requests = employeeIds.map(employeeId =>
      ({
        method: 'absencerequest.get',
        params: [
          [
            {
              field: 'absencerequest.employee',
              operator: 'equals',
              value: employeeId,
            },
            {
              field: 'absencerequest.startdate',
              operator: 'lessthanequalto',
              value: endDate,
            },
            {
              field: 'absencerequest.enddate',
              operator: 'greaterthanequalto',
              value: startDate,
            },
            {
              field: 'absencerequest.status',
              operator: 'equals',
              value: 2, // Assuming 2 is the status for approved requests
            }
          ],
          {
            paging: {
              firstresult: 0,
              maxresults: 250,
            },
            orderings: [
              {
                field: 'absencerequest.startdate',
                direction: 'asc',
              },
            ],
          },
        ],
        id: Date.now(),
      } as GrippRequest)
    );

    return Promise.all(requests.map(request => executeRequest<AbsenceRequest>(request)));
  },
}; 