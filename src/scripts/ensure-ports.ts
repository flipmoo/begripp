/**
 * Ensure Ports Script
 *
 * This script ensures that the required ports are available before starting the application.
 * It kills any existing processes on the required ports.
 */

import { FRONTEND_PORT, API_PORT, killProcessOnPort } from '../config/ports';
import { execSync } from 'child_process';
import { setTimeout } from 'timers/promises';

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
 * Main function to ensure ports are available
 */
async function ensurePorts() {
  console.log(`${colors.cyan}=== PORT AVAILABILITY CHECK ===${colors.reset}`);
  console.log(`${colors.cyan}Ensuring required ports are available...${colors.reset}`);

  // Check and kill processes on frontend port
  console.log(`${colors.yellow}Checking frontend port ${FRONTEND_PORT}...${colors.reset}`);
  const frontendKilled = await killProcessOnPort(FRONTEND_PORT);
  if (frontendKilled) {
    console.log(`${colors.green}Successfully killed process on frontend port ${FRONTEND_PORT}${colors.reset}`);
  } else {
    console.log(`${colors.green}No process found on frontend port ${FRONTEND_PORT}${colors.reset}`);
  }

  // Check and kill processes on API port
  console.log(`${colors.yellow}Checking API port ${API_PORT}...${colors.reset}`);
  const apiKilled = await killProcessOnPort(API_PORT);
  if (apiKilled) {
    console.log(`${colors.green}Successfully killed process on API port ${API_PORT}${colors.reset}`);
  } else {
    console.log(`${colors.green}No process found on API port ${API_PORT}${colors.reset}`);
  }

  // Wait for ports to be released
  console.log(`${colors.yellow}Waiting for ports to be released...${colors.reset}`);
  await setTimeout(1000);

  // Verify ports are available
  console.log(`${colors.yellow}Verifying ports are available...${colors.reset}`);
  const frontendAvailable = await isPortAvailable(FRONTEND_PORT);
  const apiAvailable = await isPortAvailable(API_PORT);

  if (frontendAvailable && apiAvailable) {
    console.log(`${colors.green}All required ports are available!${colors.reset}`);
    console.log(`${colors.cyan}=== PORT AVAILABILITY CHECK COMPLETED ===${colors.reset}`);
    return true;
  } else {
    console.log(`${colors.red}Some ports are still in use:${colors.reset}`);
    if (!frontendAvailable) {
      console.log(`${colors.red}- Frontend port ${FRONTEND_PORT} is still in use${colors.reset}`);
    }
    if (!apiAvailable) {
      console.log(`${colors.red}- API port ${API_PORT} is still in use${colors.reset}`);
    }
    console.log(`${colors.red}Please manually kill the processes using these ports and try again.${colors.reset}`);
    console.log(`${colors.cyan}=== PORT AVAILABILITY CHECK FAILED ===${colors.reset}`);
    return false;
  }
}

/**
 * Check if a port is available
 */
async function isPortAvailable(port: number): Promise<boolean> {
  try {
    if (process.platform === 'win32') {
      // Windows command
      const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`).toString();
      return result.trim() === '';
    } else {
      // macOS/Linux command
      const result = execSync(`lsof -i:${port} | grep LISTEN`).toString();
      return result.trim() === '';
    }
  } catch (error) {
    // If the command fails, it means no process is using the port
    return true;
  }
}

// Run the script if it's called directly
// In ESM, we can't use require.main === module, so we'll always run it
// and export the function for use in other scripts
ensurePorts().then(success => {
  if (!success) {
    process.exit(1);
  }
}).catch(error => {
  console.error(`${colors.red}Error ensuring ports:${colors.reset}`, error);
  process.exit(1);
});

// Export the function for use in other scripts
export default ensurePorts;
