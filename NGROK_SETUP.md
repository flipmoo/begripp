# Ngrok Setup Handleiding

Deze handleiding helpt je bij het instellen van ngrok, zodat je je lokale applicatie toegankelijk kunt maken voor anderen via een publieke URL.

## Stap 1: Maak een gratis ngrok account aan

1. Ga naar [https://ngrok.com/signup](https://ngrok.com/signup)
2. Maak een gratis account aan (je kunt inloggen met GitHub, Google of een e-mailadres)
3. Bevestig je e-mailadres als dat nodig is

## Stap 2: Haal je authtoken op

1. Log in op je ngrok dashboard: [https://dashboard.ngrok.com/](https://dashboard.ngrok.com/)
2. Ga naar "Your Authtoken" in het linker menu of gebruik deze directe link: [https://dashboard.ngrok.com/get-started/your-authtoken](https://dashboard.ngrok.com/get-started/your-authtoken)
3. Kopieer je authtoken (het ziet eruit als `2aBcDeFgHiJkLmNoPqRsTuVwXyZ`)

## Stap 3: Configureer ngrok met je authtoken

1. Open een terminal
2. Voer het volgende commando uit, waarbij je `YOUR_AUTHTOKEN` vervangt door je eigen authtoken:

```bash
ngrok config add-authtoken YOUR_AUTHTOKEN
```

3. Je zou een bevestiging moeten zien dat je authtoken is toegevoegd

## Stap 4: Start de applicatie met ngrok

Nu kun je de applicatie starten met ngrok:

```bash
./start-with-ngrok.sh
```

Dit script zal:
1. De API-server starten op poort 3004
2. De frontend starten op poort 3002
3. ngrok starten om de frontend toegankelijk te maken via een publieke URL
4. De publieke URL tonen die je kunt delen met je collega

## Beperkingen van het gratis plan

Het gratis ngrok plan heeft enkele beperkingen:
- De publieke URL verandert elke keer dat je ngrok start
- Maximaal 1 tunnel tegelijk
- Maximaal 40 verbindingen per minuut
- Sessies verlopen na 2 uur

Voor de meeste testdoeleinden is dit voldoende, maar voor langdurig gebruik kun je overwegen om te upgraden naar een betaald plan.

## Problemen oplossen

### "ngrok not running" foutmelding

Als je een foutmelding krijgt dat ngrok niet draait, controleer dan of:
- Je ngrok correct hebt geïnstalleerd
- Je je authtoken hebt geconfigureerd
- Poort 4040 niet al in gebruik is door een andere applicatie

### Kan de publieke URL niet ophalen

Als het script de publieke URL niet kan ophalen, kun je deze handmatig bekijken:
1. Open een browser en ga naar [http://localhost:4040](http://localhost:4040)
2. Hier zie je het ngrok dashboard met de publieke URL

### Andere problemen

Voor andere problemen, raadpleeg de ngrok documentatie:
- [https://ngrok.com/docs](https://ngrok.com/docs)
- [https://ngrok.com/docs/getting-started/](https://ngrok.com/docs/getting-started/)
