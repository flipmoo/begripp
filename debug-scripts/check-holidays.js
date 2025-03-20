// Define the holidays
const holidays = [
  { id: '1', date: '2025-01-01', name: 'New Year' },
  { id: '2', date: '2025-04-18', name: 'Good Friday' },
  { id: '3', date: '2025-04-21', name: 'Easter' },
  { id: '4', date: '2025-04-26', name: 'Kingsdag' },
  { id: '5', date: '2025-05-05', name: 'Liberation Day' },
  { id: '6', date: '2025-05-29', name: 'Ascension Day' },
  { id: '7', date: '2025-06-08', name: '1st day of Pentecost' },
  { id: '8', date: '2025-06-09', name: '2nd day of Pentecost' },
  { id: '9', date: '2025-12-25', name: 'Christmas' },
  { id: '10', date: '2025-12-26', name: 'Christmas' },
];

// Function to get the date of ISO week
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

// Calculate the date range for week 17 of 2025
const startDate = getDateOfISOWeek(17, 2025);
startDate.setUTCHours(0, 0, 0, 0);

const endDate = new Date(startDate);
endDate.setUTCDate(startDate.getUTCDate() + 6);
endDate.setUTCHours(23, 59, 59, 999);

console.log('Week 17 of 2025:');
console.log('Start date:', startDate.toISOString().split('T')[0]);
console.log('End date:', endDate.toISOString().split('T')[0]);

// Check if any holidays fall within this week
const holidaysInWeek = holidays.filter(holiday => {
  const holidayDate = new Date(holiday.date + 'T00:00:00Z');
  return holidayDate >= startDate && holidayDate <= endDate;
});

console.log('\nHolidays in week 17:');
if (holidaysInWeek.length === 0) {
  console.log('No holidays found');
} else {
  holidaysInWeek.forEach(holiday => {
    console.log(`- ${holiday.date}: ${holiday.name}`);
  });
}

// Check each day of the week
console.log('\nChecking each day of week 17:');
const currentDate = new Date(startDate);
while (currentDate <= endDate) {
  const dateStr = currentDate.toISOString().split('T')[0];
  const isHoliday = holidays.some(h => h.date === dateStr);
  console.log(`${dateStr} is${isHoliday ? '' : ' not'} a holiday`);
  
  // Move to the next day
  currentDate.setUTCDate(currentDate.getUTCDate() + 1);
} 