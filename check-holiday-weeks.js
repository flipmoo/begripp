import { getWeek, parseISO } from 'date-fns';

// 2025 holidays from the API
const holidays2025 = [
  { date: "2025-01-01", name: "Nieuwjaarsdag" },
  { date: "2025-04-18", name: "Goede Vrijdag" },
  { date: "2025-04-21", name: "Paasmaandag" },
  { date: "2025-04-27", name: "Koningsdag" },
  { date: "2025-05-05", name: "Bevrijdingsdag" },
  { date: "2025-05-29", name: "Hemelvaartsdag" },
  { date: "2025-06-09", name: "Pinkstermaandag" },
  { date: "2025-12-25", name: "Eerste Kerstdag" },
  { date: "2025-12-26", name: "Tweede Kerstdag" }
];

// Calculate ISO week for each holiday
const holidaysWithWeeks = holidays2025.map(holiday => {
  const date = parseISO(holiday.date);
  const isoWeek = getWeek(date, { weekStartsOn: 1, firstWeekContainsDate: 4 });
  
  return {
    ...holiday,
    isoWeek,
    dayOfWeek: date.getDay() === 0 ? 7 : date.getDay() // Convert Sunday from 0 to 7 for better readability
  };
});

// Print the results
console.log("2025 Holidays with ISO Weeks:");
console.log("-----------------------------");
holidaysWithWeeks.forEach(holiday => {
  console.log(`${holiday.date} (${getDayName(holiday.dayOfWeek)}): ${holiday.name} - Week ${holiday.isoWeek}`);
});

// Helper function to get day name
function getDayName(dayNumber) {
  const days = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return days[dayNumber];
} 