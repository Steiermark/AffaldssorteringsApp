# Affaldssorterings app

Forsøg på en enkel app til affaldssortering på genbrugspladsen.

## Formål

Appen skal hjælpe almindelige mennesker med hurtigt at finde den rigtige sortering af affald ved hjælp af kamera og AI.

## Prototype

Den første version er en statisk, kørbar prototype med:

- Kamera-start via browserens `getUserMedia`
- Placeringsvalg af nærmeste genbrugsplads via browserens `geolocation`
- Kommuneopslag via Dataforsyningens reverse-geocoding API
- Hentning af genbrugspladsdata fra kommunespecifikke datakilder
- Fallback til lokale forsynings-/affaldsselskaber, hvis kommunen ikke har data
- Landsdækkende indlæsning af danske genbrugspladser fra OpenStreetMap/Overpass
- Billedvalg fra telefon eller computer
- Simuleret AI-forslag til affaldsfraktion
- Billedgenkendelse der matcher affaldet direkte mod appens lokale piktogramfraktioner
- Lokale placeringer for fraktioner på den valgte genbrugsplads
- Manuel søgning på almindelige affaldstyper
- PWA-manifest, så løsningen kan udvikles mod en rigtig app
- Android-klar PWA med service worker, manifest og installationsknap
- Piktogrammer ved affaldstype i resultat og forslag
- Alle fraktioner fra piktogrampakken indlæses fra `data/fractions.json`
- Pladsinterne fraktionsplaceringer indlæses fra `data/site-layouts.json`, når en officiel pladskortkilde er registreret.

## Sådan køres projektet

Åbn `index.html` direkte i en browser.

For kameraadgang virker det bedst at køre projektet via en lokal webserver, for eksempel:

```powershell
.\dev-server.ps1 -Port 8000
```

Åbn derefter:

```text
http://localhost:8000
```

## Android

Android-versionen er en PWA. Den kan installeres fra Chrome på Android, når den ligger på en HTTPS-adresse.

Vigtigt:

- Kamera og placering virker ikke stabilt fra `file://`.
- Kamera og placering kræver normalt HTTPS på Android.
- Service worker og offline-cache virker kun via `http://localhost` eller HTTPS.
- Til reel mobiltest: deploy mappen til en HTTPS-host, eller brug en HTTPS-tunnel foran den lokale server.

Når appen åbnes via HTTPS på Android, vises `Installer app`, når Chrome vurderer at PWA'en kan installeres.

## Næste skridt

- Tilføj hver kommunes officielle datakilde i `municipalDataSources` i `app.js`.
- Tilføj lokale forsynings- eller affaldsselskaber i `utilityCompanyDataSources` i `app.js`.
- Brug knappen `Indlæs Danmark` til at hente alle OSM-markerede genbrugspladser i Danmark.
- Brug `data/municipal/0530.json` som format for pladser, koordinater og lokale fraktionsplaceringer.
- Brug `data/utility/0530-affaldspartner.json` som fallback-format for forsyningsselskaber.
- Appens aktive farvepiktogrammer ligger i `assets/pictograms` og er hentet fra den lokale mappe `assets/PIKTOGRAMMER-andre-fraktioner`.
- `data/fractions.json` er genereret ud fra alle `*_rgb_ikon_600x600dpi.png`-filer i piktogrampakken.
- `data/fractions.js` indeholder samme katalog som browservenligt fallback, så fraktionerne også kan indlæses fra cache eller `file://`.
- `data/site-layout-coverage.json` viser hvilke genbrugsstationer der har officielle fraktionsplaceringer, og hvilke der stadig mangler pladskortdata.
- Hvis kommunens eller forsyningsselskabets hjemmeside ikke tilbyder CORS eller JSON/API, lav en lille backend-sync der henter og normaliserer data til samme JSON-format.
- Kør via `.\dev-server.ps1 -Port 8000` under test, fordi `file://` ofte blokerer `fetch()` af lokale JSON-filer.
- Erstat prototype-klassifikationen med en rigtig billedmodel, der sammenligner brugerens foto med web-/kommunebilleder og returnerer fraktionstype.
- Gem anonym feedback, så appen kan lære af fejl.
- Test brugerflowet på mobil på selve pladsen.
