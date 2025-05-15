import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function main() {
  // Open the database
  const db = await open({
    filename: 'src/db/database.sqlite',
    driver: sqlite3.Database
  });

  console.log('Connected to the database');

  // Update the team user's password
  const result = await db.run(
    'UPDATE users SET password_hash = ? WHERE username = ?',
    ['team', 'team']
  );

  console.log('Update result:', result);

  // Verify the update
  const teamUser = await db.get('SELECT * FROM users WHERE username = ?', ['team']);
  console.log('Team user after update:', teamUser);

  // Close the database
  await db.close();
}

main().catch(console.error);
