import express from 'express';
import cors from 'cors';
import { getDatabase, updateSyncStatus } from '../../db/database';
import { Database as SqliteDatabase } from 'sqlite';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { employeeService } from './services/employee';
import { contractService } from './services/contract';
import { absenceService } from './services/absence';
import { normalizeDate, getWeekDates } from './utils/date-utils';
import { calculateLeaveHours } from './utils/leave-utils';

const exec = promisify(execCallback);
const app = express();
const port = 3002;

// Create Express router
export const router = express.Router();

app.use(cors());
app.use(express.json());

// Add CORS headers to allow requests from any origin
app.use((_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

let db: SqliteDatabase | null = null;

// Initialize database on startup
getDatabase().then(async database => {
  db = database;
  console.log('Database connected');
  
  // Log the tables in the database
  const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('Tables in database:', tables.map(t => t.name));
  
  // Log the number of employees
  const employeeCount = await db.get("SELECT COUNT(*) as count FROM employees");
  console.log('Number of employees:', employeeCount.count);
  
  // Log the number of contracts
  const contractCount = await db.get("SELECT COUNT(*) as count FROM contracts");
  console.log('Number of contracts:', contractCount.count);
  
  // Log the number of absences
  const absenceCount = await db.get("SELECT COUNT(*) as count FROM absence_requests");
  console.log('Number of absences:', absenceCount.count);
  
  // Log the number of holidays
  const holidayCount = await db.get("SELECT COUNT(*) as count FROM holidays");
  console.log('Number of holidays:', holidayCount.count);
}).catch(error => {
  console.error('Failed to connect to database:', error);
});

// Helper function to get the start and end dates of a week is now imported from date-utils.ts

// Define type for weekday to ensure type safety
export type Weekday = 1 | 2 | 3 | 4 | 5;

// Helper function to calculate leave hours for an employee for a specific week is now imported from leave-utils.ts

// Get employees endpoint
router.get('/employees', function(req, res) {
  (async () => {
    try {
      if (!db) {
        console.error('Database not initialized');
        return res.status(503).json({ error: 'Database not ready. Please try again in a few seconds.' });
      }
      
      const { year, week } = req.query;
      
      if (!year || !week) {
        return res.status(400).json({ error: 'Year and week parameters are required' });
      }
      
      const yearNum = parseInt(year as string);
      const weekNum = parseInt(week as string);
      
      if (isNaN(yearNum) || isNaN(weekNum)) {
        return res.status(400).json({ error: 'Year and week must be valid numbers' });
      }
      
      const { startDate, endDate } = getWeekDates(yearNum, weekNum);
      console.log(`Fetching employee data for week ${weekNum} of ${yearNum} (${startDate} to ${endDate})`);
      
      // Get all employees from the database
      const employeesQuery = `
        SELECT 
          id, firstname, lastname, email, function, department_id, department_name
        FROM 
          employees
        WHERE 
          active = 1
        ORDER BY 
          firstname, lastname
      `;
      
      const employees = await db.all(employeesQuery);
      console.log(`Found ${employees.length} employees`);
      
      // Get contracts for these employees
      const contractsQuery = `
        SELECT 
          employee_id,
          substr(startdate, 1, 10) as contract_start,
          CASE WHEN enddate IS NULL THEN NULL ELSE substr(enddate, 1, 10) END as contract_end,
          hours_monday_even, hours_tuesday_even, hours_wednesday_even, hours_thursday_even, hours_friday_even,
          hours_monday_odd, hours_tuesday_odd, hours_wednesday_odd, hours_thursday_odd, hours_friday_odd
        FROM 
          contracts
        WHERE 
          startdate <= ? AND (enddate IS NULL OR enddate >= ?)
      `;
      
      const contracts = await db.all(contractsQuery, [endDate, startDate]);
      console.log(`Found ${contracts.length} contracts for the period`);
      
      // Get holidays for the week
      const holidays = await db.all(`
        SELECT date, name
        FROM holidays
      `);
      console.log(`Found ${holidays.length} holidays in the database`);
      
      // Get absences for the week
      console.log(`Querying absences with parameters: endDate=${endDate}, startDate=${startDate}`);
      process.stdout.write(`Querying absences with parameters: endDate=${endDate}, startDate=${startDate}\n`);
      
      // Add debug log for SQL parameters
      console.log(`SQL parameters: [${startDate}, ${endDate}]`);
      process.stdout.write(`SQL parameters: [${startDate}, ${endDate}]\n`);
      
      const absences = await db.all(`
        SELECT 
          arl.id, 
          ar.employee_id, 
          arl.date as startdate, 
          arl.date as enddate, 
          arl.amount as hours_per_day, 
          ar.absencetype_searchname as type_name, 
          arl.description, 
          arl.status_id, 
          arl.status_name
        FROM 
          absence_request_lines arl
        JOIN 
          absence_requests ar ON arl.absencerequest_id = ar.id
        WHERE 
          arl.date BETWEEN ? AND ?
          AND (arl.status_id = 2 OR arl.status_id = 1)
      `, [startDate, endDate]);
      console.log(`Found ${absences.length} absences for the period`);
      process.stdout.write(`Found ${absences.length} absences for the period\n`);
      console.log(`Absences: ${JSON.stringify(absences)}`);
      process.stdout.write(`Absences: ${JSON.stringify(absences)}\n`);
      
      // Process the data
      const result = employees.map(employee => {
        // Default values
        let contractPeriod = 'No contract';
        let contractHours = 0;
        let holidayHours = 0;
        let expectedHours = 0;
        let leaveHours = 0;
        
        // Find contracts for this employee
        const employeeContracts = contracts.filter(c => c.employee_id === employee.id);
        
        // If employee has contracts
        if (employeeContracts.length > 0) {
          // Use the first contract (we'll assume it's the most relevant one)
          const contract = employeeContracts[0];
          
          // Format contract period - extract only the date part (YYYY-MM-DD)
          const contractStartDate = contract.contract_start.split(' ')[0];
          const contractEndDate = contract.contract_end ? contract.contract_end.split(' ')[0] : 'heden';
          contractPeriod = `${contractStartDate} - ${contractEndDate}`;
          
          // Determine if it's an even or odd week
          const isEvenWeek = weekNum % 2 === 0;
          
          // Calculate contract hours for the week
          if (isEvenWeek) {
            contractHours = (contract.hours_monday_even || 0) +
                            (contract.hours_tuesday_even || 0) +
                            (contract.hours_wednesday_even || 0) +
                            (contract.hours_thursday_even || 0) +
                            (contract.hours_friday_even || 0);
          } else {
            contractHours = (contract.hours_monday_odd || 0) +
                            (contract.hours_tuesday_odd || 0) +
                            (contract.hours_wednesday_odd || 0) +
                            (contract.hours_thursday_odd || 0) +
                            (contract.hours_friday_odd || 0);
          }
          
          // Create a map of day of week to hours
          const dayToHours = isEvenWeek 
            ? {
                1: contract.hours_monday_even || 0,
                2: contract.hours_tuesday_even || 0,
                3: contract.hours_wednesday_even || 0,
                4: contract.hours_thursday_even || 0,
                5: contract.hours_friday_even || 0
              }
            : {
                1: contract.hours_monday_odd || 0,
                2: contract.hours_tuesday_odd || 0,
                3: contract.hours_wednesday_odd || 0,
                4: contract.hours_thursday_odd || 0,
                5: contract.hours_friday_odd || 0
              };
          
          // Reset holiday hours for each employee
          holidayHours = 0;
          
          // Calculate holiday hours
          for (const holiday of holidays) {
            const holidayDate = new Date(holiday.date);
            
            // Check if the holiday is within the current week
            // Use the actual week dates instead of contract dates
            console.log(`Checking holiday: ${holiday.name} on ${holiday.date}, weekStartDate: ${startDate}, weekEndDate: ${endDate}`);
            
            // Only count holidays in the current week (using the actual week dates)
            if (holidayDate >= new Date(startDate) && holidayDate <= new Date(endDate)) {
              const dayOfWeek = holidayDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
              
              // Skip weekends
              if (dayOfWeek === 0 || dayOfWeek === 6) {
                console.log(`Skipping weekend day: ${dayOfWeek}`);
                continue;
              }
              
              // Add hours for this day if it's a weekday (1-5)
              if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                const dayHours = dayToHours[dayOfWeek as Weekday];
                console.log(`Adding ${dayHours} hours for ${holiday.name} on day ${dayOfWeek}`);
                holidayHours += dayHours;
              }
            }
          }
          
          // Calculate expected hours (contract hours minus holiday hours)
          expectedHours = Math.max(0, contractHours - holidayHours);
          
          // Calculate leave hours
          leaveHours = calculateLeaveHours(
            employee.id,
            absences,
            startDate,
            endDate,
            holidays
          );
        }
        
        // Get employee absences
        const employeeAbsences = absences.filter(a => a.employee_id === employee.id);
        
        // Return employee with calculated fields
        return {
          id: employee.id,
          name: `${employee.firstname} ${employee.lastname}`,
          email: employee.email,
          function: employee.function || '-',
          contract_period: contractPeriod,
          contract_hours: contractHours,
          holiday_hours: holidayHours,
          expected_hours: expectedHours,
          leave_hours: leaveHours,
          written_hours: 0, // Placeholder for written hours
          absences: employeeAbsences
        };
      });
      
      return res.json(result);
    } catch (error) {
      console.error('Error fetching employees:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })();
});

// Add function to sync Dutch holidays
async function syncDutchHolidays(year: number) {
  if (!db) {
    console.error('Database not initialized');
    return;
  }

  const holidays = [
    { date: `${year}-01-01`, name: 'Nieuwjaarsdag' },
    { date: `${year}-04-07`, name: 'Goede Vrijdag' }, // Approximate, should be calculated based on Easter
    { date: `${year}-04-10`, name: 'Paasmaandag' },   // Approximate, should be calculated based on Easter
    { date: `${year}-04-27`, name: 'Koningsdag' },
    { date: `${year}-05-05`, name: 'Bevrijdingsdag' },
    { date: `${year}-05-18`, name: 'Hemelvaartsdag' }, // Approximate, should be calculated based on Easter
    { date: `${year}-05-29`, name: 'Pinkstermaandag' }, // Approximate, should be calculated based on Easter
    { date: `${year}-12-25`, name: 'Eerste Kerstdag' },
    { date: `${year}-12-26`, name: 'Tweede Kerstdag' }
  ];

  console.log(`Adding ${holidays.length} Dutch holidays for ${year}`);

  for (const holiday of holidays) {
    try {
      await db.run(
        'INSERT OR IGNORE INTO holidays (date, name) VALUES (?, ?)',
        [holiday.date, holiday.name]
      );
    } catch (error) {
      console.error(`Error inserting holiday ${holiday.name}:`, error);
    }
  }

  const count = await db.get('SELECT COUNT(*) as count FROM holidays');
  console.log(`Total holidays in database: ${count.count}`);
}

// Modify the sync endpoint to include holiday sync
router.post('/sync', async (req, res) => {
  try {
    if (!db) {
      console.error('Database not initialized');
      return res.status(503).json({ error: 'Database not ready. Please try again in a few seconds.' });
    }
    
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    
    console.log(`Syncing data for period ${startDate} to ${endDate}`);
    
    // Get all employees from Gripp API
    console.log('Fetching employees from Gripp API...');
    const employeeResult = await employeeService.getAll();
    
    if (!employeeResult?.result?.rows?.length) {
      return res.status(500).json({ error: 'No employees found in Gripp API' });
    }
    
    console.log(`Found ${employeeResult.result.rows.length} employees in Gripp API`);
    
    // Get contracts for these employees
    console.log('Fetching contracts from Gripp API...');
    const employeeIds = employeeResult.result.rows.map(emp => emp.id);
    const contractResults = await contractService.getByEmployeeIds(employeeIds);
    
    console.log(`Found ${contractResults.result?.rows?.length || 0} contracts in Gripp API`);
    
    // Begin transaction
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Clear existing employees
      await db.run('DELETE FROM employees');
      
      // Insert employees
      for (const employee of employeeResult.result.rows) {
        await db.run(`
          INSERT INTO employees (
            id, firstname, lastname, email, active, function, department_id, department_name
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          employee.id,
          employee.firstname,
          employee.lastname,
          employee.email,
          employee.active ? 1 : 0,
          employee.function || null,
          employee.department?.id || null,
          employee.department?.zoeknaam || null
        ]);
      }
      
      console.log(`Inserted ${employeeResult.result.rows.length} employees into database`);
      
      // Clear existing contracts
      await db.run('DELETE FROM contracts');
      
      // Insert contracts
      if (contractResults.result?.rows?.length) {
        for (const contract of contractResults.result.rows) {
          await db.run(`
            INSERT INTO contracts (
              id, employee_id, 
              hours_monday_even, hours_tuesday_even, hours_wednesday_even, hours_thursday_even, hours_friday_even,
              hours_monday_odd, hours_tuesday_odd, hours_wednesday_odd, hours_thursday_odd, hours_friday_odd,
              startdate, enddate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
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
            contract.enddate?.date || null
          ]);
        }
        
        console.log(`Inserted ${contractResults.result.rows.length} contracts into database`);
      } else {
        console.warn('No contracts found to insert');
      }
      
      // Sync holidays (for simplicity, we'll keep any existing holidays)
      // In a real implementation, you would fetch holidays from an API or calendar service
      const currentYear = new Date().getFullYear();
      await syncDutchHolidays(currentYear);
      await syncDutchHolidays(currentYear + 1);
      
      // Update sync status for holidays
      await updateSyncStatus('holidays', 'success');
      
      // Sync absence data
      console.log('Syncing absence data...');
      
      // Fetch absence data from Gripp API
      const absenceLines = await absenceService.getByEmployeeIdsAndPeriod(
        employeeIds,
        startDate,
        endDate
      );
      
      console.log(`Found ${absenceLines.length} absence lines in Gripp API`);
      
      // Clear existing absence data for the period
      await db.run('DELETE FROM absence_request_lines WHERE date >= ? AND date <= ?', [startDate, endDate]);
      
      // Get unique absence request IDs
      const absenceRequestIds = [...new Set(absenceLines.map(line => line.absencerequest.id))];
      
      // Delete absence requests that have all their lines in the period
      for (const requestId of absenceRequestIds) {
        const linesOutsidePeriod = await db.get(
          'SELECT COUNT(*) as count FROM absence_request_lines WHERE absencerequest_id = ? AND (date < ? OR date > ?)',
          [requestId, startDate, endDate]
        );
        
        if (linesOutsidePeriod.count === 0) {
          await db.run('DELETE FROM absence_requests WHERE id = ?', [requestId]);
        }
      }
      
      let insertedRequests = 0;
      let insertedLines = 0;
      
      // Group absence lines by request ID
      const absenceRequestMap = new Map();
      
      for (const line of absenceLines) {
        const requestId = line.absencerequest.id;
        
        if (!absenceRequestMap.has(requestId)) {
          absenceRequestMap.set(requestId, {
            id: requestId,
            lines: []
          });
        }
        
        absenceRequestMap.get(requestId).lines.push(line);
      }
      
      // Process each absence request
      for (const [requestId, absenceRequest] of absenceRequestMap.entries()) {
        try {
          // Check if the absence request already exists
          const existingRequest = await db.get('SELECT id FROM absence_requests WHERE id = ?', [requestId]);
          
          if (!existingRequest) {
            // Get the first line to extract employee info
            const firstLine = absenceRequest.lines[0];
            
            if (!firstLine) {
              console.error(`No lines found for absence request ${requestId}`);
              continue;
            }
            
            // Get employee ID from the database if available
            let employeeId = firstLine.employee?.id;
            
            // If employee ID is not available in the line, try to find it in the database
            if (!employeeId) {
              // Try to find the employee by searchname if available
              if (firstLine.employee?.searchname) {
                const employee = await db.get(
                  'SELECT id FROM employees WHERE searchname = ?',
                  [firstLine.employee.searchname]
                );
                
                if (employee) {
                  employeeId = employee.id;
                }
              }
              
              // If still no employee ID, use a default employee
              if (!employeeId) {
                // Get the first employee from the database
                const employee = await db.get('SELECT id FROM employees LIMIT 1');
                
                if (employee) {
                  employeeId = employee.id;
                  console.log(`Using default employee ID ${employeeId} for absence request ${requestId}`);
                } else {
                  console.error(`No employees found in the database, cannot insert absence request ${requestId}`);
                  continue;
                }
              }
            }
            
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
                firstLine.employee?.searchname || 'Unknown',
                firstLine.employee?.discr || 'medewerker',
                // Default values for absence type
                firstLine.absencerequest?.absencetype?.id || 1,
                firstLine.absencerequest?.absencetype?.searchname || 'Absence'
              ]
            );
            
            insertedRequests++;
            console.log(`Inserted absence request ${requestId}`);
          }
          
          // Insert each absence request line
          for (const line of absenceRequest.lines) {
            try {
              // Extract the date from the date object
              const absenceDate = line.date.date.split(' ')[0]; // Format: YYYY-MM-DD
              const startingTime = line.startingtime?.date || null;
              
              // Check if the absence request line already exists
              const existingLine = await db.get('SELECT id FROM absence_request_lines WHERE id = ?', [line.id]);
              
              if (existingLine) {
                // Update the existing line
                await db.run(
                  `UPDATE absence_request_lines 
                  SET absencerequest_id = ?, date = ?, amount = ?, description = ?, startingtime = ?, 
                      status_id = ?, status_name = ?, updatedon = ?, searchname = ?, extendedproperties = ? 
                  WHERE id = ?`,
                  [
                    requestId,
                    absenceDate,
                    line.amount,
                    line.description || '',
                    startingTime,
                    line.absencerequeststatus.id,
                    line.absencerequeststatus.searchname,
                    line.updatedon?.date || null,
                    line.searchname || 'NOT SET',
                    line.extendedproperties || null,
                    line.id
                  ]
                );
                
                console.log(`Updated absence line for request ${requestId} on ${absenceDate}`);
              } else {
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
                    line.absencerequeststatus.id,
                    line.absencerequeststatus.searchname,
                    line.createdon?.date || new Date().toISOString(),
                    line.updatedon?.date || null,
                    line.searchname || 'NOT SET',
                    line.extendedproperties || null
                  ]
                );
                
                insertedLines++;
                console.log(`Inserted absence line for request ${requestId} on ${absenceDate}`);
              }
            } catch (error) {
              console.error(`Error processing absence request line: ${error}`);
            }
          }
        } catch (error) {
          console.error(`Error inserting absence request: ${error}`);
        }
      }
      
      console.log(`Inserted ${insertedRequests} absence requests and ${insertedLines} absence lines into database`);
      
      await db.run(`
        INSERT OR REPLACE INTO sync_status (endpoint, last_sync, status, error)
        VALUES ('absence', datetime('now'), 'success', NULL)
      `);
      
      // Commit transaction
      await db.run('COMMIT');
      
      // Update sync status
      await db.run(`
        INSERT OR REPLACE INTO sync_status (endpoint, last_sync, status, error)
        VALUES ('contracts', datetime('now'), 'success', NULL)
      `);
      
      await db.run(`
        INSERT OR REPLACE INTO sync_status (endpoint, last_sync, status, error)
        VALUES ('holidays', datetime('now'), 'success', NULL)
      `);
      
      return res.json({ success: true, message: 'Data synced successfully' });
    } catch (error) {
      // Rollback on error
      await db.run('ROLLBACK');
      console.error('Error during sync transaction:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error syncing data:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add absence sync endpoint
router.post('/sync/absence', async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: 'startDate and endDate are required' });
    }
    
    console.log(`Syncing absence data for period ${startDate} to ${endDate}`);
    console.log('Fetching absence data from Gripp API...');
    
    // Get all employee IDs from the database
    const employees = await db.all('SELECT id FROM employees');
    const employeeIds = employees.map(emp => emp.id);
    
    console.log(`Found ${employeeIds.length} employees to sync absences for`);
    
    // Fetch absence data from Gripp API
    const absenceResponse = await absenceService.getByEmployeeIdsAndPeriod(
      employeeIds,
      startDate,
      endDate
    );
    
    // Extract the absence lines from the response
    const absenceLines = absenceResponse.result.rows;
    
    console.log(`Received ${absenceLines.length} absence lines from Gripp API`);
    console.log(`API response data: ${JSON.stringify(absenceLines.slice(0, 2), null, 2)}`);
    
    // Begin transaction
    await db.run('BEGIN TRANSACTION');
    
    // Clear existing absence data for the period
    await db.run('DELETE FROM absence_request_lines WHERE date >= ? AND date <= ?', [startDate, endDate]);
    
    // Get unique absence request IDs
    const absenceRequestIds = [...new Set(absenceLines.map(line => line.absencerequest?.id).filter(Boolean))];
    
    // Delete absence requests that have all their lines in the period
    for (const requestId of absenceRequestIds) {
      const linesOutsidePeriod = await db.get(
        'SELECT COUNT(*) as count FROM absence_request_lines WHERE absencerequest_id = ? AND (date < ? OR date > ?)',
        [requestId, startDate, endDate]
      );
      
      if (linesOutsidePeriod.count === 0) {
        await db.run('DELETE FROM absence_requests WHERE id = ?', [requestId]);
      }
    }
    
    let insertedRequests = 0;
    let insertedLines = 0;
    
    // Group absence lines by request ID
    const absenceRequestMap = new Map();
    
    for (const line of absenceLines) {
      if (!line.absencerequest || !line.absencerequest.id) {
        console.warn(`Skipping absence line without valid request ID: ${JSON.stringify(line)}`);
        continue;
      }
      
      const requestId = line.absencerequest.id;
      
      if (!absenceRequestMap.has(requestId)) {
        absenceRequestMap.set(requestId, {
          id: requestId,
          lines: []
        });
      }
      
      absenceRequestMap.get(requestId).lines.push(line);
    }
    
    // Process each absence request
    for (const [requestId, absenceRequest] of absenceRequestMap.entries()) {
      try {
        // Check if the absence request already exists
        const existingRequest = await db.get('SELECT id FROM absence_requests WHERE id = ?', [requestId]);
        
        if (!existingRequest) {
          // Get the first line to extract employee info
          const firstLine = absenceRequest.lines[0];
          
          if (!firstLine) {
            console.error(`No lines found for absence request ${requestId}`);
            continue;
          }
          
          // Get employee ID from the database if available
          let employeeId = firstLine.employee?.id;
          
          // If employee ID is not available in the line, try to find it in the database
          if (!employeeId) {
            // Try to find the employee by searchname if available
            if (firstLine.employee?.searchname) {
              const employee = await db.get(
                'SELECT id FROM employees WHERE searchname = ?',
                [firstLine.employee.searchname]
              );
              
              if (employee) {
                employeeId = employee.id;
              }
            }
            
            // If still no employee ID, use a default employee
            if (!employeeId) {
              // Get the first employee from the database
              const employee = await db.get('SELECT id FROM employees LIMIT 1');
              
              if (employee) {
                employeeId = employee.id;
                console.log(`Using default employee ID ${employeeId} for absence request ${requestId}`);
              } else {
                console.error(`No employees found in the database, cannot insert absence request ${requestId}`);
                continue;
              }
            }
          }
          
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
              firstLine.employee?.searchname || 'Unknown',
              firstLine.employee?.discr || 'medewerker',
              // Default values for absence type
              firstLine.absencerequest?.absencetype?.id || 1,
              firstLine.absencerequest?.absencetype?.searchname || 'Absence'
            ]
          );
          
          insertedRequests++;
          console.log(`Inserted absence request ${requestId}`);
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
            
            // Check if the absence request line already exists
            const existingLine = await db.get('SELECT id FROM absence_request_lines WHERE id = ?', [line.id]);
            
            if (existingLine) {
              // Update the existing line
              await db.run(
                `UPDATE absence_request_lines 
                SET absencerequest_id = ?, date = ?, amount = ?, description = ?, startingtime = ?, 
                    status_id = ?, status_name = ?, updatedon = ?, searchname = ?, extendedproperties = ? 
                WHERE id = ?`,
                [
                  requestId,
                  absenceDate,
                  line.amount,
                  line.description || '',
                  startingTime,
                  line.absencerequeststatus?.id,
                  line.absencerequeststatus?.searchname,
                  line.updatedon?.date || null,
                  line.searchname || 'NOT SET',
                  line.extendedproperties || null,
                  line.id
                ]
              );
              
              console.log(`Updated absence line for request ${requestId} on ${absenceDate}`);
            } else {
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
                  line.absencerequeststatus?.id,
                  line.absencerequeststatus?.searchname,
                  line.createdon?.date || new Date().toISOString(),
                  line.updatedon?.date || null,
                  line.searchname || 'NOT SET',
                  line.extendedproperties || null
                ]
              );
              
              insertedLines++;
              console.log(`Inserted absence line for request ${requestId} on ${absenceDate}`);
            }
          } catch (error) {
            console.error(`Error processing absence request line: ${error}`);
          }
        }
      } catch (error) {
        console.error(`Error inserting absence request: ${error}`);
      }
    }
    
    // Commit transaction
    await db.run('COMMIT');
    
    console.log(`Inserted ${insertedRequests} absence requests and ${insertedLines} absence lines into database`);
    
    res.json({ success: true, message: 'Absence data synced successfully' });
  } catch (error) {
    console.error('Error syncing absence data:', error);
    
    // Rollback transaction if there was an error
    await db.run('ROLLBACK');
    
    res.status(500).json({ success: false, message: 'Error syncing absence data' });
  }
});

// Add endpoint to get absence requests
router.get('/absencerequests', async (req, res) => {
  try {
    const { start = 0, limit = 10, startDate, endDate } = req.query;
    
    // Validate parameters
    const startNum = parseInt(start as string) || 0;
    const limitNum = parseInt(limit as string) || 10;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'startDate and endDate are required query parameters' 
      });
    }
    
    console.log(`Fetching absence requests from ${startDate} to ${endDate}, limit: ${limitNum}, start: ${startNum}`);
    
    // Get total count of absence requests
    const countResult = await db.get(
      `SELECT COUNT(*) as count FROM absence_requests 
       WHERE createdon >= ? AND createdon <= ?`,
      [startDate, endDate]
    );
    
    const totalCount = countResult.count;
    
    // Get absence requests
    const absenceRequests = await db.all(
      `SELECT 
         id, description, comment, createdon, updatedon, searchname, extendedproperties,
         employee_id, employee_searchname, employee_discr,
         absencetype_id, absencetype_searchname
       FROM absence_requests
       WHERE createdon >= ? AND createdon <= ?
       ORDER BY createdon DESC
       LIMIT ? OFFSET ?`,
      [startDate, endDate, limitNum, startNum]
    );
    
    // Get absence request lines for each request
    const result = [];
    
    for (const request of absenceRequests) {
      // Get lines for this request
      const lines = await db.all(
        `SELECT 
           id, date, amount, description, startingtime, 
           status_id, status_name, createdon, updatedon, searchname, extendedproperties
         FROM absence_request_lines
         WHERE absencerequest_id = ?
         ORDER BY date ASC`,
        [request.id]
      );
      
      // Format the data to match the expected response structure
      const formattedRequest = {
        description: request.description,
        comment: request.comment,
        id: request.id,
        createdon: formatDateObject(request.createdon),
        updatedon: formatDateObject(request.updatedon),
        searchname: request.searchname,
        extendedproperties: request.extendedproperties,
        employee: {
          id: request.employee_id,
          searchname: request.employee_searchname,
          discr: request.employee_discr
        },
        absencetype: {
          id: request.absencetype_id,
          searchname: request.absencetype_searchname
        },
        absencerequestline: lines.map(line => ({
          date: formatDateObject(line.date),
          amount: line.amount,
          description: line.description,
          startingtime: formatDateObject(line.startingtime),
          id: line.id,
          createdon: formatDateObject(line.createdon),
          updatedon: formatDateObject(line.updatedon),
          searchname: line.searchname,
          extendedproperties: line.extendedproperties,
          absencerequest: {
            id: request.id,
            searchname: request.searchname
          },
          absencerequeststatus: {
            id: line.status_id,
            searchname: line.status_name
          }
        }))
      };
      
      result.push(formattedRequest);
    }
    
    // Format the response to match the expected structure
    const response = {
      id: 1,
      thread: "IFTjs4LP0nKKHw==",
      result: {
        rows: result,
        count: totalCount,
        start: startNum,
        limit: limitNum,
        next_start: startNum + limitNum,
        more_items_in_collection: startNum + limitNum < totalCount
      },
      error: null
    };
    
    res.json([response]);
  } catch (error) {
    console.error('Error fetching absence requests:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Add endpoint to get absences
router.get('/absences', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'startDate and endDate are required query parameters' 
      });
    }
    
    console.log(`Fetching absences from ${startDate} to ${endDate}`);
    
    // Get absence request lines for the period
    const absenceLines = await db.all(`
      SELECT 
        arl.id, 
        arl.date as startdate, 
        arl.date as enddate, 
        arl.amount as hours_per_day, 
        arl.description, 
        arl.status_id, 
        arl.status_name,
        ar.employee_id,
        ar.employee_searchname,
        ar.absencetype_id,
        ar.absencetype_searchname
      FROM 
        absence_request_lines arl
      JOIN 
        absence_requests ar ON arl.absencerequest_id = ar.id
      WHERE 
        arl.date BETWEEN ? AND ?
      ORDER BY 
        arl.date ASC
    `, [startDate, endDate]);
    
    console.log(`Found ${absenceLines.length} absence lines for the period`);
    
    // Format the response to match the expected structure in the front-end
    const formattedAbsences = absenceLines.map(line => ({
      id: line.id,
      employee: {
        id: line.employee_id,
        name: line.employee_searchname
      },
      startdate: line.startdate,
      enddate: line.enddate,
      type: {
        id: line.absencetype_id,
        name: line.absencetype_searchname
      },
      hours_per_day: line.hours_per_day,
      description: line.description,
      status: {
        id: line.status_id,
        name: line.status_name
      }
    }));
    
    res.json(formattedAbsences);
  } catch (error) {
    console.error('Error fetching absences:', error);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Helper function to format date objects
function formatDateObject(dateStr) {
  if (!dateStr) return null;
  
  try {
    // If it's already a date object in string form, return it
    if (typeof dateStr === 'string' && dateStr.includes('"date"')) {
      return JSON.parse(dateStr);
    }
    
    // Otherwise, create a new date object
    const date = new Date(dateStr);
    return {
      date: date.toISOString().replace('T', ' ').substring(0, 19) + '.000000',
      timezone_type: 3,
      timezone: 'Europe/Amsterdam'
    };
  } catch (error) {
    console.error('Error formatting date:', error);
    return null;
  }
}

// Add endpoint to sync holidays
router.post('/sync/holidays', async (req, res) => {
  try {
    if (!db) {
      console.error('Database not initialized');
      return res.status(503).json({ error: 'Database not ready. Please try again in a few seconds.' });
    }

    const currentYear = new Date().getFullYear();
    await syncDutchHolidays(currentYear);
    await syncDutchHolidays(currentYear + 1);
    
    // Update sync status for holidays
    await updateSyncStatus('holidays', 'success');
    
    return res.json({ success: true, message: 'Holidays synced successfully' });
  } catch (error) {
    console.error('Error syncing holidays:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Helper function to get week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Mount the router
app.use('/api', router);

// Start the server with error handling
const server = app.listen(port, () => {
  console.log(`Simple API Server running at http://localhost:${port}`);
}).on('error', async (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Trying to close existing connection...`);
    try {
      await exec(`lsof -i :${port} | grep LISTEN | awk '{print $2}' | xargs kill -9`);
      console.log(`Successfully killed process on port ${port}. Restarting server...`);
      server.listen(port);
    } catch (err) {
      console.error(`Failed to kill process on port ${port}:`, err);
      process.exit(1);
    }
  } else {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}); 