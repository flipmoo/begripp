/**
 * Test script voor de Gripp API (direct)
 */

import axios from 'axios';
import dotenv from 'dotenv';

// Laad environment variables
dotenv.config();

// Gripp API configuratie
const GRIPP_API_URL = process.env.GRIPP_API_URL || 'https://api.gripp.com/public/api3.php';
const GRIPP_API_KEY = process.env.GRIPP_API_KEY;

console.log('Using Gripp API server:', GRIPP_API_URL);
console.log('Using Gripp API key:', GRIPP_API_KEY ? GRIPP_API_KEY.substring(0, 10) + '...' : 'Not set');

async function testGrippApi() {
  try {
    console.log('Testing Gripp API directly...');
    
    // Maak een API call naar Gripp
    const response = await axios.post(GRIPP_API_URL, {
      api_key: GRIPP_API_KEY,
      call: 'projects/list',
      params: {
        options: {
          limit: 5,
          offset: 0
        }
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    
    console.log('Test completed successfully.');
  } catch (error) {
    console.error('Error testing Gripp API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Start de test
testGrippApi();
