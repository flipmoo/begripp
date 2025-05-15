/**
 * Unified Application Starter
 *
 * Dit script start de volledige applicatie op een gestandaardiseerde manier:
 * 1. Controleert of de poorten vrij zijn en maakt ze vrij indien nodig
 * 2. Initialiseert de database indien nodig
 * 3. Start de API server (v2)
 * 4. Start de frontend server
 *
 * Gebruik: npm run start
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FRONTEND_PORT, API_PORT, killProcessOnPort } from '../config/ports';

// Define __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const rootDir = join(__dirname, '../..');
const dbPath = join(rootDir, 'src/db/database.sqlite');
const dbInitScript = join(rootDir, 'src/db/init-db.ts');
const apiServerScript = join(__dirname, 'start-api-v2.ts');

/**
 * Controleert of de poorten vrij zijn en maakt ze vrij indien nodig
 */
async function ensurePortsAvailable(): Promise<boolean> {
  console.log('Ensuring required ports are available...');

  // Check and kill processes on frontend port
  console.log(`Checking frontend port ${FRONTEND_PORT}...`);
  await killProcessOnPort(FRONTEND_PORT);

  // Check and kill processes on API port
  console.log(`Checking API port ${API_PORT}...`);
  await killProcessOnPort(API_PORT);

  // Wait for ports to be released
  console.log('Waiting for ports to be released...');
  await new Promise(resolve => setTimeout(resolve, 1000));

  return true;
}

/**
 * Initialiseert de database indien nodig
 */
async function initializeDatabase(): Promise<boolean> {
  try {
    // Controleer of de database al bestaat
    const dbExists = existsSync(dbPath);

    if (dbExists) {
      console.log('Database already exists, skipping initialization');
      return true;
    }

    console.log('Database does not exist, initializing...');

    // Voer het database initialisatie script uit
    const dbInitProcess = spawn('tsx', [dbInitScript], {
      stdio: 'inherit',
      shell: true
    });

    return new Promise((resolve) => {
      dbInitProcess.on('close', (code) => {
        if (code === 0) {
          console.log('Database initialized successfully');
          resolve(true);
        } else {
          console.error(`Database initialization failed with code ${code}`);
          resolve(false);
        }
      });

      dbInitProcess.on('error', (err) => {
        console.error(`Database initialization error: ${err.message}`);
        resolve(false);
      });
    });
  } catch (error) {
    console.error('Failed to initialize database:', error);
    return false;
  }
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

/**
 * Main function to start the application
 */
async function startApp() {
  console.log(`${colors.cyan}=== STARTING APPLICATION ===${colors.reset}`);

  // Stap 1: Zorg ervoor dat de poorten beschikbaar zijn
  try {
    await ensurePortsAvailable();
  } catch (error) {
    console.error(`${colors.red}Failed to ensure ports are available. Exiting...${colors.reset}`);
    console.error(error);
    process.exit(1);
  }

  // Stap 2: Initialiseer de database indien nodig
  try {
    const dbInitialized = await initializeDatabase();
    if (!dbInitialized) {
      console.error(`${colors.red}Failed to initialize database. Exiting...${colors.reset}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`${colors.red}Error initializing database:${colors.reset}`, error);
    process.exit(1);
  }

  // Stap 3: Start de API server (v2)
  console.log(`${colors.yellow}Starting API server v2 on port ${API_PORT}...${colors.reset}`);
  const apiProcess = spawn('tsx', [apiServerScript], {
    stdio: 'inherit',
    shell: false
  });

  // Handle API server process events
  apiProcess.on('error', (error) => {
    console.error(`${colors.red}Failed to start API server:${colors.reset}`, error);
    process.exit(1);
  });

  // Wait for API server to start
  console.log(`${colors.yellow}Waiting for API server to start...${colors.reset}`);
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Stap 4: Start de frontend
  console.log(`${colors.yellow}Starting frontend on port ${FRONTEND_PORT}...${colors.reset}`);
  const frontendProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true
  });

  // Handle frontend process events
  frontendProcess.on('error', (error) => {
    console.error(`${colors.red}Failed to start frontend:${colors.reset}`, error);
    apiProcess.kill();
    process.exit(1);
  });

  // Handle process termination
  process.on('SIGINT', () => {
    console.log(`${colors.yellow}Shutting down...${colors.reset}`);
    frontendProcess.kill();
    apiProcess.kill();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log(`${colors.yellow}Shutting down...${colors.reset}`);
    frontendProcess.kill();
    apiProcess.kill();
    process.exit(0);
  });

  console.log(`${colors.green}Application started successfully!${colors.reset}`);
  console.log(`${colors.green}Frontend: http://localhost:${FRONTEND_PORT}${colors.reset}`);
  console.log(`${colors.green}API v2: http://localhost:${API_PORT}${colors.reset}`);
  console.log(`${colors.cyan}Press Ctrl+C to stop the application${colors.reset}`);
}

// Run the script
startApp().catch(error => {
  console.error(`${colors.red}Error starting application:${colors.reset}`, error);
  process.exit(1);
});
