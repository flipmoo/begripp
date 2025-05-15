# Bravoure People - Cleanup Documentation

## Overview

This document outlines the cleanup process performed on the Bravoure People application to remove test data and establish a proper connection with the actual Gripp API data.

## Cleanup Actions Performed

1. **Removed Test Data SQL Files**
   - Moved test SQL files to a backup directory (`test_data_backup/`)
   - Files moved: `add_absences.sql`, `add_multi_week_absences.sql`, `add_week9_absences.sql`
   - These files contained test data that was causing conflicts with actual data

2. **Cleaned Up Code**
   - Removed special handling for specific employees (Anne de Jong, Koen Straatman)
   - Removed debug logging and test code from `simple-api-server.ts`
   - Standardized the absence filtering logic for all employees

3. **Database Cleanup**
   - Cleared all test absence data from the database
   - Set up proper syncing with the Gripp API

## Current State

The application now:
- Uses a consistent approach for all employees
- Properly filters absences by date range
- Correctly calculates leave hours
- Syncs data from the Gripp API without special cases

## How to Use the API

### Syncing Data from Gripp

1. **Sync Employees and Contracts**
   ```bash
   curl -X POST -H "Content-Type: application/json" -d '{"startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}' http://localhost:3002/api/sync
   ```

2. **Sync Absence Data**
   ```bash
   curl -X POST -H "Content-Type: application/json" -d '{"startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD"}' http://localhost:3002/api/sync/absence
   ```

### Retrieving Employee Data

```bash
curl "http://localhost:3002/api/employees?year=YYYY&week=WW"
```

## Future Development Guidelines

1. **Avoid Test Data in Production**
   - Do not execute test data SQL files in the production environment
   - Create a separate test database for development and testing

2. **Standardized Approach**
   - Treat all employees consistently in the code
   - Avoid special case handling for specific employees

3. **Proper Data Syncing**
   - Always sync employees and contracts before syncing absences
   - Use date ranges that make sense for your use case

4. **Debugging**
   - Use proper logging levels instead of hardcoded debug statements
   - Consider implementing a logging framework for better control

## Troubleshooting

If you encounter issues with the API:

1. Check if the server is running
2. Verify that the database has been properly synced with Gripp
3. Check the server logs for any errors
4. Ensure that the date ranges for syncing are correct 