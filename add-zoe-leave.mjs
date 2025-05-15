import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function main() {
  // Open the database
  const db = await open({
    filename: 'src/db/database.sqlite',
    driver: sqlite3.Database
  });

  console.log('Connected to the database');

  // Employee ID van Zoe Zinnemers
  const employeeId = 101667;
  
  try {
    // Maak een nieuwe verlofaanvraag
    const absenceResult = await db.run(
      'INSERT INTO absence_requests (description, employee_id, employee_searchname, absencetype_id, absencetype_searchname, createdon, updatedon) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        'Vakantie Zoe Zinnemers April 2025',
        employeeId,
        'Zoe Zinnemers',
        1, // Verlof type ID
        'Vakantie', // Verlof type naam
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );
    
    const absenceRequestId = absenceResult.lastID;
    console.log(`Created absence request with ID: ${absenceRequestId}`);
    
    // Voeg verlofuren toe voor verschillende dagen in april
    const leaveDays = [
      { date: '2025-04-01', hours: 8 },
      { date: '2025-04-02', hours: 8 },
      { date: '2025-04-03', hours: 8 },
      { date: '2025-04-04', hours: 8 },
      { date: '2025-04-08', hours: 8 },
      { date: '2025-04-09', hours: 8 },
      { date: '2025-04-10', hours: 8 },
      { date: '2025-04-11', hours: 8 },
      { date: '2025-04-14', hours: 8 },
      { date: '2025-04-15', hours: 8 },
      { date: '2025-04-16', hours: 8 },
      { date: '2025-04-17', hours: 8 },
      { date: '2025-04-18', hours: 8 },
      { date: '2025-04-21', hours: 4 },
      { date: '2025-04-22', hours: 8 }
    ];
    
    // Totaal aantal uren
    let totalHours = 0;
    
    // Voeg elke verlofdag toe
    for (const day of leaveDays) {
      await db.run(
        'INSERT INTO absence_request_lines (absencerequest_id, date, amount, description, status_id, status_name, createdon, updatedon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          absenceRequestId,
          day.date,
          day.hours,
          `Vakantie Zoe Zinnemers`,
          2, // Status ID voor goedgekeurd verlof
          'Goedgekeurd',
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );
      
      totalHours += day.hours;
      console.log(`Added ${day.hours} leave hours for ${day.date}`);
    }
    
    console.log(`Total leave hours added: ${totalHours}`);
    
    // Controleer het totaal aantal verlofuren voor Zoe in april
    const totalLeaveHours = await db.get(
      `SELECT SUM(amount) as total FROM absence_request_lines 
       WHERE date LIKE '2025-04%' 
       AND absencerequest_id IN (
         SELECT id FROM absence_requests 
         WHERE employee_id = ?
       )`,
      [employeeId]
    );
    
    console.log(`Total leave hours for Zoe in April 2025: ${totalLeaveHours.total}`);
    
  } catch (error) {
    console.error('Error adding leave hours:', error);
  } finally {
    // Close the database
    await db.close();
    console.log('Database connection closed');
  }
}

main().catch(console.error);
