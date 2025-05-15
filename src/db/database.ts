import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { readFileSync, existsSync, writeFileSync, accessSync, constants } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: Database | null = null;

export async function initializeDatabase() {
    if (db) return db;

    // Check if database file exists
    const dbPath = join(__dirname, 'database.sqlite');

    console.log(`Database path: ${dbPath}`);

    // Controleer bestandstoegang en permissies
    try {
        if (existsSync(dbPath)) {
            console.log(`Database file exists, checking permissions...`);
            try {
                accessSync(dbPath, constants.R_OK | constants.W_OK);
                console.log(`Database file is readable and writable`);
            } catch (permError) {
                console.error(`Permission error on database file: ${permError}`);
                throw new Error(`Database file permission error: ${permError}`);
            }
        } else {
            console.log(`Database file not found at ${dbPath}, creating a new one...`);
            try {
                // Create an empty file
                writeFileSync(dbPath, '', { flag: 'w' });
                console.log(`Database file created successfully`);

                // Verify the file was created
                if (!existsSync(dbPath)) {
                    throw new Error('Failed to create database file: File not found after creation');
                }

                // Verify permissions
                accessSync(dbPath, constants.R_OK | constants.W_OK);
                console.log(`New database file is readable and writable`);
            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.error('Error creating database file:', err);
                throw new Error(`Failed to create database file: ${errorMessage}`);
            }
        }
    } catch (fsError) {
        console.error(`Filesystem error when checking database: ${fsError}`);
        throw new Error(`Database filesystem error: ${fsError}`);
    }

    try {
        // Open database connection
        console.log(`Opening database connection to ${dbPath}...`);

        // Enable verbose logging for SQLite
        sqlite3.verbose();

        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });

        console.log('Database connection opened successfully');

        // Read and execute schema
        try {
            const schemaPath = join(__dirname, 'schema.sql');
            console.log(`Looking for schema at ${schemaPath}`);

            if (existsSync(schemaPath)) {
                console.log('Schema file found, loading...');
                const schema = readFileSync(schemaPath, 'utf-8');
                await db.exec(schema);
                console.log('Schema applied successfully');
            } else {
                console.warn(`Schema file not found at ${schemaPath}`);
            }
        } catch (schemaErr) {
            console.error('Error applying schema:', schemaErr);
            // Continue despite schema errors - tables might already exist
        }

        // Test database by running a simple query
        try {
            const result = await db.get('SELECT sqlite_version() as version');
            console.log(`SQLite version: ${result?.version}`);
        } catch (testError) {
            console.error('Database test query failed:', testError);
            throw new Error(`Database test query failed: ${testError}`);
        }

        // Create basic tables if they don't exist
        await db.exec(`
          CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY,
            firstname TEXT,
            lastname TEXT,
            email TEXT,
            active INTEGER,
            function TEXT,
            department_id INTEGER,
            department_name TEXT,
            searchname TEXT
          )
        `);

        await db.exec(`
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
          )
        `);

        // Create sync_status table for tracking synchronization
        await db.exec(`
          CREATE TABLE IF NOT EXISTS sync_status (
            endpoint TEXT PRIMARY KEY,
            last_sync TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status TEXT,
            error TEXT
          )
        `);

        // Create cache table for unified caching
        await db.exec(`
          CREATE TABLE IF NOT EXISTS cache (
            key TEXT PRIMARY KEY,
            value TEXT,
            timestamp INTEGER,
            expires INTEGER
          )
        `);

        return db;
    } catch (err) {
        console.error('Database initialization error:', err);

        // Gedetailleerde error informatie
        if (err instanceof Error) {
            console.error('Database error details:', {
                message: err.message,
                stack: err.stack,
                name: err.name,
                code: (err as any).code,
                errno: (err as any).errno
            });
        }

        throw err;
    }
}

export async function getDatabase() {
    if (!db) {
        try {
            await initializeDatabase();
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }
    return db!;
}

// Generic function to update sync status
export async function updateSyncStatus(endpoint: string, status: string, error?: string) {
    const db = await getDatabase();
    await db.run(
        `INSERT OR REPLACE INTO sync_status (endpoint, last_sync, status, error)
         VALUES (?, CURRENT_TIMESTAMP, ?, ?)`,
        [endpoint, status, error || null]
    );
}

// Generic function to get last sync status
export async function getLastSyncStatus(endpoint: string) {
    const db = await getDatabase();
    return await db.get(
        'SELECT * FROM sync_status WHERE endpoint = ?',
        [endpoint]
    );
}

// Function to close database connection
export async function closeDatabase() {
    if (db) {
        await db.close();
        db = null;
    }
}