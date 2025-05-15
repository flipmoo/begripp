import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function main() {
  // Open the database
  const db = await open({
    filename: 'src/db/database.sqlite',
    driver: sqlite3.Database
  });

  console.log('Connected to the database');

  try {
    // Definieer het jaar en de maanden
    const year = 2025;
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    
    // Loop door alle maanden
    for (const month of months) {
      // Formatteer de maand als MM
      const monthStr = month.toString().padStart(2, '0');
      
      // Tel het totaal aantal uren voor deze maand
      const totalHours = await db.get(`
        SELECT SUM(amount) as total 
        FROM hours 
        WHERE date LIKE '${year}-${monthStr}-%'
      `);
      
      // Tel het aantal medewerkers met uren in deze maand
      const employeeCount = await db.get(`
        SELECT COUNT(DISTINCT employee_id) as count 
        FROM hours 
        WHERE date LIKE '${year}-${monthStr}-%'
      `);
      
      // Bereken het gemiddelde aantal uren per medewerker
      const avgHours = employeeCount.count > 0 ? totalHours.total / employeeCount.count : 0;
      
      console.log(`${year}-${monthStr}: ${totalHours.total || 0} hours, ${employeeCount.count} employees, avg: ${avgHours.toFixed(2)} hours/employee`);
      
      // Toon de top 5 medewerkers met de meeste uren
      const topEmployees = await db.all(`
        SELECT e.firstname, e.lastname, SUM(h.amount) as total_hours 
        FROM hours h 
        JOIN employees e ON h.employee_id = e.id 
        WHERE h.date LIKE '${year}-${monthStr}-%' 
        GROUP BY h.employee_id 
        ORDER BY total_hours DESC 
        LIMIT 5
      `);
      
      if (topEmployees.length > 0) {
        console.log(`  Top 5 employees for ${year}-${monthStr}:`);
        topEmployees.forEach(emp => {
          console.log(`  - ${emp.firstname} ${emp.lastname}: ${emp.total_hours}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error checking monthly hours:', error);
  } finally {
    // Close the database
    await db.close();
    console.log('Database connection closed');
  }
}

main().catch(console.error);
