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
    project_id INTEGER,
    project_name TEXT,
    project_line_id INTEGER,
    project_line_name TEXT,
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

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY,
    number TEXT NOT NULL,
    subject TEXT,
    date TEXT,
    expirydate TEXT,
    companyname TEXT,
    totalinclvat TEXT,
    totalincldiscountexclvat TEXT,
    totalpayed TEXT,
    totalopeninclvat TEXT,
    createdon TEXT,
    updatedon TEXT,
    searchname TEXT,
    extendedproperties TEXT
);

-- Invoice lines table
CREATE TABLE IF NOT EXISTS invoice_lines (
    id INTEGER PRIMARY KEY,
    invoice_id INTEGER NOT NULL,
    description TEXT,
    amount REAL NOT NULL,
    taxAmount REAL NOT NULL,
    totalAmount REAL NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_company ON invoices (company);
CREATE INDEX IF NOT EXISTS idx_invoice_status ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoice_date ON invoices (date);
CREATE INDEX IF NOT EXISTS idx_invoice_line_invoice ON invoice_lines (invoice_id);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    is_active BOOLEAN DEFAULT 1,
    is_admin BOOLEAN DEFAULT 0,
    last_login TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User roles table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- Create default admin user if not exists
INSERT OR IGNORE INTO users (id, username, email, password_hash, first_name, last_name, is_active, is_admin)
VALUES (1, 'admin', 'admin@example.com', '$2b$10$Hl8cP.NEm3rVbHGh8ZVG8.VMbLJ.l6BwNHo2.fGHdXKmIUCn7zPJy', 'Admin', 'User', 1, 1);

-- Create default roles
INSERT OR IGNORE INTO roles (id, name, description)
VALUES
(1, 'admin', 'Administrator with full access'),
(2, 'user', 'Regular user with limited access');

-- Assign admin role to admin user
INSERT OR IGNORE INTO user_roles (user_id, role_id)
VALUES (1, 1);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role permissions table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Create default permissions
INSERT OR IGNORE INTO permissions (id, name, description)
VALUES
(1, 'manage_users', 'Manage users'),
(2, 'manage_roles', 'Manage roles and permissions'),
(3, 'view_dashboard', 'View dashboard'),
(4, 'manage_projects', 'Manage projects'),
(5, 'manage_employees', 'Manage employees'),
(6, 'manage_hours', 'Manage hours'),
(7, 'manage_invoices', 'Manage invoices'),
(8, 'manage_settings', 'Manage application settings');

-- Assign permissions to admin role
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
VALUES
(1, 1), -- admin - manage_users
(1, 2), -- admin - manage_roles
(1, 3), -- admin - view_dashboard
(1, 4), -- admin - manage_projects
(1, 5), -- admin - manage_employees
(1, 6), -- admin - manage_hours
(1, 7), -- admin - manage_invoices
(1, 8); -- admin - manage_settings

-- Assign permissions to user role
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
VALUES
(2, 3), -- user - view_dashboard
(2, 6); -- user - manage_hours

-- Project corrections table
CREATE TABLE IF NOT EXISTS project_corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    project_name TEXT,
    client_name TEXT,
    project_type TEXT,
    budget REAL,
    previous_year_budget_used REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_corrections_project_id ON project_corrections (project_id);

-- Insert initial project corrections
INSERT OR IGNORE INTO project_corrections (project_id, project_name, client_name, project_type, budget, previous_year_budget_used)
VALUES
(5368, 'Internal hours 2024', 'Bravoure', 'Intern', 0, 0),
(5520, 'Boer & Croon - Bullhorn koppeling', 'Boer & Croon Management Solutions B.V..', 'Vaste Prijs', 13093, 0),
(5787, 'Dynamics Koppeling - Courses', 'Ebbinge B.V.', 'Vaste Prijs', 13093, 0),
(5632, 'OLM - Phase 3A', 'Limburgs Museum', 'Vaste Prijs', 154154, 142757);