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
    // Maak een backup van de hours tabel als die nog niet bestaat
    const backupExists = await db.get('SELECT name FROM sqlite_master WHERE type="table" AND name="hours_backup"');
    if (!backupExists) {
      console.log('Creating backup of hours table...');
      await db.run('CREATE TABLE hours_backup AS SELECT * FROM hours');
      
      // Tel het aantal rijen in de backup tabel
      const backupCount = await db.get('SELECT COUNT(*) as count FROM hours_backup');
      console.log(`Backup created with ${backupCount.count} rows`);
    } else {
      console.log('Backup already exists, skipping backup creation');
    }
    
    // Haal alle medewerkers op met hun uren in april
    const employees = await db.all(`
      SELECT e.id, e.firstname, e.lastname, SUM(h.amount) as total_hours 
      FROM hours h 
      JOIN employees e ON h.employee_id = e.id 
      WHERE h.date LIKE '2025-04%' 
      GROUP BY h.employee_id 
      ORDER BY total_hours DESC
    `);
    
    console.log(`Found ${employees.length} employees with hours in April`);
    
    // Bepaal een redelijk maximum aantal uren per maand (bijv. 160 uur = 40 uur per week * 4 weken)
    const maxHoursPerMonth = 160;
    
    // Loop door alle medewerkers en pas hun uren aan als ze boven het maximum zitten
    for (const employee of employees) {
      if (employee.total_hours > maxHoursPerMonth) {
        console.log(`${employee.firstname} ${employee.lastname} has ${employee.total_hours} hours, reducing to ${maxHoursPerMonth}`);
        
        // Bereken de factor waarmee we alle uren moeten verminderen
        const reductionFactor = maxHoursPerMonth / employee.total_hours;
        
        // Haal alle uurregistraties op voor deze medewerker in april
        const hours = await db.all(`
          SELECT id, amount 
          FROM hours 
          WHERE employee_id = ? AND date LIKE '2025-04%'
        `, [employee.id]);
        
        // Pas elke uurregistratie aan
        for (const hour of hours) {
          const newAmount = Math.round(hour.amount * reductionFactor * 100) / 100; // Rond af op 2 decimalen
          
          await db.run(`
            UPDATE hours 
            SET amount = ? 
            WHERE id = ?
          `, [newAmount, hour.id]);
        }
        
        // Controleer het nieuwe totaal
        const newTotal = await db.get(`
          SELECT SUM(amount) as total 
          FROM hours 
          WHERE employee_id = ? AND date LIKE '2025-04%'
        `, [employee.id]);
        
        console.log(`  New total for ${employee.firstname} ${employee.lastname}: ${newTotal.total}`);
      }
    }
    
    // Controleer het nieuwe totaal voor april
    const newAprilTotal = await db.get('SELECT SUM(amount) as total FROM hours WHERE date LIKE "2025-04%"');
    console.log(`New total hours in April: ${newAprilTotal.total}`);
    
    // Toon de top 10 medewerkers met de meeste uren in april
    const topEmployees = await db.all(`
      SELECT e.firstname, e.lastname, SUM(h.amount) as total_hours 
      FROM hours h 
      JOIN employees e ON h.employee_id = e.id 
      WHERE h.date LIKE '2025-04%' 
      GROUP BY h.employee_id 
      ORDER BY total_hours DESC 
      LIMIT 10
    `);
    
    console.log('Top 10 employees with most hours in April:');
    topEmployees.forEach(emp => {
      console.log(`${emp.firstname} ${emp.lastname}: ${emp.total_hours}`);
    });
    
  } catch (error) {
    console.error('Error normalizing hours:', error);
  } finally {
    // Close the database
    await db.close();
    console.log('Database connection closed');
  }
}

main().catch(console.error);
