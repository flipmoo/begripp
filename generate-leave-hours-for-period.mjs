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
    
    // Definieer de periode waarvoor we verlofuren willen genereren
    const year = 2025;
    const month = 4; // April
    
    // Genereer verlofuren voor elke medewerker
    for (const employee of employees) {
      console.log(`Generating leave hours for ${employee.firstname} ${employee.lastname} (ID: ${employee.id})`);
      
      // Controleer of de medewerker al verlofuren heeft in deze periode
      const existingLeaveHours = await db.get(
        `SELECT SUM(amount) as total FROM absence_request_lines 
         WHERE date LIKE '${year}-${month.toString().padStart(2, '0')}-%' 
         AND absencerequest_id IN (
           SELECT id FROM absence_requests 
           WHERE employee_id = ?
         )`,
        [employee.id]
      );
      
      const totalExistingHours = existingLeaveHours.total || 0;
      
      // Als de medewerker al meer dan 40 uur verlof heeft in deze periode, sla deze medewerker over
      if (totalExistingHours >= 40) {
        console.log(`  Skipping ${employee.firstname} ${employee.lastname} - already has ${totalExistingHours} leave hours in ${year}-${month}`);
        continue;
      }
      
      // Bepaal het aantal werkdagen in de maand
      const workingDays = getWorkingDaysInMonth(year, month);
      
      // Bepaal het aantal verlofdagen (ongeveer 20% van de werkdagen, maar random verdeeld)
      // Zorg ervoor dat het totaal aantal verlofuren ongeveer 80 uur is
      const targetLeaveHours = 80 - totalExistingHours;
      const leaveDayCount = Math.ceil(targetLeaveHours / 8); // Ongeveer 8 uur per dag
      
      // Als er geen verlofdagen nodig zijn, sla deze medewerker over
      if (leaveDayCount <= 0) {
        console.log(`  No additional leave days needed for ${employee.firstname} ${employee.lastname}`);
        continue;
      }
      
      // Kies random werkdagen voor verlof
      const leaveDays = [];
      const shuffledWorkingDays = [...workingDays].sort(() => 0.5 - Math.random());
      
      for (let i = 0; i < leaveDayCount && i < shuffledWorkingDays.length; i++) {
        leaveDays.push(shuffledWorkingDays[i]);
      }
      
      // Als er geen verlofdagen zijn, sla deze medewerker over
      if (leaveDays.length === 0) {
        console.log(`  No working days available for ${employee.firstname} ${employee.lastname}`);
        continue;
      }
      
      // Maak een nieuwe verlofaanvraag
      const absenceResult = await db.run(
        'INSERT INTO absence_requests (description, employee_id, employee_searchname, absencetype_id, absencetype_searchname, createdon, updatedon) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          `Vakantie ${employee.firstname} ${employee.lastname} ${year}-${month.toString().padStart(2, '0')}`,
          employee.id,
          `${employee.firstname} ${employee.lastname}`,
          1, // Verlof type ID
          'Vakantie', // Verlof type naam
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );
      
      const absenceRequestId = absenceResult.lastID;
      
      // Voeg verlofuren toe voor elke verlofdag
      let totalHours = 0;
      
      for (const day of leaveDays) {
        // Bepaal het aantal uren (meestal 8, soms 4 voor halve dagen)
        const hours = Math.random() < 0.8 ? 8 : 4;
        
        await db.run(
          'INSERT INTO absence_request_lines (absencerequest_id, date, amount, description, status_id, status_name, createdon, updatedon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            absenceRequestId,
            day,
            hours,
            `Vakantie ${employee.firstname} ${employee.lastname}`,
            2, // Status ID voor goedgekeurd verlof
            'Goedgekeurd',
            new Date().toISOString(),
            new Date().toISOString()
          ]
        );
        
        totalHours += hours;
      }
      
      console.log(`  Added ${totalHours} leave hours for ${employee.firstname} ${employee.lastname} in ${year}-${month.toString().padStart(2, '0')} (${leaveDays.length} days)`);
      
      // Controleer het nieuwe totaal aantal verlofuren
      const newTotalLeaveHours = await db.get(
        `SELECT SUM(amount) as total FROM absence_request_lines 
         WHERE date LIKE '${year}-${month.toString().padStart(2, '0')}-%' 
         AND absencerequest_id IN (
           SELECT id FROM absence_requests 
           WHERE employee_id = ?
         )`,
        [employee.id]
      );
      
      console.log(`  New total: ${newTotalLeaveHours.total || 0} hours`);
    }
    
    // Controleer het totaal aantal verlofuren voor de periode
    const totalLeaveHours = await db.get(
      `SELECT SUM(amount) as total FROM absence_request_lines 
       WHERE date LIKE '${year}-${month.toString().padStart(2, '0')}-%'`
    );
    
    console.log(`\nTotal leave hours for ${year}-${month}: ${totalLeaveHours.total || 0}`);
    
    // Update de sync_status tabel om aan te geven dat de verlofuren zijn gesynchroniseerd
    await db.run(
      'INSERT OR REPLACE INTO sync_status (endpoint, last_sync, status) VALUES (?, ?, ?)',
      ['leave_hours', new Date().toISOString(), 'success']
    );
    
    console.log('Updated sync_status table to indicate leave hours are synchronized');
    
  } catch (error) {
    console.error('Error generating leave hours:', error);
  } finally {
    // Close the database
    await db.close();
    console.log('Database connection closed');
  }
}

// Functie om werkdagen in een maand te bepalen (ma-vr, geen feestdagen)
function getWorkingDaysInMonth(year, month) {
  const result = [];
  
  // Bepaal het aantal dagen in de maand
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // Loop door alle dagen van de maand
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = zondag, 1 = maandag, ..., 6 = zaterdag
    
    // Alleen werkdagen (ma-vr)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      // Formatteer de datum als YYYY-MM-DD
      const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      result.push(formattedDate);
    }
  }
  
  return result;
}

main().catch(console.error);
