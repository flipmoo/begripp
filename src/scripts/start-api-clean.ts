/**
 * Clean API Server Starter
 * 
 * This script starts the API server after killing any existing processes on the API port.
 */

import { execSync } from 'child_process';
import { API_PORT } from '../config/ports';

console.log(`=== CLEAN API SERVER STARTER ===`);
console.log(`Starting API server on port ${API_PORT}...`);

// Kill any existing process on the API port
try {
  console.log(`Killing any existing process on port ${API_PORT}...`);
  execSync(`lsof -t -i:${API_PORT} | xargs kill -9 2>/dev/null || echo "No process on port ${API_PORT}"`, { stdio: 'inherit' });
  console.log(`Successfully killed processes on port ${API_PORT}`);
} catch (error) {
  console.log(`No process found on port ${API_PORT}`);
}

// Wait for port to be released
console.log('Waiting for port to be released...');
setTimeout(() => {
  // Initialize database
  console.log('Initializing database...');
  try {
    execSync('npm run db:init', { stdio: 'inherit' });
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }

  // Start API server
  console.log(`Starting API server on port ${API_PORT}...`);
  try {
    execSync('tsx src/api/gripp/api-server.ts', { stdio: 'inherit' });
  } catch (error) {
    console.error('Failed to start API server:', error);
    process.exit(1);
  }
}, 2000);
