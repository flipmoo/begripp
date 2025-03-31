# Port Configuration

This application consists of two main components:

1. **Frontend (Vite React)** - Runs on port 3000
2. **API Server** - Runs on port 3002

## Important Note

Always use these exact port numbers. The application is now configured to automatically handle port conflicts by killing existing processes on the required ports. This ensures consistency across all components.

## Central Port Configuration

All port settings are now centralized in `src/config/ports.ts`. This file contains:

- Port numbers for all application components 
- Functions for handling port conflicts
- Platform-specific commands for killing processes on ports

If you need to change port numbers, modify ONLY this file, and the changes will propagate throughout the application.

## Configuration Files Using Port Settings

The following files now use the centralized port configuration:

- `vite.config.ts` - Frontend server configuration
- `src/api/gripp/api-server.ts` - Main API server
- `src/api/gripp/simple-api-server.ts` - Simple API server
- `src/scripts/kill-port.ts` - Script for killing processes on ports

## Running the Application

To run the application correctly:

```bash
# Kill any existing API processes
npm run kill-api

# Start the API server on port 3002
npm run api

# In a separate terminal, start the frontend on port 3000
npm run dev
```

Or use the combined command:

```bash
npm run dev:all
```

## Automatic Port Conflict Resolution

If a process is already using one of the required ports, the application will:

1. Detect the port conflict
2. Attempt to kill the process on that port
3. Retry starting the server on the same port
4. If the kill fails, provide clear error messages

This ensures the application always runs on the same ports without manual intervention.

## Troubleshooting

If you encounter port-related issues:

1. Run `npm run kill-api` to kill any processes on the API port
2. For frontend port issues, restart the development server
3. If problems persist, check `src/scripts/kill-port.ts [port]` manually with the problematic port

## Making Changes

If you need to modify API endpoints or services, ensure that:

1. All new endpoints use the API_PORT from the central configuration
2. New services reference `http://localhost:${API_PORT}/api` consistently
3. After making changes, restart both servers 