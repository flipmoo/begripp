import { getDatabase } from '../../db/database';

// Create tables if they don't exist
export async function initializeDatabase() {
  const db = await getDatabase();
  await db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY,
      firstname TEXT,
      lastname TEXT,
      function TEXT,
      active BOOLEAN DEFAULT true,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS contracts (
      id INTEGER PRIMARY KEY,
      employee_id INTEGER,
      startdate DATE,
      enddate DATE,
      hours_monday_even REAL,
      hours_monday_odd REAL,
      hours_tuesday_even REAL,
      hours_tuesday_odd REAL,
      hours_wednesday_even REAL,
      hours_wednesday_odd REAL,
      hours_thursday_even REAL,
      hours_thursday_odd REAL,
      hours_friday_even REAL,
      hours_friday_odd REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees (id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS hours (
      id INTEGER PRIMARY KEY,
      employee_id INTEGER,
      date DATE,
      amount REAL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees (id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY,
      date DATE UNIQUE,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

  console.log('Database initialized');
} 