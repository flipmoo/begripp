# API Structuur

Dit document beschrijft de structuur van de API en hoe deze is georganiseerd.

## Overzicht

De API is georganiseerd volgens een consistente structuur met versioning en gestandaardiseerde response formaten. De API is toegankelijk via de basis URL `/api`.

## Versioning

De API gebruikt versioning om backward compatibility te garanderen. De huidige versie is v1 en is toegankelijk via `/api/v1`.

## Response Formaat

Alle API endpoints gebruiken een consistent response formaat:

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2025-04-22T12:34:56.789Z",
    // Optionele metadata
  }
}
```

Bij een error:

```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "code": "ERROR_CODE",
    "details": {
      // Optionele error details
    }
  },
  "meta": {
    "timestamp": "2025-04-22T12:34:56.789Z"
  }
}
```

## Endpoints

### Projecten

- `GET /api/v1/projects` - Haal alle projecten op
- `GET /api/v1/projects/:id` - Haal een specifiek project op
- `GET /api/v1/projects/company/:companyId` - Haal projecten op voor een specifiek bedrijf
- `GET /api/v1/projects/phase/:phaseId` - Haal projecten op voor een specifieke fase
- `POST /api/v1/projects/sync` - Synchroniseer projecten met Gripp

### Medewerkers

- `GET /api/v1/employees` - Haal alle medewerkers op
- `GET /api/v1/employees/week` - Haal medewerkers op voor een specifieke week
- `GET /api/v1/employees/month` - Haal medewerkers op voor een specifieke maand

### Facturen

- `GET /api/v1/invoices` - Haal alle facturen op
- `GET /api/v1/invoices/unpaid` - Haal onbetaalde facturen op
- `GET /api/v1/invoices/overdue` - Haal achterstallige facturen op

### Synchronisatie

- `POST /api/v1/sync` - Synchroniseer alle data met Gripp
- `POST /api/v1/sync/absence` - Synchroniseer afwezigheidsverzoeken met Gripp

### Cache

- `GET /api/v1/cache/status` - Haal de status van de cache op
- `POST /api/v1/cache/clear` - Leeg de hele cache
- `POST /api/v1/cache/clear/employees` - Leeg de employee cache
- `POST /api/v1/cache/clear/projects` - Leeg de project cache
- `POST /api/v1/cache/clear/invoices` - Leeg de invoice cache

### Health

- `GET /api/v1/health` - Controleer de gezondheid van de API

## Error Codes

De API gebruikt de volgende error codes:

- `INTERNAL_SERVER_ERROR` - Interne server error
- `NOT_FOUND` - Resource niet gevonden
- `INVALID_REQUEST` - Ongeldige request parameters
- `DATABASE_ERROR` - Database error
- `GRIPP_API_ERROR` - Gripp API error
- `UNAUTHORIZED` - Niet geautoriseerd
- `FORBIDDEN` - Geen toegang
- `RATE_LIMIT_EXCEEDED` - Rate limit overschreden

## Middleware

De API gebruikt de volgende middleware:

- **CORS** - Staat cross-origin requests toe
- **Rate Limiting** - Beperkt het aantal requests per tijdseenheid
- **Error Handling** - Vangt errors op en retourneert gestandaardiseerde error responses
- **Database** - Controleert of de database connectie beschikbaar is

## Implementatie

De API is geïmplementeerd met de volgende bestanden:

- `src/api/routes/index.ts` - Hoofdrouter voor alle API routes
- `src/api/routes/*.ts` - Route modules voor verschillende resources
- `src/api/middleware/*.ts` - Middleware modules
- `src/api/utils/response.ts` - Utilities voor het standaardiseren van API responses
- `src/api/gripp/api-server-v2.ts` - API server implementatie

## Migratie

De oude API endpoints zijn nog steeds beschikbaar voor backward compatibility, maar zullen in de toekomst worden uitgefaseerd. Nieuwe ontwikkeling moet gebruik maken van de nieuwe API structuur.

## Voorbeelden

### Haal alle projecten op

```bash
curl -X GET "http://localhost:3002/api/v1/projects"
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "name": "Project Naam",
      "number": 1001,
      "color": "#FF5733",
      "archived": false,
      "clientreference": "CLIENT-001",
      "startdate": "2025-01-01T00:00:00.000Z",
      "deadline": "2025-06-30T00:00:00.000Z",
      "company": {
        "id": 456,
        "name": "Bedrijfsnaam"
      },
      "phase": {
        "id": 789,
        "name": "In uitvoering"
      }
    }
  ],
  "meta": {
    "timestamp": "2025-04-22T12:34:56.789Z",
    "fromCache": true
  }
}
```

### Error Response

```bash
curl -X GET "http://localhost:3002/api/v1/projects/999999"
```

Response:

```json
{
  "success": false,
  "error": {
    "message": "Project with ID 999999 not found",
    "code": "NOT_FOUND"
  },
  "meta": {
    "timestamp": "2025-04-22T12:34:56.789Z"
  }
}
```
