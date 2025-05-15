/**
 * Create Authentication Tables Script
 * 
 * Dit script maakt de authenticatie tabellen direct aan in de database.
 */
import { Database } from 'sqlite';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcrypt';

// Database path
const DB_PATH = './src/db/database.sqlite';

async function createAuthTables() {
  console.log('Creating authentication tables...');
  
  // Open database connection
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });
  
  try {
    // Enable foreign keys
    await db.exec('PRAGMA foreign_keys = ON');
    
    // Begin transaction
    await db.exec('BEGIN TRANSACTION');
    
    // Create users table
    console.log('Creating users table...');
    await db.exec(`
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
      )
    `);
    
    // Create roles table
    console.log('Creating roles table...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create permissions table
    console.log('Creating permissions table...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create user_roles table
    console.log('Creating user_roles table...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id INTEGER NOT NULL,
        role_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, role_id),
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
      )
    `);
    
    // Create role_permissions table
    console.log('Creating role_permissions table...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER NOT NULL,
        permission_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
      )
    `);
    
    // Create migrations table
    console.log('Creating migrations table...');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add system user
    console.log('Adding system user...');
    const passwordHash = await bcrypt.hash('admin', 10);
    await db.exec(`
      INSERT OR IGNORE INTO users (username, email, password_hash, first_name, last_name, is_active, is_admin)
      VALUES ('system', 'system@example.com', '${passwordHash}', 'System', 'User', 1, 1)
    `);
    
    // Add default roles
    console.log('Adding default roles...');
    await db.exec(`
      INSERT OR IGNORE INTO roles (id, name, description) VALUES 
        (1, 'admin', 'Administrator met volledige toegang'),
        (2, 'manager', 'Manager met toegang tot rapportages en beperkte bewerkingsrechten'),
        (3, 'user', 'Standaard gebruiker met alleen-lezen toegang')
    `);
    
    // Add default permissions
    console.log('Adding default permissions...');
    await db.exec(`
      INSERT OR IGNORE INTO permissions (name, description) VALUES
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
        ('manage_settings', 'Instellingen beheren')
    `);
    
    // Assign permissions to admin role
    console.log('Assigning permissions to admin role...');
    await db.exec(`
      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
      SELECT 1, id FROM permissions
    `);
    
    // Assign permissions to manager role
    console.log('Assigning permissions to manager role...');
    await db.exec(`
      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
      SELECT 2, id FROM permissions WHERE name IN (
        'view_dashboard', 'view_projects', 'edit_projects', 
        'view_employees', 'view_invoices', 'view_iris',
        'sync_data'
      )
    `);
    
    // Assign permissions to user role
    console.log('Assigning permissions to user role...');
    await db.exec(`
      INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
      SELECT 3, id FROM permissions WHERE name IN (
        'view_dashboard', 'view_projects', 'view_employees', 'view_invoices'
      )
    `);
    
    // Create default admin user
    console.log('Creating default admin user...');
    const adminPasswordHash = await bcrypt.hash('admin', 10);
    await db.exec(`
      INSERT OR IGNORE INTO users (username, email, password_hash, first_name, last_name, is_active, is_admin)
      VALUES ('admin', 'admin@example.com', '${adminPasswordHash}', 'Admin', 'User', 1, 1)
    `);
    
    // Assign admin role to admin user
    console.log('Assigning admin role to admin user...');
    await db.exec(`
      INSERT OR IGNORE INTO user_roles (user_id, role_id)
      SELECT id, 1 FROM users WHERE username = 'admin'
    `);
    
    // Create indexes
    console.log('Creating indexes...');
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
      CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id);
      CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id);
      CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions (role_id);
      CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions (permission_id);
    `);
    
    // Record migration
    console.log('Recording migration...');
    await db.exec(`
      INSERT OR IGNORE INTO migrations (name) VALUES ('add_authentication_tables')
    `);
    
    // Commit transaction
    await db.exec('COMMIT');
    
    console.log('Authentication tables created successfully!');
  } catch (error) {
    // Rollback transaction on error
    await db.exec('ROLLBACK');
    console.error('Error creating authentication tables:', error);
    throw error;
  } finally {
    // Close database connection
    await db.close();
  }
}

// Run the script
if (require.main === module) {
  createAuthTables()
    .then(() => {
      console.log('Script completed successfully.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}
