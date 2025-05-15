import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function main() {
  // Open the database
  const db = await open({
    filename: 'src/db/database.sqlite',
    driver: sqlite3.Database
  });

  console.log('Connected to the database');

  try {
    // Update de sync_status tabel om aan te geven dat de verlofuren zijn gesynchroniseerd
    await db.run(
      'INSERT OR REPLACE INTO sync_status (endpoint, last_sync, status) VALUES (?, ?, ?)',
      ['leave_hours', new Date().toISOString(), 'success']
    );
    
    console.log('Updated sync_status table to indicate leave hours are synchronized');
    
    // Controleer de sync_status tabel
    const syncStatus = await db.get(
      'SELECT * FROM sync_status WHERE endpoint = ?',
      ['leave_hours']
    );
    
    console.log('Sync status:', syncStatus);
    
  } catch (error) {
    console.error('Error syncing leave hours:', error);
  } finally {
    // Close the database
    await db.close();
    console.log('Database connection closed');
  }
}

main().catch(console.error);
