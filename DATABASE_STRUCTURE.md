# Database Structure Analysis

This document provides an analysis of the current database structure in the codebase. It identifies the different database schemas, their tables, and their usage.

## Database Files

### 1. `./database.sqlite`

**Description**: Contains the unified schema with entities, projects, invoices, etc.

**Tables**:
- `absence_request_lines`
- `absence_requests`
- `absence_types`
- `contracts`
- `employees`
- `entities`
- `entity_lines`
- `entity_tags`
- `holidays`
- `hours`
- `invoice_lines`
- `invoices`
- `migrations`
- `offers`
- `projects`
- `settings`
- `sync_status`
- `tags`

### 2. `./src/db/database.sqlite`

**Description**: Contains the original schema with employees, contracts, hours, etc.

**Tables**:
- `absence_request_lines`
- `absence_requests`
- `cache`
- `contracts`
- `employees`
- `holidays`
- `hours`
- `invoice_lines`
- `invoices`
- `projects`
- `settings`
- `sync_status`

## Database Schema Files

### 1. `src/db/schema.sql`

**Description**: Original database schema.

**Key Tables**:
- `employees` - Employee information
- `contracts` - Employee contracts
- `hours` - Hours worked by employees
- `absence_requests` - Absence requests
- `absence_request_lines` - Individual absence days
- `holidays` - Holiday calendar
- `sync_status` - Synchronization status
- `invoices` - Invoice information
- `invoice_lines` - Invoice line items

### 2. `src/db/unified/schema.sql`

**Description**: Unified database schema.

**Key Tables**:
- `entities` - Base table for projects, offers, etc.
- `projects` - Project information (extends entities)
- `employees` - Employee information
- `holidays` - Holiday calendar
- `invoices` - Invoice information
- `invoice_lines` - Invoice line items
- `sync_status` - Synchronization status
- `settings` - Application settings
- `migrations` - Database migrations

## Database Connection Files

### 1. `src/db/database.ts`

**Description**: Original database connection module.

**Key Functions**:
- `initializeDatabase` - Initialize the database connection
- `getDatabase` - Get the database connection
- `updateSyncStatus` - Update synchronization status
- `getLastSyncStatus` - Get last synchronization status

**Database Path**: `./src/db/database.sqlite`

### 2. `src/db/unified/database.ts`

**Description**: Unified database connection module.

**Key Functions**:
- `openDatabase` - Open the database connection
- `initializeDatabase` - Initialize the database
- `resetDatabase` - Reset the database
- `seedDatabase` - Seed the database with initial data
- `initializeAndSeedDatabase` - Initialize and seed the database
- `getDatabase` - Get the database connection

**Database Path**: `./src/db/database.sqlite`

## Migration Files

### 1. `src/db/migrations/`

**Description**: Original migration files.

**Files**:
- `01_add_absence_request_lines.sql` - Add absence request lines table
- `02_update_absence_requests.sql` - Update absence requests table

### 2. `src/db/unified/migrations/`

**Description**: Unified migration files.

**Files**:
- `001_add_gripp_id_to_invoices.sql` - Add Gripp ID to invoices table
- `add_subject_to_invoices.sql` - Add subject column to invoices table
- `run_migrations.ts` - Run migrations script
- `run_migrations.js` - Run migrations script (JavaScript version)
- `initialize_database.cjs` - Initialize database script
- `check_tables.cjs` - Check tables script
- `add_subject_column.js` - Add subject column script
- `add_subject_column.cjs` - Add subject column script (CommonJS version)

## Recommended Consolidation

Based on the analysis, we recommend the following consolidation:

### Database File

Standardize on `./database.sqlite` as the primary database file. This database contains the unified schema, which appears to be the current production version based on the package.json scripts.

### Database Schema

Standardize on `src/db/unified/schema.sql` as the primary database schema. This schema is more comprehensive and includes support for the unified data structure.

### Database Connection

Standardize on `src/db/unified/database.ts` as the primary database connection module. This module includes more advanced features and better error handling.

### Migrations

Keep both migration directories, but ensure that all future migrations are added to the `src/db/unified/migrations/` directory.

## Implementation Steps

1. Update all database references to use the recommended database file
2. Remove or archive the unused database file
3. Update environment variables to point to the correct database file
4. Test database connectivity to ensure it works correctly
