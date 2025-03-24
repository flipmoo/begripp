import express, { Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { executeRequest } from './client';
import { getDatabase } from '../../db/database';
import { employeeService } from './services/employee';
import { contractService } from './services/contract';
import { hourService } from './services/hour';
import { absenceService, AbsenceRequest } from './services/absence';
import { startOfWeek, setWeek, addDays } from 'date-fns';
import { format, getDay } from 'date-fns';
import { getAbsenceRequests } from './simple-client';
import dotenv from 'dotenv';
import { Database } from 'sqlite3';
import { Database as SqliteDatabase } from 'sqlite';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { cacheService, CACHE_KEYS } from './cache-service';
import { projectService, ProjectService } from './services/project';
import { grippClient } from './client';
import { invoiceService } from './services/invoice';

// Define the GrippRequest interface
interface GrippRequest {
  method: string;
  params: any[];
  id: number;
}

const exec = promisify(execCallback);

// Load environment variables from .env file
dotenv.config();

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
  
  // Add cache control headers to prevent browser caching
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.header('Pragma', 'no-cache');
  res.header('Expires', '0');
  
  next();
});

let db: SqliteDatabase | null = null;

// Initialize database on startup
getDatabase().then(async database => {
  db = database;
  console.log('Database connected');
}).catch(error => {
  console.error('Database connection error:', error);
});

// Helper function to normalize date strings for comparison
const normalizeDate = (dateStr: string): string => {
  // Ensure the date is in YYYY-MM-DD format
  if (!dateStr) return '';
  return dateStr.split('T')[0];
};

interface Employee {
  id: number;
  firstname: string;
  lastname: string;
  name: string;
  function: string;
  contract_startdate?: string;
  contract_enddate?: string;
  hours_monday_even?: number;
  hours_tuesday_even?: number;
  hours_wednesday_even?: number;
  hours_thursday_even?: number;
  hours_friday_even?: number;
  hours_monday_odd?: number;
  hours_tuesday_odd?: number;
  hours_wednesday_odd?: number;
  hours_thursday_odd?: number;
  hours_friday_odd?: number;
  active: boolean;
}

interface AbsenceData {
  id: number;
  employee_id: number;
  firstname?: string;
  lastname?: string;
  startdate: string;
  enddate: string;
  type_id: number;
  type_name: string;
  hours_per_day: number;
  description?: string;
  status_id: number;
  status_name: string;
}

interface Holiday {
  date: string;
  name: string;
}

// Get employees endpoint
app.get('/api/employees', async (req: Request, res: Response) => {
  try {
    if (!db) {
      console.error('Database not initialized');
      return res.status(503).json({ error: 'Database not ready. Please try again in a few seconds.' });
    }

    const { year, week } = req.query;
    
    if (!year || !week) {
      return res.status(400).json({ error: 'Year and week are required as query parameters' });
    }

    const yearNum = Number(year);
    const weekNum = Number(week);
    const cacheKey = CACHE_KEYS.EMPLOYEES_WEEK(yearNum, weekNum);
    
    // Check if data is in cache
    const cachedData = cacheService.get(cacheKey);
    if (cachedData) {
      console.log(`Using cached data for year=${year}, week=${week}`);
      
      // Set cache control headers
      res.header('X-Cache', 'HIT');
      
      return res.json(cachedData);
    }

    console.log(`Fetching employees for year=${year}, week=${week}`);
    
    // Calculate start and end dates for the week
    const startDate = startOfWeek(setWeek(new Date(yearNum, 0, 1), weekNum), { weekStartsOn: 1 });
    const endDate = addDays(startDate, 6);
    
    // Get employees from database with their most recent contract
    const employees = await db.all<Employee[]>(`
      SELECT 
        e.id, 
        e.firstname, 
        e.lastname,
        e.firstname || ' ' || e.lastname as name,
        e.function,
        e.active,
        date(c.startdate) as contract_startdate,
        date(c.enddate) as contract_enddate,
        c.hours_monday_even,
        c.hours_tuesday_even,
        c.hours_wednesday_even,
        c.hours_thursday_even,
        c.hours_friday_even,
        c.hours_monday_odd,
        c.hours_tuesday_odd,
        c.hours_wednesday_odd,
        c.hours_thursday_odd,
        c.hours_friday_odd
      FROM 
        employees e
      LEFT JOIN
        contracts c ON e.id = c.employee_id
      WHERE 
        e.active = true
      GROUP BY
        e.id
      ORDER BY
        e.firstname, e.lastname
    `);

    if (!employees || employees.length === 0) {
      console.log('No employees found in database');
      return res.status(404).json({ error: 'No employees found' });
    }

    console.log(`Found ${employees.length} employees in database`);
    
    // Get absence data for the period
    const absenceData = await db.all<AbsenceData[]>(`
      SELECT 
        ar.id,
        ar.employee_id,
        arl.date as startdate,
        arl.date as enddate,
        ar.absencetype_id as type_id,
        ar.absencetype_searchname as type_name,
        arl.amount as hours_per_day,
        ar.description,
        arl.status_id,
        arl.status_name
      FROM 
        absence_requests ar
      JOIN
        absence_request_lines arl ON ar.id = arl.absencerequest_id
      JOIN
        employees e ON ar.employee_id = e.id
      WHERE 
        e.active = true AND
        arl.date BETWEEN ? AND ? AND
        arl.status_id = 2 -- Status ID 2 = GOEDGEKEURD (Approved)
      ORDER BY
        arl.date ASC
    `, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);
    
    console.log('Found absence data:', absenceData.length, 'records');
    
    // Get written hours for the period
    const writtenHoursData = await db.all(`
      SELECT 
        employee_id,
        SUM(amount) as total_hours
      FROM 
        hours
      WHERE 
        date BETWEEN ? AND ?
      GROUP BY
        employee_id
    `, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);

    console.log('Found written hours data:', writtenHoursData.length, 'records');
    
    // Get holidays for the period
    const holidays = await db.all<Holiday[]>(`
      SELECT date, name FROM holidays 
      WHERE date >= ? AND date <= ?
    `, [
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    ]);

    console.log('Found holidays:', holidays);

    // Process employees with their absence data
    const enrichedEmployees = employees.map((employee) => {
      const isEvenWeek = Number(week) % 2 === 0;
      
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
      
      // Format contract period
      const contractPeriod = employee.contract_startdate 
        ? `${employee.contract_startdate} - ${employee.contract_enddate || 'heden'}`
        : undefined;
      
      // Calculate expected hours (contract hours minus holidays)
      let expectedHours = contractHours;
      
      // Subtract hours for holidays
      for (const holiday of holidays) {
        const holidayDate = new Date(holiday.date);
        const dayOfWeek = holidayDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        // Skip weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;
        
        // Get hours for this day of the week
        let dayHours = 0;
        if (isEvenWeek) {
          if (dayOfWeek === 1) dayHours = employee.hours_monday_even || 0;
          else if (dayOfWeek === 2) dayHours = employee.hours_tuesday_even || 0;
          else if (dayOfWeek === 3) dayHours = employee.hours_wednesday_even || 0;
          else if (dayOfWeek === 4) dayHours = employee.hours_thursday_even || 0;
          else if (dayOfWeek === 5) dayHours = employee.hours_friday_even || 0;
        } else {
          if (dayOfWeek === 1) dayHours = employee.hours_monday_odd || 0;
          else if (dayOfWeek === 2) dayHours = employee.hours_tuesday_odd || 0;
          else if (dayOfWeek === 3) dayHours = employee.hours_wednesday_odd || 0;
          else if (dayOfWeek === 4) dayHours = employee.hours_thursday_odd || 0;
          else if (dayOfWeek === 5) dayHours = employee.hours_friday_odd || 0;
        }
        
        expectedHours -= dayHours;
      }
      
      // Calculate leave hours from absences
      const employeeAbsences = absenceData.filter(a => a.employee_id === employee.id);
      let leaveHours = 0;
      
      for (const absence of employeeAbsences) {
        leaveHours += absence.hours_per_day;
      }
      
      console.log(`Employee ${employee.id} has ${employeeAbsences.length} absences for the period ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
      
      // Get written hours for this employee
      const employeeWrittenHours = writtenHoursData.find(h => h.employee_id === employee.id);
      const writtenHours = employeeWrittenHours ? employeeWrittenHours.total_hours : 0;
      const actualHours = writtenHours + leaveHours;
      
      return {
        id: employee.id,
        name: employee.name,
        function: employee.function || "",
        contract_period: contractPeriod,
        contract_hours: contractHours,
        holiday_hours: contractHours - expectedHours,
        expected_hours: expectedHours,
        leave_hours: leaveHours,
        written_hours: writtenHours,
        actual_hours: actualHours,
        absences: employeeAbsences,
        active: employee.active === true || employee.active === 1
      };
    });

    // After processing the data, store it in cache
    cacheService.set(cacheKey, enrichedEmployees);
    
    // Set cache control headers
    res.header('X-Cache', 'MISS');

    res.json(enrichedEmployees);
  } catch (error) {
    console.error('Error in /api/employees:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Endpoint to get employees data by month
app.get('/api/employees/month', async (req: Request, res: Response) => {
  try {
    if (!db) {
      console.error('Database not initialized');
      return res.status(503).json({ error: 'Database not ready. Please try again in a few seconds.' });
    }

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
      
      // Set cache control headers
      res.header('X-Cache', 'HIT');
      
      return res.json(cachedData);
    }
    
    // Calculate start and end date for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of the month
    
    console.log(`Fetching employee data for month ${month} of ${year} (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})`);
    
    // Get employees from database with their most recent contract
    const employees = await db.all<Employee[]>(`
      SELECT 
        e.id, 
        e.firstname, 
        e.lastname,
        e.firstname || ' ' || e.lastname as name,
        e.function,
        e.active,
        date(c.startdate) as contract_startdate,
        date(c.enddate) as contract_enddate,
        c.hours_monday_even,
        c.hours_tuesday_even,
        c.hours_wednesday_even,
        c.hours_thursday_even,
        c.hours_friday_even,
        c.hours_monday_odd,
        c.hours_tuesday_odd,
        c.hours_wednesday_odd,
        c.hours_thursday_odd,
        c.hours_friday_odd
      FROM 
        employees e
      LEFT JOIN
        contracts c ON e.id = c.employee_id
      WHERE 
        e.active = true
      GROUP BY
        e.id
      ORDER BY
        e.firstname, e.lastname
    `);

    if (!employees || employees.length === 0) {
      console.log('No employees found in database');
      return res.status(404).json({ error: 'No employees found' });
    }

    console.log(`Found ${employees.length} employees in database`);
    
    // Get absence data for the period
    const absenceData = await db.all<AbsenceData[]>(`
      SELECT 
        ar.id,
        ar.employee_id,
        arl.date as startdate,
        arl.date as enddate,
        ar.absencetype_id as type_id,
        ar.absencetype_searchname as type_name,
        arl.amount as hours_per_day,
        ar.description,
        arl.status_id,
        arl.status_name
      FROM 
        absence_requests ar
      JOIN
        absence_request_lines arl ON ar.id = arl.absencerequest_id
      JOIN
        employees e ON ar.employee_id = e.id
      WHERE 
        e.active = true AND
        arl.date BETWEEN ? AND ? AND
        arl.status_id = 2 -- Status ID 2 = GOEDGEKEURD (Approved)
      ORDER BY
        arl.date ASC
    `, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);
    
    console.log('Found absence data:', absenceData.length, 'records');
    
    // Get written hours for the period
    const writtenHoursData = await db.all(`
      SELECT 
        employee_id,
        SUM(amount) as total_hours
      FROM 
        hours
      WHERE 
        date BETWEEN ? AND ?
      GROUP BY
        employee_id
    `, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);

    console.log('Found written hours data:', writtenHoursData.length, 'records');
    
    // Get holidays for the period
    const holidays = await db.all<Holiday[]>(`
      SELECT date, name FROM holidays 
      WHERE date >= ? AND date <= ?
    `, [
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    ]);

    console.log('Found holidays:', holidays);

    // Process employees with their absence data
    const enrichedEmployees = employees.map((employee) => {
      // Calculate total contract hours for the month
      let contractHours = 0;
      let expectedHours = 0;
      
      // Loop through each day of the month
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const isEvenWeek = Math.ceil((currentDate.getDate() + new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()) / 7) % 2 === 0;
        
        // Skip weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
        
        // Get hours for this day of the week
        let dayHours = 0;
        if (isEvenWeek) {
          if (dayOfWeek === 1) dayHours = employee.hours_monday_even || 0;
          else if (dayOfWeek === 2) dayHours = employee.hours_tuesday_even || 0;
          else if (dayOfWeek === 3) dayHours = employee.hours_wednesday_even || 0;
          else if (dayOfWeek === 4) dayHours = employee.hours_thursday_even || 0;
          else if (dayOfWeek === 5) dayHours = employee.hours_friday_even || 0;
        } else {
          if (dayOfWeek === 1) dayHours = employee.hours_monday_odd || 0;
          else if (dayOfWeek === 2) dayHours = employee.hours_tuesday_odd || 0;
          else if (dayOfWeek === 3) dayHours = employee.hours_wednesday_odd || 0;
          else if (dayOfWeek === 4) dayHours = employee.hours_thursday_odd || 0;
          else if (dayOfWeek === 5) dayHours = employee.hours_friday_odd || 0;
        }
        
        contractHours += dayHours;
        
        // Check if this day is a holiday
        const dateStr = currentDate.toISOString().split('T')[0];
        const isHoliday = holidays.some(h => h.date === dateStr);
        
        // Add to expected hours if not a holiday
        if (!isHoliday) {
          expectedHours += dayHours;
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Format contract period
      const contractPeriod = employee.contract_startdate 
        ? `${employee.contract_startdate} - ${employee.contract_enddate || 'heden'}`
        : undefined;
      
      // Calculate leave hours from absences
      const employeeAbsences = absenceData.filter(a => a.employee_id === employee.id);
      let leaveHours = 0;
      
      for (const absence of employeeAbsences) {
        leaveHours += absence.hours_per_day;
      }
      
      // Get written hours for this employee
      const employeeWrittenHours = writtenHoursData.find(h => h.employee_id === employee.id);
      const writtenHours = employeeWrittenHours ? employeeWrittenHours.total_hours : 0;
      const actualHours = writtenHours + leaveHours;
      
      return {
        id: employee.id,
        name: employee.name,
        function: employee.function || "",
        contract_period: contractPeriod,
        contract_hours: contractHours,
        holiday_hours: contractHours - expectedHours,
        expected_hours: expectedHours,
        leave_hours: leaveHours,
        written_hours: writtenHours,
        actual_hours: actualHours,
        absences: employeeAbsences,
        active: employee.active === true || employee.active === 1
      };
    });

    // After processing the data, store it in cache
    cacheService.set(cacheKey, enrichedEmployees);
    
    // Set cache control headers
    res.header('X-Cache', 'MISS');

    res.json(enrichedEmployees);
  } catch (error) {
    console.error('Error in /api/employees/month:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Endpoint to update function titles from Gripp API
app.post('/api/update-function-titles', async (req: Request, res: Response) => {
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
          [typeof employee.function === 'string' ? employee.function : employee.function.searchname || '', employee.id]
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

// Keep all other endpoints as they were originally
app.post('/api/sync', async (req: Request, res: Response) => {
  try {
    if (!db) {
      console.error('Database not initialized');
      return res.status(503).json({ error: 'Database not ready. Please try again in a few seconds.' });
    }

    console.log('Starting sync process...');
    
    // Get date range from request body
    const { startDate, endDate } = req.body;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    
    // Import the syncAllData function from the sync service
    const { syncAllData } = await import('../../services/sync.service');
    
    // Clear employee data cache before syncing
    cacheService.clearEmployeeData();
    
    // Call the syncAllData function
    const success = await syncAllData(startDate, endDate);
    
    if (success) {
      console.log('Sync completed successfully');
      return res.json({ 
        success: true,
        message: 'Sync completed successfully'
      });
    } else {
      console.error('Sync failed');
      return res.status(500).json({ 
        error: 'Sync failed',
        message: 'Failed to sync data'
      });
    }
  } catch (error) {
    console.error('Sync failed:', error);
    return res.status(500).json({ 
      error: 'Sync failed', 
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? { stack: error.stack } : error
    });
  }
});

// Add endpoint to clear cache
app.post('/api/cache/clear', (req: Request, res: Response) => {
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
app.post('/api/cache/clear/employees', (req: Request, res: Response) => {
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
app.get('/api/cache/status', (req: Request, res: Response) => {
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

// Add endpoint for absences
app.get('/api/absences', async (req: Request, res: Response) => {
  try {
    if (!db) {
      console.error('Database not initialized');
      return res.status(503).json({ error: 'Database not ready. Please try again in a few seconds.' });
    }

    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required query parameters' });
    }

    console.log(`Fetching absences from ${startDate} to ${endDate}`);
    
    // Get absence data for the period using the same query as the month view
    const absenceData = await db.all(`
      SELECT 
        ar.id,
        ar.employee_id,
        arl.date as startdate,
        arl.date as enddate,
        ar.absencetype_id as type_id,
        ar.absencetype_searchname as type_name,
        arl.amount as hours_per_day,
        ar.description,
        arl.status_id,
        arl.status_name
      FROM 
        absence_requests ar
      JOIN
        absence_request_lines arl ON ar.id = arl.absencerequest_id
      JOIN
        employees e ON ar.employee_id = e.id
      WHERE 
        e.active = true AND
        arl.date BETWEEN ? AND ? AND
        arl.status_id = 2 -- Status ID 2 = GOEDGEKEURD (Approved)
      ORDER BY
        arl.date ASC
    `, [startDate, endDate]);
    
    console.log(`Found ${absenceData.length} absence records for the period`);
    
    // Format the response to match the expected format in the client
    const formattedAbsences = absenceData.map(absence => ({
      id: absence.id,
      employee: {
        id: absence.employee_id,
        name: '' // The client doesn't seem to use this field
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
    console.error('Error fetching absences:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch absences', 
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Add endpoint to get employee functions directly from Gripp
app.get('/api/employee-functions', async (req: Request, res: Response) => {
  try {
    console.log('Fetching employee functions from Gripp API');
    
    // Get employees with their functions from Gripp API
    const employeeResponse = await employeeService.getAll();
    
    if (!employeeResponse || !employeeResponse.result || !employeeResponse.result.rows) {
      return res.status(500).json({ error: 'Failed to fetch employees from Gripp API' });
    }
    
    // Extract employee functions
    const employeeFunctions = employeeResponse.result.rows.map(employee => ({
      id: employee.id,
      name: `${employee.firstname} ${employee.lastname}`,
      function: employee.function?.searchname || employee.function || ''
    }));
    
    return res.json(employeeFunctions);
  } catch (error) {
    console.error('Error fetching employee functions:', error);
    return res.status(500).json({ error: 'Failed to fetch employee functions' });
  }
});

// Create a router for the dashboard endpoints
const dashboardRouter = express.Router();

// Dashboard endpoints voor projecten
dashboardRouter.get('/test', async (req, res) => {
  try {
    res.json({ status: 'ok', message: 'Dashboard API is working' });
  } catch (error) {
    console.error('Error in dashboard test endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

dashboardRouter.get('/projects/active', async (req, res) => {
  try {
    const db = await getDatabase();
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

dashboardRouter.get('/projects/:id', async (req, res) => {
  try {
    const db = await getDatabase();
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

dashboardRouter.post('/sync/projects', async (req, res) => {
  try {
    const db = await getDatabase();
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

// Add the endpoint before mounting the dashboard router
dashboardRouter.post('/gripp/sync-project', async (req, res) => {
  try {
    const { projectId } = req.body;
    
    if (!projectId || isNaN(parseInt(projectId))) {
      return res.status(400).json({ error: 'Invalid or missing project ID' });
    }
    
    const db = await getDatabase();
    if (!db) {
      return res.status(500).json({ error: 'Database not connected' });
    }
    
    console.log(`Syncing project ${projectId} from Gripp API...`);
    
    // Create request to get specific project with all needed fields
    const request = {
      method: 'project.get',
      params: [
        [
          {
            field: 'project.id',
            operator: 'equals',
            value: parseInt(projectId)
          }
        ],
        {
          fields: [
            'project.id',
            'project.name',
            'project.number',
            'project.color',
            'project.totalexclvat',
            'project.totalinclvat',
            'project.deadline',
            'project.phase',
            'project.company',
            'project.projectlines.id',
            'project.projectlines.amount',
            'project.projectlines.amountwritten',
            'project.projectlines.description',
            'project.projectlines.sellingprice',
            'project.projectlines.product',
            'project.employees_starred',
            'project.tags'
          ]
        }
      ],
      id: 1
    };
    
    // Execute request to Gripp API
    // @ts-expect-error - We weten dat dit werkt, ook al matcht het type niet exact
    const response = await grippClient.executeRequest(request);
    
    if (response.error) {
      console.error('Error from Gripp API:', response.error);
      return res.status(500).json({ error: 'Failed to get project from Gripp API' });
    }
    
    if (!response.result.rows.length) {
      return res.status(404).json({ error: 'Project not found in Gripp' });
    }
    
    // Get the updated project details
    const updatedProject = response.result.rows[0];
    
    // Save it in the database
    await projectService.saveProject(db, updatedProject);
    
    // Return the updated project details
    res.json({ response: updatedProject });
  } catch (error) {
    console.error('Error syncing project:', error);
    res.status(500).json({ 
      error: 'Failed to sync project', 
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Mount the dashboard router
app.use('/api/dashboard', dashboardRouter);

// Invoice endpoints
app.get('/api/invoices', async (req: Request, res: Response) => {
  try {
    console.log('API server: Fetching invoices');
    const year = req.query.year ? parseInt(req.query.year as string) : 0;
    
    let filters = [];
    
    // Only apply year filter if a specific year is requested
    if (year > 0) {
      const startDate = `${year}-01-01`;
      const endDate = `${year + 1}-01-01`;
      
      filters.push({
        field: 'invoice.date',
        operator: 'greaterequals',
        value: startDate
      });
      
      filters.push({
        field: 'invoice.date',
        operator: 'less',
        value: endDate
      });
    } else {
      // If no specific year, get all invoices from 2024 onwards
      filters.push({
        field: 'invoice.date',
        operator: 'greaterequals',
        value: '2024-01-01'
      });
    }
    
    const response = await invoiceService.get({
      filters: filters,
      options: {
        orderings: [
          {
            field: 'invoice.date',
            direction: 'desc',
          },
        ],
      }
    });
    
    res.json(response.result);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

app.get('/api/invoices/unpaid', async (req: Request, res: Response) => {
  try {
    console.log('API server: Fetching unpaid invoices');
    
    // Parse year parameter if provided
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    
    // Just use the invoiceService which now includes client-side filtering
    const response = await invoiceService.getUnpaid(year);
    res.json(response.result);
  } catch (error) {
    console.error('Error fetching unpaid invoices:', error);
    res.status(500).json({ error: 'Failed to fetch unpaid invoices' });
  }
});

app.get('/api/invoices/overdue', async (req: Request, res: Response) => {
  try {
    console.log('API server: Fetching overdue invoices');
    
    // Parse year parameter if provided
    const year = req.query.year ? parseInt(req.query.year as string) : undefined;
    
    // Just use the invoiceService which now includes client-side filtering
    const response = await invoiceService.getOverdue(year);
    res.json(response.result);
  } catch (error) {
    console.error('Error fetching overdue invoices:', error);
    res.status(500).json({ error: 'Failed to fetch overdue invoices' });
  }
});

// Revenue endpoint - Get project hours per month
app.get('/api/revenue/hours', async (req: Request, res: Response) => {
  try {
    console.log('API server: Fetching project hours for revenue');
    const year = req.query.year ? parseInt(req.query.year as string) : 2025; // Default to 2025
    
    if (!db) {
      console.error('Database not initialized');
      return res.status(503).json({ error: 'Database not ready. Please try again in a few seconds.' });
    }

    // Get ALL employees (including inactive)
    const employees = await db.all(`SELECT id, firstname, lastname, active FROM employees`);
    console.log(`Found ${employees.length} total employees`);
    
    if (!employees || employees.length === 0) {
      return res.status(404).json({ error: 'No employees found' });
    }
    
    // Get project hours for ALL employees (including inactive) for specified year
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    console.log(`Fetching hours for ALL employees from ${startDate} to ${endDate}`);
    
    let allHours: any[] = [];
    const PAGE_SIZE = 250; // API max page size
    let totalRequestsMade = 0;
    let totalHoursFound = 0;
    let employeesWithHours = 0;
    let employeesWithoutHours = 0;
    
    // Map to keep track of hours per employee
    const employeeHoursMap: { [key: number]: number } = {};
    
    for (const employee of employees) {
      let hasMoreResults = true;
      let offset = 0;
      let employeeHours = 0;
      
      console.log(`Fetching hours for employee ${employee.id} (${employee.firstname} ${employee.lastname}, active: ${employee.active ? 'yes' : 'no'})`);
      
      while (hasMoreResults) {
        totalRequestsMade++;
        const request = {
          method: 'hour.get',
          params: [
            [
              {
                field: 'hour.employee',
                operator: 'equals',
                value: employee.id,
              },
              {
                field: 'hour.date',
                operator: 'between',
                value: startDate,
                value2: endDate,
              }
            ],
            {
              paging: {
                firstresult: offset,
                maxresults: PAGE_SIZE,
              },
            },
          ],
          id: Date.now(),
        };
        
        const response = await executeRequest(request);
        
        if (!response.result || !response.result.rows) {
          console.error(`Unexpected API response for employee ${employee.id}:`, response);
          break;
        }
        
        const hours = response.result.rows;
        const totalCount = response.result.count || 0;
        
        console.log(`Fetched ${hours.length} hours for employee ${employee.id} (offset: ${offset}, total: ${totalCount}, status: ${hours.length > 0 ? hours[0].status?.searchname || 'unknown' : 'N/A'})`);
        
        if (hours.length > 0) {
          allHours = [...allHours, ...hours];
          
          // Sum up hours for this employee
          for (const hour of hours) {
            const hourAmount = parseFloat(hour.amount);
            employeeHours += hourAmount;
            totalHoursFound += hourAmount;
          }
        }
        
        // If we got fewer results than page size or reached total count, we're done
        if (hours.length < PAGE_SIZE || offset + hours.length >= totalCount) {
          hasMoreResults = false;
        } else {
          offset += PAGE_SIZE;
        }
      }
      
      // Track how many hours this employee has
      employeeHoursMap[employee.id] = employeeHours;
      
      if (employeeHours > 0) {
        employeesWithHours++;
      } else {
        employeesWithoutHours++;
      }
      
      console.log(`Total hours for employee ${employee.id} (${employee.firstname} ${employee.lastname}): ${employeeHours}`);
    }
    
    console.log('=== SUMMARY ===');
    console.log(`Total API requests made: ${totalRequestsMade}`);
    console.log(`Total hours entries fetched: ${allHours.length}`);
    console.log(`Total hours (summed): ${totalHoursFound}`);
    console.log(`Employees with hours: ${employeesWithHours}`);
    console.log(`Employees without hours: ${employeesWithoutHours}`);
    console.log('=== TOP 5 EMPLOYEES WITH MOST HOURS ===');
    
    // Show top 5 employees with most hours
    const topEmployees = Object.entries(employeeHoursMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    for (const [empId, hours] of topEmployees) {
      const employee = employees.find(e => e.id === parseInt(empId));
      console.log(`${employee?.firstname} ${employee?.lastname}: ${hours} hours`);
    }
    
    // Group hours by project and month
    interface ProjectHour {
      projectId: number;
      projectName: string;
      month: number;
      totalHours: number;
    }
    
    const projectHours: { [key: string]: ProjectHour } = {};
    
    for (const hour of allHours) {
      if (!hour.offerprojectbase || !hour.offerprojectbase.id) {
        continue; // Skip hours without project association
      }
      
      const projectId = hour.offerprojectbase.id;
      const projectName = hour.offerprojectbase.searchname || `Project ${projectId}`;
      
      // Extract month from date string (format: YYYY-MM-DD)
      const dateStr = hour.date.date;
      const month = new Date(dateStr).getMonth() + 1; // 1-12
      
      const key = `${projectId}-${month}`;
      
      if (!projectHours[key]) {
        projectHours[key] = {
          projectId,
          projectName,
          month,
          totalHours: 0
        };
      }
      
      projectHours[key].totalHours += parseFloat(hour.amount);
    }
    
    // Convert to array and format for display
    const result = Object.values(projectHours);
    console.log(`Grouped hours by project and month: ${result.length} unique project-month combinations`);
    
    // Group by project
    const projectMonthlyHours: { [key: string]: any } = {};
    
    for (const item of result) {
      const { projectId, projectName, month, totalHours } = item;
      
      if (!projectMonthlyHours[projectId]) {
        projectMonthlyHours[projectId] = {
          projectId,
          projectName,
          months: Array(12).fill(0) // Initialize array for 12 months
        };
      }
      
      // Months are 1-indexed, so subtract 1 for array index
      projectMonthlyHours[projectId].months[month - 1] = totalHours;
    }
    
    // Convert to array and sort by project name
    const sortedResults = Object.values(projectMonthlyHours).sort((a, b) => 
      a.projectName.localeCompare(b.projectName)
    );
    
    console.log(`Final result: ${sortedResults.length} projects with hourly data`);
    
    res.json(sortedResults);
  } catch (error) {
    console.error('Error fetching revenue data:', error);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

// Start the server with error handling
const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  
  // Initialize the database
  getDatabase().then(database => {
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