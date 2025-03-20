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
import { syncHours, syncAllData, syncAbsenceRequests } from '../../services/sync.service';
import { projectService, ProjectService } from './services/project';
import { cacheService, CACHE_KEYS } from './cache-service';
import { GrippRequest, executeRequest } from './client';

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
let autoSyncInterval: NodeJS.Timeout | null = null;
let isAutoSyncEnabled = false;

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

  // Controleer of de projects tabel bestaat
  try {
    const projectCount = await db.get("SELECT COUNT(*) as count FROM projects");
    console.log('Number of projects:', projectCount.count);
  } catch (_error) {
    console.log('Projects table not found or error counting projects');
  }

  // Log the number of absences
  const absenceCount = await db.get("SELECT COUNT(*) as count FROM absence_requests");
  console.log('Number of absences:', absenceCount.count);
  
  // Log the number of holidays
  const holidayCount = await db.get("SELECT COUNT(*) as count FROM holidays");
  console.log('Number of holidays:', holidayCount.count);

  // Check if auto-sync was previously enabled
  const syncStatus = await db.get("SELECT value FROM settings WHERE key = 'auto_sync_enabled'");
  if (syncStatus && syncStatus.value === 'true') {
    startAutoSync();
  }

  // Create the project service if it doesn't exist yet
  let projectServiceInstance = projectService;
  if (!projectServiceInstance) {
    projectServiceInstance = new ProjectService();
  }
}).catch(error => {
  console.error('Failed to connect to database:', error);
});

// Function to start auto-sync
async function startAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
  }

  isAutoSyncEnabled = true;
  
  // Save auto-sync status to database
  if (db) {
    await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_sync_enabled', 'true')");
  }

  // Run initial sync
  await runAutoSync();
  
  // Set up interval for auto-sync (every hour)
  autoSyncInterval = setInterval(runAutoSync, 60 * 60 * 1000);
  console.log('Auto-sync started. Will sync every hour.');
}

// Function to stop auto-sync
async function stopAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }

  isAutoSyncEnabled = false;
  
  // Save auto-sync status to database
  if (db) {
    await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_sync_enabled', 'false')");
  }
  
  console.log('Auto-sync stopped.');
}

// Function to run auto-sync
async function runAutoSync() {
  try {
    console.log('Running auto-sync...');
    
    // Update function titles from Gripp
    try {
      console.log('Updating function titles from Gripp...');
      
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

      const response = await executeRequest<any>(request);
      
      if (response?.result?.rows && response.result.rows.length > 0) {
        console.log(`Received ${response.result.rows.length} employees from Gripp API for function title update`);
        
        let updatedCount = 0;
        
        // Begin transaction
        if (db) {
          await db.run('BEGIN TRANSACTION');
          
          for (const employee of response.result.rows) {
            // Check if the employee has a function
            if (employee.function) {
              // Update the function title in the database
              await db.run(
                `UPDATE employees SET function = ? WHERE id = ?`,
                [typeof employee.function === 'string' ? employee.function.trim() : employee.function.searchname?.trim() || '', employee.id]
              );
              updatedCount++;
            }
          }
          
          // Commit transaction
          await db.run('COMMIT');
          
          console.log(`Updated function titles for ${updatedCount} employees during auto-sync`);
        }
      }
    } catch (error) {
      console.error('Error updating function titles during auto-sync:', error);
      // Continue with the rest of the sync process even if function title update fails
    }
    
    // Get current date
    const now = new Date();
    
    // Sync data for the current month and the previous month
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JavaScript months are 0-indexed
    
    // Calculate previous month
    let previousMonth = currentMonth - 1;
    let previousYear = currentYear;
    if (previousMonth === 0) {
      previousMonth = 12;
      previousYear--;
    }
    
    // Format dates for current month
    const currentMonthStart = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(currentYear, currentMonth, 0).getDate();
    const currentMonthEnd = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${lastDay}`;
    
    // Format dates for previous month
    const previousMonthStart = `${previousYear}-${previousMonth.toString().padStart(2, '0')}-01`;
    const previousLastDay = new Date(previousYear, previousMonth, 0).getDate();
    const previousMonthEnd = `${previousYear}-${previousMonth.toString().padStart(2, '0')}-${previousLastDay}`;
    
    // Sync data for both months
    console.log(`Syncing data for current month: ${currentMonthStart} to ${currentMonthEnd}`);
    await syncAllData(currentMonthStart, currentMonthEnd);
    
    console.log(`Syncing data for previous month: ${previousMonthStart} to ${previousMonthEnd}`);
    await syncAllData(previousMonthStart, previousMonthEnd);
    
    // Update last sync time
    if (db) {
      await db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_auto_sync', ?)", [new Date().toISOString()]);
    }
    
    console.log('Auto-sync completed successfully.');
  } catch (error) {
    console.error('Error during auto-sync:', error);
  }
}

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
      
      const cacheKey = CACHE_KEYS.EMPLOYEES_WEEK(yearNum, weekNum);
      
      // Check if data is in cache
      const cachedData = cacheService.get(cacheKey);
      if (cachedData) {
        console.log(`Using cached data for year=${yearNum}, week=${weekNum}`);
        return res.json(cachedData);
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
          written_hours: 0, // Will be updated with actual hours
          actual_hours: 0, // Will be calculated
          absences: employeeAbsences,
          active: employee.active === 1 || employee.active === true, // Match the logic in api-server.ts
        };
      });
      
      // Fetch written hours for all employees in the specified week
      const writtenHoursQuery = `
        SELECT employee_id, SUM(amount) as total_hours
        FROM hours
        WHERE date BETWEEN ? AND ?
        GROUP BY employee_id
      `;
      
      const writtenHours = await db.all(writtenHoursQuery, [startDate, endDate]);
      
      // Create a map for quick lookup
      const writtenHoursMap = new Map();
      writtenHours.forEach(row => {
        writtenHoursMap.set(row.employee_id, row.total_hours);
      });
      
      // Get days with written hours for each employee
      const daysWithHoursQuery = `
        SELECT employee_id, date
        FROM hours
        WHERE date BETWEEN ? AND ?
        GROUP BY employee_id, date
      `;
      
      const daysWithHours = await db.all(daysWithHoursQuery, [startDate, endDate]);
      
      // Create a map of days with written hours for each employee
      const daysWithHoursMap = new Map();
      daysWithHours.forEach(row => {
        const employeeId = row.employee_id;
        const date = row.date.split(' ')[0]; // Extract just the date part
        
        if (!daysWithHoursMap.has(employeeId)) {
          daysWithHoursMap.set(employeeId, new Set());
        }
        
        daysWithHoursMap.get(employeeId).add(date);
      });
      
      // Update the result with written hours and calculate actual hours
      result.forEach(employee => {
        const employeeId = employee.id;
        let writtenHoursValue = writtenHoursMap.get(employeeId) || 0;
        
        // Only use the actual written hours from the database, no automatic additions
        employee.written_hours = writtenHoursValue;
        
        // Calculate actual hours as the sum of leave hours and written hours
        employee.actual_hours = employee.leave_hours + employee.written_hours;
      });
      
      // After processing the data, store it in cache
      cacheService.set(cacheKey, result);
      
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

// Endpoint to get employees data by month
app.get('/api/employees/month', async (req, res) => {
  (async () => {
    try {
      // Parse month and year from query parameters
      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);
      
      if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
        return res.status(400).json({ error: 'Invalid month or year' });
      }
      
      const cacheKey = CACHE_KEYS.EMPLOYEES_MONTH(year, month);
      
      // Check if data is in cache
      const cachedData = cacheService.get(cacheKey);
      if (cachedData) {
        console.log(`Using cached data for year=${year}, month=${month}`);
        return res.json(cachedData);
      }
      
      // Calculate start and end date for the month
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      // In JavaScript, months are 0-indexed, so we need to use month-1 for the current month
      // and month for the next month, then get day 0 of the next month (which is the last day of the current month)
      const lastDay = new Date(year, month, 0).getDate(); // Get last day of the month
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay}`;
      
      console.log(`Fetching employee data for month ${month} of ${year} (${startDate} to ${endDate})`);
      
      // Get employees
      const employees = await db.all('SELECT * FROM employees');
      
      // Get contracts
      const contracts = await db.all(`
        SELECT * FROM contracts 
        WHERE (startdate <= ? AND (enddate IS NULL OR enddate >= ?))
      `, [endDate, startDate]);
      
      // Get absences for the month
      const absences = await db.all(`
        SELECT ar.id, ar.employee_id, arl.date as startdate, arl.date as enddate, arl.amount as hours_per_day, 
               ar.absencetype_searchname as type_name, ar.description, arl.status_id, arl.status_name
        FROM absence_request_lines arl
        JOIN absence_requests ar ON arl.absencerequest_id = ar.id
        WHERE arl.date BETWEEN ? AND ?
      `, [startDate, endDate]);
      
      // Get holidays for the month
      const holidays = await db.all(`
        SELECT * FROM holidays
        WHERE date BETWEEN ? AND ?
      `, [startDate, endDate]);
      
      // Process employees
      const result = employees.map(employee => {
        // Find contracts for this employee
        const employeeContracts = contracts.filter(contract => contract.employee_id === employee.id);
        
        // Calculate contract hours and period
        let contractHours = 0;
        let contractStartDate = null;
        let contractEndDate = null;
        
        if (employeeContracts.length > 0) {
          // Sort contracts by start date (descending)
          employeeContracts.sort((a, b) => new Date(b.startdate).getTime() - new Date(a.startdate).getTime());
          
          // Use the most recent contract
          const latestContract = employeeContracts[0];
          contractHours = latestContract.hours_monday_even + latestContract.hours_tuesday_even + 
                         latestContract.hours_wednesday_even + latestContract.hours_thursday_even + 
                         latestContract.hours_friday_even;
          contractStartDate = latestContract.startdate;
          contractEndDate = latestContract.enddate;
        }
        
        // Format contract period
        const contractPeriod = contractStartDate ? 
          `${contractStartDate.split(' ')[0]}${contractEndDate ? ` - ${contractEndDate.split(' ')[0]}` : ''}` : 
          'No contract';
        
        // Find absences for this employee
        const employeeAbsences = absences.filter(absence => absence.employee_id === employee.id);
        
        // Calculate leave hours for the month
        let leaveHours = 0;
        employeeAbsences.forEach(absence => {
          leaveHours += absence.hours_per_day;
        });
        
        // Calculate holiday hours for the month
        let holidayHours = 0;
        holidays.forEach(holiday => {
          const holidayDate = new Date(holiday.date);
          const dayOfWeek = holidayDate.getDay();
          
          // Skip weekends
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            // Check if employee has a contract on this date
            if (contractStartDate && (!contractEndDate || new Date(contractEndDate) >= holidayDate) && 
                new Date(contractStartDate) <= holidayDate) {
              // Add 8 hours for each holiday (or the appropriate amount based on contract)
              holidayHours += 8;
            }
          }
        });
        
        // Calculate expected hours for the month (excluding weekends and holidays)
        let expectedHours = 0;
        if (contractHours > 0) {
          // Count working days in the month (excluding weekends and holidays)
          let workingDays = 0;
          const holidayDates = new Set(holidays.map(h => h.date));
          
          // Loop through each day of the month
          const currentDate = new Date(startDate);
          const monthEndDate = new Date(endDate);
          
          while (currentDate <= monthEndDate) {
            const dayOfWeek = currentDate.getDay();
            const dateString = currentDate.toISOString().split('T')[0];
            
            // Skip weekends and holidays
            if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateString)) {
              // Check if employee has a contract on this date
              if (contractStartDate && (!contractEndDate || new Date(contractEndDate) >= currentDate) && 
                  new Date(contractStartDate) <= currentDate) {
                workingDays++;
              }
            }
            
            // Move to the next day
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          // Calculate expected hours based on working days
          expectedHours = workingDays * (contractHours / 5); // Use actual contract hours per day
        }
        
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
          written_hours: 0, // Will be updated with actual hours
          actual_hours: 0, // Will be calculated
          absences: employeeAbsences,
          active: employee.active === 1 || employee.active === true, // Match the logic in api-server.ts
        };
      });
      
      // Fetch written hours for all employees in the specified month
      const writtenHoursQuery = `
        SELECT employee_id, SUM(amount) as total_hours
        FROM hours
        WHERE date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ? OR date LIKE ?
        GROUP BY employee_id
      `;
      
      // Generate date patterns for each day of the month
      const datePatterns = [];
      const currentDate = new Date(year, month - 1, 1); // Month is 0-indexed in JavaScript Date
      const endDateObj = new Date(year, month, 0);
      
      while (currentDate <= endDateObj) {
        const day = currentDate.getDate().toString().padStart(2, '0');
        datePatterns.push(`${year}-${month.toString().padStart(2, '0')}-${day}%`);
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Fill in any remaining parameters with empty strings
      while (datePatterns.length < 31) {
        datePatterns.push('');
      }
      
      const writtenHours = await db.all(writtenHoursQuery, datePatterns);
      
      // Create a map for quick lookup
      const writtenHoursMap = new Map();
      writtenHours.forEach(row => {
        writtenHoursMap.set(row.employee_id, row.total_hours);
      });
      
      // Get days with written hours for each employee
      const daysWithHoursQuery = `
        SELECT employee_id, date
        FROM hours
        WHERE date BETWEEN ? AND ?
        GROUP BY employee_id, date
      `;
      
      const daysWithHours = await db.all(daysWithHoursQuery, [startDate, endDate]);
      
      // Create a map of days with written hours for each employee
      const daysWithHoursMap = new Map();
      daysWithHours.forEach(row => {
        const employeeId = row.employee_id;
        const date = row.date.split(' ')[0]; // Extract just the date part
        
        if (!daysWithHoursMap.has(employeeId)) {
          daysWithHoursMap.set(employeeId, new Set());
        }
        
        daysWithHoursMap.get(employeeId).add(date);
      });
      
      // Update the result with written hours and calculate actual hours
      result.forEach(employee => {
        const employeeId = employee.id;
        let writtenHoursValue = writtenHoursMap.get(employeeId) || 0;
        
        // Only use the actual written hours from the database, no automatic additions
        employee.written_hours = writtenHoursValue;
        
        // Calculate actual hours as the sum of leave hours and written hours
        employee.actual_hours = employee.leave_hours + employee.written_hours;
      });
      
      // After processing the data, store it in cache
      cacheService.set(cacheKey, result);
      
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
      return res.status(503).json({ 
        success: false, 
        error: 'Database not ready. Please try again in a few seconds.' 
      });
    }
    
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ 
        success: false, 
        error: 'startDate and endDate are required' 
      });
    }
    
    console.log(`Syncing data for period ${startDate} to ${endDate}`);
    
    // Clear employee data cache before syncing
    cacheService.clearEmployeeData();
    
    // Use the syncAllData function from sync.service.ts
    const success = await syncAllData(startDate, endDate);
    
    if (success) {
      return res.json({ 
        success: true, 
        message: 'Data synced successfully',
        syncedPeriod: {
          startDate,
          endDate
        }
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to sync data',
        details: 'Check server logs for more information'
      });
    }
  } catch (error) {
    console.error('Error syncing data:', error);
    res.status(500).json({ 
      success: false,
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
      return res.status(400).json({ 
        success: false, 
        message: 'startDate and endDate are required' 
      });
    }
    
    console.log(`Syncing absence data for period ${startDate} to ${endDate}`);
    
    try {
      await syncAbsenceRequests(startDate, endDate);
      return res.json({ 
        success: true, 
        message: 'Absence data synced successfully',
        syncedPeriod: {
          startDate,
          endDate
        }
      });
    } catch (error) {
      console.error('Error syncing absence data:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to sync absence data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error in absence sync endpoint:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add auto-sync endpoints
router.post('/auto-sync/start', async (req, res) => {
  try {
    await startAutoSync();
    res.json({ success: true, message: 'Auto-sync started' });
  } catch (error) {
    console.error('Error starting auto-sync:', error);
    res.status(500).json({ error: 'Failed to start auto-sync' });
  }
});

router.post('/auto-sync/stop', async (req, res) => {
  try {
    await stopAutoSync();
    res.json({ success: true, message: 'Auto-sync stopped' });
  } catch (error) {
    console.error('Error stopping auto-sync:', error);
    res.status(500).json({ error: 'Failed to stop auto-sync' });
  }
});

router.get('/auto-sync/status', async (req, res) => {
  try {
    let lastSync = null;
    
    if (db) {
      const lastSyncRecord = await db.get("SELECT value FROM settings WHERE key = 'last_auto_sync'");
      if (lastSyncRecord) {
        lastSync = lastSyncRecord.value;
      }
    }
    
    res.json({
      enabled: isAutoSyncEnabled,
      lastSync: lastSync
    });
  } catch (error) {
    console.error('Error getting auto-sync status:', error);
    res.status(500).json({ error: 'Failed to get auto-sync status' });
  }
});

router.post('/auto-sync/run-now', async (req, res) => {
  try {
    await runAutoSync();
    res.json({ success: true, message: 'Manual auto-sync completed' });
  } catch (error) {
    console.error('Error running manual auto-sync:', error);
    res.status(500).json({ error: 'Failed to run manual auto-sync' });
  }
});

// Dashboard endpoints
router.get('/dashboard/test', async (req, res) => {
  try {
    res.json({ status: 'ok', message: 'Dashboard API is working' });
  } catch (error) {
    console.error('Error in dashboard test endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/dashboard/projects/active', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const projects = await projectService.getActiveProjects(db);
    res.json({ response: projects });
  } catch (error) {
    console.error('Error fetching active projects:', error);
    res.status(500).json({ error: 'Failed to fetch active projects' });
  }
});

router.get('/dashboard/projects/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }

    const project = await projectService.getProjectById(db, projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ response: project });
  } catch (error) {
    console.error(`Error fetching project ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch project details' });
  }
});

router.post('/dashboard/sync/projects', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }

    await projectService.syncProjects(db);
    res.json({ status: 'ok', message: 'Projects synchronized successfully' });
  } catch (error) {
    console.error('Error synchronizing projects:', error);
    res.status(500).json({ error: 'Failed to synchronize projects' });
  }
});

// Add endpoint to clear cache
router.post('/cache/clear', (req, res) => {
  try {
    cacheService.clear();
    console.log('Cache cleared successfully');
    return res.json({ 
      success: true, 
      message: 'Cache cleared successfully' 
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to clear cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add endpoint to clear employee data cache
router.post('/cache/clear/employees', (req, res) => {
  try {
    cacheService.clearEmployeeData();
    console.log('Employee data cache cleared successfully');
    return res.json({ 
      success: true, 
      message: 'Employee data cache cleared successfully' 
    });
  } catch (error) {
    console.error('Error clearing employee data cache:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to clear employee data cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add endpoint to get cache status
router.get('/cache/status', (req, res) => {
  try {
    const keys = cacheService.keys();
    const stats = {
      total: keys.length,
      employeeWeek: keys.filter(key => key.startsWith('employees_week_')).length,
      employeeMonth: keys.filter(key => key.startsWith('employees_month_')).length,
      keys: keys
    };
    
    return res.json({ 
      success: true, 
      stats
    });
  } catch (error) {
    console.error('Error getting cache status:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Failed to get cache status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Endpoint to update function titles from Gripp API
app.post('/api/update-function-titles', async (req, res) => {
  try {
    if (!db) {
      console.error('Database not initialized');
      return res.status(503).json({ error: 'Database not ready. Please try again in a few seconds.' });
    }

    console.log('Fetching employees from Gripp API to update function titles');
    
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

    const response = await executeRequest<any>(request);
    
    if (!response?.result?.rows || response.result.rows.length === 0) {
      return res.status(404).json({ error: 'No employees found in Gripp API' });
    }
    
    console.log(`Received ${response.result.rows.length} employees from Gripp API`);
    
    // Log the first employee to see the structure
    console.log('Sample employee data:', JSON.stringify(response.result.rows[0], null, 2));
    
    let updatedCount = 0;
    
    // Begin transaction
    await db.run('BEGIN TRANSACTION');
    
    for (const employee of response.result.rows) {
      // Check if the employee has a function
      if (employee.function) {
        // Update the function title in the database
        await db.run(
          `UPDATE employees SET function = ? WHERE id = ?`,
          [typeof employee.function === 'string' ? employee.function.trim() : employee.function.searchname?.trim() || '', employee.id]
        );
        updatedCount++;
      }
    }
    
    // Commit transaction
    await db.run('COMMIT');
    
    console.log(`Updated function titles for ${updatedCount} employees`);
    
    return res.json({ 
      success: true, 
      message: `Updated function titles for ${updatedCount} employees` 
    });
  } catch (error) {
    console.error('Error updating function titles:', error);
    
    // Rollback transaction if there was an error
    if (db) {
      await db.run('ROLLBACK');
    }
    
    return res.status(500).json({ 
      error: 'Failed to update function titles', 
      message: error instanceof Error ? error.message : String(error),
      details: error
    });
  }
});

// Mount the router
app.use('/api', router);

// Start the server with error handling
const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  
  // Initialize the database
  getDatabase().then(database => {
    db = database;
    console.log('Database connected');
    
    // Create the project service if it doesn't exist yet
    let projectServiceInstance = projectService;
    if (!projectServiceInstance) {
      projectServiceInstance = new ProjectService();
    }
  }).catch(err => {
    console.error('Failed to connect to database:', err);
  });
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