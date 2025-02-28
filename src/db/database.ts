import sqlite3 from 'sqlite3';
import { Database, open } from 'sqlite';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: Database | null = null;

export async function initializeDatabase() {
    if (db) return db;

    // Open database connection
    db = await open({
        filename: join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    // Read and execute schema
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    await db.exec(schema);

    return db;
}

export async function getDatabase() {
    if (!db) {
        await initializeDatabase();
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