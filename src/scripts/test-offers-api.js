/**
 * Test script voor de offers API
 */

import axios from 'axios';

async function testOffersApi() {
  try {
    console.log('Testing offers API...');

    // Test de /api/v1/iris/offers endpoint
    const response = await axios.get('http://localhost:3004/api/v1/iris/offers');

    console.log('Response status:', response.status);
    console.log('Response data:', response.data);

    console.log('Test completed successfully.');
  } catch (error) {
    console.error('Error testing offers API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Start de test
testOffersApi();
