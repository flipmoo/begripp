import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/common/Layout';
import { employeeService, contractService, hourService } from '../../api/gripp/services';
import type { Employee } from '../../api/gripp/services/employee';
import type { Contract } from '../../api/gripp/services/contract';
import type { Hour } from '../../api/gripp/services/hour';
import type { GrippResponse } from '../../api/gripp/client';
import { getWorkingHoursForDay, defaultHolidays } from '../../data/holidays';

type ViewType = 'week' | 'month' | 'year';

const getDateRangeForView = (viewType: ViewType, selectedDate: { year: number; month?: number; week?: number }) => {
  const { year, month, week } = selectedDate;
  
  if (viewType === 'week' && week) {
    // Get January 4th for the selected year (always in week 1 by ISO)
    const jan4th = new Date(Date.UTC(year, 0, 4));
    
    // Get Monday of week 1
    const firstWeekMonday = new Date(jan4th);
    firstWeekMonday.setUTCDate(jan4th.getUTCDate() - (jan4th.getUTCDay() || 7) + 1);
    
    // Calculate start date by adding weeks
    const startDate = new Date(firstWeekMonday);
    startDate.setUTCDate(firstWeekMonday.getUTCDate() + (week - 1) * 7);
    startDate.setUTCHours(0, 0, 0, 0);
    
    // Calculate end date (6 days after start date)
    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 6);
    endDate.setUTCHours(23, 59, 59, 999);
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    };
  }
  
  if (viewType === 'month' && month !== undefined) {
    const startDate = new Date(Date.UTC(year, month, 1));
    startDate.setUTCHours(0, 0, 0, 0);
    
    const endDate = new Date(Date.UTC(year, month + 1, 0));
    endDate.setUTCHours(23, 59, 59, 999);
    
    return {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
    };
  }
  
  // Year view
  const startDate = new Date(Date.UTC(year, 0, 1));
  startDate.setUTCHours(0, 0, 0, 0);
  
  const endDate = new Date(Date.UTC(year, 11, 31));
  endDate.setUTCHours(23, 59, 59, 999);
  
  return {
    start: startDate.toISOString().split('T')[0],
    end: endDate.toISOString().split('T')[0],
  };
};

const getCurrentWeek = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil(days / 7);
  return week;
};

function getContractForDate(contracts: Contract[], date: Date): Contract | null {
  return contracts.find(contract => {
    const startDate = new Date(contract.startdate.date);
    const endDate = contract.enddate ? new Date(contract.enddate.date) : null;
    
    if (endDate) {
      return date >= startDate && date <= endDate;
    }
    return date >= startDate;
  }) || null;
}

function calculateExpectedHours(contracts: Contract[], viewType: ViewType, selectedDate: { year: number; month?: number; week?: number }): number {
  if (!contracts.length) return 0;

  // Helper function to get ISO week number using a more reliable calculation
  const getISOWeek = (date: Date) => {
    // Create a new date object and set to UTC midnight
    const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    const dayNumber = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
    
    // Get first day of year
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    
    // Calculate full weeks to nearest Thursday
    const weekNumber = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    
    return weekNumber;
  };

  // Helper function to determine if a week is even or odd based on contract schedule
  const isEvenWeekForContract = (date: Date, contract: Contract) => {
    const weekNum = getISOWeek(date);
    
    // Check if the contract has any even/odd schedule by comparing the hours
    const hasEvenOddSchedule = [
      ['monday', contract.hours_monday_even, contract.hours_monday_odd],
      ['tuesday', contract.hours_tuesday_even, contract.hours_tuesday_odd],
      ['wednesday', contract.hours_wednesday_even, contract.hours_wednesday_odd],
      ['thursday', contract.hours_thursday_even, contract.hours_thursday_odd],
      ['friday', contract.hours_friday_even, contract.hours_friday_odd]
    ].some(([_, even, odd]) => {
      // If both are defined and different, it's an even/odd schedule
      if (even !== undefined && odd !== undefined) {
        return even !== odd;
      }
      // If only one is defined, it's not an even/odd schedule
      return false;
    });

    // If there's no even/odd schedule, use odd week hours for consistency
    if (!hasEvenOddSchedule) {
      return false;
    }
    
    return weekNum % 2 === 0;
  };

  // Get date range for the selected period
  const { start, end } = getDateRangeForView(viewType, selectedDate);
  const startDate = new Date(start);
  const endDate = new Date(end);

  // Filter holidays for the selected period - use UTC dates for comparison
  const periodHolidays = defaultHolidays.filter(holiday => {
    const holidayDate = new Date(holiday.date);
    const periodStart = new Date(startDate);
    const periodEnd = new Date(endDate);
    
    // Set all dates to UTC midnight for comparison
    holidayDate.setUTCHours(0, 0, 0, 0);
    periodStart.setUTCHours(0, 0, 0, 0);
    periodEnd.setUTCHours(0, 0, 0, 0);
    
    // Compare dates using UTC time
    return holidayDate >= periodStart && holidayDate <= periodEnd;
  });

  let totalHours = 0;
  const currentDate = new Date(startDate);

  // Loop through each day of the period
  while (currentDate <= endDate) {
    // Find the contract valid for this specific date
    const validContract = getContractForDate(contracts, currentDate);

    if (validContract) {
      // Create a new Date object to avoid mutation
      const dateForCalculation = new Date(currentDate);
      // Calculate isEvenWeek specifically for this contract
      const isEvenWeek = isEvenWeekForContract(dateForCalculation, validContract);

      // Pass the filtered holidays array to getWorkingHoursForDay
      totalHours += getWorkingHoursForDay(
        dateForCalculation,
        validContract,
        isEvenWeek,
        periodHolidays
      );
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return totalHours;
}

export function EmployeesPage() {
  const [viewType, setViewType] = useState<ViewType>('week');
  const [selectedDate, setSelectedDate] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    week: getCurrentWeek(),
  });

  const dateRange = getDateRangeForView(viewType, selectedDate);

  const { data: employeesData, isLoading: isLoadingEmployees, error: employeesError } = useQuery({
    queryKey: ['employees'],
    queryFn: async () => {
      const response = await employeeService.getAll();
      return response as GrippResponse<Employee>;
    },
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const activeEmployees = employeesData?.result?.rows?.filter((employee: Employee) => employee.active) || [];
  const employeeIds = activeEmployees.map((employee: Employee) => employee.id);

  const { data: contractsData, isLoading: isLoadingContracts, error: contractsError } = useQuery({
    queryKey: ['contracts', employeeIds],
    queryFn: async () => {
      const response = await contractService.getByEmployeeIds(employeeIds);
      return response as GrippResponse<Contract>[];
    },
    enabled: employeeIds.length > 0,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60 * 1000,
  });

  const { data: hoursData, isLoading: isLoadingHours, error: hoursError } = useQuery({
    queryKey: ['hours', employeeIds, dateRange.start, dateRange.end],
    queryFn: async () => {
      const response = await hourService.getByEmployeeIdsAndPeriod(
        employeeIds,
        dateRange.start,
        dateRange.end
      );
      return response as GrippResponse<Hour>[];
    },
    enabled: employeeIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const getEmployeeData = (employee: Employee) => {
    // Get all contracts for this employee
    const employeeContracts = contractsData
      ?.find((response) => 
        response?.result?.rows?.some(row => row.employee?.id === employee.id)
      )
      ?.result?.rows || [];

    const employeeHours = hoursData
      ?.find((response) => 
        response?.result?.rows?.some(row => row.employee?.id === employee.id)
      )
      ?.result?.rows || [];

    // Get the date range for the current view
    const { start: periodStart, end: periodEnd } = getDateRangeForView(viewType, selectedDate);
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);

    // Sort all contracts by start date in ascending order
    const allContracts = [...employeeContracts].sort((a, b) => {
      const dateA = new Date(a.startdate.date);
      const dateB = new Date(b.startdate.date);
      return dateA.getTime() - dateB.getTime();
    });

    // Filter contracts that are valid during the selected period
    const validContracts = allContracts.filter(contract => {
      const contractStart = new Date(contract.startdate.date);
      const contractEnd = contract.enddate ? new Date(contract.enddate.date) : null;

      // A contract is valid if it overlaps with the selected period:
      // 1. Contract starts before or during the period AND
      // 2. Either has no end date OR ends after the start of the period
      return (contractStart <= endDate) && (!contractEnd || contractEnd >= startDate);
    });

    // Calculate expected hours based on valid contracts for the selected period
    const expectedHours = calculateExpectedHours(validContracts, viewType, selectedDate);
    const actualHours = employeeHours.reduce((sum: number, hour: Hour) => 
      sum + (hour.amount || 0), 0
    );

    const percentage = expectedHours > 0 ? (actualHours / expectedHours) * 100 : 0;

    return {
      expectedHours,
      actualHours,
      percentage,
      contracts: validContracts,
      allContracts,
    };
  };

  const isLoading = isLoadingEmployees || isLoadingContracts || isLoadingHours;
  const error = employeesError || contractsError || hoursError;

  if (error) {
    return (
      <Layout>
        <div className="rounded-lg bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Er is een fout opgetreden bij het ophalen van de gegevens</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>De Gripp API is momenteel niet beschikbaar. We proberen het automatisch opnieuw. Als het probleem aanhoudt, neem dan contact op met de beheerder.</p>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Employee Hours Overview</h1>
          <div className="flex items-center space-x-4">
            <select
              className="block rounded-md border-gray-200 py-2 pl-3 pr-10 text-base focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              value={viewType}
              onChange={(e) => setViewType(e.target.value as ViewType)}
            >
              <option value="week">Week View</option>
              <option value="month">Month View</option>
              <option value="year">Year View</option>
            </select>

            {viewType === 'week' && (
              <select
                className="block rounded-md border-gray-200 py-2 pl-3 pr-10 text-base focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                value={selectedDate.week}
                onChange={(e) => setSelectedDate(prev => ({ ...prev, week: Number(e.target.value) }))}
              >
                {Array.from({ length: 52 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Week {i + 1}</option>
                ))}
              </select>
            )}

            {viewType === 'month' && (
              <select
                className="block rounded-md border-gray-200 py-2 pl-3 pr-10 text-base focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                value={selectedDate.month}
                onChange={(e) => setSelectedDate(prev => ({ ...prev, month: Number(e.target.value) }))}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {new Date(2024, i, 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            )}

            <select
              className="block rounded-md border-gray-200 py-2 pl-3 pr-10 text-base focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              value={selectedDate.year}
              onChange={(e) => setSelectedDate(prev => ({ ...prev, year: Number(e.target.value) }))}
            >
              {Array.from({ length: 3 }, (_, i) => {
                const year = new Date().getFullYear() - 1 + i;
                return (
                  <option key={year} value={year}>{year}</option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="rounded-lg bg-white shadow">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Employee
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Function
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Contract Period
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Contract Hours
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actual Hours
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Percentage
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      <div className="flex items-center justify-center">
                        <svg className="h-5 w-5 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="ml-2">Loading data...</span>
                      </div>
                    </td>
                  </tr>
                ) : activeEmployees.map(employee => {
                  const { expectedHours, actualHours, percentage, allContracts } = getEmployeeData(employee);
                  const hasIncompleteData = actualHours === 0;

                  return (
                    <tr key={employee.id} className="bg-white hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {employee.firstname} {employee.lastname}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500">{employee.function}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-500">
                          {allContracts.length > 0 ? (
                            <>
                              {new Date(allContracts[0].startdate.date).toLocaleDateString()}
                              {' - '}
                              {allContracts[allContracts.length - 1]?.enddate?.date 
                                ? new Date(allContracts[allContracts.length - 1].enddate.date).toLocaleDateString() 
                                : 'Present'}
                            </>
                          ) : (
                            'No contract found'
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{expectedHours.toFixed(1)} hours</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{actualHours.toFixed(1)} hours</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`text-sm ${hasIncompleteData ? 'text-status-critical' : percentage >= 100 ? 'text-status-normal' : 'text-gray-900'}`}>
                          {percentage.toFixed(1)}%
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
} 
