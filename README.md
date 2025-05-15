# Het Nieuwe Werken - Begripp V2

This project is a dashboard application for managing projects, hours, employees, and invoices. It uses React, TypeScript, and Vite for the frontend, and Node.js, Express, and SQLite for the backend.

## Features

- **Dashboard**: View project status, hours, and budget information
- **Projects**: Manage projects and project lines
- **Hours**: Track and manage hours worked on projects
- **Employees**: Manage employee information and hours
- **Invoices**: Manage invoices and invoice lines
- **Gripp Integration**: Synchronize data with Gripp API

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm 9 or higher

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file with the following content:
   ```
   # Gripp API
   GRIPP_API_KEY=your_api_key_here

   # Database
   DB_PATH=./src/db/database.sqlite

   # API
   API_PORT=3004
   FRONTEND_PORT=3002
   USE_MOCK=false
   ```
4. Initialize the database:
   ```
   npm run db:init
   ```
5. Synchronize data with Gripp:
   ```
   npm run sync:all
   ```
6. Start the application (recommended method):
   ```
   npm run start
   ```

## API Server

The API server provides endpoints for accessing the data. There are multiple ways to start the API server:

### Recommended method (API v2)

```
npm run api:v2
```

This will start the API server v2 using `src/api/gripp/api-server-v2.ts`.

### Legacy method

```
npm run api
```

This will start the simple API server using `src/scripts/start-api-simple-express.ts`.

The API server will be available at http://localhost:3004/api/v1.

## Documentation

- [API Documentation](./docs/API_DOCUMENTATION.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Database Structure](./docs/DATABASE_STRUCTURE.md)
- [Setup](./docs/SETUP.md)
- [User Guide](./docs/USER_GUIDE.md)
- [FAQ](./docs/FAQ.md)

## Scripts

### Main scripts

- `npm run start`: Start the complete application (recommended method)
- `npm run dev`: Start only the frontend development server
- `npm run api`: Start the API server using `src/scripts/start-api-simple-express.ts`
- `npm run api:v2`: Start the API server using `src/api/gripp/api-server-v2.ts`
- `npm run dev-with-api`: Start both frontend and API server (legacy method)
- `npm run build`: Build the application for production

### Database scripts

- `npm run db:init`: Initialize the database
- `npm run db:iris`: Create IRIS tables

### Synchronization scripts

- `npm run sync:all`: Synchronize all data with Gripp
- `npm run sync:projects`: Synchronize projects with Gripp
- `npm run sync:employees`: Synchronize employees with Gripp
- `npm run sync:hours`: Synchronize hours with Gripp
- `npm run sync:invoices`: Synchronize invoices with Gripp

### Testing scripts

- `npm run test`: Run all tests
- `npm run test:watch`: Run tests in watch mode
- `npm run test:api`: Run API tests
