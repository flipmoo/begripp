import { format } from 'date-fns';
import { Absence, AbsencesByEmployee } from './absence.service';

export interface EmployeeWithStats {
    id: number;
    name: string;
    function?: string;
    contractPeriod?: string;
    contractHours?: number;
    holidayHours?: number;
    expectedHours: number;
    leaveHours: number;
    writtenHours: number;
    actualHours: number;
    absences?: Absence[];
}

interface ApiEmployee {
    id: number;
    name: string;
    function?: string;
    contract_period?: string;
    contract_hours?: number;
    holiday_hours?: number;
    expected_hours?: number;
    actual_hours?: number;
    leave_hours?: number;
    written_hours?: number;
}

const API_BASE = '/api';

export async function getEmployeeStats(year: number, week: number, timestamp?: number): Promise<EmployeeWithStats[]> {
    try {
        // Always use a timestamp to prevent caching issues
        const currentTimestamp = timestamp || new Date().getTime();
        const url = `/api/employees?year=${year}&week=${week}&_=${currentTimestamp}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch employee data');
        }
        
        const data: ApiEmployee[] = await response.json();
        console.log('Raw API response:', data);
        
        return data.map(employee => ({
            id: employee.id,
            name: employee.name,
            function: employee.function,
            contractPeriod: employee.contract_period,
            contractHours: employee.contract_hours,
            holidayHours: employee.holiday_hours,
            expectedHours: employee.expected_hours || 0,
            leaveHours: employee.leave_hours || 0,
            writtenHours: employee.written_hours || 0,
            actualHours: employee.actual_hours || (employee.written_hours || 0)
        }));
    } catch (error) {
        console.error('Error fetching employee stats:', error);
        return [];
    }
}

export function enrichEmployeesWithAbsences(
    employees: EmployeeWithStats[], 
    absencesByEmployee: AbsencesByEmployee
): EmployeeWithStats[] {
    return employees.map(employee => ({
        ...employee,
        absences: absencesByEmployee[employee.id] || []
    }));
}

export async function getEmployeeDetails(employeeId: number) {
    try {
        const response = await fetch(`/api/employees/${employeeId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch employee details');
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching employee details:', error);
        return null;
    }
} 