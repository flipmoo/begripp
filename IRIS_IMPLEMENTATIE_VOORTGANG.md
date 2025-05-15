# IRIS Revenue App Integratie - Implementatie Voortgang

Dit document houdt de voortgang bij van de implementatie van de IRIS Revenue App in de bestaande applicatie.

## Implementatieplan

### Fase 1: Voorbereiding en Basisstructuur

#### Stap 1: Creëer de basis IRIS pagina en route
- [x] Creëer de basis IrisPage component (`src/pages/iris/index.tsx`)
- [x] Voeg de route toe aan App.tsx
- [x] Voeg het menu-item toe aan de navigatie

#### Stap 2: Creëer de basis API routes
- [x] Creëer de basis IRIS API route module
- [x] Registreer de routes in de API router

#### Stap 3: Creëer de database tabellen
- [x] Creëer de benodigde database tabellen voor IRIS
- [x] Test de database tabellen

### Fase 2: Core Functionaliteit

#### Stap 4: Implementeer de IRIS context en state management
- [x] Creëer de IrisContext voor state management
- [x] Implementeer de basis data fetching logica

#### Stap 5: Implementeer de RevenueTable component
- [x] Creëer de basis RevenueTable component
- [x] Implementeer de tabel headers en structuur

#### Stap 6: Implementeer de API endpoints
- [x] Implementeer de /api/v1/iris/revenue endpoint
- [x] Implementeer de data processing logica

### Fase 3: Uitbreiding en Verfijning

#### Stap 7: Implementeer filtering en sortering
- [ ] Voeg jaar selectie toe
- [ ] Implementeer filtering op project type
- [ ] Implementeer sortering

#### Stap 8: Implementeer de KPI functionaliteit
- [ ] Creëer de KPI componenten
- [ ] Implementeer de KPI API endpoints

#### Stap 9: Implementeer de handmatige data invoer
- [ ] Creëer de formulieren voor handmatige data invoer
- [ ] Implementeer de API endpoints voor handmatige data

### Fase 4: Afronding en Optimalisatie

#### Stap 10: Implementeer caching en performance optimalisaties
- [ ] Implementeer client-side caching
- [ ] Optimaliseer database queries

#### Stap 11: Implementeer error handling en validatie
- [ ] Voeg uitgebreide error handling toe
- [ ] Implementeer data validatie

#### Stap 12: Documentatie en final testing
- [ ] Schrijf technische documentatie
- [ ] Schrijf gebruikersdocumentatie
- [ ] Voer final testing uit

## Implementatie Details

### Stap 1: Creëer de basis IRIS pagina en route

#### IrisPage Component
- Bestand: `src/pages/iris/index.tsx`
- Status: ✅ Voltooid
- Details: Basis component gemaakt met een Card die de titel "IRIS Revenue Overzicht" toont.
- Validatie: Component kan worden gerenderd zonder fouten.

#### Route Toevoegen aan App.tsx
- Bestand: `src/App.tsx`
- Status: ✅ Voltooid
- Details: Route toegevoegd aan de Routes component tussen regels 91-95.
- Validatie: Navigatie naar /iris toont de IrisPage component.

#### Menu-item Toevoegen aan Navigatie
- Bestand: `src/components/common/Layout.tsx`
- Status: ✅ Voltooid
- Details: "Iris" menu-item toegevoegd aan de navigation array op regel 43.
- Validatie: Menu-item is zichtbaar in de navigatiebalk en klikbaar.

### Stap 2: Creëer de basis API routes

#### IRIS API Route Module
- Bestand: `src/api/routes/iris.ts`
- Status: ✅ Voltooid
- Details: Basis API routes gemaakt voor IRIS met endpoints voor health, revenue en kpi.
- Validatie: De routes kunnen worden geïmporteerd zonder fouten.

#### Registreer Routes in API Router
- Bestand: `src/api/routes/index.ts`
- Status: ✅ Voltooid
- Details: IRIS routes geregistreerd in de API router op regel 55 en toegevoegd aan de endpoints lijst.
- Validatie: De API server start zonder fouten en de IRIS endpoints zijn beschikbaar.

### Stap 3: Creëer de database tabellen

#### Database Migratie Script
- Bestand: `src/db/migrations/iris.sql`
- Status: ✅ Voltooid
- Details: SQL migratie script gemaakt met de benodigde tabellen voor IRIS.
- Validatie: Het script bevat alle benodigde tabellen met de juiste structuur.

#### Database Tabellen Creatie Script
- Bestand: `src/scripts/create-iris-tables.ts`
- Status: ✅ Voltooid
- Details: Script gemaakt om de IRIS tabellen te creëren in de database.
- Validatie: Het script kan worden uitgevoerd zonder fouten en creëert de tabellen.

#### NPM Script
- Bestand: `package.json`
- Status: ✅ Voltooid
- Details: NPM script `db:iris` toegevoegd om de IRIS tabellen te creëren.
- Validatie: Het script kan worden uitgevoerd met `npm run db:iris` en creëert de tabellen.

### Stap 4: Implementeer de IRIS context en state management

#### IrisContext Component
- Bestand: `src/contexts/IrisContext.tsx`
- Status: ✅ Voltooid
- Details: Context component gemaakt met state management voor IRIS data.
- Validatie: De context kan worden geïmporteerd en gebruikt in andere componenten.

#### IrisPage Update
- Bestand: `src/pages/iris/index.tsx`
- Status: ✅ Voltooid
- Details: IrisPage component bijgewerkt om de IrisContext te gebruiken.
- Validatie: De pagina toont een laad-indicator en kan data ophalen via de context.

### Stap 5: Implementeer de RevenueTable component

#### RevenueTable Component
- Bestand: `src/components/iris/RevenueTable.tsx`
- Status: ✅ Voltooid
- Details: Tabel component gemaakt voor het tonen van revenue data per project en per maand.
- Validatie: De component kan worden geïmporteerd en gebruikt in de IrisPage.

#### IrisPage Update
- Bestand: `src/pages/iris/index.tsx`
- Status: ✅ Voltooid
- Details: IrisPage component bijgewerkt om de RevenueTable component te gebruiken.
- Validatie: De pagina toont de RevenueTable component wanneer data beschikbaar is.

### Stap 6: Implementeer de API endpoints

#### Revenue API Endpoint
- Bestand: `src/api/routes/iris.ts`
- Status: ✅ Voltooid
- Details: API endpoint geïmplementeerd voor het ophalen van revenue data.
- Validatie: De endpoint retourneert revenue data op basis van uren in de database.

#### Data Processing Logica
- Bestand: `src/api/routes/iris.ts`
- Status: ✅ Voltooid
- Details: Logica geïmplementeerd voor het berekenen van revenue op basis van uren en uurtarieven.
- Validatie: De berekende revenue data is correct en kan worden gebruikt door de frontend.

## Samenvatting van de Implementatie

We hebben de volgende stappen succesvol afgerond:

1. **Basis IRIS pagina en route**
   - Gemaakt: `src/pages/iris/index.tsx`
   - Toegevoegd: Route in App.tsx
   - Toegevoegd: Menu-item in Layout.tsx

2. **Basis API routes**
   - Gemaakt: `src/api/routes/iris.ts`
   - Geregistreerd: Routes in API router

3. **Database tabellen**
   - Gemaakt: `src/db/migrations/iris.sql`
   - Gemaakt: `src/scripts/create-iris-tables.ts`
   - Toegevoegd: NPM script `db:iris`

4. **IRIS context en state management**
   - Gemaakt: `src/contexts/IrisContext.tsx`
   - Bijgewerkt: IrisPage component om context te gebruiken

5. **RevenueTable component**
   - Gemaakt: `src/components/iris/RevenueTable.tsx`
   - Bijgewerkt: IrisPage component om tabel te tonen

6. **API endpoints**
   - Geïmplementeerd: `/api/v1/iris/revenue` endpoint
   - Geïmplementeerd: Data processing logica

De IRIS pagina is nu toegankelijk via het menu en toont een tabel met revenue data op basis van de uren in de database. De pagina is volledig geïntegreerd in de bestaande applicatie en maakt gebruik van dezelfde database en styling.

## Database Analyse en Integratie Plan

Na analyse van de bestaande database structuur hebben we de volgende inzichten:

### Bestaande Database Structuur

1. **Hours Tabel**
   - Bevat uren geregistreerd door medewerkers
   - Heeft een relatie met employees via employee_id
   - Bevat geen directe relatie met projects
   - Belangrijke velden: id, employee_id, date, amount, description

2. **Projects Tabel**
   - Bevat project informatie
   - Geen directe relatie met hours
   - Belangrijke velden: id, name, company (JSON string met client info)

3. **Employees Tabel**
   - Bevat medewerker informatie
   - Heeft een relatie met hours via id -> employee_id
   - Belangrijke velden: id, firstname, lastname, function

4. **Bestaande IRIS Tabellen**
   - iris_kpi_targets: KPI targets per jaar
   - iris_manual_monthly_targets: Maandelijkse revenue targets
   - iris_manual_monthly_definite_revenue: Definitieve maandelijkse revenue
   - iris_manual_project_previous_consumption: Historische project consumptie
   - iris_project_revenue_settings: Project instellingen voor revenue berekening

### Integratie Strategie

Omdat er geen directe relatie is tussen hours en projects, moeten we een strategie bedenken om uren aan projecten te koppelen:

1. **Optie 1: Gebruik description veld in hours**
   - Analyseer het description veld in hours om project informatie te extraheren
   - Voordeel: Geen database wijzigingen nodig
   - Nadeel: Mogelijk onbetrouwbaar als de beschrijvingen niet consistent zijn

2. **Optie 2: Creëer een nieuwe koppeltabel**
   - Maak een nieuwe tabel hours_projects om uren aan projecten te koppelen
   - Voordeel: Schone en duidelijke relatie
   - Nadeel: Vereist data migratie en aanpassingen aan bestaande code

3. **Optie 3: Gebruik bestaande IRIS tabellen**
   - Gebruik de bestaande IRIS tabellen om revenue data te berekenen
   - Voordeel: Maakt gebruik van bestaande structuur
   - Nadeel: Mogelijk niet alle data beschikbaar

4. **Optie 4: Hybride aanpak**
   - Gebruik echte uren data uit hours tabel
   - Koppel aan projecten via een heuristische benadering
   - Vul aan met data uit IRIS tabellen waar nodig
   - Voordeel: Flexibel en maakt gebruik van alle beschikbare data
   - Nadeel: Complexer om te implementeren

### Gekozen Aanpak: Optie 4 (Hybride)

We kiezen voor een hybride aanpak waarbij we:
1. Echte uren data gebruiken uit de hours tabel
2. Deze koppelen aan projecten via een heuristische benadering (bijv. op basis van description)
3. Aanvullen met data uit de IRIS tabellen waar nodig
4. Gebruikers de mogelijkheid geven om handmatig koppelingen te maken en te corrigeren

## Recente Wijzigingen

We hebben de volgende wijzigingen aangebracht:

1. **Verbeterde IRIS API route**
   - Aangepast om alleen echte data te gebruiken (geen dummy data meer)
   - Verbeterd algoritme om uren aan projecten te koppelen op basis van description
   - Toegevoegd ondersteuning voor project nummer en client referentie in matching
   - Toegevoegd status van uren (definitief of niet) op basis van status_id/status_name
   - Verbeterde error handling en logging

## Volgende Stappen

De volgende stappen in de implementatie zijn:

1. **Verdere verbetering van de data integratie**
   - Verfijn het algoritme om uren aan projecten te koppelen
   - Voeg meer metadata toe aan de revenue records
   - Implementeer een caching mechanisme voor performance

2. **Implementeer filtering en sortering**
   - Voeg jaar selectie toe
   - Implementeer filtering op project type
   - Implementeer sortering

3. **Implementeer de KPI functionaliteit**
   - Creëer de KPI componenten
   - Implementeer de KPI API endpoints
   - Integreer met de bestaande iris_kpi_targets tabel

4. **Implementeer de handmatige data invoer**
   - Creëer de formulieren voor handmatige data invoer
   - Implementeer de API endpoints voor handmatige data
   - Integreer met de bestaande IRIS tabellen
