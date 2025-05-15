# Poortconfiguratie voor Het Nieuwe Werken

Dit document beschrijft de vaste poortconfiguratie voor de applicatie. Het is belangrijk om deze poorten consistent te gebruiken om problemen te voorkomen.

## Vaste Poorten

| Component | Poort | Beschrijving |
|-----------|-------|-------------|
| Frontend  | 3002  | De React frontend applicatie |
| API       | 3004  | De API server |

## Waarom vaste poorten?

Het gebruik van vaste poorten zorgt voor:
1. Consistentie tussen ontwikkelomgevingen
2. Voorspelbaar gedrag van de applicatie
3. Eenvoudiger debugging
4. Betere documentatie

## Hoe te gebruiken

De applicatie is geconfigureerd om automatisch processen op deze poorten te stoppen voordat de applicatie start. Dit zorgt ervoor dat de applicatie altijd op dezelfde poorten draait.

### Applicatie starten

Om de volledige applicatie (frontend + API) te starten, gebruik:

```bash
npm run start-app
```

Dit commando:
1. Stopt eventuele bestaande processen op de vereiste poorten
2. Start de API server op poort 3004
3. Start de frontend op poort 3002

### Alleen frontend starten

```bash
npm run dev
```

### Alleen API server starten

```bash
npm run api
```

## Problemen oplossen

Als je problemen ondervindt met poorten die in gebruik zijn, kun je het volgende proberen:

1. Handmatig processen stoppen:
   ```bash
   npm run kill-api
   ```

2. Controleren welke processen de poorten gebruiken:
   ```bash
   # Op macOS/Linux
   lsof -i :3002
   lsof -i :3004
   
   # Op Windows
   netstat -ano | findstr :3002
   netstat -ano | findstr :3004
   ```

3. Handmatig processen stoppen op basis van PID:
   ```bash
   # Op macOS/Linux
   kill -9 <PID>
   
   # Op Windows
   taskkill /F /PID <PID>
   ```

## Poorten wijzigen (niet aanbevolen)

Het wijzigen van de poorten wordt sterk afgeraden omdat dit kan leiden tot onverwacht gedrag. Als je toch de poorten moet wijzigen, doe dit dan in het centrale configuratiebestand:

```typescript
// src/config/ports.ts
export const FRONTEND_PORT = 3002;
export const API_PORT = 3004;
```

Na het wijzigen van de poorten moet je de applicatie opnieuw starten met:

```bash
npm run start-app
```
