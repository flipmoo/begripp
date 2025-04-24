# Veelgestelde vragen (FAQ)

## Algemeen

### Wat is Het Nieuwe Werken?

Het Nieuwe Werken is een applicatie voor het beheren van projecten, medewerkers, facturen en bedrijven. De applicatie is geïntegreerd met Gripp en biedt een moderne gebruikersinterface voor het werken met Gripp data.

### Welke browsers worden ondersteund?

De applicatie ondersteunt de volgende browsers:
- Google Chrome (laatste 2 versies)
- Mozilla Firefox (laatste 2 versies)
- Microsoft Edge (laatste 2 versies)
- Safari (laatste 2 versies)

### Is de applicatie beschikbaar op mobiele apparaten?

Ja, de applicatie is responsive en kan worden gebruikt op mobiele apparaten zoals smartphones en tablets.

### Hoe kan ik de applicatie updaten?

De applicatie kan worden geüpdatet door de volgende stappen te volgen:
1. Pull de laatste wijzigingen: `git pull`
2. Installeer dependencies: `npm install`
3. Build de applicatie: `npm run build`
4. Start de applicatie: `npm start`

## Installatie en configuratie

### Hoe installeer ik de applicatie?

Zie de [Setup en Installatie Instructies](./SETUP.md) voor gedetailleerde instructies.

### Welke omgevingsvariabelen moet ik configureren?

De volgende omgevingsvariabelen moeten worden geconfigureerd:
- `GRIPP_API_KEY`: Je Gripp API key
- `GRIPP_API_URL`: De URL van de Gripp API
- `FRONTEND_PORT`: De poort voor de frontend (standaard: 3000)
- `API_PORT`: De poort voor de API (standaard: 3002)
- `DB_PATH`: Het pad naar het SQLite database bestand (standaard: ./data/database.sqlite)
- `LOG_LEVEL`: Het log level (standaard: info)

### Hoe kan ik de poorten wijzigen?

Je kunt de poorten wijzigen door de volgende omgevingsvariabelen te configureren:
- `FRONTEND_PORT`: De poort voor de frontend (standaard: 3000)
- `API_PORT`: De poort voor de API (standaard: 3002)

### Hoe kan ik de applicatie in productie draaien?

Je kunt de applicatie in productie draaien door de volgende stappen te volgen:
1. Build de applicatie: `npm run build`
2. Start de applicatie: `npm start`

### Kan ik de applicatie in Docker draaien?

Ja, je kunt de applicatie in Docker draaien door de volgende stappen te volgen:
1. Build de Docker image: `docker build -t het-nieuwe-werken .`
2. Run de Docker container: `docker run -p 3000:3000 -p 3002:3002 -v $(pwd)/data:/app/data het-nieuwe-werken`

## Gebruik

### Hoe log ik in?

Je kunt inloggen door naar de applicatie te gaan en je gebruikersnaam en wachtwoord in te vullen.

### Hoe maak ik een nieuw project aan?

Je kunt een nieuw project aanmaken door de volgende stappen te volgen:
1. Ga naar "Projecten" in het hoofdmenu
2. Klik op "Nieuw project"
3. Vul de projectgegevens in
4. Klik op "Opslaan"

### Hoe voeg ik een medewerker toe aan een project?

Je kunt een medewerker toevoegen aan een project door de volgende stappen te volgen:
1. Ga naar de projectdetails
2. Klik op "Teamleden"
3. Klik op "Medewerker toevoegen"
4. Selecteer de medewerker
5. Klik op "Toevoegen"

### Hoe maak ik een factuur aan?

Je kunt een factuur aanmaken door de volgende stappen te volgen:
1. Ga naar "Facturen" in het hoofdmenu
2. Klik op "Nieuwe factuur"
3. Vul de factuurgegevens in
4. Klik op "Opslaan"

### Hoe exporteer ik data?

Je kunt data exporteren door de volgende stappen te volgen:
1. Ga naar het overzicht van de data die je wilt exporteren (projecten, medewerkers, etc.)
2. Klik op "Exporteren"
3. Selecteer het formaat (CSV, Excel, PDF)
4. Klik op "Exporteren"

## Synchronisatie

### Hoe synchroniseer ik data met Gripp?

Je kunt data synchroniseren door de volgende stappen te volgen:
1. Ga naar "Instellingen" in het hoofdmenu
2. Klik op "Synchronisatie"
3. Klik op "Nu synchroniseren"
4. Selecteer welke data je wilt synchroniseren
5. Klik op "Start synchronisatie"

### Hoe vaak wordt data gesynchroniseerd?

Data wordt automatisch gesynchroniseerd volgens het geconfigureerde schema. Standaard wordt data elke dag om middernacht gesynchroniseerd.

### Kan ik data handmatig synchroniseren?

Ja, je kunt data handmatig synchroniseren door de volgende stappen te volgen:
1. Ga naar "Instellingen" in het hoofdmenu
2. Klik op "Synchronisatie"
3. Klik op "Nu synchroniseren"
4. Selecteer welke data je wilt synchroniseren
5. Klik op "Start synchronisatie"

### Wat gebeurt er als er een conflict is tijdens synchronisatie?

Als er een conflict is tijdens synchronisatie, wordt de lokale data overschreven door de data van Gripp. Dit betekent dat wijzigingen die je lokaal hebt gemaakt, verloren kunnen gaan als ze niet zijn gesynchroniseerd met Gripp.

## Problemen oplossen

### De applicatie start niet

Als de applicatie niet start, controleer dan het volgende:
1. Zijn alle dependencies geïnstalleerd? `npm install`
2. Is het `.env` bestand correct geconfigureerd?
3. Is de database geïnitialiseerd? `npm run db:init`
4. Zijn de poorten beschikbaar? Controleer of er geen andere applicaties draaien op dezelfde poorten.

### Ik krijg een database error

Als je een database error krijgt, probeer dan het volgende:
1. Initialiseer de database opnieuw: `npm run db:init`
2. Controleer of het database bestand bestaat en toegankelijk is
3. Controleer of het pad naar het database bestand correct is geconfigureerd in het `.env` bestand

### Ik krijg een API error

Als je een API error krijgt, controleer dan het volgende:
1. Is de Gripp API key correct geconfigureerd in het `.env` bestand?
2. Is de Gripp API URL correct geconfigureerd in het `.env` bestand?
3. Is de Gripp API beschikbaar? Controleer of je verbinding kunt maken met de Gripp API.

### De applicatie is traag

Als de applicatie traag is, probeer dan het volgende:
1. Controleer of je voldoende geheugen en CPU beschikbaar hebt
2. Controleer of de database niet te groot is geworden
3. Controleer of er geen grote queries worden uitgevoerd
4. Controleer of de caching correct werkt

### Ik zie geen data

Als je geen data ziet, controleer dan het volgende:
1. Is de data gesynchroniseerd met Gripp? Ga naar "Instellingen" > "Synchronisatie" en klik op "Nu synchroniseren"
2. Zijn de filters correct ingesteld? Controleer of je geen filters hebt ingesteld die de data filteren
3. Heb je de juiste rechten om de data te zien? Controleer of je de juiste rol hebt

## Beveiliging

### Hoe veilig is mijn data?

De applicatie gebruikt verschillende beveiligingsmaatregelen om je data te beschermen:
1. Alle communicatie met de Gripp API gebeurt via HTTPS
2. De database is alleen toegankelijk voor de applicatie
3. Wachtwoorden worden gehasht opgeslagen
4. De applicatie gebruikt rate limiting om brute force aanvallen te voorkomen

### Hoe worden wachtwoorden opgeslagen?

Wachtwoorden worden gehasht opgeslagen met bcrypt. Dit betekent dat wachtwoorden niet in leesbare vorm worden opgeslagen en niet kunnen worden achterhaald, zelfs niet door de beheerders van de applicatie.

### Hoe kan ik mijn wachtwoord wijzigen?

Je kunt je wachtwoord wijzigen door de volgende stappen te volgen:
1. Klik op je gebruikersnaam rechtsboven
2. Klik op "Instellingen"
3. Klik op "Wachtwoord wijzigen"
4. Vul je huidige wachtwoord in
5. Vul je nieuwe wachtwoord in
6. Klik op "Opslaan"

### Wat moet ik doen als ik mijn wachtwoord ben vergeten?

Als je je wachtwoord bent vergeten, kun je het volgende doen:
1. Klik op "Wachtwoord vergeten" op het inlogscherm
2. Vul je e-mailadres in
3. Klik op "Verstuur"
4. Je ontvangt een e-mail met instructies om je wachtwoord te resetten

## Ondersteuning

### Waar kan ik hulp krijgen?

Als je hulp nodig hebt, kun je contact opnemen met de ontwikkelaars:
- Email: koen@bravoure.nl
- GitHub Issues: https://github.com/flipmoo/het-nieuwe-werken/issues

### Hoe kan ik een bug melden?

Je kunt een bug melden door een issue aan te maken op GitHub:
1. Ga naar https://github.com/flipmoo/het-nieuwe-werken/issues
2. Klik op "New issue"
3. Beschrijf de bug zo gedetailleerd mogelijk
4. Klik op "Submit new issue"

### Hoe kan ik een feature request indienen?

Je kunt een feature request indienen door een issue aan te maken op GitHub:
1. Ga naar https://github.com/flipmoo/het-nieuwe-werken/issues
2. Klik op "New issue"
3. Beschrijf de feature zo gedetailleerd mogelijk
4. Klik op "Submit new issue"

### Hoe kan ik bijdragen aan de applicatie?

Je kunt bijdragen aan de applicatie door een pull request in te dienen op GitHub:
1. Fork de repository
2. Maak je wijzigingen
3. Dien een pull request in

## Overig

### Is de applicatie open source?

Ja, de applicatie is open source en beschikbaar op GitHub: https://github.com/flipmoo/het-nieuwe-werken

### Welke technologieën worden gebruikt?

De applicatie gebruikt de volgende technologieën:
- Frontend: React, React Router, React Query, Tailwind CSS, shadcn/ui
- Backend: Node.js, Express, SQLite
- Overig: TypeScript, Vite, Jest

### Hoe kan ik de applicatie aanpassen?

Je kunt de applicatie aanpassen door de code te wijzigen. De code is georganiseerd volgens een modulaire structuur, waardoor het gemakkelijk is om specifieke onderdelen aan te passen zonder de rest van de applicatie te beïnvloeden.

### Is er een API beschikbaar?

Ja, de applicatie biedt een API voor het ophalen en wijzigen van data. Zie de [API Documentatie](./API_DOCUMENTATION.md) voor meer details.
