# Absence Request API

This document describes the Absence Request API endpoints and data structures.

## Database Schema

The absence request data is stored in two tables:

### absence_requests

Stores the main absence request information:

```sql
CREATE TABLE IF NOT EXISTS absence_requests (
    id INTEGER PRIMARY KEY,
    description TEXT,
    comment TEXT,
    createdon TEXT,
    updatedon TEXT,
    searchname TEXT DEFAULT 'NOT SET',
    extendedproperties TEXT,
    employee_id INTEGER NOT NULL,
    employee_searchname TEXT,
    employee_discr TEXT DEFAULT 'medewerker',
    absencetype_id INTEGER NOT NULL,
    absencetype_searchname TEXT NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
);
```

### absence_request_lines

Stores individual absence days within an absence request:

```sql
CREATE TABLE IF NOT EXISTS absence_request_lines (
    id INTEGER PRIMARY KEY,
    absencerequest_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    startingtime TEXT,
    status_id INTEGER NOT NULL,
    status_name TEXT NOT NULL,
    createdon TEXT DEFAULT CURRENT_TIMESTAMP,
    updatedon TEXT,
    searchname TEXT,
    extendedproperties TEXT,
    FOREIGN KEY (absencerequest_id) REFERENCES absence_requests(id) ON DELETE CASCADE
);
```

## API Endpoints

### Get Absence Requests

Retrieves absence requests with their lines.

**URL**: `/api/absencerequests`

**Method**: `GET`

**Query Parameters**:

- `startDate` (required): Start date for filtering (YYYY-MM-DD)
- `endDate` (required): End date for filtering (YYYY-MM-DD)
- `limit` (optional): Maximum number of records to return (default: 10)
- `start` (optional): Starting index for pagination (default: 0)

**Response Format**:

```json
[
  {
    "id": 1,
    "thread": "IFTjs4LP0nKKHw==",
    "result": {
      "rows": [
        {
          "description": "Incidenteel verlof periode 2024-12",
          "comment": "",
          "id": 4056,
          "createdon": {
            "date": "2024-12-12 16:56:26.000000",
            "timezone_type": 3,
            "timezone": "Europe/Amsterdam"
          },
          "updatedon": null,
          "searchname": "NOT SET",
          "extendedproperties": null,
          "employee": {
            "id": 102011,
            "searchname": "Milou Dingenouts",
            "discr": "medewerker"
          },
          "absencetype": {
            "id": 3,
            "searchname": "Dokter, tandarts"
          },
          "absencerequestline": [
            {
              "date": {
                "date": "2024-12-11 00:00:00.000000",
                "timezone_type": 3,
                "timezone": "Europe/Amsterdam"
              },
              "amount": 2,
              "description": "bi-weekly meeting met psycholoog",
              "startingtime": {
                "date": "1970-01-01 09:00:00.000000",
                "timezone_type": 3,
                "timezone": "Europe/Amsterdam"
              },
              "id": 131987,
              "createdon": {
                "date": "2024-12-12 16:56:26.000000",
                "timezone_type": 3,
                "timezone": "Europe/Amsterdam"
              },
              "updatedon": null,
              "searchname": "NOT SET",
              "extendedproperties": null,
              "absencerequest": {
                "id": 4056,
                "searchname": "NOT SET"
              },
              "absencerequeststatus": {
                "id": 1,
                "searchname": "IN AANVRAAG"
              }
            }
          ]
        }
      ],
      "count": 2080,
      "start": 0,
      "limit": 10,
      "next_start": 10,
      "more_items_in_collection": true
    },
    "error": null
  }
]
```

### Sync Absence Data

Synchronizes absence data from the Gripp API.

**URL**: `/api/sync/absence`

**Method**: `POST`

**Request Body**:

```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-12-31"
}
```

**Response Format**:

```json
{
  "success": true,
  "message": "Absence data synced successfully"
}
```

## Data Types

### AbsenceRequest

| Field | Type | Description |
|-------|------|-------------|
| id | number | Unique identifier |
| description | string | Description of the absence request |
| comment | string | Additional comments |
| createdon | GrippDate | Creation date |
| updatedon | GrippDate | Last update date |
| searchname | string | Search name |
| extendedproperties | string | Extended properties (JSON) |
| employee | object | Employee information |
| absencetype | object | Absence type information |
| absencerequestline | array | Array of absence request lines |

### AbsenceRequestLine

| Field | Type | Description |
|-------|------|-------------|
| id | number | Unique identifier |
| date | GrippDate | Date of absence |
| amount | number | Hours of absence |
| description | string | Description of the absence |
| startingtime | GrippDate | Starting time |
| createdon | GrippDate | Creation date |
| updatedon | GrippDate | Last update date |
| searchname | string | Search name |
| extendedproperties | string | Extended properties (JSON) |
| absencerequest | object | Reference to the parent absence request |
| absencerequeststatus | object | Status information |

### GrippDate

| Field | Type | Description |
|-------|------|-------------|
| date | string | Date string (YYYY-MM-DD HH:MM:SS.000000) |
| timezone_type | number | Timezone type (usually 3) |
| timezone | string | Timezone name (e.g., "Europe/Amsterdam") |

## Status Values

- **Status ID 1**: "IN AANVRAAG" (Pending approval)
- **Status ID 2**: "GOEDGEKEURD" (Approved)

## Absence Types

- **Type ID 3**: "Dokter, tandarts" (Doctor, dentist)
- **Type ID 4**: "Vakantie / vrij" (Vacation / time off)
- **Type ID 5**: "Ziekte" (Illness)
- **Type ID 105**: "Other"
- **Type ID 106**: "Tijd voor Tijd" (Time for time)

## Setup and Testing

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