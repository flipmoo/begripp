# Absence Data Management

## Issue Summary

There was an issue with test absence data being present in the local database that did not match the actual absence data in the Gripp API. This caused discrepancies in the absence hours shown for employees, particularly for Adam Devaux who had a test absence record for week 6 of 2025 (February 3-7) that did not exist in Gripp.

## Root Cause

The issue was caused by SQL seed files (`add_absences.sql` and `add_multi_week_absences.sql`) that were manually executed to populate the database with test data. These files:

1. Delete all existing absence records from the database
2. Insert test absence records, including ones for real employees like Adam Devaux

When the application tried to sync with the Gripp API, it encountered errors, and the test data remained in the database, causing discrepancies between what was shown in the application and what was actually in Gripp.

## Solution

The following steps were taken to resolve the issue:

1. All test absence records were deleted from the database
2. The SQL seed files were modified with warning comments to prevent accidental execution in production
3. Actual absence data for Adam Devaux was manually added to the database based on the data from the Gripp API

## Preventing Future Issues

To prevent similar issues in the future:

1. **Do not execute test data SQL files in production environments**
2. If test data is needed, consider:
   - Using fictional employee IDs instead of real ones
   - Creating a separate test database
   - Adding a clear prefix to test data (e.g., "TEST_" in descriptions)

3. When syncing fails, check the logs and try to resolve the API issues

## Gripp API Sync Issues

The application is currently experiencing issues with the Gripp API sync process. When attempting to sync absence data, the following error occurs:

```
API request failed: Error
    at execute (/Users/koenstraatman/bravoure-people/src/api/gripp/client.ts:77:27)
```

This should be investigated further to ensure that absence data can be properly synced from Gripp in the future.

## Manual Data Entry

If the Gripp API sync continues to fail, absence data can be manually added to the database using SQL commands like:

```sql
INSERT INTO absence_requests (
  employee_id, startdate, enddate, type_id, type_name, 
  hours_per_day, description, status_id, status_name
) VALUES (
  101994, '2024-07-22', '2024-07-26', 1, 'Vakantie / vrij', 
  8.0, 'In Dublin - no access to laptop', 2, 'GOEDGEKEURD'
);
```

Ensure that the data matches what is in Gripp to avoid discrepancies. 