import axios from 'axios';
import { GRIPP_API_KEY } from './config';

const API_URL = 'https://api.gripp.com/public/api3.php';

async function testDirectAPI() {
  try {
    console.log('Testing direct API call...');

    const request = {
      method: 'employee.get',
      params: [
        [], // filters
        {   // options
          paging: {
            firstresult: 0,
            maxresults: 250,
          },
          orderings: [
            {
              field: 'employee.firstname',
              direction: 'asc',
            },
          ],
        },
      ],
      id: Date.now(),
    };

    const response = await axios.post(API_URL, [request], {
      headers: {
        'Authorization': `Bearer ${GRIPP_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('API Error:', {
        status: error.response?.status,
        data: error.response?.data,
        headers: error.response?.headers,
      });
    } else {
      console.error('Error:', error);
    }
  }
}

// Run the test
testDirectAPI(); 