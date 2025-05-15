import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function main() {
  // Open the database
  const db = await open({
    filename: 'src/db/database.sqlite',
    driver: sqlite3.Database
  });

  console.log('Connected to the database');

  // Voeg nieuwe dashboard-specifieke permissies toe
  const dashboardPermissions = [
    { name: 'view_dashboard_projects', description: 'Projecten sectie op dashboard bekijken' },
    { name: 'view_dashboard_employees', description: 'Medewerkers sectie op dashboard bekijken' },
    { name: 'view_dashboard_invoices', description: 'Facturen sectie op dashboard bekijken' },
    { name: 'view_dashboard_iris', description: 'Iris sectie op dashboard bekijken' },
    { name: 'view_dashboard_stats', description: 'Statistieken op dashboard bekijken' }
  ];

  // Voeg elke permissie toe
  for (const permission of dashboardPermissions) {
    // Controleer of de permissie al bestaat
    const existingPermission = await db.get('SELECT id FROM permissions WHERE name = ?', [permission.name]);
    
    if (!existingPermission) {
      // Voeg de permissie toe
      const result = await db.run(
        'INSERT INTO permissions (name, description) VALUES (?, ?)',
        [permission.name, permission.description]
      );
      
      console.log(`Added permission ${permission.name} with ID ${result.lastID}`);
    } else {
      console.log(`Permission ${permission.name} already exists with ID ${existingPermission.id}`);
    }
  }

  // Voeg de nieuwe permissies toe aan de admin rol
  const adminRoleId = 1; // ID van de admin rol
  
  for (const permission of dashboardPermissions) {
    // Haal de permissie ID op
    const permissionRecord = await db.get('SELECT id FROM permissions WHERE name = ?', [permission.name]);
    
    if (permissionRecord) {
      // Controleer of de permissie al aan de rol is toegewezen
      const existingRolePermission = await db.get(
        'SELECT * FROM role_permissions WHERE role_id = ? AND permission_id = ?',
        [adminRoleId, permissionRecord.id]
      );
      
      if (!existingRolePermission) {
        // Voeg de permissie toe aan de rol
        await db.run(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
          [adminRoleId, permissionRecord.id]
        );
        
        console.log(`Added permission ${permission.name} to admin role`);
      } else {
        console.log(`Permission ${permission.name} already assigned to admin role`);
      }
    }
  }

  // Voeg alleen view_dashboard_stats toe aan de Team rol
  const teamRoleId = 4; // ID van de Team rol
  const statsPermissionRecord = await db.get('SELECT id FROM permissions WHERE name = ?', ['view_dashboard_stats']);
  
  if (statsPermissionRecord) {
    // Controleer of de permissie al aan de rol is toegewezen
    const existingRolePermission = await db.get(
      'SELECT * FROM role_permissions WHERE role_id = ? AND permission_id = ?',
      [teamRoleId, statsPermissionRecord.id]
    );
    
    if (!existingRolePermission) {
      // Voeg de permissie toe aan de rol
      await db.run(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
        [teamRoleId, statsPermissionRecord.id]
      );
      
      console.log(`Added permission view_dashboard_stats to Team role`);
    } else {
      console.log(`Permission view_dashboard_stats already assigned to Team role`);
    }
  }

  // Close the database
  await db.close();
  console.log('Database connection closed');
}

main().catch(console.error);
