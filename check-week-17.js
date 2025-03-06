import fetch from 'node-fetch';

// Function to check API response for week 17
async function checkWeek17() {
  try {
    console.log('Checking week 17 of 2025...');
    const response = await fetch('http://localhost:3002/api/employees?year=2025&week=17');
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('API response for employees in week 17:');
    console.log('------------------------------------');
    
    // Display holiday hours for each employee
    data.forEach(employee => {
      console.log(`${employee.name}: ${employee.holiday_hours} holiday hours`);
    });
    
    // Calculate the week's date range
    const firstDayOfYear = new Date(Date.UTC(2025, 0, 1));
    const dayOfWeek = firstDayOfYear.getUTCDay();
    const nearestThursday = new Date(firstDayOfYear);
    nearestThursday.setUTCDate(firstDayOfYear.getUTCDate() + (dayOfWeek <= 4 ? 4 - dayOfWeek : 11 - dayOfWeek));
    
    const firstWeek = new Date(nearestThursday);
    firstWeek.setUTCDate(nearestThursday.getUTCDate() - 3); // Go back to Monday
    
    const week17Start = new Date(firstWeek);
    week17Start.setUTCDate(firstWeek.getUTCDate() + (17 - 1) * 7);
    
    const week17End = new Date(week17Start);
    week17End.setUTCDate(week17Start.getUTCDate() + 6);
    
    console.log('\nWeek 17 date range:');
    console.log(`Start: ${week17Start.toISOString().split('T')[0]}`);
    console.log(`End: ${week17End.toISOString().split('T')[0]}`);
    
    // Easter Monday 2025 is on April 21
    console.log('\nEaster Monday check:');
    console.log(`Easter Monday 2025: 2025-04-21`);
    console.log(`Is Easter Monday in week 17? ${week17Start <= new Date('2025-04-21') && new Date('2025-04-21') <= week17End}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkWeek17(); 