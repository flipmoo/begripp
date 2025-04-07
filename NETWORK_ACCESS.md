# Applicatie toegankelijk maken binnen het netwerk

Deze instructies helpen je om de applicatie beschikbaar te maken voor anderen binnen hetzelfde netwerk.

## Configuratie

De volgende aanpassingen zijn gemaakt om netwerktoegankelijkheid mogelijk te maken:

1. De Vite development server is geconfigureerd om te luisteren op alle netwerkinterfaces (`0.0.0.0`)
2. De API server is geconfigureerd om te luisteren op alle netwerkinterfaces
3. De npm scripts zijn bijgewerkt om expliciet de host parameter te gebruiken
4. Een nieuw script is toegevoegd om je netwerk IP-adres te tonen

## Starten van de applicatie voor gedeelde toegang

Om de applicatie voor iedereen in je netwerk toegankelijk te maken:

1. Start de API server:
   ```
   npm run kill-api && npm run api
   ```

2. Start de frontend development server:
   ```
   npm run dev
   ```

3. Of gebruik het gecombineerde commando voor beide servers:
   ```
   npm run dev:all
   ```

4. Vind je netwerkadres:
   ```
   npm run network-info
   ```

5. Deel de getoonde URL's met je collega's, bijvoorbeeld:
   - Frontend: http://192.168.1.184:3000
   - API: http://192.168.1.184:3002

## Opmerkingen en Problemen

- Zorg ervoor dat je firewall toegang toestaat tot de poorten 3000 en 3002
- Voor sommige netwerken moet je mogelijk poort-forwarding instellen op je router
- Gebruikers moeten toegang hebben tot beide URLs (frontend en API)
- Als de frontend en API niet op hetzelfde adres draaien, kunnen er CORS-problemen ontstaan

## Handleiding voor Gebruikers

Gebruikers moeten alleen de frontend URL openen in hun browser (bijv. `http://192.168.1.184:3000`). 
Ze gebruiken de applicatie zoals normaal via hun browsers. De applicatie communiceert automatisch 
met de API server. 

Als er problemen zijn, controleer het volgende:
- Zijn beide servers actief?
- Zijn de firewalls correct ingesteld?
- Bevinden alle gebruikers zich in hetzelfde netwerk?

Wanneer een gebruiker voor het eerst toegang krijgt, moet je mogelijk de API server opnieuw opstarten 
om ervoor te zorgen dat alle services beschikbaar zijn. 