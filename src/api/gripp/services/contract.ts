import { GrippRequest, GrippResponse, executeRequest } from '../client';

export type GrippDate = {
  date: string;
  timezone_type: number;
  timezone: string;
};

export type Contract = {
  id: number;
  employee: {
    id: number;
    searchname: string;
  };
  hours_monday_even: number;
  hours_tuesday_even: number;
  hours_wednesday_even: number;
  hours_thursday_even: number;
  hours_friday_even: number;
  hours_monday_odd: number;
  hours_tuesday_odd: number;
  hours_wednesday_odd: number;
  hours_thursday_odd: number;
  hours_friday_odd: number;
  startdate: GrippDate;
  enddate: GrippDate | null;
  internal_price_per_hour?: string;
};

export type ContractFilter = {
  field: string;
  operator: string;
  value: string | number | boolean;
  value2?: string;
};

export type GetContractsOptions = {
  filters?: ContractFilter[];
  options?: {
    paging?: {
      firstresult: number;
      maxresults: number;
    };
  };
};

function getDateFromGrippDate(grippDate: GrippDate | null): Date | null {
  if (!grippDate) return null;
  return new Date(grippDate.date);
}

function isDateInRange(date: Date, start: Date, end: Date | null): boolean {
  if (!end) return date >= start;
  return date >= start && date <= end;
}

function getContractForDate(contracts: Contract[], date: Date): Contract | null {
  return contracts.find(contract => {
    const startDate = getDateFromGrippDate(contract.startdate);
    const endDate = getDateFromGrippDate(contract.enddate);
    if (!startDate) return false;
    return isDateInRange(date, startDate, endDate);
  }) || null;
}

export const contractService = {
  async getByEmployeeIds(employeeIds: number[]): Promise<GrippResponse<Contract>[]> {
    const requests = employeeIds.map(employeeId =>
      ({
        method: 'employmentcontract.get',
        params: [
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
              maxresults: 250,
            },
            orderings: [
              {
                field: 'employmentcontract.startdate',
                direction: 'asc',
              },
            ],
          },
        ],
        id: Date.now(),
      } as GrippRequest)
    );

    return Promise.all(requests.map(request => executeRequest<Contract>(request)));
  },
}; 
