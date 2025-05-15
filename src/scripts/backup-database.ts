/**
 * Database Backup Script
 *
 * Dit script maakt een backup van de database voordat er wijzigingen worden aangebracht.
 * Het is belangrijk om dit script uit te voeren voordat je migraties uitvoert.
 */
import { existsSync, mkdirSync, copyFileSync } from 'fs';
import { join } from 'path';
import { format } from 'date-fns';

// Configuratie
// Gebruik een testdatabase als TEST_MODE=true is ingesteld
const TEST_MODE = process.env.TEST_MODE === 'true';
const DB_PATH = TEST_MODE ? './database_test.sqlite' : './src/db/database.sqlite';
const BACKUP_DIR = './backups'; // Directory voor backups
const BACKUP_PREFIX = 'database_backup_'; // Prefix voor backup bestanden

/**
 * Maak een backup van de database
 * @param reason Reden voor de backup (bijv. 'pre-auth-migration')
 * @returns Pad naar het backup bestand
 */
function backupDatabase(reason: string = 'manual'): string {
  console.log('Starting database backup...');

  // Controleer of de database bestaat
  if (!existsSync(DB_PATH)) {
    throw new Error(`Database file not found at ${DB_PATH}`);
  }

  // Maak backup directory als deze niet bestaat
  if (!existsSync(BACKUP_DIR)) {
    console.log(`Creating backup directory: ${BACKUP_DIR}`);
    mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Genereer een timestamp voor de bestandsnaam
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const backupFileName = `${BACKUP_PREFIX}${timestamp}_${reason}.sqlite`;
  const backupPath = join(BACKUP_DIR, backupFileName);

  // Kopieer de database naar de backup locatie
  console.log(`Copying database to ${backupPath}...`);
  copyFileSync(DB_PATH, backupPath);

  console.log('Database backup completed successfully!');
  return backupPath;
}

// Als dit script direct wordt uitgevoerd (niet geïmporteerd)
if (require.main === module) {
  try {
    // Haal reden uit command line arguments
    const reason = process.argv[2] || 'manual';
    const backupPath = backupDatabase(reason);
    console.log(`Backup created at: ${backupPath}`);
    process.exit(0);
  } catch (error) {
    console.error('Error during database backup:', error);
    process.exit(1);
  }
}

// Exporteer de functie voor gebruik in andere scripts
export { backupDatabase };
