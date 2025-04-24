# Architectuur Documentatie

Dit document beschrijft de architectuur van de applicatie.

## Overzicht

De applicatie is gebouwd als een moderne web applicatie met een React frontend en een Node.js backend. De applicatie gebruikt een SQLite database voor lokale opslag en communiceert met de Gripp API voor het ophalen en synchroniseren van data.

## Architectuur Diagram

```
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|  React Frontend  | <-> |  Node.js Backend | <-> |    Gripp API     |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
                               |
                               v
                         +------------+
                         |            |
                         |   SQLite   |
                         |            |
                         +------------+
```

## Componenten

### Frontend

De frontend is gebouwd met React en gebruikt de volgende technologieën:

- **React**: JavaScript library voor het bouwen van user interfaces
- **React Router**: Voor routing binnen de applicatie
- **React Query**: Voor het beheren van server state
- **Tailwind CSS**: Voor styling
- **shadcn/ui**: Voor UI componenten
- **date-fns**: Voor het werken met datums
- **Lucide React**: Voor iconen

De frontend is georganiseerd volgens de volgende structuur:

```
src/
├── components/       # UI componenten
│   ├── common/       # Gedeelde componenten
│   ├── features/     # Feature-specifieke componenten
│   └── ui/           # Basis UI componenten
├── hooks/            # Custom React hooks
├── lib/              # Utilities en configuratie
├── pages/            # Pagina componenten
├── types/            # TypeScript type definities
└── utils/            # Helper functies
```

### Backend

De backend is gebouwd met Node.js en Express en gebruikt de volgende technologieën:

- **Express**: Web framework voor Node.js
- **SQLite**: Lichtgewicht database
- **node-fetch**: Voor het maken van HTTP requests
- **node-cache**: Voor caching

De backend is georganiseerd volgens de volgende structuur:

```
src/
├── api/              # API endpoints
│   └── gripp/        # Gripp API integratie
│       ├── client.ts # Gripp API client
│       ├── services/ # Service modules
│       └── types.ts  # Type definities
├── db/               # Database modules
├── config/           # Configuratie
└── scripts/          # Utility scripts
```

## Dataflow

1. **Frontend naar Backend**: De frontend maakt API requests naar de backend om data op te halen of acties uit te voeren.
2. **Backend naar Database**: De backend haalt data op uit de SQLite database of slaat data op in de database.
3. **Backend naar Gripp API**: De backend maakt requests naar de Gripp API om data te synchroniseren.
4. **Caching**: De backend gebruikt caching om de performance te verbeteren en het aantal requests naar de Gripp API te beperken.

## Belangrijke Modules

### Frontend Modules

#### React Query

React Query wordt gebruikt voor het beheren van server state. Het biedt caching, automatische refetching en error handling.

```typescript
// Voorbeeld van een query hook
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        throw new Error('Failed to fetch projects');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minuten
  });
}
```

#### Error Handling

De applicatie gebruikt een centrale error handling service voor het afhandelen van fouten.

```typescript
// Voorbeeld van error handling
try {
  // Code die een error kan gooien
} catch (error) {
  handleError(error, {
    title: 'Fout bij het laden van projecten',
    context: { action: 'load projects' }
  });
}
```

#### Performance Optimalisatie

De applicatie gebruikt verschillende technieken voor performance optimalisatie:

- **Memoization**: Voor het voorkomen van onnodige re-renders
- **Lazy Loading**: Voor het lazy loaden van componenten
- **Optimized Images**: Voor het optimaliseren van afbeeldingen

### Backend Modules

#### Gripp API Client

De Gripp API client is verantwoordelijk voor het communiceren met de Gripp API.

```typescript
// Voorbeeld van de Gripp API client
export class GrippClient {
  async getProjects(): Promise<GrippProject[]> {
    const response = await this.request('/projects');
    return response;
  }

  private async request(endpoint: string, options?: RequestOptions): Promise<any> {
    // Request implementatie
  }
}
```

#### Database Optimizer

De database optimizer is verantwoordelijk voor het optimaliseren van database queries.

```typescript
// Voorbeeld van de database optimizer
export class DbOptimizer {
  async query<T>(query: string, params: any[] = []): Promise<T[]> {
    return this.measureQuery(query, params, () => this.db!.all<T[]>(query, params));
  }

  private async measureQuery<T>(query: string, params: any[], fn: () => Promise<T>): Promise<T> {
    // Query performance meting
  }
}
```

#### Enhanced Cache

De enhanced cache is verantwoordelijk voor het cachen van data.

```typescript
// Voorbeeld van de enhanced cache
export class EnhancedCache {
  get<T>(key: string, defaultValue?: T): T | undefined {
    // Cache implementatie
  }

  set<T>(key: string, value: T, ttl: number = this.options.defaultTtl, level: CacheLevel = CacheLevel.MEMORY): void {
    // Cache implementatie
  }
}
```

## Database Schema

De applicatie gebruikt een SQLite database met de volgende tabellen:

### Projects

```sql
CREATE TABLE projects (
  id INTEGER PRIMARY KEY,
  name TEXT,
  number INTEGER,
  color TEXT,
  archived INTEGER,
  -- Andere velden
);
```

### Employees

```sql
CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT,
  email TEXT,
  function TEXT,
  active INTEGER,
  -- Andere velden
);
```

### Invoices

```sql
CREATE TABLE invoices (
  id INTEGER PRIMARY KEY,
  number TEXT,
  date TEXT,
  duedate TEXT,
  status TEXT,
  totalinclvat TEXT,
  totalexclvat TEXT,
  -- Andere velden
);
```

### Companies

```sql
CREATE TABLE companies (
  id INTEGER PRIMARY KEY,
  name TEXT,
  city TEXT,
  country TEXT,
  active INTEGER,
  -- Andere velden
);
```

## API Endpoints

De applicatie biedt de volgende API endpoints:

- `/api/projects`: Voor het ophalen en synchroniseren van projecten
- `/api/employees`: Voor het ophalen en synchroniseren van medewerkers
- `/api/invoices`: Voor het ophalen en synchroniseren van facturen
- `/api/companies`: Voor het ophalen en synchroniseren van bedrijven

Zie de [API Documentatie](./API_DOCUMENTATION.md) voor meer details.

## Caching Strategie

De applicatie gebruikt een multi-level caching strategie:

1. **Memory Cache**: Voor snelle toegang tot veelgebruikte data
2. **Persistent Cache**: Voor data die moet overleven na server restart
3. **Database Cache**: Voor het cachen van data uit de Gripp API

De cache wordt geïnvalideerd wanneer data verandert, bijvoorbeeld bij het synchroniseren van data.

## Error Handling

De applicatie gebruikt een centrale error handling service voor het afhandelen van fouten:

1. **Frontend**: Gebruikt React Error Boundaries en een centrale error handler
2. **Backend**: Gebruikt try-catch blocks en een centrale error middleware
3. **Logging**: Fouten worden gelogd voor debugging

## Performance Optimalisatie

De applicatie gebruikt verschillende technieken voor performance optimalisatie:

1. **Frontend**: Memoization, lazy loading, optimized images
2. **Backend**: Query optimalisatie, caching, prepared statements
3. **Database**: Indexen, query optimalisatie, transacties

## Deployment

De applicatie kan worden gedeployed als een standalone applicatie of als een Docker container.

### Standalone Deployment

1. Build de frontend: `npm run build`
2. Start de server: `npm start`

### Docker Deployment

1. Build de Docker image: `docker build -t het-nieuwe-werken .`
2. Run de Docker container: `docker run -p 3000:3000 -p 3002:3002 het-nieuwe-werken`

## Conclusie

De applicatie is gebouwd met moderne technologieën en volgt best practices voor performance, error handling en caching. De architectuur is modulair en schaalbaar, wat het gemakkelijk maakt om nieuwe features toe te voegen of bestaande features te wijzigen.
