/**
 * Script to kill processes running on specified ports
 * Used by npm run kill-api and other scripts
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import { FRONTEND_PORT, API_PORT, getPortKillCommand } from '../config/ports';

const execAsync = promisify(exec);

async function killPort(port: number): Promise<void> {
  try {
    console.log(`Attempting to kill process on port ${port}...`);
    const command = getPortKillCommand(port);
    await execAsync(command);
    console.log(`Successfully killed process on port ${port}`);
  } catch (error) {
    console.log(`No active process found on port ${port} or failed to kill`);
  }
}

async function main() {
  // Default to killing API_PORT if no arguments provided
  const args = process.argv.slice(2);
  const portsToKill = args.length > 0 
    ? args.map(arg => parseInt(arg, 10))
    : [API_PORT];
  
  for (const port of portsToKill) {
    if (isNaN(port)) {
      console.error(`Invalid port number: ${port}`);
      continue;
    }
    await killPort(port);
  }
}

main().catch(error => {
  console.error('Error executing kill-port script:', error);
  process.exit(1);
}); 