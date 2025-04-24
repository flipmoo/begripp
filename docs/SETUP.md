# Setup en Installatie Instructies

Dit document beschrijft hoe je de applicatie kunt installeren en configureren.

## Vereisten

- Node.js (v18 of hoger)
- npm (v8 of hoger)
- Git

## Installatie

### 1. Clone de repository

```bash
git clone https://github.com/flipmoo/het-nieuwe-werken.git
cd het-nieuwe-werken
```

### 2. Installeer dependencies

```bash
npm install
```

### 3. Configureer omgevingsvariabelen

Maak een `.env` bestand in de root van het project:

```
# API configuratie
GRIPP_API_KEY=your_gripp_api_key
GRIPP_API_URL=https://api.gripp.com/public/v2

# Server configuratie
FRONTEND_PORT=3000
API_PORT=3002

# Database configuratie
DB_PATH=./data/database.sqlite

# Logging configuratie
LOG_LEVEL=info
```

Vervang `your_gripp_api_key` met je eigen Gripp API key.

### 4. Initialiseer de database

```bash
npm run db:init
```

### 5. Start de applicatie

```bash
npm run dev
```

De applicatie is nu beschikbaar op:
- Frontend: http://localhost:3000
- API: http://localhost:3002

## Ontwikkeling

### Development mode

Start de applicatie in development mode:

```bash
npm run dev
```

Dit start zowel de frontend als de backend met hot reloading.

### Frontend development

Start alleen de frontend:

```bash
npm run dev:frontend
```

### Backend development

Start alleen de backend:

```bash
npm run dev:backend
```

### Database beheer

Initialiseer de database:

```bash
npm run db:init
```

Leeg de database:

```bash
npm run db:purge
```

### Testen

Run alle tests:

```bash
npm test
```

Run alleen API tests:

```bash
npm run test:api
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Productie

### Build voor productie

```bash
npm run build
```

### Start in productie mode

```bash
npm start
```

## Docker

### Build Docker image

```bash
docker build -t het-nieuwe-werken .
```

### Run Docker container

```bash
docker run -p 3000:3000 -p 3002:3002 -v $(pwd)/data:/app/data het-nieuwe-werken
```

## Configuratie

### Poorten

De applicatie gebruikt standaard de volgende poorten:
- Frontend: 3000
- API: 3002

Je kunt deze poorten wijzigen in het `.env` bestand.

### Database

De applicatie gebruikt SQLite als database. Het database bestand wordt standaard opgeslagen in `./data/database.sqlite`.

Je kunt de locatie van het database bestand wijzigen in het `.env` bestand.

### Logging

De applicatie gebruikt verschillende log levels:
- `error`: Alleen errors
- `warn`: Errors en warnings
- `info`: Errors, warnings en info (standaard)
- `debug`: Alle logs, inclusief debug informatie

Je kunt het log level wijzigen in het `.env` bestand.

## Troubleshooting

### Poort al in gebruik

Als je een foutmelding krijgt dat een poort al in gebruik is, kun je de poort wijzigen in het `.env` bestand.

### Database errors

Als je database errors krijgt, kun je proberen de database opnieuw te initialiseren:

```bash
npm run db:purge
npm run db:init
```

### API errors

Als je API errors krijgt, controleer dan of je Gripp API key correct is geconfigureerd in het `.env` bestand.

### Offline mode

Je kunt de applicatie in offline mode starten, waarbij geen verbinding wordt gemaakt met de Gripp API:

```bash
npm run dev-offline
```

## Veelgestelde vragen

### Hoe synchroniseer ik data met Gripp?

Je kunt data synchroniseren via de API endpoints:

```bash
# Synchroniseer projecten
curl -X POST http://localhost:3002/api/projects/sync

# Synchroniseer medewerkers
curl -X POST http://localhost:3002/api/employees/sync

# Synchroniseer facturen
curl -X POST http://localhost:3002/api/invoices/sync

# Synchroniseer bedrijven
curl -X POST http://localhost:3002/api/companies/sync
```

### Hoe kan ik de applicatie updaten?

```bash
# Pull de laatste wijzigingen
git pull

# Installeer dependencies
npm install

# Build de applicatie
npm run build

# Start de applicatie
npm start
```

### Hoe kan ik de applicatie debuggen?

Je kunt de applicatie in debug mode starten:

```bash
# Debug frontend
npm run dev

# Debug backend
npm run api:debug
```

Je kunt ook de logs bekijken:

```bash
# Bekijk alle logs
npm run logs

# Bekijk alleen error logs
npm run logs:error
```

## Ondersteuning

Als je problemen hebt met de installatie of configuratie, kun je contact opnemen met de ontwikkelaars:

- Email: koen@bravoure.nl
- GitHub Issues: https://github.com/flipmoo/het-nieuwe-werken/issues
