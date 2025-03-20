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
  function?: string;
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

    console.log(`Fetching employees for year ${year}, week ${week}`);
    
    // Calculate start and end dates for the week
    const startDate = startOfWeek(setWeek(new Date(Number(year), 0, 1), Number(week)), { weekStartsOn: 1 });
    const endDate = addDays(startDate, 6);
    
    // Get employees from database with their most recent contract
    const employees = await db.all<Employee[]>(`
      SELECT 
        e.id, 
        e.firstname, 
        e.lastname,
        e.firstname || ' ' || e.lastname as name,
        e.function,
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
         (ar.startdate >= ? AND ar.startdate <= ?)) AND
        ar.status_name = 'Goedgekeurd'
      ORDER BY
        ar.startdate ASC
    `, [endDate.toISOString().split('T')[0], startDate.toISOString().split('T')[0], 
        startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]);
    
    console.log('Found absence data:', absenceData.length, 'records');
    
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
      let contractPeriod = null;
      if (employee.contract_startdate) {
        const startDateStr = employee.contract_startdate;
        const endDateStr = employee.contract_enddate || 'heden';
        contractPeriod = `${startDateStr} - ${endDateStr}`;
      }

      // Get absences for this employee
      const employeeAbsences = absenceData.filter((a) => a.employee_id === employee.id);
      
      // Calculate total leave hours for the week
      let leaveHours = 0;
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        
        // Find any absence for this day
        const absence = employeeAbsences.find(a => {
          const absenceStart = new Date(a.startdate);
          const absenceEnd = new Date(a.enddate);
          absenceStart.setHours(0, 0, 0, 0);
          absenceEnd.setHours(0, 0, 0, 0);
          
          const checkDate = new Date(currentDate);
          checkDate.setHours(0, 0, 0, 0);
          
          return checkDate >= absenceStart && checkDate <= absenceEnd;
        });

        if (absence) {
          leaveHours += absence.hours_per_day;
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Calculate holiday hours
      let holidayHours = 0;
      for (const holiday of holidays) {
        const holidayDate = new Date(holiday.date);
        holidayDate.setHours(0, 0, 0, 0);
        
        // Get day of week (0 = Sunday, 1 = Monday, etc.)
        const dayOfWeek = holidayDate.getDay();
        
        // Skip weekends
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;
        
        // Get hours for this day based on even/odd week
        let dayHours = 0;
        if (isEvenWeek) {
          switch (dayOfWeek) {
            case 1: dayHours = employee.hours_monday_even || 0; break;
            case 2: dayHours = employee.hours_tuesday_even || 0; break;
            case 3: dayHours = employee.hours_wednesday_even || 0; break;
            case 4: dayHours = employee.hours_thursday_even || 0; break;
            case 5: dayHours = employee.hours_friday_even || 0; break;
          }
        } else {
          switch (dayOfWeek) {
            case 1: dayHours = employee.hours_monday_odd || 0; break;
            case 2: dayHours = employee.hours_tuesday_odd || 0; break;
            case 3: dayHours = employee.hours_wednesday_odd || 0; break;
            case 4: dayHours = employee.hours_thursday_odd || 0; break;
            case 5: dayHours = employee.hours_friday_odd || 0; break;
          }
        }
        
        holidayHours += dayHours;
      }
      
      // Calculate expected hours (contract hours minus holiday hours)
      const expectedHours = Math.max(0, contractHours - holidayHours);
      
      // For now, set written hours to 0 (this would come from time tracking)
      const writtenHours = 0;
      
      // Actual hours are written hours
      const actualHours = writtenHours;
      
      return {
        id: employee.id,
        name: employee.name,
        function: employee.function,
        contractPeriod: contractPeriod,
        contractHours: contractHours,
        holidayHours: holidayHours,
        expectedHours: expectedHours,
        leaveHours: leaveHours,
        writtenHours: writtenHours,
        actualHours: actualHours,
        absences: employeeAbsences
      };
    });

    res.json(enrichedEmployees);
  } catch (error) {
    console.error('Error in /api/employees:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
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
    
    // Get all employees from Gripp
    const employeeResult = await employeeService.getAll();
    console.log('Employee fetch result:', employeeResult);

    if (!employeeResult?.result?.rows?.length) {
      throw new Error('No employees found');
    }
    
    // Get contracts using the service
    const contractResult = await contractService.getByEmployeeIds(
      employeeResult.result.rows.map(emp => emp.id)
    );
    console.log('Contract fetch result:', contractResult);
    
    if (!contractResult?.result?.rows?.length) {
      console.warn('No contracts found for employees');
      // Instead of throwing an error, we'll just proceed with an empty array
      contractResult.result = { rows: [] };
    }

    // Begin transaction
    await db.run('BEGIN TRANSACTION');
    
    try {
      // Clear existing employees
      await db.run('DELETE FROM employees');
      console.log('Cleared existing employees');

      // Insert new employees
      let insertedEmployees = 0;
      for (const employee of employeeResult.result.rows) {
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
            employee.active ? 1 : 0,
            employee.function?.searchname || null,
            employee.department?.id || null,
            employee.department?.searchname || null
          ]
        );
        insertedEmployees++;
      }
      console.log(`Inserted ${insertedEmployees} employees`);

      // Clear existing contracts
      await db.run('DELETE FROM contracts');
      console.log('Cleared existing contracts');
      
      // Insert new contracts
      let insertedContracts = 0;
      for (const contract of contractResult.result.rows) {
        await db.run(
          `INSERT INTO contracts (
            id, employee_id, 
            hours_monday_even, hours_tuesday_even, hours_wednesday_even,
            hours_thursday_even, hours_friday_even,
            hours_monday_odd, hours_tuesday_odd, hours_wednesday_odd,
            hours_thursday_odd, hours_friday_odd,
            startdate, enddate
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            contract.enddate?.date || null
          ]
        );
        insertedContracts++;
      }
      console.log(`Inserted ${insertedContracts} contracts`);
      
      // Commit transaction
      await db.run('COMMIT');
      console.log('Sync completed successfully');
      
      return res.json({ 
        success: true,
        message: 'Sync completed',
        stats: {
          employees: insertedEmployees,
          contracts: insertedContracts
        }
      });
    } catch (error) {
      // Rollback on error
      await db.run('ROLLBACK');
      console.error('Error during sync transaction:', error);
      throw error;
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

// Start the server with error handling
const server = app.listen(port, () => {
  console.log(`API Server running at http://localhost:${port}`);
}).on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Trying to close existing connection...`);
    const { exec } = require('child_process');
    exec(`lsof -i :${port} | grep LISTEN | awk '{print $2}' | xargs kill -9`, (err: Error | null) => {
      if (err) {
        console.error(`Failed to kill process on port ${port}:`, err);
        process.exit(1);
      } else {
        console.log(`Successfully killed process on port ${port}. Restarting server...`);
        server.listen(port);
      }
    });
  } else {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
});