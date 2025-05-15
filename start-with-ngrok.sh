#!/bin/bash

# Start de applicatie en maak deze toegankelijk via ngrok
# Dit script start de applicatie en maakt deze toegankelijk via een publieke URL

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

# Functie om ngrok te controleren en te configureren
check_ngrok() {
  # Controleer of ngrok is geïnstalleerd
  if ! command -v ngrok &> /dev/null; then
    print_colored "$RED" "ngrok is niet geïnstalleerd. Installeer het via: brew install ngrok"
    return 1
  fi
  
  # Controleer of ngrok is geconfigureerd
  if ! ngrok config check &> /dev/null; then
    print_colored "$YELLOW" "ngrok is niet geconfigureerd."
    print_colored "$YELLOW" "Je moet een gratis account aanmaken op https://ngrok.com en je authtoken configureren."
    print_colored "$YELLOW" "Na het aanmaken van een account, voer uit: ngrok config add-authtoken <je-authtoken>"
    return 1
  fi
  
  return 0
}

# Functie om ngrok te starten
start_ngrok() {
  local port=$1
  
  print_colored "$BLUE" "ngrok wordt gestart voor poort $port..."
  
  # Start ngrok in de achtergrond
  ngrok http $port --log=stdout > ngrok.log &
  NGROK_PID=$!
  
  # Wacht even tot ngrok is opgestart
  sleep 3
  
  # Haal de publieke URL op
  local ngrok_url=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*' | grep -o 'http[^"]*')
  
  if [ -z "$ngrok_url" ]; then
    print_colored "$RED" "Kon de ngrok URL niet ophalen. Controleer ngrok.log voor details."
    return 1
  fi
  
  print_colored "$GREEN" "ngrok is gestart! Publieke URL: $ngrok_url"
  return 0
}

# Hoofdfunctie
main() {
  print_colored "$BLUE" "===== APPLICATIE STARTEN MET NGROK ====="
  
  # Controleer ngrok
  if ! check_ngrok; then
    print_colored "$RED" "ngrok configuratie ontbreekt. Script wordt afgebroken."
    exit 1
  fi
  
  # Stap 1: Stop alle processen op de benodigde poorten
  check_port_in_use 3004  # API-server poort
  check_port_in_use 3002  # Frontend poort
  
  # Stap 2: Start de API-server
  print_colored "$BLUE" "API-server wordt gestart op poort 3004..."
  npm run api &
  API_PID=$!
  
  # Wacht tot de API-server beschikbaar is
  if ! wait_for_server "http://localhost:3004/api/v1/health" 10; then
    print_colored "$RED" "API-server kon niet worden gestart. Script wordt afgebroken."
    exit 1
  fi
  
  # Stap 3: Start de frontend
  print_colored "$BLUE" "Frontend wordt gestart op poort 3002..."
  npm run dev &
  FRONTEND_PID=$!
  
  # Wacht tot de frontend beschikbaar is
  if ! wait_for_server "http://localhost:3002" 15; then
    print_colored "$RED" "Frontend kon niet worden gestart. Script wordt afgebroken."
    kill $API_PID
    exit 1
  fi
  
  # Stap 4: Start ngrok voor de frontend
  if ! start_ngrok 3002; then
    print_colored "$RED" "ngrok kon niet worden gestart. Script wordt afgebroken."
    kill $API_PID
    kill $FRONTEND_PID
    exit 1
  fi
  
  # Stap 5: Toon informatie
  print_colored "$GREEN" "===== APPLICATIE IS SUCCESVOL GESTART ====="
  print_colored "$GREEN" "Lokale frontend: http://localhost:3002"
  print_colored "$GREEN" "Lokale API: http://localhost:3004"
  print_colored "$GREEN" "Publieke URL (deel deze met je collega): $(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*' | grep -o 'http[^"]*')"
  print_colored "$YELLOW" "Druk op Ctrl+C om de servers te stoppen."
  
  # Wacht tot de gebruiker het script afbreekt
  wait
}

# Start de hoofdfunctie
main
