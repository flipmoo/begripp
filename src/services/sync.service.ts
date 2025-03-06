import { getDatabase, updateSyncStatus } from '../db/database';
import { executeRequest } from '../api/gripp/client';
import type { GrippRequest, GrippResponse } from '../api/gripp/client';

interface Employee {
    id: number;
    firstname: string;
    lastname: string;
    email: string;
    active: boolean;
    function?: {
        searchname: string;
    };
    department?: {
        id: number;
        searchname: string;
    };
}

interface Contract {
    id: number;
    employee: {
        id: number;
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
    startdate: {
        date: string;
    };
    enddate?: {
        date: string;
    };
    internal_price_per_hour?: string;
}

interface Hour {
    id: number;
    employee: {
        id: number;
    };
    date: {
        date: string;
    };
    amount: number;
    description: string;
    status: {
        id: number;
        searchname: string;
    };
}

interface Absence {
    id: number;
    employee: {
        id: number;
    };
    startdate: {
        date: string;
    };
    enddate: {
        date: string;
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

export async function syncEmployees() {
    const db = await getDatabase();
    try {
        const request: GrippRequest = {
            method: 'employee.get',
            params: [
                [], // No filters, get all employees
                {
                    paging: {
                        firstresult: 0,
                        maxresults: 1000 // Adjust if needed
                    }
                }
            ],
            id: Date.now()
        };

        const response = await executeRequest<Employee>(request);
        if (!response?.result?.rows) {
            throw new Error('No employees found in response');
        }
        const employees = response.result.rows;

        // Begin transaction
        await db.run('BEGIN TRANSACTION');

        // Clear existing employees
        await db.run('DELETE FROM employees');

        // Insert new employees
        for (const employee of employees) {
            await db.run(
                `INSERT INTO employees (
                    id, firstname, lastname, email, active, 
                    function, department_id, department_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    employee.id,
                    employee.firstname,
                    employee.lastname,
                    employee.email,
                    employee.active,
                    employee.function?.searchname,
                    employee.department?.id,
                    employee.department?.searchname
                ]
            );
        }

        // Commit transaction
        await db.run('COMMIT');
        await updateSyncStatus('employee.get', 'success');
    } catch (error) {
        await db.run('ROLLBACK');
        if (error instanceof Error) {
            await updateSyncStatus('employee.get', 'error', error.message);
        } else {
            await updateSyncStatus('employee.get', 'error', 'Unknown error occurred');
        }
        throw error;
    }
}

export async function syncContracts() {
    const db = await getDatabase();
    try {
        const request: GrippRequest = {
            method: 'employmentcontract.get',
            params: [
                [], // No filters, get all contracts
                {
                    paging: {
                        firstresult: 0,
                        maxresults: 1000
                    }
                }
            ],
            id: Date.now()
        };

        const response = await executeRequest<Contract>(request);
        if (!response?.result?.rows) {
            throw new Error('No contracts found in response');
        }
        const contracts = response.result.rows;

        await db.run('BEGIN TRANSACTION');
        await db.run('DELETE FROM contracts');

        for (const contract of contracts) {
            await db.run(
                `INSERT INTO contracts (
                    id, employee_id, 
                    hours_monday_even, hours_tuesday_even, hours_wednesday_even,
                    hours_thursday_even, hours_friday_even,
                    hours_monday_odd, hours_tuesday_odd, hours_wednesday_odd,
                    hours_thursday_odd, hours_friday_odd,
                    startdate, enddate, internal_price_per_hour
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    contract.id,
                    contract.employee.id,
                    contract.hours_monday_even,
                    contract.hours_tuesday_even,
                    contract.hours_wednesday_even,
                    contract.hours_thursday_even,
                    contract.hours_friday_even,
                    contract.hours_monday_odd,
                    contract.hours_tuesday_odd,
                    contract.hours_wednesday_odd,
                    contract.hours_thursday_odd,
                    contract.hours_friday_odd,
                    contract.startdate.date,
                    contract.enddate?.date,
                    contract.internal_price_per_hour
                ]
            );
        }

        await db.run('COMMIT');
        await updateSyncStatus('employmentcontract.get', 'success');
    } catch (error) {
        await db.run('ROLLBACK');
        if (error instanceof Error) {
            await updateSyncStatus('employmentcontract.get', 'error', error.message);
        } else {
            await updateSyncStatus('employmentcontract.get', 'error', 'Unknown error occurred');
        }
        throw error;
    }
}

export async function syncAbsenceRequests(startDate: string, endDate: string) {
    const db = await getDatabase();
    try {
        // Get all employees first
        const employees = await db.all('SELECT id FROM employees WHERE active = 1');
        
        for (const employee of employees) {
            const request: GrippRequest = {
                method: 'absencerequest.get',
                params: [
                    [
                        {
                            field: 'absencerequest.employee',
                            operator: 'equals',
                            value: employee.id
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
                        }
                    ],
                    {
                        paging: {
                            firstresult: 0,
                            maxresults: 250
                        }
                    }
                ],
                id: Date.now()
            };

            const response = await executeRequest(request);
            const absences = response.result;

            // Store each absence request
            for (const absence of absences) {
                await db.run(
                    `INSERT OR REPLACE INTO absence_requests (
                        id, employee_id, startdate, enddate,
                        type_id, type_name, hours_per_day,
                        description, status_id, status_name
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        absence.id,
                        absence.employee.id,
                        absence.startdate.date,
                        absence.enddate.date,
                        absence.type.id,
                        absence.type.searchname,
                        absence.hours_per_day,
                        absence.description,
                        absence.status.id,
                        absence.status.searchname
                    ]
                );
            }
        }

        await updateSyncStatus('absencerequest.get', 'success');
    } catch (error) {
        await updateSyncStatus('absencerequest.get', 'error', error.message);
        throw error;
    }
}

export async function syncHours(startDate: string, endDate: string) {
    const db = await getDatabase();
    try {
        const employees = await db.all('SELECT id FROM employees WHERE active = 1');
        
        await db.run('BEGIN TRANSACTION');
        
        // Delete existing hours in the date range
        await db.run(
            'DELETE FROM hours WHERE date BETWEEN ? AND ?',
            [startDate, endDate]
        );

        for (const employee of employees) {
            const request: GrippRequest = {
                method: 'hour.get',
                params: [
                    [
                        {
                            field: 'hour.employee',
                            operator: 'equals',
                            value: employee.id
                        },
                        {
                            field: 'hour.date',
                            operator: 'between',
                            value: startDate,
                            value2: endDate
                        }
                    ],
                    {
                        paging: {
                            firstresult: 0,
                            maxresults: 1000
                        }
                    }
                ],
                id: Date.now()
            };

            const response = await executeRequest(request);
            const hours = response.result;

            for (const hour of hours) {
                await db.run(
                    `INSERT INTO hours (
                        id, employee_id, date, amount,
                        description, status_id, status_name
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        hour.id,
                        hour.employee.id,
                        hour.date.date,
                        hour.amount,
                        hour.description,
                        hour.status.id,
                        hour.status.searchname
                    ]
                );
            }
        }

        await db.run('COMMIT');
        await updateSyncStatus('hour.get', 'success');
    } catch (error) {
        await db.run('ROLLBACK');
        await updateSyncStatus('hour.get', 'error', error.message);
        throw error;
    }
}

// Function to sync all data
export async function syncAllData(startDate: string, endDate: string) {
    try {
        await syncEmployees();
        await syncContracts();
        await syncAbsenceRequests(startDate, endDate);
        await syncHours(startDate, endDate);
        return true;
    } catch (error) {
        console.error('Error syncing data:', error);
        return false;
    }
} 