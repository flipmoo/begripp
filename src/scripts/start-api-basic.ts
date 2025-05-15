/**
 * Basic API Server Starter
 * 
 * This script starts the API server in a very basic way.
 */

import { spawn } from 'child_process';
import { API_PORT } from '../config/ports';

console.log(`=== BASIC API SERVER STARTER ===`);
console.log(`Starting API server on port ${API_PORT}...`);

// Start the API server
const apiServer = spawn('tsx', ['src/api/gripp/api-server.ts'], {
  stdio: 'inherit',
  detached: true
});

// Handle process events
apiServer.on('error', (error) => {
  console.error(`Failed to start API server: ${error.message}`);
  process.exit(1);
});

// Detach the process
apiServer.unref();

console.log(`API server started with PID ${apiServer.pid}`);
console.log(`Press Ctrl+C to stop the API server`);
