import { getDatabase, updateSyncStatus } from '../db/database';
import { executeRequest } from '../api/gripp/client';
import type { GrippRequest, GrippResponse } from '../api/gripp/client';
import { hourService } from '../api/gripp/services/hour';
import { absenceService } from '../api/gripp/services/absence';

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
        let allEmployees: Employee[] = [];
        let currentPage = 0;
        const pageSize = 250; // Maximum allowed by the API
        let hasMoreResults = true;
        
        // Begin transaction
        await db.run('BEGIN TRANSACTION');
        
        // Debug: Query all existing employees to see functions before
        const beforeEmployees = await db.all('SELECT id, function FROM employees');
        console.log('DEBUG - Before sync: Number of employees with function:', 
            beforeEmployees.filter(e => e.function && e.function !== '').length);
        console.log('DEBUG - Example employees before sync:', 
            beforeEmployees.filter(e => e.function && e.function !== '').slice(0, 5));
        
        // Query and store existing function titles before clearing employees
        const existingFunctions = await db.all(`
            SELECT id, function FROM employees WHERE function IS NOT NULL AND function != ''
        `);
        
        console.log(`DEBUG - Preserving function titles for ${existingFunctions.length} employees`);
        console.log('DEBUG - First 5 function titles to preserve:', existingFunctions.slice(0, 5));
        
        // Create a map for faster lookup
        const functionMap = new Map();
        existingFunctions.forEach(emp => {
            functionMap.set(emp.id, emp.function);
        });
        console.log('DEBUG - Function map size:', functionMap.size);
        
        // Clear existing employees
        await db.run('DELETE FROM employees');
        
        // Verify map after delete
        console.log('DEBUG - Function map size after employees delete:', functionMap.size);
        
        while (hasMoreResults) {
            const firstResult = currentPage * pageSize;
            
            const request: GrippRequest = {
                method: 'employee.get',
                params: [
                    [], // No filters, get all employees
                    {
                        paging: {
                            firstresult: firstResult,
                            maxresults: pageSize
                        }
                    }
                ],
                id: Date.now()
            };

            console.log(`Fetching employees page ${currentPage + 1} (${firstResult} to ${firstResult + pageSize})`);
            const response = await executeRequest<Employee>(request);
            
            if (!response?.result?.rows || response.result.rows.length === 0) {
                console.log('No more employees found or end of results reached');
                hasMoreResults = false;
                break;
            }
            
            const employees = response.result.rows;
            console.log(`Received ${employees.length} employees for page ${currentPage + 1}`);
            console.log('DEBUG - First 5 employees from API:', employees.slice(0, 5).map(e => ({
                id: e.id,
                function: e.function?.searchname || 'no function'
            })));
            
            // Count how many employees have a function in the API response
            const employeesWithFunctionFromAPI = employees.filter(e => e.function && e.function.searchname);
            console.log(`DEBUG - Employees with function from API: ${employeesWithFunctionFromAPI.length}`);
            
            let preservedFunctionCount = 0;
            let apiSourcedFunctionCount = 0;
            
            // Insert employees from this page
            for (const employee of employees) {
                // Check if we have a preserved function title
                const preservedFunction = functionMap.get(employee.id);
                const functionTitle = preservedFunction || employee.function?.searchname || '';
                
                if (preservedFunction) {
                    preservedFunctionCount++;
                } else if (employee.function?.searchname) {
                    apiSourcedFunctionCount++;
                }
                
                await db.run(
                    `INSERT INTO employees (
                        id, firstname, lastname, email, active, 
                        function, department_id, department_name
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        employee.id,
                        employee.firstname || '',
                        employee.lastname || '',
                        employee.email || '',
                        employee.active ? 1 : 0,
                        functionTitle,
                        employee.department?.id || null,
                        employee.department?.searchname || ''
                    ]
                );
            }
            
            console.log(`DEBUG - Used preserved functions: ${preservedFunctionCount}, Used API functions: ${apiSourcedFunctionCount}`);
            allEmployees = [...allEmployees, ...employees];
            
            // If we received fewer results than the page size, we've reached the end
            if (employees.length < pageSize) {
                hasMoreResults = false;
            } else {
                currentPage++;
            }
        }

        console.log(`Total employees synced: ${allEmployees.length}`);
        
        // Commit transaction
        await db.run('COMMIT');
        
        // Check function titles after sync
        const afterEmployees = await db.all('SELECT id, function FROM employees');
        console.log('DEBUG - After sync: Number of employees with function:', 
            afterEmployees.filter(e => e.function && e.function !== '').length);
        console.log('DEBUG - Example employees after sync:', 
            afterEmployees.filter(e => e.function && e.function !== '').slice(0, 5));
        
        // Update sync status
        await updateSyncStatus('employee.get', 'success');
        
        // Call the API to update function titles directly
        try {
            console.log('Updating function titles via API...');
            const response = await fetch('http://localhost:3002/api/update-function-titles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`Function titles updated successfully: ${result.message}`);
                
                // Check function titles after update
                const finalEmployees = await db.all('SELECT id, function FROM employees');
                console.log('DEBUG - After function update: Number of employees with function:', 
                    finalEmployees.filter(e => e.function && e.function !== '').length);
            } else {
                console.error(`Failed to update function titles: ${response.statusText}`);
            }
        } catch (titleError) {
            console.error('Error calling function title update API:', titleError);
            // Continue even if this fails
        }
        
        return true;
    } catch (error) {
        // Rollback on error
        try {
            await db.run('ROLLBACK');
        } catch (rollbackError) {
            console.error('Error during rollback:', rollbackError);
        }
        
        console.error('Error syncing employees:', error);
        
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
        let allContracts: Contract[] = [];
        let currentPage = 0;
        const pageSize = 250; // Maximum allowed by the API
        let hasMoreResults = true;
        
        // Begin transaction
        await db.run('BEGIN TRANSACTION');
        
        // Clear existing contracts
        await db.run('DELETE FROM contracts');
        
        while (hasMoreResults) {
            const firstResult = currentPage * pageSize;
            
            const request: GrippRequest = {
                method: 'employmentcontract.get',
                params: [
                    [], // No filters, get all contracts
                    {
                        paging: {
                            firstresult: firstResult,
                            maxresults: pageSize
                        }
                    }
                ],
                id: Date.now()
            };

            console.log(`Fetching contracts page ${currentPage + 1} (${firstResult} to ${firstResult + pageSize})`);
            const response = await executeRequest<Contract>(request);
            
            if (!response?.result?.rows || response.result.rows.length === 0) {
                console.log('No more contracts found or end of results reached');
                hasMoreResults = false;
                break;
            }
            
            const contracts = response.result.rows;
            console.log(`Received ${contracts.length} contracts for page ${currentPage + 1}`);
            
            // Insert contracts from this page
            for (const contract of contracts) {
                // Skip contracts without employee ID
                if (!contract.employee?.id) {
                    console.warn(`Skipping contract without employee ID: ${contract.id}`);
                    continue;
                }
                
                const startDate = contract.startdate?.date?.split(' ')[0];
                const endDate = contract.enddate?.date?.split(' ')[0] || null;
                
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
                        contract.hours_monday_even || 0,
                        contract.hours_tuesday_even || 0,
                        contract.hours_wednesday_even || 0,
                        contract.hours_thursday_even || 0,
                        contract.hours_friday_even || 0,
                        contract.hours_monday_odd || 0,
                        contract.hours_tuesday_odd || 0,
                        contract.hours_wednesday_odd || 0,
                        contract.hours_thursday_odd || 0,
                        contract.hours_friday_odd || 0,
                        startDate,
                        endDate,
                        contract.internal_price_per_hour || null
                    ]
                );
            }
            
            allContracts = [...allContracts, ...contracts];
            
            // If we received fewer results than the page size, we've reached the end
            if (contracts.length < pageSize) {
                hasMoreResults = false;
            } else {
                currentPage++;
            }
        }

        console.log(`Total contracts synced: ${allContracts.length}`);
        
        // Commit transaction
        await db.run('COMMIT');
        
        // Update sync status
        await updateSyncStatus('employmentcontract.get', 'success');
        
        return true;
    } catch (error) {
        // Rollback on error
        try {
            await db.run('ROLLBACK');
        } catch (rollbackError) {
            console.error('Error during rollback:', rollbackError);
        }
        
        console.error('Error syncing contracts:', error);
        
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
    let transaction = false;
    try {
        console.log(`Fetching absences from ${startDate} to ${endDate}`);
        
        // Begin transaction
        await db.run('BEGIN TRANSACTION');
        transaction = true;
        
        // Bewaar alle huidige status waarden, niet alleen de goedgekeurde
        const currentStatusValues = await db.all(`
            SELECT id, status_id, status_name
            FROM absence_request_lines
            WHERE date BETWEEN ? AND ?
        `, [startDate, endDate]);
        
        console.log(`Preserving status for ${currentStatusValues.length} absence lines`);
        
        // Create a map of line ID to status for faster lookup
        const statusMap = new Map();
        currentStatusValues.forEach(line => {
            statusMap.set(line.id, {
                status_id: line.status_id,
                status_name: line.status_name
            });
        });
        
        // Clear existing absence records for the date range
        await db.run(
            `DELETE FROM absence_request_lines 
             WHERE date BETWEEN ? AND ?`,
            [startDate, endDate]
        );
        
        // Get the absence requests using the new method for efficient fetching
        const absenceData = await absenceService.getAllAbsencesByPeriod(startDate, endDate);
        
        console.log(`Found ${absenceData.length} absence records for the period`);
        
        let insertedRequests = 0;
        let insertedLines = 0;
        let preservedStatusCount = 0;
        
        // Process each absence request
        for (const absenceRequest of absenceData) {
            try {
                // Skip absence requests without lines
                if (!absenceRequest.lines || absenceRequest.lines.length === 0) {
                    console.warn(`Skipping absence request ${absenceRequest.id} with no lines`);
                    continue;
                }
                
                const requestId = absenceRequest.id;
                const firstLine = absenceRequest.lines[0]; // Get the first line for request details
                
                // Extract employee info
                let employeeId = absenceRequest.employee?.id;
                const employeeSearchname = absenceRequest.employee?.searchname || firstLine.employee?.searchname;
                
                // If no employee ID directly available, try to find it
                if (!employeeId && employeeSearchname) {
                    // Query database for employee ID based on employee name
                    const employee = await db.get(
                        'SELECT id FROM employees WHERE firstname || " " || lastname = ?',
                        [employeeSearchname]
                    );
                    
                    if (employee) {
                        employeeId = employee.id;
                        console.log(`Found employee ID ${employeeId} for searchname ${employeeSearchname}`);
                    }
                }
                
                // If still no employee ID, log an error and skip this request
                if (!employeeId) {
                    console.error(`Cannot find employee for absence request ${requestId} with searchname ${employeeSearchname}`);
                    continue;
                }
                
                // Check if this request already exists
                const existingRequest = await db.get('SELECT id FROM absence_requests WHERE id = ?', [requestId]);
                
                if (existingRequest) {
                    // Update the existing request
                    await db.run(
                        `UPDATE absence_requests 
                        SET description = ?, employee_id = ?, 
                            absencetype_id = ?, absencetype_searchname = ? 
                        WHERE id = ?`,
                        [
                            firstLine.description || '',
                            employeeId,
                            absenceRequest.absencetype?.id || firstLine.absencerequest?.absencetype?.id || 1,
                            absenceRequest.absencetype?.searchname || firstLine.absencerequest?.absencetype?.searchname || 'Absence',
                            requestId
                        ]
                    );
                } else {
                    // Insert the absence request
                    await db.run(
                        `INSERT INTO absence_requests 
                        (id, description, comment, createdon, updatedon, searchname, extendedproperties, 
                         employee_id, employee_searchname, employee_discr, 
                         absencetype_id, absencetype_searchname) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            requestId,
                            firstLine.description || '',
                            '',
                            firstLine.createdon?.date || new Date().toISOString(),
                            firstLine.updatedon?.date || null,
                            firstLine.searchname || 'NOT SET',
                            firstLine.extendedproperties || null,
                            employeeId,
                            employeeSearchname || 'Unknown',
                            firstLine.employee?.discr || 'medewerker',
                            // Default values for absence type
                            absenceRequest.absencetype?.id || firstLine.absencerequest?.absencetype?.id || 1,
                            absenceRequest.absencetype?.searchname || firstLine.absencerequest?.absencetype?.searchname || 'Absence'
                        ]
                    );
                    
                    insertedRequests++;
                }
                
                // Insert each absence request line
                for (const line of absenceRequest.lines) {
                    try {
                        // Extract the date from the date object
                        const absenceDate = line.date?.date?.split(' ')[0]; // Format: YYYY-MM-DD
                        
                        if (!absenceDate) {
                            console.warn(`Skipping absence line without valid date: ${JSON.stringify(line)}`);
                            continue;
                        }
                        
                        const startingTime = line.startingtime?.date || null;
                        
                        // Check if we have preserved status values for this line
                        const preservedStatus = statusMap.get(line.id);
                        
                        // Use either preserved status or the status from the API
                        let statusId = line.absencerequeststatus?.id || 1;
                        let statusName = line.absencerequeststatus?.searchname || 'ONBEKEND';
                        
                        // Als we een bewaarde status hebben, gebruik deze
                        if (preservedStatus) {
                            statusId = preservedStatus.status_id;
                            statusName = preservedStatus.status_name;
                            preservedStatusCount++;
                        }
                        
                        // Als de status in Gripp goedgekeurd is, gebruik deze direct
                        if (line.absencerequeststatus?.id === 2 || 
                            line.absencerequeststatus?.searchname === 'GOEDGEKEURD' ||
                            line.absencerequeststatus?.searchname === 'Approved') {
                            statusId = 2;
                            statusName = 'GOEDGEKEURD';
                        }
                        
                        // Insert the absence request line
                        await db.run(
                            `INSERT INTO absence_request_lines 
                            (id, absencerequest_id, date, amount, description, startingtime, 
                             status_id, status_name, createdon, updatedon, searchname, extendedproperties) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                            [
                                line.id,
                                requestId,
                                absenceDate,
                                line.amount,
                                line.description || '',
                                startingTime,
                                statusId,
                                statusName,
                                line.createdon?.date || new Date().toISOString(),
                                line.updatedon?.date || null,
                                line.searchname || 'NOT SET',
                                line.extendedproperties || null
                            ]
                        );
                        
                        insertedLines++;
                    } catch (error) {
                        console.error(`Error processing absence request line: ${error}`);
                    }
                }
            } catch (error) {
                console.error(`Error inserting absence request: ${error}`);
            }
        }
        
        console.log(`Inserted ${insertedRequests} absence requests and ${insertedLines} absence lines into database`);
        console.log(`Preserved status for ${preservedStatusCount} absence lines`);
        
        // Commit transaction
        await db.run('COMMIT');
        transaction = false;
        
        // Update sync status
        await updateSyncStatus('absencerequest.get', 'success');
        
        return true;
    } catch (error) {
        console.error('Error syncing absence requests:', error);
        
        // Only try to rollback if we started a transaction
        if (transaction) {
            try {
                await db.run('ROLLBACK');
                transaction = false;
            } catch (rollbackError) {
                console.error('Error during rollback:', rollbackError);
            }
        }
        
        if (error instanceof Error) {
            await updateSyncStatus('absencerequest.get', 'error', error.message);
        } else {
            await updateSyncStatus('absencerequest.get', 'error', 'Unknown error occurred');
        }
        
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

        console.log(`Syncing hours for ${employees.length} employees from ${startDate} to ${endDate}`);
        
        let totalHoursSynced = 0;
        
        for (const employee of employees) {
            try {
                // Use the new function with pagination support
                const hours = await hourService.getAllHoursByEmployeeAndPeriod(
                    employee.id,
                    startDate,
                    endDate
                );
                
                console.log(`Processing ${hours.length} hours for employee ${employee.id}`);
                totalHoursSynced += hours.length;

                // Process hours in batches to avoid too many parameters in a single query
                const BATCH_SIZE = 100;
                for (let i = 0; i < hours.length; i += BATCH_SIZE) {
                    const batch = hours.slice(i, i + BATCH_SIZE);
                    
                    // Use a prepared statement for better performance
                    const stmt = await db.prepare(`
                        INSERT OR REPLACE INTO hours (
                            id, employee_id, date, amount,
                            description, status_id, status_name
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `);
                    
                    for (const hour of batch) {
                        try {
                            // Extract date from the date object
                            const hourDate = hour.date.date.split(' ')[0]; // Format: YYYY-MM-DD
                            
                            await stmt.run(
                                hour.id,
                                hour.employee.id,
                                hourDate,
                                hour.amount,
                                hour.description || '',
                                hour.status.id,
                                hour.status.searchname
                            );
                        } catch (insertError) {
                            console.error(`Error inserting hour ${hour.id} for employee ${employee.id}:`, insertError);
                            // Continue with the next hour
                        }
                    }
                    
                    await stmt.finalize();
                    console.log(`Inserted batch of ${batch.length} hours for employee ${employee.id}`);
                }
            } catch (error) {
                console.error(`Error syncing hours for employee ${employee.id}:`, error);
                // Continue with the next employee
            }
        }

        console.log(`Total hours synced: ${totalHoursSynced}`);
        await db.run('COMMIT');
        await updateSyncStatus('hour.get', 'success');
        return true;
    } catch (error) {
        try {
            await db.run('ROLLBACK');
        } catch (rollbackError) {
            console.error('Error during rollback:', rollbackError);
        }
        console.error('Error syncing hours:', error);
        await updateSyncStatus('hour.get', 'error', error instanceof Error ? error.message : 'Unknown error');
        throw error;
    }
}

// Function to sync all data
export async function syncAllData(startDate: string, endDate: string) {
    console.log(`Starting full data sync for period ${startDate} to ${endDate}`);
    
    try {
        // First sync employees and contracts
        console.log('Syncing employees...');
        await syncEmployees();
        
        console.log('Syncing contracts...');
        await syncContracts();
        
        // Sync projects
        console.log('Syncing projects...');
        try {
            // Import the projectService
            const { projectService } = await import('../api/gripp/services/project');
            const { getDatabase } = await import('../db/database');
            
            // Get database connection
            const db = await getDatabase();
            
            // Sync projects
            await projectService.syncProjects(db);
            console.log('Projects synced successfully');
        } catch (error) {
            console.error('Error syncing projects, continuing with absence sync:', error);
            // Continue with absence sync even if project sync fails
        }
        
        // Then sync absence requests
        console.log(`Syncing absence requests for period ${startDate} to ${endDate}...`);
        try {
            await syncAbsenceRequests(startDate, endDate);
        } catch (error) {
            console.error('Error syncing absence requests, continuing with hours sync:', error);
            // Continue with hours sync even if absence sync fails
        }
        
        // Finally sync hours
        console.log(`Syncing hours for period ${startDate} to ${endDate}...`);
        try {
            await syncHours(startDate, endDate);
        } catch (error) {
            console.error('Error syncing hours:', error);
            // If hours sync fails, we still want to return success if employees and contracts were synced
        }
        
        // Update function titles directly in the database
        console.log('Updating function titles directly in database...');
        try {
            // Get database connection
            const db = await getDatabase();
            
            // Fetch employees from Gripp API with their function titles
            const request: GrippRequest = {
                method: 'employee.get',
                params: [
                    [], // No filters, get all employees
                    {
                        paging: {
                            firstresult: 0,
                            maxresults: 250
                        }
                    }
                ],
                id: Date.now()
            };
            
            const response = await executeRequest<Employee>(request);
            if (!response?.result?.rows || response.result.rows.length === 0) {
                console.error('No employees found in Gripp API for function title update');
            } else {
                console.log(`Received ${response.result.rows.length} employees from Gripp API for function title update`);
                
                // Start transaction for function title updates
                await db.run('BEGIN TRANSACTION');
                
                let updatedCount = 0;
                
                // Update function titles in the database
                for (const employee of response.result.rows) {
                    if (employee.function) {
                        const functionTitle = typeof employee.function === 'string' 
                            ? employee.function 
                            : employee.function.searchname || '';
                        
                        if (functionTitle) {
                            await db.run(
                                `UPDATE employees SET function = ? WHERE id = ?`,
                                [functionTitle, employee.id]
                            );
                            updatedCount++;
                        }
                    }
                }
                
                // Commit transaction
                await db.run('COMMIT');
                
                console.log(`Updated ${updatedCount} employee function titles directly in database`);
                
                // Verify function titles were updated
                const employeesWithFunctions = await db.get(
                    'SELECT COUNT(*) as count FROM employees WHERE function IS NOT NULL AND function != ""'
                );
                console.log(`After direct update: ${employeesWithFunctions.count} employees have function titles`);
            }
        } catch (error) {
            console.error('Error updating function titles directly:', error);
            // Continue even if function title update fails
        }
        
        console.log(`Data sync completed for period ${startDate} to ${endDate}`);
        return true;
    } catch (error) {
        console.error('Error syncing data:', error);
        return false;
    }
} 