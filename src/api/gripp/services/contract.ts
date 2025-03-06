import { executeRequest, createRequest, GrippClient, grippClient } from '../client';

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

class ContractService {
  private client: GrippClient;

  constructor(client: GrippClient) {
    this.client = client;
  }

  async getByEmployeeIds(employeeIds: number[]): Promise<any> {
    console.log('Fetching contracts for employee IDs:', employeeIds);
    
    const request = this.client.createRequest(
      'contract.get',
      [],
      {
        paging: {
          firstresult: 0,
          maxresults: 250
        },
        orderings: [
          {
            field: 'contract.startdate',
            direction: 'asc'
          }
        ]
      }
    );
    
    try {
      console.log('Sending contract request to Gripp API:', JSON.stringify(request, null, 2));
      const response = await this.client.executeRequest(request);
      console.log('Contract response from Gripp API:', JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      console.error('Error fetching contract data:', error);
      throw error;
    }
  }

  async getAll(): Promise<any> {
    return this.getByEmployeeIds([]);
  }
}

export const contractService = new ContractService(grippClient); 
