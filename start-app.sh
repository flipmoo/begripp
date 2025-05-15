#!/bin/bash

# Kill any existing processes on the required ports
echo "Killing any existing processes on ports 3002 and 3004..."
npm run kill-ports

# Initialize the database
echo "Initializing the database..."
npm run db:init

# Start the API server
echo "Starting the API server on port 3004..."
npm run api:express &
API_PID=$!

# Wait for the API server to start
echo "Waiting for the API server to start..."
sleep 3

# Start the frontend
echo "Starting the frontend on port 3002..."
npm run dev &
FRONTEND_PID=$!

# Wait for user input
echo ""
echo "Application is running!"
echo "API server: http://localhost:3004"
echo "Frontend: http://localhost:3002"
echo ""
echo "Press Ctrl+C to stop the application"

# Wait for user to press Ctrl+C
trap "kill $API_PID $FRONTEND_PID; exit" INT
wait
