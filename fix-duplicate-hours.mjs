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
    // Maak een backup van de hours tabel
    console.log('Creating backup of hours table...');
    await db.run('CREATE TABLE IF NOT EXISTS hours_backup AS SELECT * FROM hours');
    
    // Tel het aantal rijen in de backup tabel
    const backupCount = await db.get('SELECT COUNT(*) as count FROM hours_backup');
    console.log(`Backup created with ${backupCount.count} rows`);
    
    // Identificeer duplicaten
    console.log('Identifying duplicates...');
    const duplicates = await db.all(`
      SELECT date, employee_id, project_id, amount, COUNT(*) as count 
      FROM hours 
      WHERE date LIKE '2025-04%' 
      GROUP BY date, employee_id, project_id, amount 
      HAVING count > 1
    `);
    
    console.log(`Found ${duplicates.length} duplicate groups`);
    
    // Maak een tijdelijke tabel met unieke uren
    console.log('Creating temporary table with unique hours...');
    await db.run('DROP TABLE IF EXISTS hours_unique');
    await db.run(`
      CREATE TABLE hours_unique AS
      SELECT MIN(id) as id, date, employee_id, project_id, project_name, project_line_id, project_line_name, amount, description, status_id, status_name
      FROM hours
      GROUP BY date, employee_id, project_id, amount, description
    `);
    
    // Tel het aantal rijen in de unieke tabel
    const uniqueCount = await db.get('SELECT COUNT(*) as count FROM hours_unique');
    console.log(`Created unique hours table with ${uniqueCount.count} rows`);
    
    // Tel het aantal uren in april voor en na deduplicatie
    const beforeTotal = await db.get('SELECT SUM(amount) as total FROM hours WHERE date LIKE "2025-04%"');
    const afterTotal = await db.get('SELECT SUM(amount) as total FROM hours_unique WHERE date LIKE "2025-04%"');
    
    console.log(`Total hours in April before: ${beforeTotal.total}`);
    console.log(`Total hours in April after: ${afterTotal.total}`);
    console.log(`Difference: ${beforeTotal.total - afterTotal.total}`);
    
    // Vervang de hours tabel met de unieke uren
    console.log('Replacing hours table with unique hours...');
    await db.run('DROP TABLE hours');
    await db.run('ALTER TABLE hours_unique RENAME TO hours');
    
    // Controleer het resultaat
    const finalCount = await db.get('SELECT COUNT(*) as count FROM hours');
    console.log(`Final hours table has ${finalCount.count} rows`);
    
    const finalAprilTotal = await db.get('SELECT SUM(amount) as total FROM hours WHERE date LIKE "2025-04%"');
    console.log(`Final total hours in April: ${finalAprilTotal.total}`);
    
    // Controleer of er nog duplicaten zijn
    const remainingDuplicates = await db.all(`
      SELECT date, employee_id, project_id, amount, COUNT(*) as count 
      FROM hours 
      WHERE date LIKE '2025-04%' 
      GROUP BY date, employee_id, project_id, amount 
      HAVING count > 1
    `);
    
    console.log(`Remaining duplicates: ${remainingDuplicates.length}`);
    
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
    console.error('Error fixing duplicate hours:', error);
  } finally {
    // Close the database
    await db.close();
    console.log('Database connection closed');
  }
}

main().catch(console.error);
