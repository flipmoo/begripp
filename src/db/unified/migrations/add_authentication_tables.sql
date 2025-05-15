-- Authentication System Migration
-- This migration adds the necessary tables for the authentication system

-- Enable foreign keys
PRAGMA foreign_keys = ON;

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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- User-role table
CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
);

-- Role-permission table
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
);

-- Add system user for existing data
INSERT INTO users (username, email, password_hash, first_name, last_name, is_active, is_admin)
VALUES ('system', 'system@example.com', '$2b$10$X7VYVy.MU.fK1LfZpGjXO.1hk0f0qTY/ZBdcTCCeSbQVxOWVB2vcu', 'System', 'User', 1, 1);

-- Default roles
INSERT INTO roles (name, description) VALUES
    ('admin', 'Administrator met volledige toegang'),
    ('manager', 'Manager met toegang tot rapportages en beperkte bewerkingsrechten'),
    ('user', 'Standaard gebruiker met alleen-lezen toegang');

-- Default permissions
INSERT INTO permissions (name, description) VALUES
    -- Dashboard permissions
    ('view_dashboard', 'Dashboard bekijken'),

    -- Project permissions
    ('view_projects', 'Projecten bekijken'),
    ('edit_projects', 'Projecten bewerken'),

    -- Employee permissions
    ('view_employees', 'Medewerkers bekijken'),
    ('edit_employees', 'Medewerkers bewerken'),

    -- Invoice permissions
    ('view_invoices', 'Facturen bekijken'),
    ('edit_invoices', 'Facturen bewerken'),

    -- Iris permissions
    ('view_iris', 'Iris bekijken'),
    ('edit_iris', 'Iris bewerken'),

    -- Sync permissions
    ('sync_data', 'Data synchroniseren met Gripp'),

    -- Cache permissions
    ('manage_cache', 'Cache beheren'),

    -- Admin permissions
    ('manage_users', 'Gebruikers beheren'),
    ('manage_roles', 'Rollen beheren'),
    ('manage_settings', 'Instellingen beheren');

-- Assign permissions to roles
-- Admin role (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions;

-- Manager role
INSERT INTO role_permissions (role_id, permission_id)
SELECT 2, id FROM permissions WHERE name IN (
    'view_dashboard', 'view_projects', 'edit_projects',
    'view_employees', 'view_invoices', 'view_iris',
    'sync_data'
);

-- User role (read-only)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 3, id FROM permissions WHERE name IN (
    'view_dashboard', 'view_projects', 'view_employees', 'view_invoices'
);

-- Create default admin user
INSERT INTO users (username, email, password_hash, first_name, last_name, is_active, is_admin)
VALUES ('admin', 'admin@example.com', '$2b$10$X7VYVy.MU.fK1LfZpGjXO.1hk0f0qTY/ZBdcTCCeSbQVxOWVB2vcu', 'Admin', 'User', 1, 1);

-- Assign admin role to admin user
INSERT INTO user_roles (user_id, role_id) VALUES (2, 1);

-- Add created_by and updated_by columns to relevant tables if they don't exist
-- This is for tracking which user created or modified records

-- Check if the column exists in the entities table
SELECT CASE
    WHEN COUNT(*) = 0 THEN
        -- Column doesn't exist, add it
        'ALTER TABLE entities ADD COLUMN created_by INTEGER REFERENCES users(id);
         ALTER TABLE entities ADD COLUMN updated_by INTEGER REFERENCES users(id);'
    ELSE
        -- Column exists, do nothing
        'SELECT 1;'
END AS sql_statement FROM pragma_table_info('entities') WHERE name = 'created_by';

-- Check if the column exists in the projects table
SELECT CASE
    WHEN COUNT(*) = 0 THEN
        -- Column doesn't exist, add it
        'ALTER TABLE projects ADD COLUMN created_by INTEGER REFERENCES users(id);
         ALTER TABLE projects ADD COLUMN updated_by INTEGER REFERENCES users(id);'
    ELSE
        -- Column exists, do nothing
        'SELECT 1;'
END AS sql_statement FROM pragma_table_info('projects') WHERE name = 'created_by';

-- Check if the column exists in the invoices table
SELECT CASE
    WHEN COUNT(*) = 0 THEN
        -- Column doesn't exist, add it
        'ALTER TABLE invoices ADD COLUMN created_by INTEGER REFERENCES users(id);
         ALTER TABLE invoices ADD COLUMN updated_by INTEGER REFERENCES users(id);'
    ELSE
        -- Column exists, do nothing
        'SELECT 1;'
END AS sql_statement FROM pragma_table_info('invoices') WHERE name = 'created_by';

-- Update existing records to set system user as creator/updater
UPDATE entities SET created_by = 1, updated_by = 1 WHERE created_by IS NULL;
UPDATE projects SET created_by = 1, updated_by = 1 WHERE created_by IS NULL;
UPDATE invoices SET created_by = 1, updated_by = 1 WHERE created_by IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions (role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions (permission_id);

-- Create migrations table if it doesn't exist
CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Record this migration in the migrations table
INSERT INTO migrations (name) VALUES ('add_authentication_tables');
