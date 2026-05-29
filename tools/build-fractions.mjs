import fs from "node:fs";

const renames = {
  batteries:       { id: "batterier",     title: "Batterier" },
  "bloed-plast-2": { id: "bloed-plast",   title: "Blød Plast" },
  cardboard:       { id: "pap",           title: "Pap" },
  glass:           { id: "glas",          title: "Glas" },
  hazardous:       { id: "farligt-affald", title: "Farligt Affald" },
  "haard-plast":   { id: "haardt-plast",  title: "Hård Plast" },
  "haard-pvc":     { id: "haardt-pvc",    title: "Hård PVC" },
  plastic:         { id: "plast",         title: "Blandet Plast" },
  "porcelaen-2":   { id: "porcelaen",     title: "Porcelæn" },
};

// Kredsløb rule ID → new fraction ID(s) after rename
const krdslobMap = {
  asbest:                           ["asbest"],
  asfalt:                           ["asfalt"],
  batterier:                        ["batterier"],
  beton:                            ["beton"],
  bilbatterier:                     ["bilbatterier"],
  "bloed-plast":                    ["bloed-plast"],
  brokker:                          ["mursten-og-tegl"],
  boeger:                           ["boeger"],
  drikkedaser:                      ["drikkedaaser"],
  daek:                             ["daek"],
  "elektronik-mellemstort-50-120-cm": ["mellemstort-elektronik"],
  "elektronik-smat-under-50-cm":    ["smaat-elektronik"],
  elpaerer:                         ["elpaerer"],
  "farligt-affald":                 ["farligt-affald"],
  "farvet-flamingo":                ["flamingo"],
  fibergips:                        ["fibergips"],
  "fladskaerme-baerbare-computere": ["tv-og-skaerme"],
  flamingo:                         ["flamingo", "smaat-braendbart"],
  gips:                             ["gips"],
  glas:                             ["glas"],
  "glasuld-stenuld":                ["glasuld", "stenuld", "mineraluld"],
  haveaffald:                       ["haveaffald"],
  "jern-metal":                     ["metal"],
  jord:                             ["jord"],
  keramik:                          ["porcelaen"],
  "komfurer-vaskemaskiner":         ["stort-elektronik"],
  "koeleskabe-frysere":             ["koeleudstyr"],
  "ledninger-og-kabler":            ["ledninger-og-kabler"],
  lysstofroer:                      ["lysstofroer"],
  "madrasser-sofaer":               ["madrasser", "polstrede-moebler"],
  "mursten-tegl":                   ["mursten-og-tegl"],
  "maelke-og-broedkasser":          ["maelke-og-broedkasser"],
  paller:                           ["paller"],
  pap:                              ["pap"],
  "papir-aviser":                   ["papir"],
  "papir-til-makulering":           ["papir-til-makulering"],
  "pehd-plast":                     ["haardt-plast"],
  "pet-plast":                      ["bloed-plast"],
  "plast-havemoebler":              ["plasthavemoebler"],
  "pp-plast":                       ["haardt-plast"],
  printerpatroner:                  ["printerpatroner"],
  "ps-plast":                       ["haardt-plast"],
  "puds-stentoej":                  ["sanitet"],
  "pvc-hard":                       ["haardt-pvc"],
  "skaerme-med-billedroer":         ["tv-og-skaerme"],
  "smat-braendbart":                ["smaat-braendbart"],
  spraydaser:                       ["farligt-affald"],
  tagpap:                           ["tagpap"],
  tekstilaffald:                    ["tekstilaffald"],
  "toiletter-handvaske":            ["sanitet"],
  trykflasker:                      ["trykflasker"],
  "udendoers-trae-trykimpraeneret": ["udendoers-trae"],
  "indendoers-trae":                ["indendoers-trae"],
  vinduer:                          ["vinduer"],
};

// Miljøstyrelsen official keywords per fraction (positive lists, most visual first)
const mstKeywords = {
  madaffald:            ["madrester", "frugt og grønt", "kaffefiltre", "teposer", "kød", "fisk og skaldyr", "brød og kager", "æggeskaller", "mælkeprodukter", "blomsterbuketter", "knogler"],
  kompost:              ["madrester", "kaffefiltre", "teposer", "kaffegrums", "frugt og grønt", "planterester", "blomsterbuketter"],
  papir:                ["aviser", "reklamer", "magasiner", "kontorpapir", "tryksager", "brochurer", "kuverter", "kvitteringer", "papirposer"],
  pap:                  ["papkasser", "bølgepap", "karton", "papemballage", "skotøjsæsker", "paprør", "æggebakker", "æsker"],
  glas:                 ["glasflasker", "konservesglas", "drikkeglas", "glasemballage", "vitaminglas", "glasskår"],
  metal:                ["konservesdåser", "dåser", "foliebakker", "stanniol", "kaffekapsler", "kapsler og låg", "bestik", "gryder og pander", "søm og skruer", "fyrfadslysholdere", "øl og sodavandsdåser", "saks"],
  "bloed-plast":        ["plastposer", "bobleplast", "plastfolier", "strækfilm", "plastfilm", "bæresække", "indkøbsposer", "fryseposer"],
  "haardt-plast":       ["plastflasker", "plastdunke", "plastbakker", "plastbøtter", "plastlåg", "plastlegetøj", "plastservice", "spande", "baljer"],
  plast:                ["plastemballage", "plastflasker", "plastposer", "plastfolier", "plastbakker"],
  "mad-og-drikkekartoner": ["mælkekartoner", "yoghurtkartoner", "juicekartoner", "drikkekartoner", "tetra pak", "kartoner til flåede tomater", "kartoner til bønner"],
  tekstilaffald:        ["tøj", "bluser", "bukser", "kjoler", "undertøj", "sokker", "håndklæder", "klude", "gardiner", "tæpper", "sengetøj", "duge", "viskestykker"],
  "farligt-affald":     ["maling", "spraydåser", "kemikalier", "lyskilder", "elpærer", "LED pærer", "olierester", "plantegift", "neglelak", "neglelakfjerner", "termometre", "afkalkningsmidler", "gødning"],
  batterier:            ["AA batterier", "AAA batterier", "knapcellebatterier", "litiumbatterier", "alkalibatterier", "genopladelige batterier"],
  "smaat-elektronik":   ["mobiltelefoner", "telefoner", "radio", "kamera", "elektrisk legetøj", "opladere", "elektrisk værktøj", "hårtørrere", "elkedel", "brødrister"],
  "smaat-braendbart":   ["gavepapir", "pizzabakker", "flamingo", "eps", "tyggegummi", "sutter", "blisterpakker", "skriveredskaber", "bagepapir", "muffinsforme", "chipsposer", "kaffeposer", "servietter", "to-go papkrus", "cigaretskod", "melamin", "ringbind"],
  haveaffald:           ["blade og blomster", "grene og buske", "hækafklip", "nedfaldsfrugt", "græstørv", "brænde", "træer og rødder"],
};

// Load current fractions
const g = {};
(new Function("g", fs.readFileSync("data/fractions.js", "utf8").replace(/window\./g, "g.")))(g);
let fractions = g.generatedWasteFractions;

// Apply renames
fractions = fractions.map((f) => {
  const r = renames[f.id];
  return r ? { ...f, id: r.id, title: r.title } : f;
});

// Build Kredsløb keyword map (new IDs after rename)
const krdslobData = JSON.parse(fs.readFileSync("data/kredslob-sorting-rules.json", "utf8"));
const krdslobKw = {};
for (const rule of krdslobData.rules) {
  for (const target of (krdslobMap[rule.id] || [])) {
    if (!krdslobKw[target]) krdslobKw[target] = [];
    krdslobKw[target].push(...(rule.yes || []).map((k) => k.toLowerCase()));
  }
}

// Merge keywords: MST first (most curated), then Kredsløb, then existing
fractions = fractions.map((f) => {
  const combined = [
    ...(mstKeywords[f.id] || []),
    ...(krdslobKw[f.id] || []),
    ...(f.keywords || []),
  ].map((k) => k.toLowerCase());
  return { ...f, keywords: [...new Set(combined)] };
});

const output = `window.generatedWasteFractions = ${JSON.stringify(fractions, null, 4)};\n`;
fs.writeFileSync("data/fractions.js", output);
fs.writeFileSync("data/fractions.json", JSON.stringify(fractions, null, 2));

const renamed = Object.keys(renames);
console.log(`Fractions: ${fractions.length}`);
console.log(`Renamed IDs: ${renamed.join(", ")}`);
console.log(`Fractions with enriched keywords: ${fractions.filter((f) => (f.keywords || []).length > 3).length}`);
