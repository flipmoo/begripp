# Opschoon Plan

Dit document beschrijft het plan voor het opschonen en optimaliseren van de codebase. De huidige werkende versie van de code is leidend in dit plan.

## Fase 1: Codebase structuur verbeteren

### Werkwijze
Voor elke wijziging volgen we deze stappen:
1. Analyseer het bestand en identificeer verbeterpunten
2. Maak een gedetailleerd plan voor de wijzigingen
3. Voer de wijzigingen uit
4. Start de applicatie en test de functionaliteit
5. Commit de wijzigingen
6. Update het refactoring logboek en cleanup plan

### 1.1 Opschonen van imports en exports
- [x] src/App.tsx
- [x] src/main.tsx
- [x] src/api/gripp/api-server.ts
- [x] src/api/gripp/simple-api-server.ts
- [x] src/services/api.ts
- [x] src/pages/dashboard/index.tsx
- [x] src/pages/pm-dash/index.tsx
- [x] src/pages/employees/index.tsx
- [x] src/pages/projects/index.tsx
- [x] src/pages/invoices/index.tsx

### 1.2 Verbeteren van code formatting en linting
- [x] Consistente code formatting toepassen
- [x] Linting errors oplossen
- [x] TypeScript strict mode verbeteren

### 1.3 Verwijderen van ongebruikte code
- [x] Ongebruikte componenten identificeren en verwijderen
- [x] Dode code verwijderen
- [x] Gedupliceerde code consolideren

## Fase 2: Backend optimalisatie

### 2.1 API structuur verbeteren
- [x] Consistente API structuur implementeren
- [x] Error handling verbeteren
- [x] Logging verbeteren

### 2.2 Database interactie optimaliseren
- [x] Database queries optimaliseren
- [x] Caching strategieën verbeteren
- [x] Data synchronisatie optimaliseren

## Fase 3: Frontend optimalisatie

### 3.1 Componenten optimaliseren
- [x] Grote componenten opsplitsen
- [x] Props typing verbeteren
- [x] Component structuur standaardiseren

### 3.2 State management verbeteren
- [x] React Query gebruik optimaliseren
- [x] Caching strategie verbeteren
- [x] Error handling verbeteren

## Fase 4: Performance optimalisatie

### 4.1 Frontend performance verbeteren (aangepaste aanpak)
- [x] Veilige optimalisaties implementeren (memoization, rendering optimalisatie)
- [x] Afbeeldingen en assets optimaliseren
- [x] Voorzichtige bundle optimalisatie zonder code splitting

### 4.2 Backend performance verbeteren
- [x] API response tijden optimaliseren
- [x] Database queries optimaliseren
- [x] Caching verbeteren

## Fase 5: Documentatie verbeteren

### 5.1 Technische documentatie
- [x] API documentatie maken
- [x] Architectuur documentatie maken
- [x] Setup en installatie instructies verbeteren

### 5.2 Gebruikersdocumentatie
- [x] Gebruikershandleiding maken
- [x] Feature documentatie maken
- [x] FAQ toevoegen

## Fase 6: Codebase opschonen voor merge

### 6.1 Package.json correctie
- [x] Script `simple-api` bijwerken om te verwijzen naar `src/api/gripp/simple-api-server.ts`
- [x] Script `db:init:unified` bijwerken om te verwijzen naar `src/db/unified/init-database.ts`
- [ ] Overige scripts controleren en corrigeren

### 6.2 README.md correctie
- [x] Database locatie bijwerken naar `./src/db/database.sqlite`
- [x] API server informatie bijwerken
- [x] Scripts informatie bijwerken
- [x] Documentatie verwijzingen bijwerken

### 6.3 Database consolidatie
- [ ] Bepalen welk database bestand de huidige productieversie is
- [ ] Zorgen dat alle code naar hetzelfde database bestand verwijst
- [ ] Bijwerken van documentatie om het correcte database bestand te vermelden

### 6.4 API server consolidatie
- [ ] Identificeren van de API server die momenteel in gebruik is
- [ ] Bijwerken van README.md om de correcte API server te vermelden
- [ ] Documenteren van de correcte manier om de API server te starten

### 6.5 API client consolidatie
- [ ] Identificeren van de API client die momenteel in gebruik is
- [ ] Documenteren van de correcte API client in de documentatie

### 6.6 Opschonen van backup en debug bestanden
- [x] Inventariseren van alle backup en debug bestanden
- [x] Bepalen welke bestanden behouden moeten worden
- [x] Archiveren van bestanden die niet direct nodig zijn maar wel bewaard moeten worden
- [x] Verwijderen van bestanden die niet meer nodig zijn
