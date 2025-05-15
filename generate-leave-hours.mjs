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
    
    // Definieer het jaar en de maanden waarvoor we verlofuren willen genereren
    const year = 2025;
    const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // Alle maanden
    
    // Genereer verlofuren voor elke medewerker
    for (const employee of employees) {
      console.log(`Generating leave hours for ${employee.firstname} ${employee.lastname} (ID: ${employee.id})`);
      
      // Voor elke maand
      for (const month of months) {
        // Bepaal het aantal werkdagen in de maand
        const workingDays = getWorkingDaysInMonth(year, month);
        
        // Bepaal het aantal verlofdagen (ongeveer 20% van de werkdagen, maar random verdeeld)
        const leaveDayCount = Math.floor(workingDays.length * 0.2 * Math.random());
        
        // Als er geen verlofdagen zijn, sla deze maand over
        if (leaveDayCount === 0) continue;
        
        // Kies random werkdagen voor verlof
        const leaveDays = [];
        const shuffledWorkingDays = [...workingDays].sort(() => 0.5 - Math.random());
        
        for (let i = 0; i < leaveDayCount && i < shuffledWorkingDays.length; i++) {
          leaveDays.push(shuffledWorkingDays[i]);
        }
        
        // Als er geen verlofdagen zijn, sla deze maand over
        if (leaveDays.length === 0) continue;
        
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
        
        console.log(`Added ${totalHours} leave hours for ${employee.firstname} ${employee.lastname} in ${year}-${month.toString().padStart(2, '0')} (${leaveDays.length} days)`);
      }
    }
    
    // Controleer het totaal aantal verlofuren
    const totalLeaveHours = await db.get(
      `SELECT SUM(amount) as total FROM absence_request_lines 
       WHERE date LIKE '${year}-%'`
    );
    
    console.log(`Total leave hours generated for ${year}: ${totalLeaveHours.total}`);
    
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
