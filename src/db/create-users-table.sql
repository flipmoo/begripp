-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
INSERT OR IGNORE INTO users (id, username, password, email, first_name, last_name, is_active)
VALUES (1, 'admin', '$2b$10$Hl8cP.NEm3rVbHGh8ZVG8.VMbLJ.l6BwNHo2.fGHdXKmIUCn7zPJy', 'admin@example.com', 'Admin', 'User', 1);

-- Create default roles
INSERT OR IGNORE INTO roles (id, name, description)
VALUES 
(1, 'admin', 'Administrator with full access'),
(2, 'user', 'Regular user with limited access');

-- Assign admin role to admin user
INSERT OR IGNORE INTO user_roles (user_id, role_id)
VALUES (1, 1);
