# Opgave til Codex

Tilføj billedgenkendelse til appen: brugeren vælger/dropper et billede af affald, og appen viser hvilken container på genbrugsstationen det skal i.

## API-kald

Kald direkte fra klienten (backend kommer senere):

```
POST https://api.anthropic.com/v1/messages
```

- Model: `claude-haiku-4-5-20251001`
- max_tokens: `400`
- Billede som base64, type `image`, media_type `image/jpeg`

## Prompt (testet og tunet — brug ordret)

```
Klassificér det primære affaldsobjekt på billedet. Containere: trae, metal, murbrokker, stort_braendbart, farligt_affald, elektronik, pap, haveaffald, glas, haardt_plast, bloed_plast, tekstil, daek, gips, vinduer, pvc, deponi, sanitet, flamingo, smaat_braendbart
Kun JSON:{"name":"kort navn","category":"key","confidence":0.9,"tip":"evt tip"}
Kun ét objekt. Ingen array.
```

## Respons-parsing

Strip eventuelle markdown-backticks før JSON.parse:

```javascript
const text = data.content?.map(c => c.text || "").join("");
const clean = text.replace(/```json|```/g, "").trim();
const result = JSON.parse(clean);
// result = { name: "Træstol", category: "trae", confidence: 0.92, tip: "Fjern beslag" }
```

## Billedkomprimering (vigtig for hastighed)

Resize til maks 800px på den lange side, JPEG quality 80%, FØR afsendelse til API.

## De 20 containere

```json
{
  "trae":             { "label": "Træ",                "icon": "🪵", "desc": "Rent træ, møbler, spånplader" },
  "metal":            { "label": "Metal",              "icon": "🔩", "desc": "Jern, stål, aluminium, dåser" },
  "murbrokker":       { "label": "Murbrokker",         "icon": "🧱", "desc": "Mursten, beton, fliser, tegl" },
  "stort_braendbart": { "label": "Stort brændbart",    "icon": "🔥", "desc": "Madrasser, gulvtæpper, plast-møbler" },
  "farligt_affald":   { "label": "Farligt affald",     "icon": "☠️", "desc": "Maling, kemikalier, batterier, olie" },
  "elektronik":       { "label": "Elektronik",         "icon": "🔌", "desc": "Hårde hvidevarer, kabler, IT-udstyr" },
  "pap":              { "label": "Pap",                "icon": "📦", "desc": "Papkasser, bølgepap, karton" },
  "haveaffald":       { "label": "Haveaffald",         "icon": "🌿", "desc": "Grene, blade, græs, jord" },
  "glas":             { "label": "Glas",               "icon": "🫙", "desc": "Flasker, syltetøjsglas, vinduesglas" },
  "haardt_plast":     { "label": "Hård plast",         "icon": "♻️", "desc": "Havemøbler, legetøj, spande" },
  "bloed_plast":      { "label": "Blød plast / folie", "icon": "🛍️", "desc": "Plastposer, folie, bobleplast" },
  "tekstil":          { "label": "Tekstil & tøj",      "icon": "👕", "desc": "Tøj, sko, tasker, sengetøj" },
  "daek":             { "label": "Dæk",               "icon": "🛞", "desc": "Bildæk, cykeldæk" },
  "gips":             { "label": "Gips",              "icon": "🏗️", "desc": "Gipsplader, gipsrester" },
  "vinduer":          { "label": "Vinduer & glasdøre", "icon": "🪟", "desc": "Termoruder, glasdøre, spejle" },
  "pvc":              { "label": "PVC",                "icon": "🔧", "desc": "PVC-rør, tagrender, vinyl" },
  "deponi":           { "label": "Deponi",             "icon": "🚫", "desc": "Rockwool, asbest, forurenet jord" },
  "sanitet":          { "label": "Sanitet / porcelæn", "icon": "🚽", "desc": "Toilet, håndvask, porcelæn" },
  "flamingo":         { "label": "Flamingo / EPS",     "icon": "📐", "desc": "Flamingo, styropor, EPS" },
  "smaat_braendbart": { "label": "Småt brændbart",     "icon": "🗑️", "desc": "Restaffald, småt brændbart" }
}
```

## UX-krav

- Auto-klassificering: analyse starter automatisk når billede vælges — ingen knap.
- Drop anywhere: hele skærmen er drop-zone, også når der allerede vises et resultat.
- Drag overlay: fuldskærms-overlay med "Slip billedet her" ved drag.
- Loading: spinner oven på billedet mens API'et svarer.
- Resultat viser: objektnavn, container (farve + ikon), confidence-%, evt. tip, og container-beskrivelse.
