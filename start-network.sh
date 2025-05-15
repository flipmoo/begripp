#!/bin/bash

# Netwerk toegankelijke versie van de applicatie starten
# Dit script start de applicatie op een manier die toegankelijk is vanaf andere apparaten op het netwerk

# Kleuren voor output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functie om gekleurde tekst te printen
print_colored() {
  echo -e "${1}${2}${NC}"
}

# Functie om te controleren of een poort in gebruik is
check_port_in_use() {
  local port=$1
  print_colored "$BLUE" "Controleren of poort $port in gebruik is..."

  if lsof -i :$port > /dev/null 2>&1; then
    print_colored "$YELLOW" "Poort $port is in gebruik. Proces wordt gestopt..."

    # Haal PID op van proces dat de poort gebruikt
    local pid=$(lsof -t -i :$port)
    print_colored "$YELLOW" "Proces met PID $pid wordt gestopt..."

    # Stop het proces
    kill -9 $pid > /dev/null 2>&1

    # Controleer of het proces is gestopt
    if ! lsof -i :$port > /dev/null 2>&1; then
      print_colored "$GREEN" "Proces op poort $port is succesvol gestopt."
      return 0
    else
      print_colored "$RED" "Kon proces op poort $port niet stoppen."
      return 1
    fi
  else
    print_colored "$GREEN" "Poort $port is niet in gebruik."
    return 0
  fi
}

# Functie om te wachten tot een server beschikbaar is
wait_for_server() {
  local url=$1
  local max_attempts=$2
  local attempt=1

  print_colored "$BLUE" "Wachten tot server op $url beschikbaar is..."

  while [ $attempt -le $max_attempts ]; do
    print_colored "$YELLOW" "Poging $attempt/$max_attempts: Server controleren..."

    if curl -s -o /dev/null -w "%{http_code}" $url | grep -q "200\|404"; then
      print_colored "$GREEN" "Server op $url is beschikbaar!"
      return 0
    else
      print_colored "$YELLOW" "Server nog niet beschikbaar. Wachten..."
      sleep 3
      attempt=$((attempt+1))
    fi
  done

  print_colored "$RED" "Server op $url is niet beschikbaar na $max_attempts pogingen."
  return 1
}

# Haal het lokale IP-adres op
get_local_ip() {
  local ip=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n 1)
  echo $ip
}

# Hoofdfunctie
main() {
  local ip_address=$(get_local_ip)

  print_colored "$BLUE" "===== NETWERK TOEGANKELIJKE SERVER STARTEN ====="
  print_colored "$GREEN" "Lokaal IP-adres: $ip_address"

  # Stap 1: Stop alle processen op de benodigde poorten
  check_port_in_use 8081  # API-server poort
  check_port_in_use 8080  # Frontend poort

  # Stap 2: Start de API-server
  print_colored "$BLUE" "API-server wordt gestart op poort 8081..."
  npm run api &
  API_PID=$!

  # Wacht tot de API-server beschikbaar is
  if ! wait_for_server "http://localhost:8081/api/v1/health" 10; then
    print_colored "$RED" "API-server kon niet worden gestart. Script wordt afgebroken."
    exit 1
  fi

  # Stap 3: Start de frontend
  print_colored "$BLUE" "Frontend wordt gestart op poort 8080..."
  npm run dev &
  FRONTEND_PID=$!

  # Wacht tot de frontend beschikbaar is
  if ! wait_for_server "http://localhost:8080" 15; then
    print_colored "$RED" "Frontend kon niet worden gestart. Script wordt afgebroken."
    kill $API_PID
    exit 1
  fi

  # Stap 4: Toon informatie over hoe de applicatie te benaderen is
  print_colored "$GREEN" "===== SERVERS SUCCESVOL GESTART ====="
  print_colored "$GREEN" "API-server draait op: http://$ip_address:8081"
  print_colored "$GREEN" "Frontend draait op: http://$ip_address:8080"
  print_colored "$YELLOW" "Druk op Ctrl+C om de servers te stoppen."

  # Wacht tot de gebruiker het script afbreekt
  wait
}

# Start de hoofdfunctie
main
