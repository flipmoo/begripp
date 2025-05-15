# Server Instructies

Dit document bevat instructies voor het starten, stoppen en herstarten van de servers voor dit project.

## Vereisten

- Node.js (versie 18 of hoger)
- npm (versie 7 of hoger)

## Poorten

Dit project gebruikt de volgende poorten:
- **3002**: Frontend server
- **3004**: API server

## Servers starten

### Methode 1: Alles in één keer starten (aanbevolen)

```bash
npm run start
```

Dit commando start zowel de frontend als de API-server in één keer. Het zorgt ervoor dat de API-server eerst wordt gestart en wacht tot deze beschikbaar is voordat de frontend wordt gestart.

### Methode 2: Servers afzonderlijk starten

**API-server starten:**
```bash
npm run api
```

**Frontend starten:**
```bash
npm run dev
```

## Servers herstarten

Als je problemen ondervindt met de servers of als je wijzigingen hebt aangebracht die een herstart vereisen, kun je het volgende commando gebruiken:

```bash
npm run restart
```

Dit script:
1. Controleert of er processen draaien op poort 3002 en 3004
2. Stopt deze processen indien nodig
3. Start de API-server opnieuw op
4. Wacht tot de API-server beschikbaar is
5. Start de frontend opnieuw op
6. Wacht tot de frontend beschikbaar is

## Problemen oplossen

### "Address already in use" foutmelding

Als je een foutmelding krijgt zoals "Error: listen EADDRINUSE: address already in use", betekent dit dat er al een proces draait op de betreffende poort. Gebruik het `npm run restart` commando om alle processen te stoppen en de servers opnieuw te starten.

### Handmatig processen stoppen

Als het `npm run restart` commando niet werkt, kun je de processen handmatig stoppen:

1. Vind de processen die de poorten gebruiken:
   ```bash
   lsof -i :3002,3004
   ```

2. Stop de processen met hun PID (Process ID):
   ```bash
   kill -9 [PID]
   ```

3. Start de servers opnieuw:
   ```bash
   npm run start
   ```

### Controleren of de servers draaien

Je kunt controleren of de servers correct draaien door de volgende URL's te bezoeken:
- Frontend: http://localhost:3002
- API: http://localhost:3004

## Belangrijke opmerkingen

- De API-server moet draaien voordat de frontend correct kan werken
- Als je wijzigingen aanbrengt in de code, moet je mogelijk de servers herstarten om de wijzigingen te zien
- Het is normaal dat het enkele seconden duurt voordat de servers volledig zijn opgestart
