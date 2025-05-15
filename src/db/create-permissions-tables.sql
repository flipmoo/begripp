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
