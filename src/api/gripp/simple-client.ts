import { executeRequest } from './client';
import { config } from './config';

export interface Employee {
  id: number;
  firstname: string;
  lastname: string;
  active: boolean;
}

export async function getEmployees() {
  return executeRequest<Employee>({
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
      }
    ],
    id: Date.now()
  });
}

export interface AbsenceRequest {
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
  type: {
    id: number;
    searchname: string;
  };
  hours_per_day: number;
  description: string;
  status: {
    id: number;
    searchname: string;
  };
}

export async function getAbsenceRequests(employeeIds: number[], startDate: string, endDate: string) {
  return executeRequest<AbsenceRequest>({
    method: 'absencerequest.get',
    params: [
      [
        {
          field: 'absencerequest.employee',
          operator: 'in',
          value: employeeIds
        },
        {
          field: 'absencerequest.startdate',
          operator: 'lessthanequalto',
          value: endDate
        },
        {
          field: 'absencerequest.enddate',
          operator: 'greaterthanequalto',
          value: startDate
        },
        {
          field: 'absencerequest.status',
          operator: 'equals',
          value: 2 // Approved requests
        }
      ],
      {
        paging: {
          firstresult: 0,
          maxresults: 250
        },
        orderings: [
          {
            field: 'absencerequest.startdate',
            direction: 'asc'
          }
        ]
      }
    ],
    id: Date.now()
  });
}