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

-- Create indexes for users table
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

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
