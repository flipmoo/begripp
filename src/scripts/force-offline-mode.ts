/**
 * Force Offline Mode
 * 
 * This script forces the application to run in offline mode by setting the OFFLINE_MODE environment variable.
 */

import { writeFileSync } from 'fs';
import path from 'path';

// Path to the .env file
const envPath = path.resolve(process.cwd(), '.env');

// Read the current .env file if it exists
let envContent = '';
try {
  envContent = require('fs').readFileSync(envPath, 'utf8');
} catch (error) {
  console.log('No .env file found, creating a new one');
}

// Check if OFFLINE_MODE is already set
if (envContent.includes('OFFLINE_MODE=')) {
  // Replace the existing OFFLINE_MODE value
  envContent = envContent.replace(/OFFLINE_MODE=.*/, 'OFFLINE_MODE=true');
} else {
  // Add OFFLINE_MODE to the .env file
  envContent += '\nOFFLINE_MODE=true';
}

// Write the updated .env file
writeFileSync(envPath, envContent);

console.log('Offline mode has been enabled in the .env file');
console.log('Restart the application for the changes to take effect');
