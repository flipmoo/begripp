# API Server Instructies

## Probleem

Er zijn problemen met het starten van de standaard API-server op poort 3004. De server start wel, maar crasht vervolgens met de foutmelding "Port XXXX is already in use. Killing existing process and retrying...".

## Oplossing

We hebben een alternatieve API-server implementatie gemaakt die wel correct werkt. Deze server gebruikt Express en is eenvoudiger dan de standaard API-server.

## Gebruik

Om de applicatie te starten, gebruik je het volgende commando:

```bash
npm run start-shell
```

Dit script zal:
1. Alle processen op de benodigde poorten stoppen
2. De database initialiseren
3. De Express API-server starten op poort 3004
4. De frontend starten op poort 3002

## Alternatieve methoden

Als je alleen de API-server wilt starten, gebruik je:

```bash
npm run api:express
```

Als je alleen de frontend wilt starten, gebruik je:

```bash
npm run dev
```

## Offline modus

Als je de applicatie in offline modus wilt starten (zonder verbinding met de Gripp API), gebruik je:

```bash
npm run dev-offline
```

## Poorten

- Frontend: 3002
- API: 3004

Deze poorten zijn geconfigureerd in `src/config/ports.ts`.
