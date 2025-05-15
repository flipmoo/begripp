/**
 * Kill Ports Script
 * 
 * This script kills processes on the required ports.
 */

import { FRONTEND_PORT, API_PORT, killProcessOnPort } from '../config/ports';

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
 * Main function to kill processes on required ports
 */
async function killPorts() {
  console.log(`${colors.cyan}=== KILLING PROCESSES ON REQUIRED PORTS ===${colors.reset}`);
  
  // Kill process on frontend port
  console.log(`${colors.yellow}Killing process on frontend port ${FRONTEND_PORT}...${colors.reset}`);
  const frontendKilled = await killProcessOnPort(FRONTEND_PORT);
  if (frontendKilled) {
    console.log(`${colors.green}Successfully killed process on frontend port ${FRONTEND_PORT}${colors.reset}`);
  } else {
    console.log(`${colors.green}No process found on frontend port ${FRONTEND_PORT}${colors.reset}`);
  }
  
  // Kill process on API port
  console.log(`${colors.yellow}Killing process on API port ${API_PORT}...${colors.reset}`);
  const apiKilled = await killProcessOnPort(API_PORT);
  if (apiKilled) {
    console.log(`${colors.green}Successfully killed process on API port ${API_PORT}${colors.reset}`);
  } else {
    console.log(`${colors.green}No process found on API port ${API_PORT}${colors.reset}`);
  }
  
  console.log(`${colors.cyan}=== PORTS CLEARED ===${colors.reset}`);
}

// Run the script
killPorts().catch(error => {
  console.error(`${colors.red}Error killing ports:${colors.reset}`, error);
  process.exit(1);
});
