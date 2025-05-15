/**
 * Create Authentication Tables Script
 * 
 * Dit script maakt de authenticatie tabellen direct aan in de database.
 */
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// Database path
const DB_PATH = './src/db/database.sqlite';

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to the database.');
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON', (err) => {
  if (err) {
    console.error('Error enabling foreign keys:', err.message);
    process.exit(1);
  }
  
  // Begin transaction
  db.run('BEGIN TRANSACTION', (err) => {
    if (err) {
      console.error('Error beginning transaction:', err.message);
      process.exit(1);
    }
    
    console.log('Creating authentication tables...');
    
    // Create users table
    db.run(`
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
    `, (err) => {
      if (err) {
        console.error('Error creating users table:', err.message);
        db.run('ROLLBACK');
        process.exit(1);
      }
      
      console.log('Users table created.');
      
      // Create roles table
      db.run(`
        CREATE TABLE IF NOT EXISTS roles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          description TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating roles table:', err.message);
          db.run('ROLLBACK');
          process.exit(1);
        }
        
        console.log('Roles table created.');
        
        // Create permissions table
        db.run(`
          CREATE TABLE IF NOT EXISTS permissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            console.error('Error creating permissions table:', err.message);
            db.run('ROLLBACK');
            process.exit(1);
          }
          
          console.log('Permissions table created.');
          
          // Create user_roles table
          db.run(`
            CREATE TABLE IF NOT EXISTS user_roles (
              user_id INTEGER NOT NULL,
              role_id INTEGER NOT NULL,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (user_id, role_id),
              FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
              FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE
            )
          `, (err) => {
            if (err) {
              console.error('Error creating user_roles table:', err.message);
              db.run('ROLLBACK');
              process.exit(1);
            }
            
            console.log('User_roles table created.');
            
            // Create role_permissions table
            db.run(`
              CREATE TABLE IF NOT EXISTS role_permissions (
                role_id INTEGER NOT NULL,
                permission_id INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (role_id, permission_id),
                FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
              )
            `, (err) => {
              if (err) {
                console.error('Error creating role_permissions table:', err.message);
                db.run('ROLLBACK');
                process.exit(1);
              }
              
              console.log('Role_permissions table created.');
              
              // Create migrations table
              db.run(`
                CREATE TABLE IF NOT EXISTS migrations (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  name TEXT NOT NULL UNIQUE,
                  applied_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
              `, (err) => {
                if (err) {
                  console.error('Error creating migrations table:', err.message);
                  db.run('ROLLBACK');
                  process.exit(1);
                }
                
                console.log('Migrations table created.');
                
                // Hash admin password
                bcrypt.hash('admin', 10, (err, hash) => {
                  if (err) {
                    console.error('Error hashing password:', err.message);
                    db.run('ROLLBACK');
                    process.exit(1);
                  }
                  
                  // Add system user
                  db.run(`
                    INSERT OR IGNORE INTO users (username, email, password_hash, first_name, last_name, is_active, is_admin)
                    VALUES ('system', 'system@example.com', ?, 'System', 'User', 1, 1)
                  `, [hash], (err) => {
                    if (err) {
                      console.error('Error adding system user:', err.message);
                      db.run('ROLLBACK');
                      process.exit(1);
                    }
                    
                    console.log('System user added.');
                    
                    // Add default roles
                    db.run(`
                      INSERT OR IGNORE INTO roles (id, name, description) VALUES 
                        (1, 'admin', 'Administrator met volledige toegang'),
                        (2, 'manager', 'Manager met toegang tot rapportages en beperkte bewerkingsrechten'),
                        (3, 'user', 'Standaard gebruiker met alleen-lezen toegang')
                    `, (err) => {
                      if (err) {
                        console.error('Error adding default roles:', err.message);
                        db.run('ROLLBACK');
                        process.exit(1);
                      }
                      
                      console.log('Default roles added.');
                      
                      // Add default permissions
                      db.run(`
                        INSERT OR IGNORE INTO permissions (name, description) VALUES
                          ('view_dashboard', 'Dashboard bekijken'),
                          ('view_projects', 'Projecten bekijken'),
                          ('edit_projects', 'Projecten bewerken'),
                          ('view_employees', 'Medewerkers bekijken'),
                          ('edit_employees', 'Medewerkers bewerken'),
                          ('view_invoices', 'Facturen bekijken'),
                          ('edit_invoices', 'Facturen bewerken'),
                          ('view_iris', 'Iris bekijken'),
                          ('edit_iris', 'Iris bewerken'),
                          ('sync_data', 'Data synchroniseren met Gripp'),
                          ('manage_cache', 'Cache beheren'),
                          ('manage_users', 'Gebruikers beheren'),
                          ('manage_roles', 'Rollen beheren'),
                          ('manage_settings', 'Instellingen beheren')
                      `, (err) => {
                        if (err) {
                          console.error('Error adding default permissions:', err.message);
                          db.run('ROLLBACK');
                          process.exit(1);
                        }
                        
                        console.log('Default permissions added.');
                        
                        // Assign permissions to admin role
                        db.run(`
                          INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
                          SELECT 1, id FROM permissions
                        `, (err) => {
                          if (err) {
                            console.error('Error assigning permissions to admin role:', err.message);
                            db.run('ROLLBACK');
                            process.exit(1);
                          }
                          
                          console.log('Permissions assigned to admin role.');
                          
                          // Assign permissions to manager role
                          db.run(`
                            INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
                            SELECT 2, id FROM permissions WHERE name IN (
                              'view_dashboard', 'view_projects', 'edit_projects', 
                              'view_employees', 'view_invoices', 'view_iris',
                              'sync_data'
                            )
                          `, (err) => {
                            if (err) {
                              console.error('Error assigning permissions to manager role:', err.message);
                              db.run('ROLLBACK');
                              process.exit(1);
                            }
                            
                            console.log('Permissions assigned to manager role.');
                            
                            // Assign permissions to user role
                            db.run(`
                              INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
                              SELECT 3, id FROM permissions WHERE name IN (
                                'view_dashboard', 'view_projects', 'view_employees', 'view_invoices'
                              )
                            `, (err) => {
                              if (err) {
                                console.error('Error assigning permissions to user role:', err.message);
                                db.run('ROLLBACK');
                                process.exit(1);
                              }
                              
                              console.log('Permissions assigned to user role.');
                              
                              // Hash admin password
                              bcrypt.hash('admin', 10, (err, hash) => {
                                if (err) {
                                  console.error('Error hashing admin password:', err.message);
                                  db.run('ROLLBACK');
                                  process.exit(1);
                                }
                                
                                // Create default admin user
                                db.run(`
                                  INSERT OR IGNORE INTO users (username, email, password_hash, first_name, last_name, is_active, is_admin)
                                  VALUES ('admin', 'admin@example.com', ?, 'Admin', 'User', 1, 1)
                                `, [hash], (err) => {
                                  if (err) {
                                    console.error('Error creating default admin user:', err.message);
                                    db.run('ROLLBACK');
                                    process.exit(1);
                                  }
                                  
                                  console.log('Default admin user created.');
                                  
                                  // Get admin user ID
                                  db.get(`SELECT id FROM users WHERE username = 'admin'`, (err, row) => {
                                    if (err) {
                                      console.error('Error getting admin user ID:', err.message);
                                      db.run('ROLLBACK');
                                      process.exit(1);
                                    }
                                    
                                    const adminId = row ? row.id : null;
                                    
                                    if (!adminId) {
                                      console.error('Admin user not found.');
                                      db.run('ROLLBACK');
                                      process.exit(1);
                                    }
                                    
                                    // Assign admin role to admin user
                                    db.run(`
                                      INSERT OR IGNORE INTO user_roles (user_id, role_id)
                                      VALUES (?, 1)
                                    `, [adminId], (err) => {
                                      if (err) {
                                        console.error('Error assigning admin role to admin user:', err.message);
                                        db.run('ROLLBACK');
                                        process.exit(1);
                                      }
                                      
                                      console.log('Admin role assigned to admin user.');
                                      
                                      // Create indexes
                                      db.run(`
                                        CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
                                        CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
                                        CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles (user_id);
                                        CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id);
                                        CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions (role_id);
                                        CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions (permission_id);
                                      `, (err) => {
                                        if (err) {
                                          console.error('Error creating indexes:', err.message);
                                          db.run('ROLLBACK');
                                          process.exit(1);
                                        }
                                        
                                        console.log('Indexes created.');
                                        
                                        // Record migration
                                        db.run(`
                                          INSERT OR IGNORE INTO migrations (name) VALUES ('add_authentication_tables')
                                        `, (err) => {
                                          if (err) {
                                            console.error('Error recording migration:', err.message);
                                            db.run('ROLLBACK');
                                            process.exit(1);
                                          }
                                          
                                          console.log('Migration recorded.');
                                          
                                          // Commit transaction
                                          db.run('COMMIT', (err) => {
                                            if (err) {
                                              console.error('Error committing transaction:', err.message);
                                              db.run('ROLLBACK');
                                              process.exit(1);
                                            }
                                            
                                            console.log('Transaction committed.');
                                            console.log('Authentication tables created successfully!');
                                            
                                            // Close database connection
                                            db.close((err) => {
                                              if (err) {
                                                console.error('Error closing database:', err.message);
                                                process.exit(1);
                                              }
                                              
                                              console.log('Database connection closed.');
                                              process.exit(0);
                                            });
                                          });
                                        });
                                      });
                                    });
                                  });
                                });
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
