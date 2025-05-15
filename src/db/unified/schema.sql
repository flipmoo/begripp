-- Unified Database Schema
-- This schema defines the structure for the unified data model

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Entities table (base table for projects, offers, etc.)
CREATE TABLE IF NOT EXISTS entities (
    id INTEGER PRIMARY KEY,
    type TEXT NOT NULL,  -- 'project', 'offer', etc.
    number TEXT,
    name TEXT NOT NULL,
    description TEXT,
    archived BOOLEAN DEFAULT 0,
    created_at TEXT,
    updated_at TEXT,
    created_by INTEGER,
    updated_by INTEGER,
    external_id TEXT,
    external_data TEXT,  -- JSON data from external system
    metadata TEXT        -- JSON metadata
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities (type);
CREATE INDEX IF NOT EXISTS idx_entities_archived ON entities (archived);
CREATE INDEX IF NOT EXISTS idx_entities_external_id ON entities (external_id);

-- Projects table (extends entities)
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY,
    entity_id INTEGER NOT NULL,
    client_id INTEGER,
    client_name TEXT,
    client_reference TEXT,
    accountmanager_id INTEGER,
    accountmanager_name TEXT,
    phase_id INTEGER,
    phase_name TEXT,
    color TEXT,
    start_date TEXT,
    deadline TEXT,
    delivery_date TEXT,
    end_date TEXT,
    total_excl_vat REAL,
    total_incl_vat REAL,
    hours_specification BOOLEAN DEFAULT 0,
    files_available_for_client BOOLEAN DEFAULT 0,
    view_online_url TEXT,
    FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_projects_entity_id ON projects (entity_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects (client_id);
CREATE INDEX IF NOT EXISTS idx_projects_accountmanager_id ON projects (accountmanager_id);
CREATE INDEX IF NOT EXISTS idx_projects_phase_id ON projects (phase_id);

-- Offers table (extends entities)
CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY,
    entity_id INTEGER NOT NULL,
    client_id INTEGER,
    client_name TEXT,
    client_reference TEXT,
    accountmanager_id INTEGER,
    accountmanager_name TEXT,
    status_id INTEGER,
    status_name TEXT,
    start_date TEXT,
    deadline TEXT,
    delivery_date TEXT,
    end_date TEXT,
    total_excl_vat REAL,
    total_incl_vat REAL,
    view_online_url TEXT,
    FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_offers_entity_id ON offers (entity_id);
CREATE INDEX IF NOT EXISTS idx_offers_client_id ON offers (client_id);
CREATE INDEX IF NOT EXISTS idx_offers_accountmanager_id ON offers (accountmanager_id);
CREATE INDEX IF NOT EXISTS idx_offers_status_id ON offers (status_id);

-- Entity lines table (for project lines, offer lines, etc.)
CREATE TABLE IF NOT EXISTS entity_lines (
    id INTEGER PRIMARY KEY,
    entity_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT,
    description TEXT,
    amount REAL,
    amount_written REAL DEFAULT 0,
    selling_price REAL,
    buying_price REAL,
    discount REAL DEFAULT 0,
    unit TEXT,
    invoice_basis_id INTEGER,
    invoice_basis_name TEXT,
    contract_line_id INTEGER,
    contract_line_name TEXT,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_entity_lines_entity_id ON entity_lines (entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_lines_product_id ON entity_lines (product_id);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY,
    firstname TEXT NOT NULL,
    lastname TEXT NOT NULL,
    email TEXT,
    active BOOLEAN DEFAULT 1,
    function_id INTEGER,
    function_name TEXT,
    department_id INTEGER,
    department_name TEXT,
    created_at TEXT,
    updated_at TEXT,
    external_id TEXT,
    external_data TEXT,  -- JSON data from external system
    metadata TEXT        -- JSON metadata
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees (active);
CREATE INDEX IF NOT EXISTS idx_employees_external_id ON employees (external_id);

-- Contracts table
CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
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
    internal_price_per_hour REAL,
    created_at TEXT,
    updated_at TEXT,
    FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contracts_employee_id ON contracts (employee_id);
CREATE INDEX IF NOT EXISTS idx_contracts_dates ON contracts (start_date, end_date);

-- Hours table
CREATE TABLE IF NOT EXISTS hours (
    id INTEGER PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    entity_id INTEGER,
    entity_line_id INTEGER,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    status_id INTEGER,
    status_name TEXT,
    created_at TEXT,
    updated_at TEXT,
    external_id TEXT,
    external_data TEXT,  -- JSON data from external system
    FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
    FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE SET NULL,
    FOREIGN KEY (entity_line_id) REFERENCES entity_lines (id) ON DELETE SET NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_hours_employee_id ON hours (employee_id);
CREATE INDEX IF NOT EXISTS idx_hours_entity_id ON hours (entity_id);
CREATE INDEX IF NOT EXISTS idx_hours_entity_line_id ON hours (entity_line_id);
CREATE INDEX IF NOT EXISTS idx_hours_date ON hours (date);
CREATE INDEX IF NOT EXISTS idx_hours_external_id ON hours (external_id);

-- Absence types table
CREATE TABLE IF NOT EXISTS absence_types (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    created_at TEXT,
    updated_at TEXT,
    external_id TEXT,
    external_data TEXT  -- JSON data from external system
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_absence_types_external_id ON absence_types (external_id);

-- Absence requests table
CREATE TABLE IF NOT EXISTS absence_requests (
    id INTEGER PRIMARY KEY,
    employee_id INTEGER NOT NULL,
    absence_type_id INTEGER NOT NULL,
    description TEXT,
    comment TEXT,
    created_at TEXT,
    updated_at TEXT,
    external_id TEXT,
    external_data TEXT,  -- JSON data from external system
    FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE,
    FOREIGN KEY (absence_type_id) REFERENCES absence_types (id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_absence_requests_employee_id ON absence_requests (employee_id);
CREATE INDEX IF NOT EXISTS idx_absence_requests_absence_type_id ON absence_requests (absence_type_id);
CREATE INDEX IF NOT EXISTS idx_absence_requests_external_id ON absence_requests (external_id);

-- Absence request lines table
CREATE TABLE IF NOT EXISTS absence_request_lines (
    id INTEGER PRIMARY KEY,
    absence_request_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    starting_time TEXT,
    status_id INTEGER,
    status_name TEXT,
    created_at TEXT,
    updated_at TEXT,
    external_id TEXT,
    external_data TEXT,  -- JSON data from external system
    FOREIGN KEY (absence_request_id) REFERENCES absence_requests (id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_absence_request_lines_absence_request_id ON absence_request_lines (absence_request_id);
CREATE INDEX IF NOT EXISTS idx_absence_request_lines_date ON absence_request_lines (date);
CREATE INDEX IF NOT EXISTS idx_absence_request_lines_external_id ON absence_request_lines (external_id);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    created_at TEXT,
    updated_at TEXT,
    external_id TEXT,
    external_data TEXT  -- JSON data from external system
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tags_external_id ON tags (external_id);

-- Entity tags table (junction table for many-to-many relationship)
CREATE TABLE IF NOT EXISTS entity_tags (
    entity_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (entity_id, tag_id),
    FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
);

-- Holidays table
CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays (date);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY,
    grippId INTEGER,
    number TEXT,
    date TEXT,
    dueDate TEXT,
    company INTEGER,
    amount REAL,
    taxAmount REAL,
    totalAmount REAL,
    status TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    external_id TEXT,
    external_data TEXT,  -- JSON data from external system
    isPaid INTEGER DEFAULT 0,
    isOverdue INTEGER DEFAULT 0,
    totalExclVat REAL,
    totalInclVat REAL,
    tax_amount REAL,
    company_id INTEGER,
    company_name TEXT,
    due_date TEXT,
    created_at TEXT,
    updated_at TEXT
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices (number);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices (date);
CREATE INDEX IF NOT EXISTS idx_invoices_company ON invoices (company);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_grippId ON invoices (grippId);

-- Invoice lines table
CREATE TABLE IF NOT EXISTS invoice_lines (
    id INTEGER PRIMARY KEY,
    invoice INTEGER NOT NULL,
    description TEXT,
    amount REAL,
    price REAL,
    taxPercentage TEXT,
    createdAt TEXT,
    updatedAt TEXT,
    FOREIGN KEY (invoice) REFERENCES invoices (id) ON DELETE CASCADE
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines (invoice);

-- Sync status table
CREATE TABLE IF NOT EXISTS sync_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    last_sync TEXT,
    status TEXT,
    error TEXT,
    details TEXT  -- JSON details
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sync_status_endpoint ON sync_status (endpoint);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TEXT
);

-- Migrations table
CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP
);
