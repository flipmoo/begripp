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
        console.log('Running in offline mode - using local contract data');

        // Check if we already have contracts in the database
        const existingContracts = await db.all('SELECT COUNT(*) as count FROM contracts');

        // Controleer of existingContracts geldig is en een count property heeft
        if (existingContracts && existingContracts.length > 0 && existingContracts[0].count > 0) {
            console.log(`Found ${existingContracts[0].count} existing contracts in the database`);

            // Update sync status
            await updateSyncStatus('employmentcontract.get', 'success');

            return true;
        }

        // If no contracts exist, create some dummy contracts for testing
        console.log('No contracts found in database, creating dummy contracts');

        // Begin transaction
        await db.run('BEGIN TRANSACTION');

        // Get all employees
        const employees = await db.all('SELECT id FROM employees');

        // Create a contract for each employee
        for (const employee of employees) {
            const employeeId = employee.id;
            const contractId = 10000 + employeeId;

            // Create a contract with 40 hours per week (8 hours per day)
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
                    contractId,
                    employeeId,
                    8, // Monday even
                    8, // Tuesday even
                    8, // Wednesday even
                    8, // Thursday even
                    8, // Friday even
                    8, // Monday odd
                    8, // Tuesday odd
                    8, // Wednesday odd
                    8, // Thursday odd
                    8, // Friday odd
                    '2025-01-01', // Start date
                    null, // End date (null = indefinite)
                    85 // Internal price per hour
                ]
            );
        }

        // Commit transaction
        await db.run('COMMIT');

        // Update sync status
        await updateSyncStatus('employmentcontract.get', 'success');

        console.log(`Created dummy contracts for ${employees.length} employees`);

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
    let transactionStarted = false;

    // Helper function to print progress
    const printProgress = (current: number, total: number, message: string) => {
        const percent = Math.round((current / total) * 100);
        const progressBar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5));
        console.log(`[${progressBar}] ${percent}% | ${current}/${total} | ${message}`);
    };

    // Helper function to print section headers
    const printHeader = (title: string) => {
        console.log('\n┌' + '─'.repeat(70) + '┐');
        console.log('│ ' + title.padEnd(68) + ' │');
        console.log('└' + '─'.repeat(70) + '┘\n');
    };

    try {
        printHeader('STARTING HOURS SYNCHRONIZATION');
        console.log(`Period: ${startDate} to ${endDate}`);

        // Begin transaction
        console.log('Starting database transaction...');
        await db.run('BEGIN TRANSACTION');
        transactionStarted = true;

        // Store the current hours count for verification
        printHeader('VERIFICATION BEFORE SYNC');
        console.log('Getting current hours count for verification...');
        const beforeSyncCount = await db.get(`
            SELECT COUNT(*) as count, SUM(amount) as total
            FROM hours
            WHERE date BETWEEN ? AND ?
        `, [startDate, endDate]);

        console.log(`Before sync: Total hours for period ${startDate} to ${endDate} - Count: ${beforeSyncCount.count || 0}, Total: ${beforeSyncCount.total || 0}`);

        // Store counts for specific projects for verification
        const projectsToVerify = ['Internal hours 2025', 'Internal hours 2024'];
        const beforeProjectCounts: Record<string, { count: number, total: number }> = {};

        for (const projectName of projectsToVerify) {
            const result = await db.get(`
                SELECT COUNT(*) as count, SUM(amount) as total
                FROM hours
                WHERE project_name LIKE ?
                AND date BETWEEN ? AND ?
            `, [`%${projectName}%`, startDate, endDate]);

            beforeProjectCounts[projectName] = {
                count: result.count || 0,
                total: result.total || 0
            };

            console.log(`Before sync: ${projectName} for period ${startDate} to ${endDate} - Count: ${result.count || 0}, Total: ${result.total || 0}`);
        }

        // Delete existing hours in the date range
        console.log(`\nDeleting existing hours in range ${startDate} to ${endDate}...`);
        await db.run(
            'DELETE FROM hours WHERE date BETWEEN ? AND ?',
            [startDate, endDate]
        );
        console.log('Existing hours deleted successfully');

        printHeader('SYNCING ALL HOURS FROM GRIPP');
        console.log(`Period: ${startDate} to ${endDate}`);

        // Use the new function to get all hours for the period, regardless of employee
        console.log('Fetching all hours from Gripp API...');
        const allHours = await hourService.getAllHoursByPeriod(startDate, endDate);
        console.log(`Received ${allHours.length} hours in total from Gripp API`);

        let totalHoursSynced = 0;
        let projectHourCounts: Record<string, { count: number, total: number }> = {};

        // Track hours by project for verification
        for (const hour of allHours) {
            const projectName = hour.offerprojectbase?.searchname || 'Unknown Project';
            if (!projectHourCounts[projectName]) {
                projectHourCounts[projectName] = { count: 0, total: 0 };
            }
            projectHourCounts[projectName].count++;
            projectHourCounts[projectName].total += hour.amount;
        }

        // Process hours in batches to avoid too many parameters in a single query
        const BATCH_SIZE = 100;
        const batchCount = Math.ceil(allHours.length / BATCH_SIZE);

        printHeader(`INSERTING ${allHours.length} HOURS INTO DATABASE`);
        console.log(`Processing in ${batchCount} batches of ${BATCH_SIZE} hours each`);

        for (let j = 0; j < allHours.length; j += BATCH_SIZE) {
            const batch = allHours.slice(j, j + BATCH_SIZE);
            const batchNumber = Math.floor(j / BATCH_SIZE) + 1;

            printProgress(batchNumber, batchCount, `Processing batch ${batchNumber}/${batchCount}`);

            // Use a prepared statement for better performance
            const stmt = await db.prepare(`
                INSERT OR REPLACE INTO hours (
                    id, employee_id, date, amount,
                    description, status_id, status_name,
                    project_id, project_name, project_line_id, project_line_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const hour of batch) {
                try {
                    // Extract date from the date object
                    const hourDate = hour.date.date.split(' ')[0]; // Format: YYYY-MM-DD

                    // Extract project information directly from the Gripp API response
                    const projectId = hour.offerprojectbase?.id || null;
                    const projectName = hour.offerprojectbase?.searchname || '';
                    const projectLineId = hour.offerprojectline?.id || null;
                    const projectLineName = hour.offerprojectline?.searchname || '';

                    // Log for debugging specific projects
                    if (projectsToVerify.some(p => projectName.includes(p))) {
                        console.log(`Syncing ${projectName} hour: ${hour.id}, date: ${hourDate}, amount: ${hour.amount}, status: ${hour.status.searchname}`);
                    }

                    await stmt.run(
                        hour.id,
                        hour.employee.id,
                        hourDate,
                        hour.amount,
                        hour.description || '',
                        hour.status.id,
                        hour.status.searchname,
                        projectId,
                        projectName,
                        projectLineId,
                        projectLineName
                    );

                    totalHoursSynced++;
                } catch (insertError) {
                    console.error(`Error inserting hour ${hour.id} for employee ${hour.employee.id}:`, insertError);
                    // Continue with the next hour
                }
            }

            await stmt.finalize();
            console.log(`Inserted batch ${batchNumber}/${batchCount} (${batch.length} hours)`);
        }

        printHeader('VERIFICATION AFTER SYNC');

        // Verify the data after sync
        console.log('Verifying synced data...');
        const verificationResults = await db.get(`
            SELECT
                COUNT(*) as total_hours,
                SUM(amount) as total_amount,
                COUNT(DISTINCT employee_id) as employee_count,
                COUNT(DISTINCT project_id) as project_count
            FROM hours
            WHERE date BETWEEN ? AND ?
        `, [startDate, endDate]);

        console.log(`Verification results:
            - Total hours records: ${verificationResults.total_hours || 0}
            - Total hours amount: ${verificationResults.total_amount || 0}
            - Unique employees: ${verificationResults.employee_count || 0}
            - Unique projects: ${verificationResults.project_count || 0}
        `);

        // Verify specific projects after sync
        for (const projectName of projectsToVerify) {
            const result = await db.get(`
                SELECT COUNT(*) as count, SUM(amount) as total
                FROM hours
                WHERE project_name LIKE ?
                AND date BETWEEN ? AND ?
            `, [`%${projectName}%`, startDate, endDate]);

            const beforeCount = beforeProjectCounts[projectName] || { count: 0, total: 0 };
            const countDiff = (result.count || 0) - beforeCount.count;
            const totalDiff = (result.total || 0) - beforeCount.total;

            console.log(`After sync: ${projectName} for period ${startDate} to ${endDate} - Count: ${result.count || 0}, Total: ${result.total || 0}`);
            console.log(`Difference: ${projectName} - Count: ${countDiff > 0 ? '+' : ''}${countDiff}, Total: ${totalDiff > 0 ? '+' : ''}${totalDiff}`);
        }

        // Log hours by project for verification
        console.log('\nHours by project from API:');
        const sortedProjects = Object.entries(projectHourCounts)
            .sort((a, b) => b[1].total - a[1].total); // Sort by total hours descending

        for (const [project, stats] of sortedProjects) {
            console.log(`- ${project}: ${stats.count} records, ${stats.total} hours`);
        }

        printHeader('SYNC SUMMARY');
        console.log(`Total hours synced: ${totalHoursSynced}`);
        console.log(`Total hours in database: ${verificationResults.total_hours || 0}`);
        console.log(`Total amount in database: ${verificationResults.total_amount || 0}`);
        console.log(`Unique employees: ${verificationResults.employee_count || 0}`);
        console.log(`Unique projects: ${verificationResults.project_count || 0}`);

        // Commit transaction
        console.log('\nCommitting transaction...');
        await db.run('COMMIT');
        transactionStarted = false;
        console.log('Transaction committed successfully');

        // Update sync status
        console.log('Updating sync status...');
        await updateSyncStatus('hour.get', 'success');
        console.log('Sync status updated successfully');

        printHeader('HOURS SYNC COMPLETED SUCCESSFULLY');

        return true;
    } catch (error) {
        printHeader('ERROR DURING HOURS SYNC');

        // Rollback transaction if it was started
        if (transactionStarted) {
            try {
                console.log('Rolling back transaction...');
                await db.run('ROLLBACK');
                console.log('Transaction rolled back successfully');
            } catch (rollbackError) {
                console.error('Error during rollback:', rollbackError);
            }
        }

        console.error('Error syncing hours:', error);
        await updateSyncStatus('hour.get', 'error', error instanceof Error ? error.message : 'Unknown error');
        throw error;
    }
}

// Function to sync invoices
export async function syncInvoices() {
    const db = await getDatabase();
    try {
        console.log('Syncing invoices from Gripp API');

        // Begin transaction
        await db.run('BEGIN TRANSACTION');

        // We don't need to create the table as it already exists
        // Just log the current schema for debugging
        console.log('Using existing invoices table structure');

        // Count existing invoices
        const existingCount = await db.get('SELECT COUNT(*) as count FROM invoices');
        console.log(`Found ${existingCount.count} existing invoices in database`);

        // Only clear if we're sure we can fetch new data
        // We'll keep the existing data until we successfully fetch new data

        // Log the start of invoice fetching
        console.log('Fetching invoices from Gripp API with pagination...');

        // Prepare statement for inserting invoices using the correct column names
        const stmt = await db.prepare(`
            INSERT INTO invoices (
                id, number, date, dueDate, company, company_id, company_name,
                totalAmount, status, grippId, createdAt, updatedAt,
                isPaid, isOverdue, totalInclVat, due_date, subject, totalExclVat
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Implement our own pagination logic
        let allInvoicesCount = 0;
        let currentPage = 0;
        const pageSize = 250; // Maximum allowed by the API
        let hasMoreResults = true;

        // Array to store all fetched invoices
        const fetchedInvoices: any[] = [];

        // Get all invoices from 2000 onwards to ensure we get everything
        const startDate = new Date(2000, 0, 1); // Start from January 1, 2000 to get all historical data

        while (hasMoreResults) {
            const firstResult = currentPage * pageSize;
            console.log(`Fetching invoices page ${currentPage + 1} (${firstResult} to ${firstResult + pageSize})`);

            try {
                const request = {
                    method: 'invoice.get',
                    params: [
                        [
                            {
                                field: 'invoice.date',
                                operator: 'greaterequals',
                                value: startDate.toISOString().split('T')[0]
                            }
                        ],
                        {
                            paging: {
                                firstresult: firstResult,
                                maxresults: pageSize,
                            },
                            orderings: [
                                {
                                    field: 'invoice.date',
                                    direction: 'desc',
                                },
                            ],
                        },
                    ],
                    id: Date.now(),
                };

                console.log('Sending invoice request to Gripp API:', JSON.stringify(request, null, 2));
                const { executeRequest } = await import('../api/gripp/client');
                const response = await executeRequest(request);

                if (!response?.result?.rows || response.result.rows.length === 0) {
                    console.log('No more invoices found or end of results reached');
                    hasMoreResults = false;
                    break;
                }

                const invoices = response.result.rows;
                console.log(`Received ${invoices.length} invoices for page ${currentPage + 1}`);

                // Log pagination details from the response
                console.log(`Pagination details: start=${response.result.start}, limit=${response.result.limit}, next_start=${response.result.next_start}, more_items=${response.result.more_items_in_collection}`);

                // Log the first and last invoice of this page for debugging
                if (invoices.length > 0) {
                    console.log(`First invoice on page ${currentPage + 1}: ID=${invoices[0].id}, Number=${invoices[0].number}, Date=${invoices[0].date.date}`);
                    console.log(`Last invoice on page ${currentPage + 1}: ID=${invoices[invoices.length-1].id}, Number=${invoices[invoices.length-1].number}, Date=${invoices[invoices.length-1].date.date}`);
                }

                // Process and insert invoices from this page
                let pageInsertedCount = 0;
                for (const invoice of invoices) {
                    try {
                        // Get the totalopeninclvat value
                        const totalOpenInclVat = invoice.totalopeninclvat ? invoice.totalopeninclvat.toString() : '0.00';

                        // Calculate if invoice is paid based on totalopeninclvat
                        // An invoice is considered paid if totalopeninclvat is 0.00
                        const isPaid = totalOpenInclVat === '0.00';

                        // Check if invoice is overdue
                        const today = new Date();
                        const expiryDate = new Date(invoice.expirydate.date);
                        const isOverdue = !isPaid && expiryDate < today;

                        // Calculate VAT amount with safe handling of undefined values
                        const totalExclVat = invoice.totalexclvat ? parseFloat(invoice.totalexclvat.toString()) : 0;
                        const totalInclVat = invoice.totalinclvat ? parseFloat(invoice.totalinclvat.toString()) : 0;
                        const vatAmount = totalInclVat - totalExclVat;
                        const paidAmount = invoice.totalpayed ? parseFloat(invoice.totalpayed.toString()) : 0;

                        // Determine status
                        const status = isPaid ? 'paid' : (isOverdue ? 'overdue' : 'unpaid');

                        // Create a processed invoice object
                        const processedInvoice = {
                            id: invoice.id,
                            number: invoice.number,
                            date: invoice.date.date,
                            dueDate: invoice.expirydate.date,
                            company: invoice.company.id,
                            company_id: invoice.company.id,
                            company_name: invoice.company.searchname,
                            totalAmount: totalInclVat,
                            status: status,
                            grippId: invoice.id,
                            createdAt: invoice.date.date,
                            updatedAt: new Date().toISOString(),
                            isPaid: isPaid ? 1 : 0,
                            isOverdue: isOverdue ? 1 : 0,
                            totalInclVat: totalInclVat,
                            due_date: invoice.expirydate.date,
                            subject: invoice.description || '',
                            totalExclVat: totalExclVat
                        };

                        // Add to our array of fetched invoices
                        fetchedInvoices.push(processedInvoice);

                        // Insert using the correct column order matching our prepared statement
                        await stmt.run(
                            processedInvoice.id,
                            processedInvoice.number,
                            processedInvoice.date,
                            processedInvoice.dueDate,
                            processedInvoice.company,
                            processedInvoice.company_id,
                            processedInvoice.company_name,
                            processedInvoice.totalAmount,
                            processedInvoice.status,
                            processedInvoice.grippId,
                            processedInvoice.createdAt,
                            processedInvoice.updatedAt,
                            processedInvoice.isPaid,
                            processedInvoice.isOverdue,
                            processedInvoice.totalInclVat,
                            processedInvoice.due_date,
                            processedInvoice.subject,
                            processedInvoice.totalExclVat
                        );

                        pageInsertedCount++;
                        allInvoicesCount++;
                    } catch (error) {
                        console.error(`Error inserting invoice ${invoice.id}:`, error);
                        // Continue with next invoice
                    }
                }

                console.log(`Inserted ${pageInsertedCount} invoices from page ${currentPage + 1}`);

                // Always continue to the next page unless we explicitly know we're done
                if (invoices.length < pageSize) {
                    console.log('Received fewer invoices than page size, assuming end of results');
                    hasMoreResults = false;
                } else {
                    // Continue to the next page regardless of more_items_in_collection
                    // This ensures we get all invoices even if the API pagination is not reliable
                    currentPage++;
                    console.log(`Moving to next page: ${currentPage + 1}`);
                }
            } catch (error) {
                console.error(`Error fetching invoices page ${currentPage + 1}:`, error);

                // Try to continue with the next page
                currentPage++;

                // If we've had too many consecutive errors, stop
                if (currentPage > 20) {
                    console.error('Too many errors, stopping invoice fetch');
                    hasMoreResults = false;
                }
            }
        }

        await stmt.finalize();
        console.log(`Total fetched invoices: ${allInvoicesCount}`);

        // Only proceed with replacing existing invoices if we successfully fetched new ones
        if (allInvoicesCount > 0) {
            // Now it's safe to clear existing invoices and insert the new ones
            console.log(`Clearing existing ${existingCount.count} invoices and inserting ${allInvoicesCount} new invoices`);

            // Create a temporary table for the new invoices
            await db.run('CREATE TEMPORARY TABLE temp_invoices AS SELECT * FROM invoices WHERE 0');

            // Insert the fetched invoices into the temporary table
            for (const invoice of fetchedInvoices) {
                try {
                    await db.run(`
                        INSERT INTO temp_invoices (
                            id, number, date, dueDate, company, company_id, company_name,
                            totalAmount, status, grippId, createdAt, updatedAt,
                            isPaid, isOverdue, totalInclVat, due_date, subject, totalExclVat
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `, [
                        invoice.id,
                        invoice.number,
                        invoice.date,
                        invoice.dueDate,
                        invoice.company,
                        invoice.company_id,
                        invoice.company_name,
                        invoice.totalAmount,
                        invoice.status,
                        invoice.grippId,
                        invoice.createdAt,
                        invoice.updatedAt,
                        invoice.isPaid,
                        invoice.isOverdue,
                        invoice.totalInclVat,
                        invoice.due_date,
                        invoice.subject,
                        invoice.totalExclVat
                    ]);
                } catch (error) {
                    console.error(`Error inserting invoice ${invoice.id} into temp table:`, error);
                }
            }

            // Clear the main invoices table
            await db.run('DELETE FROM invoices');

            // Copy from temporary table to main table
            await db.run('INSERT INTO invoices SELECT * FROM temp_invoices');

            // Drop the temporary table
            await db.run('DROP TABLE temp_invoices');

            // Verify the number of invoices in the database
            const countResult = await db.get('SELECT COUNT(*) as count FROM invoices');
            console.log(`Total invoices in database after sync: ${countResult.count}`);
        } else {
            console.log('No invoices were fetched. Keeping existing invoices in the database.');

            // Verify the number of invoices in the database
            const countResult = await db.get('SELECT COUNT(*) as count FROM invoices');
            console.log(`Total invoices in database (unchanged): ${countResult.count}`);
        }

        // Commit transaction
        await db.run('COMMIT');

        // Update sync status
        await updateSyncStatus('invoice.get', 'success');

        return true;
    } catch (error) {
        // Rollback on error
        try {
            await db.run('ROLLBACK');
        } catch (rollbackError) {
            console.error('Error during rollback:', rollbackError);
        }

        console.error('Error syncing invoices:', error);

        if (error instanceof Error) {
            await updateSyncStatus('invoice.get', 'error', error.message);
        } else {
            await updateSyncStatus('invoice.get', 'error', 'Unknown error occurred');
        }

        throw error;
    }
}

// Function to sync all data
/**
 * Sync hours data for a specific period
 * @param startDate Start date in YYYY-MM-DD format
 * @param endDate End date in YYYY-MM-DD format
 * @returns True if sync was successful, false otherwise
 */
export async function syncHoursData(startDate: string, endDate: string): Promise<boolean> {
    console.log(`Syncing hours data for period ${startDate} to ${endDate}`);
    try {
        // Sync absence requests first
        console.log(`Syncing absence requests for period ${startDate} to ${endDate}...`);
        try {
            await syncAbsenceRequests(startDate, endDate);
            console.log('Absence requests synced successfully');
        } catch (error) {
            console.error('Error syncing absence requests, continuing with hours sync:', error);
            // Continue with hours sync even if absence sync fails
        }

        // Then sync hours
        console.log(`Syncing hours for period ${startDate} to ${endDate}...`);
        try {
            await syncHours(startDate, endDate);
            console.log('Hours synced successfully');
        } catch (error) {
            console.error('Error syncing hours:', error);
            // If hours sync fails, we still want to return success if absence sync was successful
        }

        return true;
    } catch (error) {
        console.error('Error syncing hours data:', error);
        return false;
    }
}

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

        // Sync invoices
        console.log('Syncing invoices...');
        try {
            await syncInvoices();
            console.log('Invoices synced successfully');
        } catch (error) {
            console.error('Error syncing invoices, continuing with absence sync:', error);
            // Continue with absence sync even if invoice sync fails
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