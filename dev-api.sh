#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored text
print_colored() {
  local color=$1
  local text=$2
  echo -e "${color}${text}${NC}"
}

# Function to check if a port is in use
is_port_in_use() {
  local port=$1
  lsof -i :$port >/dev/null 2>&1
  return $?
}

# Function to stop a process that is using a specific port
stop_process_on_port() {
  local port=$1
  print_colored "$YELLOW" "Checking if port $port is in use..."
  
  if is_port_in_use $port; then
    print_colored "$YELLOW" "Port $port is in use. Stopping process..."
    local pid=$(lsof -ti :$port)
    if [ -n "$pid" ]; then
      print_colored "$YELLOW" "Stopping process with PID $pid..."
      kill -9 $pid
      sleep 1
      if ! is_port_in_use $port; then
        print_colored "$GREEN" "Process on port $port successfully stopped."
      else
        print_colored "$RED" "Could not stop process on port $port. Try manually."
        exit 1
      fi
    fi
  else
    print_colored "$GREEN" "Port $port is not in use."
  fi
}

# Main function
main() {
  print_colored "$BLUE" "===== DEVELOPMENT API SERVER ====="
  
  # Step 1: Stop any process on the API port (3004)
  stop_process_on_port 3004
  
  # Step 2: Start the API server with nodemon for hot reloading
  print_colored "$BLUE" "Starting API server on port 3004 with hot reloading..."
  npx nodemon --exec tsx src/scripts/start-api-simple-express.ts
}

# Run the script
main
