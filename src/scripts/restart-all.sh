#!/bin/bash

# Script to restart all services (API server and frontend)

echo "Restarting all services..."

# Kill any processes running on ports 3002 and 3004
echo "Killing processes on ports 3002 and 3004..."
lsof -t -i:3002 | xargs kill -9 2>/dev/null || echo "No process on port 3002"
lsof -t -i:3004 | xargs kill -9 2>/dev/null || echo "No process on port 3004"

# Wait for ports to be freed
echo "Waiting for ports to be freed..."
sleep 2

# Start API server
echo "Starting API server on port 3004..."
npm run api &

# Wait for API server to start
echo "Waiting for API server to start..."
sleep 5

# Start frontend
echo "Starting frontend on port 3002..."
npm run dev &

echo "All services restarted. Frontend should be available at http://localhost:3002"
