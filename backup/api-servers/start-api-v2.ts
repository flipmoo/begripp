/**
 * Start API Server v2
 *
 * Dit script start de nieuwe API server met consistente API structuur.
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Define __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the API server
const apiServerPath = join(__dirname, '../api/gripp/api-server-v2.ts');

console.log(`Starting API server v2 from ${apiServerPath}...`);

// Start the API server
// Gebruik process.execPath om het huidige Node.js executable pad te krijgen
// en spawn het script direct met Node.js om problemen met paden met spaties te voorkomen
const apiServer = spawn('tsx', [
  apiServerPath
], {
  stdio: 'inherit',
  shell: false // Gebruik geen shell om problemen met paden met spaties te voorkomen
});

// Handle process events
apiServer.on('error', (error) => {
  console.error('Failed to start API server v2:', error);
  process.exit(1);
});

apiServer.on('close', (code) => {
  console.log(`API server v2 exited with code ${code}`);
  process.exit(code || 0);
});

// Handle process signals
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down API server v2...');
  apiServer.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down API server v2...');
  apiServer.kill('SIGTERM');
});
