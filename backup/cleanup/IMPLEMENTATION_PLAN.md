# Implementation Plan for Codebase Cleanup

This document provides a detailed implementation plan for each step of the cleanup process. It includes specific files to modify, commands to run, and tests to perform to ensure the application continues to function correctly.

## 1. Database Consolidation

### Analysis

Based on our analysis, we have two database files:
- `./database.sqlite` - Contains the unified schema (newer)
- `./src/db/database.sqlite` - Contains the original schema (older)

The package.json scripts suggest that the unified schema is the current production version, as it includes scripts like `db:init:unified` and `db:migrate` that work with the unified database.

### Implementation Steps

1. **Backup both database files**
   ```bash
   mkdir -p backup/databases
   cp ./database.sqlite backup/databases/root_database.sqlite
   cp ./src/db/database.sqlite backup/databases/src_db_database.sqlite
   ```

2. **Analyze database structure**
   ```bash
   sqlite3 ./database.sqlite ".schema" > backup/databases/root_schema.sql
   sqlite3 ./src/db/database.sqlite ".schema" > backup/databases/src_db_schema.sql
   ```

3. **Update database references**
   - Modify `src/db/database.ts` to use the root database file
   - Modify `src/db/unified/database.ts` to ensure it uses the same database file
   - Update any scripts that reference either database file

4. **Update environment variables**
   - Ensure the `.env` file points to the correct database file
   - Update documentation to reflect the correct database path

5. **Test database connectivity**
   - Run the application and verify database operations work correctly
   - Check logs for any database connection errors

## 2. API Server Consolidation

### Analysis

Based on our analysis, we have multiple API server implementations:
- `src/api/gripp/api-server.ts` - Original API server
- `src/api/gripp/api-server-v2.ts` - Updated API server with improved structure
- `src/api/gripp/simple-api-server.ts` - Simplified API server
- `src/api/gateway.js` - API gateway for domain-specific routes

The package.json scripts suggest that `api-server-v2.ts` is the current production version, as it includes scripts like `api:v2` and `api:v2:debug`.

### Implementation Steps

1. **Identify all API endpoints**
   - Create a list of all API endpoints currently in use
   - Verify that all endpoints are implemented in the primary server

2. **Update package.json scripts**
   - Modify scripts to use only the primary API server
   - Remove or comment out scripts that use deprecated servers

3. **Archive unused API servers**
   - Move unused API server files to a backup directory
   - Update imports in any files that reference the moved files

4. **Test API functionality**
   - Test all API endpoints to ensure they work correctly
   - Check for any regressions in functionality

## 3. API Client Consolidation

### Analysis

Based on our analysis, we have multiple API client implementations:
- `src/api/gripp/client.ts` - Original client
- `src/db/unified/api/gripp/client.ts` - Unified client with improved error handling
- `src/db/unified/api.ts` (GrippApiClient class) - Simplified client

### Implementation Steps

1. **Identify the primary client**
   - Determine which client is used by the primary API server
   - Verify that it includes all necessary functionality

2. **Update client references**
   - Modify any files that reference deprecated clients
   - Ensure all imports point to the primary client

3. **Archive unused clients**
   - Move unused client files to a backup directory
   - Update imports in any files that reference the moved files

4. **Test client functionality**
   - Test API calls to ensure they work correctly
   - Check for any regressions in functionality

## 4. Backup and Debug File Cleanup

### Analysis

We have identified several backup and debug files:
- `backup/` directory contains old versions of files
- `debug-scripts/` directory contains debugging scripts
- Various test files scattered throughout the codebase

### Implementation Steps

1. **Review backup files**
   - Check each file in the backup directory for unique functionality
   - Document any important code that should be preserved

2. **Review debug scripts**
   - Check each script in the debug-scripts directory for unique functionality
   - Document any important code that should be preserved

3. **Archive unnecessary files**
   - Move unnecessary files to a backup directory
   - Update any references to these files

4. **Remove test data**
   - Identify and remove any test-specific code
   - Ensure no test data is included in the production database

## 5. Documentation Update

### Implementation Steps

1. **Update README.md**
   - Update installation instructions
   - Update usage instructions
   - Update API documentation
   - Update database documentation

2. **Create migration guide**
   - Document the changes made during the cleanup process
   - Provide guidance for future developers

3. **Update API documentation**
   - Document all API endpoints
   - Include request and response examples

4. **Update database documentation**
   - Document the database schema
   - Include entity relationship diagrams if possible

## Testing Plan

After each step of the implementation plan, we will perform the following tests:

1. **Database tests**
   - Verify database connectivity
   - Verify data integrity
   - Verify all queries work correctly

2. **API tests**
   - Test all API endpoints
   - Verify request and response formats
   - Check error handling

3. **Integration tests**
   - Test the application end-to-end
   - Verify all features work correctly

## Rollback Plan

In case of issues, we will have a rollback plan:

1. **Restore database backups**
   - Restore the original database files from backups

2. **Restore code backups**
   - Restore the original code files from backups

3. **Revert package.json changes**
   - Restore the original package.json file
