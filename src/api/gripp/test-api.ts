// Set test environment
process.env.NODE_ENV = 'test';

import 'dotenv/config';
import type { Employee } from './services/employee';
import type { Contract, GrippDate } from './services/contract';
import type { Hour } from './services/hour';
import type { GrippRequest } from './client';
import { executeTestRequest } from './test-client';

// Make sure we have the API key
if (!process.env.VITE_GRIPP_API_KEY) {
  throw new Error('VITE_GRIPP_API_KEY environment variable is required');
}

function createTestRequest(
  method: string,
  filters: Record<string, unknown>[] = [],
  options: Record<string, unknown> = {}
): GrippRequest {
  return {
    method,
    params: [filters, options],
    id: Date.now(),
  };
}

function formatDate(date: GrippDate | null | undefined): string {
  if (!date) return 'Present';
  return new Date(date.date).toLocaleDateString('nl-NL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function calculateWeeklyHours(contract: Contract, isEvenWeek: boolean): number {
  if (isEvenWeek) {
    return (
      (contract.hours_monday_even || 0) +
      (contract.hours_tuesday_even || 0) +
      (contract.hours_wednesday_even || 0) +
      (contract.hours_thursday_even || 0) +
      (contract.hours_friday_even || 0)
    );
  }
  return (
    (contract.hours_monday_odd || 0) +
    (contract.hours_tuesday_odd || 0) +
    (contract.hours_wednesday_odd || 0) +
    (contract.hours_thursday_odd || 0) +
    (contract.hours_friday_odd || 0)
  );
}

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

function calculateExpectedHours(contracts: Contract[], year: number, week: number): number {
  // Calculate start and end date of the week
  const startDate = new Date(year, 0, 1 + (week - 1) * 7);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  let totalHours = 0;
  const currentDate = new Date(startDate);

  console.log('\nCalculating hours for week:', {
    week,
    startDate: currentDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  });

  // Loop through each day of the week
  while (currentDate <= endDate) {
    // Find the contract valid for this specific date
    const validContract = getContractForDate(contracts, currentDate);

    if (validContract) {
      const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Calculate if it's an even or odd week
      const yearStart = new Date(currentDate.getFullYear(), 0, 1);
      const days = Math.floor((currentDate.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000));
      const weekNumber = Math.ceil((days + yearStart.getDay() + 1) / 7);
      const isEvenWeek = weekNumber % 2 === 0;

      console.log(`\nDay ${currentDate.toISOString().split('T')[0]}:`, {
        dayOfWeek,
        weekNumber,
        isEvenWeek,
        contractId: validContract.id,
        contractStart: formatDate(validContract.startdate),
        contractEnd: formatDate(validContract.enddate),
      });

      // Add hours based on the day and whether it's an even/odd week
      let dayHours = 0;
      if (dayOfWeek === 1) dayHours = isEvenWeek ? (validContract.hours_monday_even || 0) : (validContract.hours_monday_odd || 0);
      if (dayOfWeek === 2) dayHours = isEvenWeek ? (validContract.hours_tuesday_even || 0) : (validContract.hours_tuesday_odd || 0);
      if (dayOfWeek === 3) dayHours = isEvenWeek ? (validContract.hours_wednesday_even || 0) : (validContract.hours_wednesday_odd || 0);
      if (dayOfWeek === 4) dayHours = isEvenWeek ? (validContract.hours_thursday_even || 0) : (validContract.hours_thursday_odd || 0);
      if (dayOfWeek === 5) dayHours = isEvenWeek ? (validContract.hours_friday_even || 0) : (validContract.hours_friday_odd || 0);

      console.log('Hours for this day:', dayHours);
      totalHours += dayHours;
    } else {
      console.log(`\nNo valid contract found for ${currentDate.toISOString().split('T')[0]}`);
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return totalHours;
}

async function testContractCalculation() {
  try {
    console.log('Testing Contract Calculation...');
    
    // First get all employees
    const employeesRequest = createTestRequest(
      'employee.get',
      [],
      {
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
    
    const employeesResponse = await executeTestRequest<Employee>([employeesRequest]);
    if (!employeesResponse[0]?.result?.rows) {
      console.log('No employees found');
      return;
    }
    
    // Find Laurien Maerman
    const laurien = employeesResponse[0].result.rows.find(
      e => e.firstname === 'Laurien' && e.lastname === 'Maerman'
    );
    if (!laurien) {
      console.log('\nLaurien Maerman not found in the employees list');
      return;
    }

    console.log('\nFound Laurien:', {
      id: laurien.id,
      name: `${laurien.firstname} ${laurien.lastname}`,
      active: laurien.active,
    });

    // Get all contracts for Laurien
    const contractRequest = createTestRequest(
      'employmentcontract.get',
      [
        {
          field: 'employmentcontract.employee',
          operator: 'equals',
          value: laurien.id,
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
      }
    );

    const response = await executeTestRequest<Contract>([contractRequest]);
    if (!response[0]?.result?.rows) {
      console.log('No contracts found');
      return;
    }
    
    const contracts = response[0].result.rows;
    console.log('\nAll contracts found:', contracts.length);
    
    // Log contract details
    contracts.forEach((contract, index) => {
      console.log(`\nContract ${index + 1}:`, {
        id: contract.id,
        startDate: formatDate(contract.startdate),
        endDate: formatDate(contract.enddate),
        weeklyHoursEven: calculateWeeklyHours(contract, true),
        weeklyHoursOdd: calculateWeeklyHours(contract, false),
      });
    });

    // Calculate hours for week 8 of 2025
    const expectedHours = calculateExpectedHours(contracts, 2025, 8);
    console.log('\nTotal expected hours for week 8 of 2025:', expectedHours);

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testContractCalculation(); 

