/**
 * Start API Server
 * 
 * Dit script start de API server op poort 3004.
 */
const { spawn } = require('child_process');
const path = require('path');

// Configuratie
const API_PORT = 3004;

console.log('Starting API server on port', API_PORT);

// Start de API server
const apiProcess = spawn('node', [
  '--loader', 'ts-node/esm',
  path.join('src', 'scripts', 'start-api-simple-express.ts')
], {
  env: {
    ...process.env,
    REQUIRE_AUTH: 'false',
    NODE_ENV: 'development',
    API_PORT: API_PORT.toString()
  },
  stdio: 'inherit'
});

// Event handlers
apiProcess.on('error', (error) => {
  console.error('Failed to start API server:', error);
});

apiProcess.on('exit', (code, signal) => {
  if (code !== 0) {
    console.error(`API server exited with code ${code} and signal ${signal}`);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down API server...');
  apiProcess.kill('SIGINT');
  process.exit(0);
});

console.log('API server started. Press Ctrl+C to stop.');
