# Voortgang Uniforme Datastructuur

## Overzicht

Dit document houdt de voortgang bij van de implementatie van de uniforme datastructuur in het Het Nieuwe Werken project. Het doel is om een consistente aanpak te hebben voor het ophalen, opslaan en weergeven van data uit de Gripp API.

## Huidige Status

### Algemene Voortgang
- [x] Basisstructuur voor uniforme data-aanpak opgezet
- [x] Database schema aangepast voor uniforme opslag
- [x] API endpoints gestandaardiseerd
- [x] Caching mechanisme geïmplementeerd
- [x] Synchronisatie met Gripp API geïmplementeerd
- [ ] Alle frontend componenten aangepast aan uniforme datastructuur
- [ ] Volledige test coverage voor uniforme datastructuur

### Per Datatype

#### Medewerkers (Employees)
- [x] Database schema aangepast
- [x] API endpoints geïmplementeerd
- [x] Synchronisatie met Gripp API
- [x] Frontend componenten aangepast
- [x] Caching geïmplementeerd

#### Projecten (Projects)
- [x] Database schema aangepast
- [x] API endpoints geïmplementeerd
- [x] Synchronisatie met Gripp API
- [x] Frontend componenten aangepast
- [x] Caching geïmplementeerd

#### Facturen (Invoices)
- [x] Database schema aangepast
- [x] API endpoints geïmplementeerd
- [x] Synchronisatie met Gripp API
- [ ] Paginering geïmplementeerd voor grote datasets
- [ ] Frontend componenten volledig aangepast
- [x] Caching geïmplementeerd

#### Uren (Hours)
- [x] Database schema aangepast
- [x] API endpoints geïmplementeerd
- [x] Synchronisatie met Gripp API
- [x] Frontend componenten aangepast
- [x] Caching geïmplementeerd

#### Verlof (Absence)
- [x] Database schema aangepast
- [x] API endpoints geïmplementeerd
- [x] Synchronisatie met Gripp API
- [x] Frontend componenten aangepast
- [x] Caching geïmplementeerd

## Openstaande Taken

### Hoge Prioriteit
1. **Facturen Paginering**
   - Implementeer paginering voor facturen om alle ~2330 facturen op te halen
   - Zorg dat filtering werkt over alle pagina's
   - Update frontend om te werken met gepagineerde data

2. **Dashboard Verbetering**
   - Verwijder PM dashboard en hernoem Team Dashboard naar Dashboard
   - Toon alleen projecten met beschikbaar budget maar met over-budget projectregels
   - Bereken over-budget waarde (uren × selling rate)
   - Sluit interne projecten uit van dashboard weergave

3. **Factuur Status Logica**
   - Fix de logica voor het bepalen van factuurstatus in het hele systeem
   - Controleer of 'totalopeninclvat' veld gelijk is aan '0.00' om betalingsstatus te verifiëren

### Medium Prioriteit
1. **Contracturen Data**
   - Gebruik echte contracturen data uit Gripp voor elke medewerker
   - Haal data op van employmentcontract.get endpoint

2. **Verlofuren Data**
   - Haal verlofuren data op van Gripp API's absence.get endpoint
   - Sla op in database

3. **Nationale Feestdagen**
   - Implementeer correcte telling van nationale feestdagen voor alle medewerkers
   - Zorg dat deeltijdmedewerkers dezelfde nationale feestdagen krijgen als voltijdmedewerkers

### Lage Prioriteit
1. **Code Opschoning**
   - Verwijder alle dummy data uit het project
   - Standaardiseer API response formaat

2. **Documentatie**
   - Update API documentatie
   - Voeg voorbeelden toe van het gebruik van de uniforme datastructuur

## Technische Details

### Database Schema
De database is aangepast om de uniforme datastructuur te ondersteunen. De belangrijkste tabellen zijn:

- `employees` - Medewerkers data
- `projects` - Projecten data
- `invoices` - Facturen data
- `hours` - Uren data
- `absence_requests` - Verlofaanvragen
- `absence_request_lines` - Individuele verlofuren binnen een aanvraag
- `contracts` - Contracten van medewerkers
- `holidays` - Nationale feestdagen

### API Structuur
Alle API endpoints volgen nu een consistente structuur:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    count?: number;
    timestamp: string;
    [key: string]: any;
  };
  error?: string;
}
```

### Synchronisatie
De synchronisatie met Gripp API is geïmplementeerd voor alle datatypes. De synchronisatie kan worden uitgevoerd via:

```bash
npm run sync:all          # Synchroniseer alle data
npm run sync:employees    # Synchroniseer alleen medewerkers
npm run sync:projects     # Synchroniseer alleen projecten
npm run sync:invoices     # Synchroniseer alleen facturen
npm run sync:hours        # Synchroniseer alleen uren
npm run sync:absence      # Synchroniseer alleen verlof
```

## Volgende Stappen

1. Implementeer de openstaande taken met hoge prioriteit
2. Test de uniforme datastructuur met echte data
3. Optimaliseer de performance van de synchronisatie
4. Voeg meer robuuste error handling toe
5. Verbeter de documentatie

## Conclusie

De implementatie van de uniforme datastructuur vordert goed. De meeste datatypes zijn al aangepast en werken met de nieuwe structuur. De focus ligt nu op het voltooien van de facturen paginering en het verbeteren van het dashboard.
