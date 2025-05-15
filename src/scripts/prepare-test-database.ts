/**
 * Prepare Test Database Script
 * 
 * Dit script maakt een kopie van de productiedatabase voor testdoeleinden.
 * Het zorgt ervoor dat we de authenticatie migratie kunnen testen zonder de productiedata te beïnvloeden.
 */
import { existsSync, copyFileSync } from 'fs';
import { execSync } from 'child_process';

// Configuratie
const PROD_DB_PATH = './database.sqlite';
const TEST_DB_PATH = './database_test.sqlite';

/**
 * Bereid de testdatabase voor
 */
function prepareTestDatabase(): void {
  console.log('Preparing test database...');
  
  // Controleer of de productiedatabase bestaat
  if (!existsSync(PROD_DB_PATH)) {
    throw new Error(`Production database not found at ${PROD_DB_PATH}`);
  }
  
  // Maak een kopie van de productiedatabase
  console.log(`Copying ${PROD_DB_PATH} to ${TEST_DB_PATH}...`);
  copyFileSync(PROD_DB_PATH, TEST_DB_PATH);
  
  // Controleer of de kopie is gemaakt
  if (!existsSync(TEST_DB_PATH)) {
    throw new Error(`Failed to create test database at ${TEST_DB_PATH}`);
  }
  
  console.log('Test database prepared successfully!');
}

// Als dit script direct wordt uitgevoerd (niet geïmporteerd)
if (require.main === module) {
  try {
    prepareTestDatabase();
    process.exit(0);
  } catch (error) {
    console.error('Error preparing test database:', error);
    process.exit(1);
  }
}

// Exporteer de functie voor gebruik in andere scripts
export { prepareTestDatabase };
