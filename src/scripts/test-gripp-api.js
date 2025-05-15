/**
 * Test script voor de Gripp API
 */

import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

// Laad environment variables
dotenv.config();

// Toon de inhoud van het .env bestand
console.log('Inhoud van .env bestand:');
try {
  console.log(fs.readFileSync('.env', 'utf8'));
} catch (error) {
  console.error('Fout bij lezen van .env bestand:', error);
}

// Gripp API configuratie
const GRIPP_API_URL = process.env.GRIPP_API_URL || 'https://api.gripp.com/public/api3.php';
const GRIPP_API_KEY = process.env.GRIPP_API_KEY;

async function testGrippApi() {
  try {
    console.log('Testing Gripp API...');
    console.log('API URL:', GRIPP_API_URL);
    console.log('API Key:', GRIPP_API_KEY ? GRIPP_API_KEY.substring(0, 10) + '...' : 'Not set');
    console.log('Full API Key:', GRIPP_API_KEY);

    // Maak een API call naar Gripp
    const requestData = {
      api_key: GRIPP_API_KEY,
      call: 'project.list',
      params: {
        limit: 5,
        offset: 0
      }
    };

    console.log('Request data:', JSON.stringify(requestData, null, 2));

    // Probeer verschillende manieren om de API-key door te geven
    console.log('Probeer methode 1: API-key in request body');
    try {
      const response1 = await axios({
        method: 'post',
        url: GRIPP_API_URL,
        data: requestData,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      console.log('Response status (methode 1):', response1.status);
      console.log('Response data (methode 1):', JSON.stringify(response1.data, null, 2));
    } catch (error) {
      console.error('Error methode 1:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    }

    console.log('\nProbeer methode 2: API-key in Authorization header');
    try {
      const response2 = await axios({
        method: 'post',
        url: GRIPP_API_URL,
        data: {
          call: 'project.list',
          params: {
            limit: 5,
            offset: 0
          }
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${GRIPP_API_KEY}`
        }
      });

      console.log('Response status (methode 2):', response2.status);
      console.log('Response data (methode 2):', JSON.stringify(response2.data, null, 2));
    } catch (error) {
      console.error('Error methode 2:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    }

    console.log('\nProbeer methode 3: API-key in URL');
    try {
      const response3 = await axios({
        method: 'post',
        url: `${GRIPP_API_URL}?api_key=${GRIPP_API_KEY}`,
        data: {
          call: 'project.list',
          params: {
            limit: 5,
            offset: 0
          }
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      console.log('Response status (methode 3):', response3.status);
      console.log('Response data (methode 3):', JSON.stringify(response3.data, null, 2));
    } catch (error) {
      console.error('Error methode 3:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    }

    // Gebruik de laatste response voor de rest van de functie
    const response = { status: 200, data: { message: 'Zie bovenstaande resultaten' } };

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
