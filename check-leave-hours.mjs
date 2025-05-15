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
    // Haal alle actieve medewerkers op
    const employees = await db.all(
      `SELECT id, firstname, lastname 
       FROM employees 
       WHERE active = 1`
    );
    
    console.log(`Found ${employees.length} active employees`);
    
    // Definieer het jaar en de maanden waarvoor we verlofuren willen controleren
    const year = 2025;
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // Alle maanden
    
    // Controleer verlofuren voor elke medewerker
    for (const employee of employees) {
      console.log(`\nChecking leave hours for ${employee.firstname} ${employee.lastname} (ID: ${employee.id}):`);
      
      // Voor elke maand
      for (const month of months) {
        // Controleer het aantal verlofuren in deze maand
        const monthLeaveHours = await db.get(
          `SELECT SUM(amount) as total FROM absence_request_lines 
           WHERE date LIKE '${year}-${month.toString().padStart(2, '0')}-%' 
           AND absencerequest_id IN (
             SELECT id FROM absence_requests 
             WHERE employee_id = ?
           )`,
          [employee.id]
        );
        
        const totalHours = monthLeaveHours.total || 0;
        
        // Alleen maanden met verlofuren tonen
        if (totalHours > 0) {
          console.log(`  ${year}-${month.toString().padStart(2, '0')}: ${totalHours} hours`);
        }
      }
      
      // Controleer het totaal aantal verlofuren voor het hele jaar
      const yearLeaveHours = await db.get(
        `SELECT SUM(amount) as total FROM absence_request_lines 
         WHERE date LIKE '${year}-%' 
         AND absencerequest_id IN (
           SELECT id FROM absence_requests 
           WHERE employee_id = ?
         )`,
        [employee.id]
      );
      
      const totalYearHours = yearLeaveHours.total || 0;
      console.log(`  Total for ${year}: ${totalYearHours} hours`);
    }
    
    // Controleer het totaal aantal verlofuren voor alle medewerkers
    const totalLeaveHours = await db.get(
      `SELECT SUM(amount) as total FROM absence_request_lines 
       WHERE date LIKE '${year}-%'`
    );
    
    console.log(`\nTotal leave hours for all employees in ${year}: ${totalLeaveHours.total || 0}`);
    
  } catch (error) {
    console.error('Error checking leave hours:', error);
  } finally {
    // Close the database
    await db.close();
    console.log('Database connection closed');
  }
}

main().catch(console.error);
