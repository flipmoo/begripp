const axios = require('axios');

const GRIPP_API_URL = 'https://api.gripp.com/public/api3.php';
const GRIPP_API_KEY = 'mi3Pq0Pfw6CtuFAtEoQ6gXIT7cra2c';

console.log('Using Gripp API server:', GRIPP_API_URL);
console.log('Using Gripp API key:', GRIPP_API_KEY);

// Test Method 5: API v3 with JSON-RPC format
const requestId = Math.floor(Math.random() * 10000000000);
const requestData = [{
  jsonrpc: '2.0',
  method: 'project.get',
  params: [
    {}, // filters
    {   // options
      paging: {
        firstresult: 0,
        maxresults: 5
      }
    }
  ],
  id: requestId
}];

console.log('Request data:', JSON.stringify(requestData, null, 2));

axios.post(GRIPP_API_URL, requestData, {
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${GRIPP_API_KEY}`
  }
})
.then(response => {
  console.log('Response status:', response.status);
  console.log('Response data:', JSON.stringify(response.data, null, 2));
})
.catch(error => {
  console.error('Error:', error.message);
  if (error.response) {
    console.error('Response status:', error.response.status);
    console.error('Response data:', JSON.stringify(error.response.data, null, 2));
  }
});
