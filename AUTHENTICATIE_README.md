# Authenticatiesysteem Documentatie

Dit document beschrijft het authenticatiesysteem van de applicatie, inclusief installatie, configuratie en gebruik.

## Inhoudsopgave

1. [Installatie](#installatie)
2. [Configuratie](#configuratie)
3. [Gebruik](#gebruik)
4. [Rollen en Permissies](#rollen-en-permissies)
5. [API Endpoints](#api-endpoints)
6. [Frontend Componenten](#frontend-componenten)
7. [Troubleshooting](#troubleshooting)

## Installatie

### Automatische Installatie

De eenvoudigste manier om het authenticatiesysteem te installeren is met het setup script:

```bash
node --loader ts-node/esm src/scripts/setup-auth-system.ts
```

Dit script voert de volgende stappen uit:
1. Installeert de benodigde packages
2. Maakt een backup van de database
3. Voert de database migratie uit

### Handmatige Installatie

Als je de installatie handmatig wilt uitvoeren, volg dan deze stappen:

1. Installeer de benodigde packages:
   ```bash
   npm install jsonwebtoken bcrypt cookie-parser
   npm install --save-dev @types/jsonwebtoken @types/bcrypt @types/cookie-parser
   ```

2. Maak een backup van de database:
   ```bash
   node --loader ts-node/esm src/scripts/backup-database.ts pre-auth-manual
   ```

3. Voer de database migratie uit:
   ```bash
   node --loader ts-node/esm src/scripts/run-auth-migration.ts
   ```

## Configuratie

### Feature Flags

Het authenticatiesysteem gebruikt feature flags om authenticatie geleidelijk in te schakelen. Deze flags zijn geconfigureerd in `src/config/auth.config.ts`.

De belangrijkste flags zijn:

- `REQUIRE_AUTH`: Globale flag om authenticatie in/uit te schakelen
- `AUTH_BYPASS_TOKEN`: Token voor noodgevallen om authenticatie te bypassen
- `ENDPOINTS`: Endpoint-specifieke flags om authenticatie in/uit te schakelen per endpoint

Je kunt deze flags configureren via omgevingsvariabelen:

```bash
# Schakel authenticatie globaal in
REQUIRE_AUTH=true node --loader ts-node/esm src/scripts/start-api-simple-express.ts

# Schakel authenticatie alleen in voor specifieke endpoints
REQUIRE_AUTH=false REQUIRE_AUTH_USERS=true node --loader ts-node/esm src/scripts/start-api-simple-express.ts
```

### JWT Configuratie

De JWT configuratie is ook beschikbaar in `src/config/auth.config.ts`. Je kunt de volgende instellingen configureren:

- `JWT_SECRET`: De geheime sleutel voor het ondertekenen van JWT tokens
- `JWT_EXPIRES_IN`: De vervaltijd van JWT tokens
- `JWT_REFRESH_EXPIRES_IN`: De vervaltijd van refresh tokens

Voor productie is het belangrijk om een sterke, unieke JWT secret te configureren:

```bash
JWT_SECRET=jouw-sterke-geheime-sleutel node --loader ts-node/esm src/scripts/start-api-simple-express.ts
```

## Gebruik

### Starten van de Applicatie

Start de API server met authenticatie uitgeschakeld:

```bash
REQUIRE_AUTH=false node --loader ts-node/esm src/scripts/start-api-simple-express.ts
```

Start de frontend applicatie:

```bash
npm run dev
```

### Inloggen

Ga naar de login pagina: http://localhost:5173/login

Log in met de standaard admin gebruiker:
- **Gebruikersnaam**: admin
- **Wachtwoord**: admin

### Admin Interface

Als je bent ingelogd als admin, heb je toegang tot de admin interface:

- **Gebruikersbeheer**: http://localhost:5173/admin/users
- **Rollenbeheer**: http://localhost:5173/admin/roles
- **Permissiebeheer**: http://localhost:5173/admin/permissions

## Rollen en Permissies

### Standaard Rollen

Het systeem bevat de volgende standaard rollen:

1. **Admin**: Volledige toegang tot alle functionaliteit
2. **Manager**: Toegang tot rapportages en beperkte bewerkingsrechten
3. **User**: Alleen-lezen toegang tot de meeste functionaliteit

### Standaard Permissies

Het systeem bevat de volgende categorieën van permissies:

1. **Dashboard permissies**: `view_dashboard`
2. **Project permissies**: `view_projects`, `edit_projects`
3. **Employee permissies**: `view_employees`, `edit_employees`
4. **Invoice permissies**: `view_invoices`, `edit_invoices`
5. **Iris permissies**: `view_iris`, `edit_iris`
6. **Sync permissies**: `sync_data`
7. **Cache permissies**: `manage_cache`
8. **Admin permissies**: `manage_users`, `manage_roles`, `manage_settings`

### Permissie Controle

In de frontend kun je de `usePermission` hook gebruiken om te controleren of een gebruiker een bepaalde permissie heeft:

```tsx
import { usePermission } from '../hooks/usePermission';

function MyComponent() {
  const canEditProjects = usePermission('edit_projects');
  
  return (
    <div>
      {canEditProjects && (
        <button>Bewerk Project</button>
      )}
    </div>
  );
}
```

## API Endpoints

### Authenticatie Endpoints

- `POST /api/v1/auth/login`: Inloggen
- `POST /api/v1/auth/register`: Registreren (alleen voor admins)
- `GET /api/v1/auth/me`: Huidige gebruiker ophalen
- `POST /api/v1/auth/refresh-token`: Token vernieuwen
- `POST /api/v1/auth/change-password`: Wachtwoord wijzigen
- `POST /api/v1/auth/logout`: Uitloggen

### Gebruikersbeheer Endpoints

- `GET /api/v1/users`: Alle gebruikers ophalen
- `GET /api/v1/users/:id`: Specifieke gebruiker ophalen
- `PUT /api/v1/users/:id`: Gebruiker bijwerken
- `DELETE /api/v1/users/:id`: Gebruiker verwijderen

### Rollenbeheer Endpoints

- `GET /api/v1/roles`: Alle rollen ophalen
- `GET /api/v1/roles/:id`: Specifieke rol ophalen
- `POST /api/v1/roles`: Nieuwe rol aanmaken
- `PUT /api/v1/roles/:id`: Rol bijwerken
- `DELETE /api/v1/roles/:id`: Rol verwijderen
- `GET /api/v1/roles/:id/permissions`: Permissies voor een rol ophalen

### Permissiebeheer Endpoints

- `GET /api/v1/permissions`: Alle permissies ophalen
- `GET /api/v1/permissions/:id`: Specifieke permissie ophalen
- `POST /api/v1/permissions`: Nieuwe permissie aanmaken
- `PUT /api/v1/permissions/:id`: Permissie bijwerken
- `DELETE /api/v1/permissions/:id`: Permissie verwijderen

## Frontend Componenten

### AuthContext

De `AuthContext` biedt toegang tot de authenticatiestatus en functies:

```tsx
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();
  
  return (
    <div>
      {isAuthenticated ? (
        <button onClick={logout}>Uitloggen</button>
      ) : (
        <button onClick={() => login('username', 'password')}>Inloggen</button>
      )}
    </div>
  );
}
```

### ProtectedRoute

De `ProtectedRoute` component beschermt routes tegen niet-geauthenticeerde gebruikers:

```tsx
import ProtectedRoute from '../components/auth/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardPage />
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute adminOnly={true}>
          <AdminPage />
        </ProtectedRoute>
      } />
      <Route path="/projects" element={
        <ProtectedRoute requiredPermission="view_projects">
          <ProjectsPage />
        </ProtectedRoute>
      } />
    </Routes>
  );
}
```

## Troubleshooting

### Authenticatie Problemen

Als je problemen ondervindt met authenticatie, controleer dan het volgende:

1. **JWT Secret**: Zorg ervoor dat de JWT secret correct is geconfigureerd
2. **Token Expiratie**: Controleer of de token niet is verlopen
3. **Permissies**: Controleer of de gebruiker de juiste permissies heeft

### Database Problemen

Als je problemen ondervindt met de database, kun je de backup herstellen:

```bash
# Herstel de database van de backup
cp backups/database_backup_[TIMESTAMP]_pre-auth-setup.sqlite database.sqlite
```

### Bypass Mechanisme

In noodgevallen kun je authenticatie bypassen met de bypass token:

```bash
# Gebruik de bypass token in API requests
curl -X GET http://localhost:3001/api/v1/users \
  -H "x-auth-bypass: development-only-bypass-token"
```

### Logging

Als je meer informatie nodig hebt over wat er gebeurt, kun je de logging in de authenticatie middleware uitbreiden:

```typescript
// In src/api/middleware/auth.middleware.ts
console.log(`Authentication request for ${req.path}: ${requireAuth ? 'required' : 'not required'}`);
```
