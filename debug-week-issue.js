// Debug script to help understand the week calculation issue

// Function to get the date of ISO week (same as in api-server.ts)
function getDateOfISOWeek(weekNum, yearNum) {
  // Find the first day of the year
  const firstDayOfYear = new Date(Date.UTC(yearNum, 0, 1));
  
  // Get the day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  const dayOfWeek = firstDayOfYear.getUTCDay();
  
  // Find the nearest Thursday (ISO weeks are defined by the Thursday)
  const nearestThursday = new Date(firstDayOfYear);
  nearestThursday.setUTCDate(firstDayOfYear.getUTCDate() + (dayOfWeek <= 4 ? 4 - dayOfWeek : 11 - dayOfWeek));
  
  // Get the first week of the year
  const firstWeek = new Date(nearestThursday);
  firstWeek.setUTCDate(nearestThursday.getUTCDate() - 3); // Go back to Monday
  
  // Add the required number of weeks
  const targetWeek = new Date(firstWeek);
  targetWeek.setUTCDate(firstWeek.getUTCDate() + (weekNum - 1) * 7);
  
  return targetWeek;
}

// Simulate the API request processing
function simulateApiRequest(year, week) {
  console.log(`\nSimulating API request for year=${year}, week=${week}`);
  
  // Parse parameters
  const yearNum = Number(year);
  const weekNum = Number(week);
  
  console.log(`After parsing: yearNum=${yearNum}, weekNum=${weekNum}`);
  
  // Calculate start date (Monday of the week)
  const startDate = getDateOfISOWeek(weekNum, yearNum);
  startDate.setUTCHours(0, 0, 0, 0);
  
  // Calculate end date (Sunday of the week)
  const endDate = new Date(startDate);
  endDate.setUTCDate(startDate.getUTCDate() + 6);
  endDate.setUTCHours(23, 59, 59, 999);

  console.log('Week boundaries:', {
    week: weekNum,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });
}

// Test with different inputs
simulateApiRequest('2025', '17');
simulateApiRequest('2025', '9');
simulateApiRequest(2025, 17);
simulateApiRequest(2025, 9);

// Test with query string parameters (as they would come from the URL)
simulateApiRequest('2025', '17'); 