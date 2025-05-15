/**
 * Force Mock Mode
 * 
 * This script forces the application to use mock data by setting the USE_MOCK environment variable.
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

// Check if USE_MOCK is already set
if (envContent.includes('USE_MOCK=')) {
  // Replace the existing USE_MOCK value
  envContent = envContent.replace(/USE_MOCK=.*/, 'USE_MOCK=true');
} else {
  // Add USE_MOCK to the .env file
  envContent += '\nUSE_MOCK=true';
}

// Write the updated .env file
writeFileSync(envPath, envContent);

console.log('Mock mode has been enabled in the .env file');
console.log('Restart the application for the changes to take effect');
