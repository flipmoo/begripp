import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { executeRequest } from './client';
import { getDatabase } from '../../db/database';
import { employeeService } from './services/employee';
import { contractService } from './services/contract';
import { hourService } from './services/hour';
import { absenceService, AbsenceRequest } from './services/absence';
import { startOfWeek, setWeek } from 'date-fns';

const app = express();
const port = 3002;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(cors());
app.use(express.json());
app.use(limiter);

// Add CORS headers to allow requests from any origin
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

let db = null;

// Initialize database on startup
getDatabase().then(async database => {
  db = database;

  // Initialize holidays table
  await db.run(`
    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY,
      date DATE UNIQUE,
      name TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default holidays for 2024
  const holidays2024 = [
    ['2024-01-01', 'Nieuwjaarsdag'],
    ['2024-03-29', 'Goede Vrijdag'],
    ['2024-04-01', 'Paasmaandag'],
    ['2024-04-27', 'Koningsdag'],
    ['2024-05-09', 'Hemelvaartsdag'],
    ['2024-05-20', 'Pinkstermaandag'],
    ['2024-12-25', 'Eerste Kerstdag'],
    ['2024-12-26', 'Tweede Kerstdag']
  ];

  // Insert holidays for 2025
  const holidays2025 = [
    ['2025-01-01', 'Nieuwjaarsdag'],
    ['2025-04-18', 'Goede Vrijdag'],
    ['2025-04-21', 'Paasmaandag'],
    ['2025-04-27', 'Koningsdag'],
    ['2025-05-05', 'Bevrijdingsdag'],
    ['2025-05-29', 'Hemelvaartsdag'],
    ['2025-06-09', 'Pinkstermaandag'],
    ['2025-12-25', 'Eerste Kerstdag'],
    ['2025-12-26', 'Tweede Kerstdag']
  ];

  // Insert all holidays
  const allHolidays = [...holidays2024, ...holidays2025];
  for (const [date, name] of allHolidays) {
    await db.run(`
      INSERT OR IGNORE INTO holidays (date, name)
      VALUES (?, ?)
    `, [date, name]);
  }

  console.log('Database initialized with holidays');
}).catch(console.error);

// Helper function to add delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to normalize date strings for comparison
const normalizeDate = (dateStr: string): string => {
  // Ensure the date is in YYYY-MM-DD format
  if (!dateStr) return '';
  
  // If the date already has the correct format, return it
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Try to parse the date and format it
  try {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  } catch (e) {
    console.error(`Error normalizing date: ${dateStr}`, e);
    return dateStr;
  }
};

// Helper function to make API request with exponential backoff
async function makeRequestWithBackoff<T>(
  requestFn: () => Promise<T>,
  maxRetries = 5,
  initialDelay = 1000
): Promise<T> {
  let retries = 0;
  let lastError: any;

  while (retries < maxRetries) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a rate limit error (503)
      if (error?.response?.status === 503) {
        const retryAfter = parseFloat(error?.response?.headers?.['retry-after'] || '1');
        const delayMs = Math.max(
          initialDelay * Math.pow(2, retries),
          retryAfter * 1000
        );
        console.log(`Rate limited. Retrying after ${delayMs}ms... (Attempt ${retries + 1}/${maxRetries})`);
        await delay(delayMs);
        retries++;
        continue;
      }
      
      // For other errors, log and throw
      console.error('API request failed:', {
        status: error?.response?.status,
        message: error?.message,
        data: error?.response?.data
      });
      throw error;
    }
  }

  console.error('Max retries reached. Last error:', lastError);
  throw lastError;
}

// Get employees endpoint
app.get('/api/employees', async (req, res) => {
  try {
    const { year, week } = req.query;
    
    console.log('API Request received:', { year, week, queryParams: req.query });
    
    if (!year || !week) {
      return res.status(400).json({ error: 'Year and week are required' });
    }

    // Calculate the date range for the ISO week
    const yearNum = Number(year);
    const weekNum = Number(week);
    
    console.log('After parsing:', { yearNum, weekNum });
    
    // Calculate start date (Monday of the week) using date-fns
    // This uses the same options as the frontend: { weekStartsOn: 1, firstWeekContainsDate: 4 }
    const startDate = startOfWeek(
      setWeek(new Date(yearNum, 0, 1), weekNum, { weekStartsOn: 1, firstWeekContainsDate: 4 }),
      { weekStartsOn: 1 }
    );
    startDate.setUTCHours(0, 0, 0, 0);
    
    // Calculate end date (Sunday of the week)
    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 6);
    endDate.setUTCHours(23, 59, 59, 999);

    console.log('Week boundaries:', {
      week: weekNum,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    // Get employees from database with their most recent contract
    const employees = await db.all(`
      WITH LatestContract AS (
        SELECT 
          c.*,
          ROW_NUMBER() OVER (PARTITION BY c.employee_id ORDER BY c.startdate DESC) as rn
        FROM contracts c
      )
      SELECT 
        e.id,
        e.firstname || ' ' || e.lastname as name,
        e.function,
        CASE 
          WHEN c.enddate IS NULL THEN strftime('%Y-%m-%d', c.startdate) || ' - ongoing'
          ELSE strftime('%Y-%m-%d', c.startdate) || ' - ' || strftime('%Y-%m-%d', c.enddate)
        END as contract_period,
        c.hours_monday_even, c.hours_monday_odd,
        c.hours_tuesday_even, c.hours_tuesday_odd,
        c.hours_wednesday_even, c.hours_wednesday_odd,
        c.hours_thursday_even, c.hours_thursday_odd,
        c.hours_friday_even, c.hours_friday_odd,
        c.startdate as contract_startdate,
        c.enddate as contract_enddate
      FROM employees e
      LEFT JOIN LatestContract c ON e.id = c.employee_id AND c.rn = 1
      WHERE e.active = 1
      ORDER BY e.firstname, e.lastname
    `);

    // Get holidays for the period
    const holidays = await db.all(`
      SELECT date, name FROM holidays 
      WHERE date >= ? AND date <= ?
    `, [
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    ]);

    console.log('Found holidays for week', week, ':', holidays);

    // Get absence data for the period
    const absenceData = await db.all(`
      SELECT 
        ar.employee_id,
        ar.startdate,
        ar.enddate,
        ar.hours_per_day,
        ar.type_name
      FROM absence_requests ar
      JOIN employees e ON ar.employee_id = e.id
      WHERE 
        e.active = 1 AND
        ar.status_id = 2 AND
        ((ar.startdate <= ? AND ar.enddate >= ?) OR
         (ar.startdate >= ? AND ar.startdate <= ?))
    `, [
      endDate.toISOString().split('T')[0],
      startDate.toISOString().split('T')[0],
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    ]);

    console.log('Found absence data for week', week, ':', absenceData.length, 'records');

    // Calculate holiday hours for each employee
    const enrichedEmployees = employees.map(employee => {
      let holidayHours = 0;
      let leaveHours = 0;
      const currentDate = new Date(startDate);
      const isEvenWeek = Number(week) % 2 === 0;
      
      // Check if employee has a valid contract for this period
      const contractStartDate = employee.contract_startdate ? new Date(employee.contract_startdate) : null;
      const contractEndDate = employee.contract_enddate ? new Date(employee.contract_enddate) : null;
      
      // Check if the contract is active during this week
      const isContractActive = 
        (!contractStartDate || contractStartDate <= endDate) && 
        (!contractEndDate || contractEndDate >= startDate);
      
      // If contract is not active during this week, set contract hours to 0
      if (!isContractActive) {
        console.log(`Employee ${employee.firstname} ${employee.lastname} has no active contract for this week`);
        return {
          id: employee.id,
          name: employee.name,
          function: employee.function,
          contract_period: employee.contract_period,
          contract_hours: 0,
          holiday_hours: 0,
          expected_hours: 0,
          leave_hours: 0,
          written_hours: 0,
          actual_hours: 0
        };
      }
      
      // Calculate contract hours for the week
      const contractHours = isEvenWeek
        ? (employee.hours_monday_even || 0) + 
          (employee.hours_tuesday_even || 0) + 
          (employee.hours_wednesday_even || 0) + 
          (employee.hours_thursday_even || 0) + 
          (employee.hours_friday_even || 0)
        : (employee.hours_monday_odd || 0) + 
          (employee.hours_tuesday_odd || 0) + 
          (employee.hours_wednesday_odd || 0) + 
          (employee.hours_thursday_odd || 0) + 
          (employee.hours_friday_odd || 0);

      // Create a map to track leave hours per day
      const dailyLeaveHours = new Map<string, number>();

      // Iterate through each day of the week
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Fix: Use string comparison to check if the date is a holiday
        const isHoliday = holidays.some(h => normalizeDate(h.date) === dateStr);
        const dayOfWeek = currentDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
        
        // Check if the current date is within the contract period
        const isWithinContractPeriod = 
          (!contractStartDate || currentDate >= contractStartDate) && 
          (!contractEndDate || currentDate <= contractEndDate);

        console.log(`Checking date ${dateStr}, day of week: ${dayOfWeek}, is holiday: ${isHoliday}, within contract: ${isWithinContractPeriod}`);

        // Get daily contract hours based on day of week and even/odd week
        let dailyContractHours = 0;
        if (dayOfWeek === 1) { // Monday
          dailyContractHours = isEvenWeek ? (employee.hours_monday_even || 0) : (employee.hours_monday_odd || 0);
        } else if (dayOfWeek === 2) { // Tuesday
          dailyContractHours = isEvenWeek ? (employee.hours_tuesday_even || 0) : (employee.hours_tuesday_odd || 0);
        } else if (dayOfWeek === 3) { // Wednesday
          dailyContractHours = isEvenWeek ? (employee.hours_wednesday_even || 0) : (employee.hours_wednesday_odd || 0);
        } else if (dayOfWeek === 4) { // Thursday
          dailyContractHours = isEvenWeek ? (employee.hours_thursday_even || 0) : (employee.hours_thursday_odd || 0);
        } else if (dayOfWeek === 5) { // Friday
          dailyContractHours = isEvenWeek ? (employee.hours_friday_even || 0) : (employee.hours_friday_odd || 0);
        }

        // Count holidays for all employees who are within their contract period, regardless of daily hours
        if (isHoliday && dayOfWeek >= 1 && dayOfWeek <= 5 && isWithinContractPeriod) {
          // Use a fixed 8 hours for holiday days
          console.log(`Found holiday on ${dateStr} (${dayOfWeek}): adding 8 hours for ${employee.firstname || ''} ${employee.lastname || ''}`);
          holidayHours += 8; // Fixed 8 hours per holiday day
        }

        // Initialize daily leave hours
        dailyLeaveHours.set(dateStr, 0);

        // Check for absence on this day (only if within contract period)
        if (isWithinContractPeriod) {
          for (const absence of absenceData) {
            // Fix: Ensure proper date comparison by comparing date strings
            if (
              absence.employee_id === employee.id &&
              dateStr >= normalizeDate(absence.startdate) &&
              dateStr <= normalizeDate(absence.enddate) &&
              dayOfWeek >= 1 && dayOfWeek <= 5 // Only count weekdays
            ) {
              console.log(`Found absence for ${employee.name} on ${dateStr}: ${absence.hours_per_day} hours (${absence.type_name})`);
              
              // Add absence hours to daily leave hours, but cap at daily contract hours
              const currentDailyLeave = dailyLeaveHours.get(dateStr) || 0;
              const newDailyLeave = Math.min(currentDailyLeave + absence.hours_per_day, dailyContractHours);
              dailyLeaveHours.set(dateStr, newDailyLeave);
            }
          }
        }

        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }

      // Sum up all daily leave hours
      for (const hours of dailyLeaveHours.values()) {
        leaveHours += hours;
      }

      // Cap total leave hours at contract hours minus holiday hours
      const maxLeaveHours = Math.max(0, contractHours - holidayHours);
      leaveHours = Math.min(leaveHours, maxLeaveHours);

      console.log(`Employee ${employee.name}: contract_hours=${contractHours}, holiday_hours=${holidayHours}, leave_hours=${leaveHours}`);

      return {
        id: employee.id,
        name: employee.name,
        function: employee.function,
        contract_period: employee.contract_period,
        contract_hours: contractHours,
        holiday_hours: holidayHours,
        expected_hours: Math.max(0, contractHours - holidayHours),
        leave_hours: leaveHours,
        written_hours: 0,
        actual_hours: leaveHours
      };
    });

    res.json(enrichedEmployees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// Sync endpoint with rate limiting and backoff
app.post('/api/sync', async (req, res) => {
  try {
    console.log('Starting sync process...');
    
    // Get all employees with exponential backoff
    const employeeResponse = await makeRequestWithBackoff(async () => {
      console.log('Fetching employees...');
      return await employeeService.getAll();
    });

    if (!employeeResponse?.result?.rows) {
      throw new Error('No employee data received');
    }

    // Clear existing data
    await db.run('DELETE FROM employees');
    await db.run('DELETE FROM contracts');

    console.log(`Processing ${employeeResponse.result.rows.length} employees...`);

    // Insert employees
    for (const employee of employeeResponse.result.rows) {
      if (employee.active) {
        try {
          await db.run(
            'INSERT INTO employees (id, firstname, lastname, function, active) VALUES (?, ?, ?, ?, ?)',
            [employee.id, employee.firstname, employee.lastname, employee.function, employee.active]
          );

          // Get contracts for employee with backoff
          await makeRequestWithBackoff(async () => {
            console.log(`Fetching contracts for employee ${employee.firstname} ${employee.lastname}...`);
            const contractResponse = await contractService.getByEmployeeIds([employee.id]);
            
            if (Array.isArray(contractResponse) && contractResponse[0]?.result?.rows) {
              for (const contract of contractResponse[0].result.rows) {
                await db.run(`
                  INSERT INTO contracts (
                    id, employee_id, startdate, enddate,
                    hours_monday_even, hours_tuesday_even, hours_wednesday_even, hours_thursday_even, hours_friday_even,
                    hours_monday_odd, hours_tuesday_odd, hours_wednesday_odd, hours_thursday_odd, hours_friday_odd
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                  contract.id,
                  employee.id,
                  contract.startdate?.date,
                  contract.enddate?.date,
                  contract.hours_monday_even,
                  contract.hours_tuesday_even,
                  contract.hours_wednesday_even,
                  contract.hours_thursday_even,
                  contract.hours_friday_even,
                  contract.hours_monday_odd,
                  contract.hours_tuesday_odd,
                  contract.hours_wednesday_odd,
                  contract.hours_thursday_odd,
                  contract.hours_friday_odd
                ]);
              }
            }
          });
          
          // Add a small delay between employee processing to avoid overwhelming the API
          await delay(100);
          
        } catch (error) {
          console.error(`Error processing employee ${employee.firstname} ${employee.lastname}:`, error);
          // Continue with next employee instead of failing the entire sync
          continue;
        }
      }
    }

    console.log('Sync completed successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('Sync failed:', error);
    res.status(500).json({ 
      error: 'Sync failed', 
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error
    });
  }
});

// Sync absence data endpoint
app.post('/api/sync/absence', async (req, res) => {
  try {
    console.log('Starting absence sync process...');
    
    // Get active employees
    const activeEmployees = await db.all(`
      SELECT id, firstname, lastname FROM employees WHERE active = true
    `);

    if (!activeEmployees.length) {
      return res.status(404).json({ error: 'No active employees found' });
    }

    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    console.log(`Syncing absence data from ${startDate} to ${endDate} for ${activeEmployees.length} employees`);

    // Get employee IDs
    const employeeIds = activeEmployees.map(emp => emp.id);

    // Process absence data
    let totalAbsences = 0;
    let insertedAbsences = 0;

    // Save test records before clearing
    const testRecords = await db.all(`
      SELECT * FROM absence_requests 
      WHERE id IN (1003, 1004, 1005, 1006)
    `);
    console.log(`Preserved ${testRecords.length} test records for week 9`);

    // Clear existing absence data for the period, but preserve test records
    await db.run(`
      DELETE FROM absence_requests 
      WHERE 
        id NOT IN (1003, 1004, 1005, 1006) AND
        ((startdate >= ? AND startdate <= ?) OR
        (enddate >= ? AND enddate <= ?))
    `, [startDate, endDate, startDate, endDate]);

    // Process employees in smaller batches to avoid rate limiting
    const BATCH_SIZE = 5;
    const batches = [];
    
    for (let i = 0; i < employeeIds.length; i += BATCH_SIZE) {
      batches.push(employeeIds.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`Processing ${batches.length} batches of employees`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} employees`);
      
      try {
        // Fetch absence data with backoff
        const absenceResponses = await makeRequestWithBackoff(async () => {
          console.log(`Fetching absence data for batch ${batchIndex + 1}...`);
          return await absenceService.getByEmployeeIdsAndPeriod(
            batch,
            startDate,
            endDate
          );
        }, 10, 2000); // More retries and longer initial delay
        
        // Process each response
        for (const response of absenceResponses) {
          if (!response.result?.rows?.length) continue;
          
          totalAbsences += response.result.rows.length;
          
          for (const absence of response.result.rows) {
            try {
              await db.run(`
                INSERT INTO absence_requests (
                  id, employee_id, startdate, enddate, 
                  type_id, type_name, hours_per_day, 
                  description, status_id, status_name
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `, [
                absence.id,
                absence.employee.id,
                absence.startdate.date.split(' ')[0], // Extract date part only
                absence.enddate.date.split(' ')[0],   // Extract date part only
                absence.type.id,
                absence.type.searchname,
                absence.hours_per_day,
                absence.description,
                absence.status.id,
                absence.status.searchname
              ]);
              
              insertedAbsences++;
            } catch (error) {
              console.error(`Error inserting absence record:`, error);
              // Continue with next record
              continue;
            }
          }
        }
        
        // Add a delay between batches to avoid rate limiting
        if (batchIndex < batches.length - 1) {
          console.log(`Waiting 3 seconds before processing next batch...`);
          await delay(3000);
        }
      } catch (error) {
        console.error(`Error processing batch ${batchIndex + 1}:`, error);
        // Continue with next batch instead of failing the entire sync
        continue;
      }
    }

    console.log(`Absence sync completed: ${insertedAbsences} of ${totalAbsences} records inserted`);
    res.json({ 
      success: true, 
      totalAbsences,
      insertedAbsences
    });
  } catch (error) {
    console.error('Absence sync failed:', error);
    res.status(500).json({ 
      error: 'Absence sync failed', 
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error
    });
  }
});

// Delete holiday endpoint
app.delete('/api/holidays/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Delete the holiday
    await db.run('DELETE FROM holidays WHERE date = ?', [date]);
    
    // Return success
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting holiday:', error);
    res.status(500).json({ error: 'Failed to delete holiday' });
  }
});

// Get holidays endpoint
app.get('/api/holidays', async (req, res) => {
  try {
    const holidays = await db.all(`
      SELECT 
        date,
        name
      FROM holidays 
      ORDER BY date ASC
    `);
    
    res.json(holidays);
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

// Add holiday endpoint
app.post('/api/holidays', async (req, res) => {
  try {
    const { date, name } = req.body;
    
    if (!date || !name) {
      return res.status(400).json({ error: 'Date and name are required' });
    }

    // Insert the holiday
    await db.run(
      'INSERT INTO holidays (date, name) VALUES (?, ?)',
      [date, name]
    );
    
    // Return success
    res.json({ success: true });
  } catch (error) {
    console.error('Error adding holiday:', error);
    res.status(500).json({ error: 'Failed to add holiday' });
  }
});

// Get absence data for all active employees
app.get('/api/absences', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required as query parameters' });
    }

    console.log(`Fetching absence data from ${startDate} to ${endDate}`);

    // Get absence data from the database
    const absenceData = await db.all(`
      SELECT 
        ar.id,
        ar.employee_id,
        e.firstname,
        e.lastname,
        ar.startdate,
        ar.enddate,
        ar.type_id,
        ar.type_name,
        ar.hours_per_day,
        ar.description,
        ar.status_id,
        ar.status_name
      FROM 
        absence_requests ar
      JOIN
        employees e ON ar.employee_id = e.id
      WHERE 
        e.active = true AND
        ((ar.startdate <= ? AND ar.enddate >= ?) OR
         (ar.startdate >= ? AND ar.startdate <= ?) OR
         (ar.enddate >= ? AND ar.enddate <= ?))
      ORDER BY
        ar.startdate ASC
    `, [endDate, startDate, startDate, endDate, startDate, endDate]);

    // Format the response
    const formattedAbsences = absenceData.map(absence => ({
      id: absence.id,
      employee: {
        id: absence.employee_id,
        name: `${absence.firstname} ${absence.lastname}`
      },
      startdate: absence.startdate,
      enddate: absence.enddate,
      type: {
        id: absence.type_id,
        name: absence.type_name
      },
      hours_per_day: absence.hours_per_day,
      description: absence.description,
      status: {
        id: absence.status_id,
        name: absence.status_name
      }
    }));

    return res.json(formattedAbsences);
  } catch (error) {
    console.error('Error fetching absence data:', error);
    return res.status(500).json({ error: 'Failed to fetch absence data' });
  }
});

// Debug endpoint to check database state
app.get('/api/debug/absences', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    // Get absence data from the database with detailed information
    const absenceData = await db.all(`
      SELECT 
        ar.id,
        ar.employee_id,
        e.firstname || ' ' || e.lastname as employee_name,
        ar.startdate,
        ar.enddate,
        ar.type_id,
        ar.type_name,
        ar.hours_per_day,
        ar.description,
        ar.status_id,
        ar.status_name
      FROM absence_requests ar
      JOIN employees e ON ar.employee_id = e.id
      WHERE 
        ((ar.startdate <= ? AND ar.enddate >= ?) OR
         (ar.startdate >= ? AND ar.startdate <= ?))
      ORDER BY ar.startdate, e.firstname, e.lastname
    `, [
      endDate,
      startDate,
      startDate,
      endDate
    ]);

    console.log('Debug: Found absence data:', absenceData.length, 'records');

    res.json({
      count: absenceData.length,
      absences: absenceData,
      query: {
        startDate,
        endDate
      }
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch debug data' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`API Server running at http://localhost:${port}`);
}); 