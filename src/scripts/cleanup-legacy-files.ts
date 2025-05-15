/**
 * Cleanup Legacy Files
 * 
 * Dit script markeert oude legacy bestanden als deprecated door een commentaar toe te voegen
 * en maakt een backup van de bestanden in de backup map.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

// Define __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const rootDir = join(__dirname, '../..');
const backupDir = join(rootDir, 'backup');

// Legacy bestanden die gemarkeerd moeten worden als deprecated
const legacyFiles = [
  {
    path: join(rootDir, 'simple-api-server.js'),
    comment: '/**\n * @deprecated Dit bestand is verouderd en wordt niet meer gebruikt.\n * Gebruik in plaats daarvan src/scripts/start-api-simple-express.ts of src/api/gripp/api-server-v2.ts.\n */\n\n'
  },
  {
    path: join(rootDir, 'simple-api-server.mjs'),
    comment: '/**\n * @deprecated Dit bestand is verouderd en wordt niet meer gebruikt.\n * Gebruik in plaats daarvan src/scripts/start-api-simple-express.ts of src/api/gripp/api-server-v2.ts.\n */\n\n'
  },
  {
    path: join(rootDir, 'simple-auth-server.js'),
    comment: '/**\n * @deprecated Dit bestand is verouderd en wordt niet meer gebruikt.\n * Authenticatie is nu geïntegreerd in de API server.\n */\n\n'
  },
  {
    path: join(rootDir, 'simple-health-server.js'),
    comment: '/**\n * @deprecated Dit bestand is verouderd en wordt niet meer gebruikt.\n * Health checks zijn nu geïntegreerd in de API server.\n */\n\n'
  }
];

/**
 * Maakt een backup van een bestand
 */
function backupFile(filePath: string): void {
  // Controleer of het bestand bestaat
  if (!existsSync(filePath)) {
    console.log(`Bestand bestaat niet: ${filePath}`);
    return;
  }

  // Maak de backup map aan als deze nog niet bestaat
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  // Kopieer het bestand naar de backup map
  const fileName = basename(filePath);
  const backupPath = join(backupDir, fileName);
  
  try {
    copyFileSync(filePath, backupPath);
    console.log(`Backup gemaakt van ${filePath} naar ${backupPath}`);
  } catch (error) {
    console.error(`Fout bij het maken van een backup van ${filePath}:`, error);
  }
}

/**
 * Markeert een bestand als deprecated
 */
function markAsDeprecated(filePath: string, comment: string): void {
  // Controleer of het bestand bestaat
  if (!existsSync(filePath)) {
    console.log(`Bestand bestaat niet: ${filePath}`);
    return;
  }

  try {
    // Lees het bestand
    const content = readFileSync(filePath, 'utf-8');
    
    // Controleer of het bestand al gemarkeerd is als deprecated
    if (content.includes('@deprecated')) {
      console.log(`Bestand is al gemarkeerd als deprecated: ${filePath}`);
      return;
    }
    
    // Voeg het commentaar toe aan het begin van het bestand
    const newContent = comment + content;
    
    // Schrijf het bestand terug
    writeFileSync(filePath, newContent, 'utf-8');
    
    console.log(`Bestand gemarkeerd als deprecated: ${filePath}`);
  } catch (error) {
    console.error(`Fout bij het markeren van ${filePath} als deprecated:`, error);
  }
}

/**
 * Hoofdfunctie die de legacy bestanden opruimt
 */
function cleanupLegacyFiles(): void {
  console.log('=== OPRUIMEN VAN LEGACY BESTANDEN ===');
  
  // Loop door alle legacy bestanden
  for (const file of legacyFiles) {
    // Maak een backup van het bestand
    backupFile(file.path);
    
    // Markeer het bestand als deprecated
    markAsDeprecated(file.path, file.comment);
  }
  
  console.log('=== OPRUIMEN VOLTOOID ===');
}

// Voer de cleanup uit
cleanupLegacyFiles();
