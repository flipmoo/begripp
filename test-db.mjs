import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function main() {
  // Open the database
  const db = await open({
    filename: 'src/db/database.sqlite',
    driver: sqlite3.Database
  });

  console.log('Connected to the database');

  // Test query
  const users = await db.all('SELECT * FROM users');
  console.log('All users:', users);

  // Test specific user
  const teamUser = await db.get('SELECT * FROM users WHERE username = ?', ['team']);
  console.log('Team user:', teamUser);

  // Close the database
  await db.close();
}

main().catch(console.error);
