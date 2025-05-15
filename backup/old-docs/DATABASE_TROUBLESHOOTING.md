# Database Troubleshooting Guide

This guide will help you resolve common database issues in the Het Nieuwe Werken application.

## Common Issues

### 503 Service Unavailable Errors

If you're seeing 503 errors when accessing employee data, it means the API server cannot connect to the database or the database is not properly initialized.

**Solution:**

1. First, try restarting the API server:
   ```bash
   npm run api
   ```

2. If that doesn't work, initialize the database explicitly:
   ```bash
   npm run db:init
   ```

3. If issues persist, try running the complete development environment:
   ```bash
   npm run dev:all
   ```

### Missing Employee Data

If employees are not showing up in the application:

1. Check database connection by running:
   ```bash
   npm run db:init
   ```

2. Clear client-side cache by refreshing the page with `Ctrl+F5` or `Cmd+Shift+R`

3. Manually sync employee data:
   - Go to Settings > Synchronization
   - Click "Sync Employee Data Now"

### Database File Issues

If you encounter errors about missing or corrupted database files:

1. Navigate to the database directory:
   ```bash
   cd src/db
   ```

2. Check if the database file exists:
   ```bash
   ls -la database.sqlite
   ```

3. If the file is missing or has a size of 0, delete it and let the system recreate it:
   ```bash
   rm database.sqlite
   npm run db:init
   ```

## Running the Application

For best results, always run both the API server and frontend together:

```bash
npm run dev:all
```

This will:
1. Initialize the database
2. Start the API server
3. Start the frontend development server

## Logs and Debugging

Check these files for additional debugging information:

- `server.log` - API server logs
- `server_output.txt` - Raw server output
- `server-debug.log` - Detailed debugging information

## Additional Help

If problems persist:

1. Try deleting the database file and letting it recreate
2. Check the server logs for specific error messages
3. Ensure all dependencies are installed with `npm install`
4. Make sure no other services are using port 3002 (API) or 3000 (frontend) 