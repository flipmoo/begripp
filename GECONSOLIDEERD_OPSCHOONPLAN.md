# Geconsolideerd Opschoonplan

Dit document consolideert alle bestaande opschoonplannen en documentatie om een duidelijke, schone basis te creëren voor het samenvoegen met een ander project. De huidige werkende versie van de code is leidend in dit plan.

## Uitgevoerde Opschoonacties

De volgende opschoonacties zijn reeds uitgevoerd:

1. **Package.json Correctie**
   - Script `simple-api` bijgewerkt om te verwijzen naar `src/api/gripp/simple-api-server.ts` in plaats van het niet-bestaande `src/simple-api.ts`
   - Script `db:init:unified` bijgewerkt om te verwijzen naar `src/db/unified/init-database.ts` in plaats van het niet-bestaande `src/db/unified/test-database.ts`
   - Script `simple-api:test` bijgewerkt om een waarschuwing te tonen in plaats van een niet-bestaand bestand uit te voeren

2. **README.md Correctie**
   - Bijgewerkt om de correcte database locatie te vermelden (`./src/db/database.sqlite`)
   - Bijgewerkt om de correcte API server informatie te vermelden
   - Bijgewerkt om de correcte scripts te vermelden
   - Bijgewerkt om te verwijzen naar de correcte documentatie bestanden

3. **Documentatie Consolidatie**
   - Nieuw document `docs/DATABASE_STRUCTURE.md` gemaakt met geconsolideerde informatie over de database structuur
   - Bestaande documentatie bijgewerkt om de huidige staat van het project weer te geven

4. **Opschonen van Ongebruikte Bestanden**
   - Verwijderd test bestanden die niet essentieel zijn voor de productie code
   - Verwijderd debug bestanden die niet essentieel zijn voor de productie code
   - Verwijderd backup bestanden die niet meer nodig zijn
   - Verwijderd tijdelijke bestanden die niet meer nodig zijn
   - Verwijderd redundante documentatie bestanden
   - Alle verwijderde bestanden zijn gearchiveerd in de backup directory

## Huidige Status

Na een grondige analyse van de codebase hebben we verschillende gebieden geïdentificeerd die opgeschoond moeten worden om een solide basis te garanderen voor het samenvoegen met een ander project.

### Reeds Voltooide Opschoonacties

Volgens het bestaande CLEANUP_PLAN.md en REFACTORING_LOG.md zijn de volgende acties al voltooid:

1. **Codebase structuur verbeteren**
   - Opschonen van imports en exports in belangrijke bestanden
   - Verbeteren van code formatting en linting
   - Verwijderen van ongebruikte code

2. **Backend optimalisatie**
   - Consistente API structuur implementeren
   - Error handling verbeteren
   - Logging verbeteren
   - Database queries optimaliseren
   - Caching strategieën verbeteren
   - Data synchronisatie optimaliseren

3. **Frontend optimalisatie**
   - Componenten optimaliseren
   - State management verbeteren
   - Frontend performance verbeteren
   - Backend performance verbeteren

4. **Documentatie verbeteren**
   - API documentatie maken
   - Architectuur documentatie maken
   - Setup en installatie instructies verbeteren
   - Gebruikershandleiding maken
   - Feature documentatie maken
   - FAQ toevoegen

### Huidige Problemen

Ondanks de voltooide opschoonacties zijn er nog steeds problemen die aangepakt moeten worden:

1. **Database Structuur**
   - Twee database bestanden bestaan:
     - `./database.sqlite` - In de root directory
     - `./src/db/database.sqlite` - In de src/db directory
   - Beide worden gebruikt in verschillende delen van de code
   - De unified database structuur (`./src/db/unified/database.ts`) verwijst naar `./src/db/database.sqlite`
   - De originele database structuur (`./src/db/database.ts`) verwijst ook naar `./src/db/database.sqlite`

2. **API Server**
   - Meerdere API server implementaties:
     - `src/api/gripp/api-server.ts` - Originele API server
     - `src/api/gripp/api-server-v2.ts` - Verbeterde API server
     - `src/api/gripp/simple-api-server.ts` - Vereenvoudigde API server
     - `src/api/gateway.js` - API gateway voor domein-specifieke routes
   - README.md verwijst naar `npm run simple-api` om de API server te starten
   - Het bestand `src/simple-api.ts` waarnaar wordt verwezen in package.json bestaat niet

3. **API Clients**
   - Meerdere API client implementaties:
     - `src/api/gripp/client.ts` - Originele client
     - `src/db/unified/api/gripp/client.ts` - Unified client met verbeterde error handling
     - `src/db/unified/api.ts` (GrippApiClient class) - Vereenvoudigde client

4. **Backup en Debug Bestanden**
   - `backup/` directory bevat oude versies van bestanden
   - `debug-scripts/` directory bevat debugging scripts
   - Verschillende test bestanden verspreid door de codebase

5. **Documentatie**
   - Meerdere versies van opschoonplannen en documentatie
   - Sommige documentatie kan verouderd of inconsistent zijn
   - README.md verwijst naar niet-bestaande bestanden

## Geconsolideerd Opschoonplan

### 1. Documentatie Consolidatie

**Doel**: Zorgen dat documentatie accuraat de huidige staat van het project weergeeft.

**Acties**:
- [ ] Inventariseren van alle bestaande documentatie bestanden
- [ ] Consolideren van overlappende informatie in één duidelijk document
- [ ] Bijwerken van README.md met correcte instructies
- [ ] Verwijderen van verwijzingen naar niet-bestaande bestanden
- [ ] Archiveren van verouderde documentatie

### 2. Package.json Correctie

**Doel**: Corrigeren van package.json scripts om naar bestaande bestanden te verwijzen.

**Acties**:
- [ ] Identificeren van scripts die naar niet-bestaande bestanden verwijzen
- [ ] Corrigeren van deze scripts om naar bestaande bestanden te verwijzen
- [ ] Documenteren van de correcte scripts in README.md

### 3. Database Consolidatie

**Doel**: Duidelijkheid creëren over welke database bestand gebruikt moet worden.

**Acties**:
- [ ] Bepalen welk database bestand de huidige productieversie is
- [ ] Zorgen dat alle code naar hetzelfde database bestand verwijst
- [ ] Bijwerken van documentatie om het correcte database bestand te vermelden

### 4. API Server Consolidatie

**Doel**: Duidelijkheid creëren over welke API server gebruikt moet worden.

**Acties**:
- [ ] Identificeren van de API server die momenteel in gebruik is
- [ ] Bijwerken van README.md om de correcte API server te vermelden
- [ ] Documenteren van de correcte manier om de API server te starten

### 5. API Client Consolidatie

**Doel**: Duidelijkheid creëren over welke API client gebruikt moet worden.

**Acties**:
- [ ] Identificeren van de API client die momenteel in gebruik is
- [ ] Documenteren van de correcte API client in de documentatie

### 6. Opschonen van Backup en Debug Bestanden

**Doel**: Verwijderen van onnodige bestanden die verwarring kunnen veroorzaken.

**Acties**:
- [ ] Inventariseren van alle backup en debug bestanden
- [ ] Bepalen welke bestanden behouden moeten worden
- [ ] Archiveren van bestanden die niet direct nodig zijn maar wel bewaard moeten worden
- [ ] Verwijderen van bestanden die niet meer nodig zijn

## Implementatieplan

We zullen dit opschoonplan implementeren in de volgende volgorde:

1. Documentatie Consolidatie
2. Package.json Correctie
3. Database Consolidatie
4. API Server Consolidatie
5. API Client Consolidatie
6. Opschonen van Backup en Debug Bestanden

Elke stap zal zorgvuldig worden uitgevoerd om ervoor te zorgen dat er geen functionaliteit verloren gaat en de applicatie blijft werken zoals verwacht.

## Testplan

Na elke stap van het implementatieplan zullen we de volgende tests uitvoeren:

1. **Documentatie Tests**
   - Verifiëren dat alle instructies correct zijn
   - Verifiëren dat alle verwijzingen naar bestanden correct zijn

2. **Script Tests**
   - Testen van alle scripts in package.json
   - Verifiëren dat alle scripts correct werken

3. **Database Tests**
   - Verifiëren van database connectiviteit
   - Verifiëren van data integriteit

4. **API Tests**
   - Testen van alle API endpoints
   - Verifiëren van request en response formaten

5. **Integratie Tests**
   - Testen van de applicatie end-to-end
   - Verifiëren dat alle features correct werken

## Rollback Plan

In geval van problemen hebben we een rollback plan:

1. **Herstellen van documentatie backups**
   - Herstellen van de originele documentatie bestanden

2. **Herstellen van package.json backups**
   - Herstellen van het originele package.json bestand

3. **Herstellen van code backups**
   - Herstellen van de originele code bestanden
