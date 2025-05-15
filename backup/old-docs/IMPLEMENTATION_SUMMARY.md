# Absence Request API Implementation Summary

## Overview

We've implemented a new API structure to handle absence requests in a format that matches the Gripp API response. This implementation includes:

1. A new database schema with two tables:
   - `absence_requests` - Stores the main absence request information
   - `absence_request_lines` - Stores individual absence days within an absence request

2. Updated API endpoints:
   - `GET /api/absencerequests` - Retrieves absence requests with their lines
   - `POST /api/sync/absence` - Synchronizes absence data from the Gripp API

3. Migration scripts to update the database schema

4. Testing tools to verify the API functionality

## Files Created/Modified

1. **Database Migrations**:
   - `src/db/migrations/01_add_absence_request_lines.sql` - Creates the absence request lines table
   - `src/db/migrations/02_update_absence_requests.sql` - Updates the absence requests table

2. **API Implementation**:
   - `src/api/gripp/services/absence.ts` - Updated absence service with new data types and methods
   - `src/api/gripp/simple-api-server.ts` - Added new endpoint to retrieve absence requests

3. **Utilities**:
   - `src/db/run-migrations.js` - Script to run database migrations
   - `test-absence-api.js` - Script to test the new API endpoint

4. **Documentation**:
   - `ABSENCE_API_README.md` - Documentation for the new API
   - `IMPLEMENTATION_SUMMARY.md` - This summary file

## Data Structure

The new data structure closely matches the Gripp API response format:

```typescript
interface AbsenceRequest {
  id: number;
  description: string;
  comment: string;
  createdon: GrippDate;
  updatedon: GrippDate | null;
  searchname: string;
  extendedproperties: string | null;
  employee: {
    id: number;
    searchname: string;
    discr: string;
  };
  absencetype: {
    id: number;
    searchname: string;
  };
  absencerequestline: AbsenceRequestLine[];
}

interface AbsenceRequestLine {
  id: number;
  date: GrippDate;
  amount: number;
  description: string;
  startingtime: GrippDate;
  createdon: GrippDate;
  updatedon: GrippDate | null;
  searchname: string;
  extendedproperties: string | null;
  absencerequest: {
    id: number;
    searchname: string;
  };
  absencerequeststatus: {
    id: number;
    searchname: string;
  };
}

interface GrippDate {
  date: string;
  timezone_type: number;
  timezone: string;
}
```

## Setup Instructions

1. Run the database migrations:
   ```
   node src/db/run-migrations.js
   ```

2. Start the API server:
   ```
   npm run start-api
   ```

3. Test the API:
   ```
   node test-absence-api.js
   ```

## Next Steps

1. **Integration Testing**: Test the API with real data from the Gripp API
2. **Error Handling**: Add more robust error handling for edge cases
3. **Caching**: Consider adding caching for frequently accessed data
4. **Authentication**: Add authentication to secure the API endpoints
5. **Frontend Integration**: Update the frontend to use the new API structure 