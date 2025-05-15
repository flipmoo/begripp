# Database Structure

This document provides information about the database structure used in the application.

## Database Files

The application uses a SQLite database located at `./src/db/database.sqlite`. This is the primary database file used by all parts of the application.

## Database Schema

The database schema is defined in `src/db/unified/schema.sql` and includes the following tables:

### Projects

```sql
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  number INTEGER NOT NULL UNIQUE,
  archived BOOLEAN NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
)
```

### Project Lines

```sql
CREATE TABLE IF NOT EXISTS project_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  budget REAL,
  rate REAL,
  archived BOOLEAN NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
)
```

### Employees

```sql
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firstname TEXT NOT NULL,
  lastname TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  function TEXT,
  active BOOLEAN NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
)
```

### Hours

```sql
CREATE TABLE IF NOT EXISTS hours (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee INTEGER NOT NULL,
  project INTEGER NOT NULL,
  projectline INTEGER NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  FOREIGN KEY (employee) REFERENCES employees (id) ON DELETE CASCADE,
  FOREIGN KEY (project) REFERENCES projects (id) ON DELETE CASCADE,
  FOREIGN KEY (projectline) REFERENCES project_lines (id) ON DELETE CASCADE
)
```

### Invoices

```sql
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY,
  grippId INTEGER,
  number TEXT,
  date TEXT,
  dueDate TEXT,
  company INTEGER,
  amount REAL,
  taxAmount REAL,
  totalAmount REAL,
  status TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  external_id TEXT,
  external_data TEXT,
  isPaid INTEGER DEFAULT 0,
  isOverdue INTEGER DEFAULT 0,
  totalExclVat REAL,
  totalInclVat REAL,
  tax_amount REAL,
  company_id INTEGER,
  company_name TEXT,
  due_date TEXT,
  subject TEXT
)
```

### Invoice Lines

```sql
CREATE TABLE IF NOT EXISTS invoice_lines (
  id INTEGER PRIMARY KEY,
  invoice INTEGER NOT NULL,
  description TEXT,
  amount REAL,
  price REAL,
  taxPercentage TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  FOREIGN KEY (invoice) REFERENCES invoices (id) ON DELETE CASCADE
)
```

### Sync Status

```sql
CREATE TABLE IF NOT EXISTS sync_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL UNIQUE,
  lastSyncTime TEXT,
  lastIncrementalSyncTime TEXT,
  lastFullSyncTime TEXT,
  syncInterval INTEGER,
  lastSyncCount INTEGER,
  lastSyncStatus TEXT,
  lastSyncError TEXT
)
```

## Database Initialization

The database is initialized using the `initializeDatabase` function in `src/db/unified/database.ts`. This function creates the tables if they don't exist.

To initialize the database, run:

```bash
npm run db:init:unified
```

## Database Migrations

Database migrations are managed using the `run-migrations.ts` script in `src/db/unified/run-migrations.ts`. This script applies any pending migrations to the database.

To run migrations, use:

```bash
npm run db:migrate
```

## Database Connection

The database connection is managed using the `getDatabase` function in `src/db/unified/database.ts`. This function returns a connection to the database, creating it if it doesn't exist.

Example usage:

```typescript
import { getDatabase } from '../db/unified/database';

async function getProjects() {
  const db = await getDatabase();
  const projects = await db.all('SELECT * FROM projects');
  return projects;
}
```

## Entity Relationships

The database schema includes the following relationships:

- **Projects** have many **Project Lines**
- **Projects** have many **Hours**
- **Employees** have many **Hours**
- **Project Lines** have many **Hours**
- **Invoices** have many **Invoice Lines**

## Data Synchronization

Data is synchronized with the Gripp API using the sync scripts in the `src/scripts` directory. The sync status is tracked in the `sync_status` table.

To synchronize all data, run:

```bash
npm run sync:all
```

To synchronize specific entities, use:

```bash
npm run sync:projects
npm run sync:employees
npm run sync:hours
npm run sync:invoices
```
