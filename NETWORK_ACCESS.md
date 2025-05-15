# Netwerktoegang voor Het Nieuwe Werken

Deze handleiding beschrijft hoe je de applicatie kunt starten zodat deze toegankelijk is vanaf andere apparaten op het netwerk.

## Vereisten

- Node.js en npm geïnstalleerd
- Toegang tot het lokale netwerk
- Firewall instellingen die poorten 3002 en 3004 toestaan

## Starten van de applicatie voor netwerktoegang

1. Open een terminal in de hoofdmap van het project
2. Voer het volgende commando uit:

```bash
./start-network.sh
```

Dit script zal:
- Controleren of de benodigde poorten beschikbaar zijn
- De API-server starten op poort 3004
- De frontend starten op poort 3002
- Het IP-adres van je computer tonen, dat anderen kunnen gebruiken om toegang te krijgen

## Toegang vanaf andere apparaten

Andere apparaten op hetzelfde netwerk kunnen de applicatie benaderen via:

- Frontend: `http://<jouw-ip-adres>:3002`
- API: `http://<jouw-ip-adres>:3004`

Bijvoorbeeld, als je IP-adres 192.168.2.41 is:
- Frontend: `http://192.168.2.41:3002`
- API: `http://192.168.2.41:3004`

## Problemen oplossen

### Firewall blokkering

Als andere apparaten geen verbinding kunnen maken, controleer dan of je firewall de poorten 3002 en 3004 toestaat voor inkomende verbindingen.

Op macOS:
1. Ga naar Systeemvoorkeuren > Beveiliging & Privacy > Firewall
2. Klik op "Firewall-opties..."
3. Zorg ervoor dat Node.js toegang heeft of voeg het handmatig toe

Op Windows:
1. Ga naar Configuratiescherm > Systeem en beveiliging > Windows Firewall
2. Klik op "Een app of functie toestaan via Windows Firewall"
3. Zoek Node.js in de lijst of voeg het handmatig toe

### API niet bereikbaar

Als de frontend wel werkt maar de API niet bereikbaar is, controleer dan:
1. Of de API-server draait (controleer de terminal output)
2. Of de API-server luistert op alle netwerkinterfaces (0.0.0.0)
3. Of er geen CORS-fouten zijn in de browser console

## Stoppen van de servers

Druk op `Ctrl+C` in de terminal waar je het script hebt gestart om beide servers te stoppen.

## Technische details

De volgende aanpassingen zijn gemaakt om netwerktoegang mogelijk te maken:

1. API configuratie aangepast om relatieve URLs te gebruiken in de browser
2. CORS instellingen aangepast om alle origins toe te staan
3. Servers geconfigureerd om te luisteren op alle netwerkinterfaces (0.0.0.0)
4. Vite configuratie aangepast voor strikte poortbinding

Deze aanpassingen zorgen ervoor dat de applicatie toegankelijk is vanaf andere apparaten op het netwerk, terwijl de API ook bereikbaar blijft.
