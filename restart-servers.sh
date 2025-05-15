#!/bin/bash

# Kleuren voor output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functie om tekst met kleur te printen
print_colored() {
  local color=$1
  local text=$2
  echo -e "${color}${text}${NC}"
}

# Functie om te controleren of een poort in gebruik is
is_port_in_use() {
  local port=$1
  lsof -i :$port >/dev/null 2>&1
  return $?
}

# Functie om een proces te stoppen dat een specifieke poort gebruikt
stop_process_on_port() {
  local port=$1
  print_colored "$YELLOW" "Controleren of poort $port in gebruik is..."
  
  if is_port_in_use $port; then
    print_colored "$YELLOW" "Poort $port is in gebruik. Proces wordt gestopt..."
    local pid=$(lsof -ti :$port)
    if [ -n "$pid" ]; then
      print_colored "$YELLOW" "Proces met PID $pid wordt gestopt..."
      kill -9 $pid
      sleep 1
      if ! is_port_in_use $port; then
        print_colored "$GREEN" "Proces op poort $port is succesvol gestopt."
      else
        print_colored "$RED" "Kon proces op poort $port niet stoppen. Probeer het handmatig."
        exit 1
      fi
    fi
  else
    print_colored "$GREEN" "Poort $port is niet in gebruik."
  fi
}

# Functie om te wachten tot een server beschikbaar is
wait_for_server() {
  local url=$1
  local max_attempts=$2
  local attempt=1
  
  print_colored "$YELLOW" "Wachten tot server op $url beschikbaar is..."
  
  while [ $attempt -le $max_attempts ]; do
    if curl -s --head $url >/dev/null 2>&1; then
      print_colored "$GREEN" "Server op $url is beschikbaar!"
      return 0
    fi
    
    print_colored "$YELLOW" "Poging $attempt/$max_attempts: Server nog niet beschikbaar. Wachten..."
    sleep 2
    ((attempt++))
  done
  
  print_colored "$RED" "Server op $url is niet beschikbaar na $max_attempts pogingen."
  return 1
}

# Hoofdfunctie
main() {
  print_colored "$BLUE" "===== SERVER HERSTART SCRIPT ====="
  
  # Stap 1: Stop alle processen op de benodigde poorten
  stop_process_on_port 3004  # API-server poort
  stop_process_on_port 3002  # Frontend poort
  
  # Stap 2: Start de API-server
  print_colored "$BLUE" "API-server wordt gestart op poort 3004..."
  npm run api &
  API_PID=$!
  
  # Wacht tot de API-server beschikbaar is
  if ! wait_for_server "http://localhost:3004" 10; then
    print_colored "$RED" "API-server kon niet worden gestart. Script wordt afgebroken."
    exit 1
  fi
  
  # Stap 3: Start de frontend
  print_colored "$BLUE" "Frontend wordt gestart op poort 3002..."
  npm run start &
  FRONTEND_PID=$!
  
  # Wacht tot de frontend beschikbaar is
  if ! wait_for_server "http://localhost:3002" 15; then
    print_colored "$RED" "Frontend kon niet worden gestart. Script wordt afgebroken."
    exit 1
  fi
  
  print_colored "$GREEN" "===== SERVERS SUCCESVOL HERSTART ====="
  print_colored "$GREEN" "API-server draait op: http://localhost:3004"
  print_colored "$GREEN" "Frontend draait op: http://localhost:3002"
  print_colored "$YELLOW" "Druk op Ctrl+C om de servers te stoppen."
  
  # Wacht tot de gebruiker het script afbreekt
  wait $FRONTEND_PID
}

# Voer het script uit
main
