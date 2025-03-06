-- Employees table
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY,
    firstname TEXT NOT NULL,
    lastname TEXT NOT NULL,
    email TEXT,
    active BOOLEAN DEFAULT true,
    function TEXT,
    department_id INTEGER,
    department_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contracts table
CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    hours_monday_even REAL,
    hours_tuesday_even REAL,
    hours_wednesday_even REAL,
    hours_thursday_even REAL,
    hours_friday_even REAL,
    hours_monday_odd REAL,
    hours_tuesday_odd REAL,
    hours_wednesday_odd REAL,
    hours_thursday_odd REAL,
    hours_friday_odd REAL,
    startdate DATE NOT NULL,
    enddate DATE,
    internal_price_per_hour REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Hours table
CREATE TABLE IF NOT EXISTS hours (
    id INTEGER PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    date DATE NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    status_id INTEGER,
    status_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Absence requests table
CREATE TABLE IF NOT EXISTS absence_requests (
    id INTEGER PRIMARY KEY,
    description TEXT,
    comment TEXT,
    createdon TEXT,
    updatedon TEXT,
    searchname TEXT DEFAULT 'NOT SET',
    extendedproperties TEXT,
    employee_id INTEGER NOT NULL,
    employee_searchname TEXT,
    employee_discr TEXT DEFAULT 'medewerker',
    absencetype_id INTEGER NOT NULL,
    absencetype_searchname TEXT NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_absence_employee ON absence_requests (employee_id);

-- Absence request lines table
CREATE TABLE IF NOT EXISTS absence_request_lines (
    id INTEGER PRIMARY KEY,
    absencerequest_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    startingtime TEXT,
    status_id INTEGER NOT NULL,
    status_name TEXT NOT NULL,
    createdon TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedon TEXT,
    searchname TEXT,
    extendedproperties TEXT,
    FOREIGN KEY (absencerequest_id) REFERENCES absence_requests(id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_absence_line_request ON absence_request_lines (absencerequest_id);
CREATE INDEX IF NOT EXISTS idx_absence_line_date ON absence_request_lines (date);

-- Holidays table
CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY,
    date DATE UNIQUE,
    name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sync status table to track last successful sync
CREATE TABLE IF NOT EXISTS sync_status (
    endpoint TEXT PRIMARY KEY,
    last_sync TIMESTAMP,
    status TEXT,
    error TEXT
); 