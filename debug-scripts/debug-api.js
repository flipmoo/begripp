import fetch from 'node-fetch';

async function testApi() {
  try {
    console.log('Testing API with week 17...');
    const response = await fetch('http://localhost:3002/api/employees?year=2025&week=17');
    const data = await response.json();
    
    console.log('Response received, first employee:', data[0]);
    
    // Check if the response contains the expected data
    if (data && data.length > 0) {
      console.log('Number of employees returned:', data.length);
      console.log('First employee contract period:', data[0].contract_period);
      console.log('First employee holiday hours:', data[0].holiday_hours);
    }
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testApi(); 