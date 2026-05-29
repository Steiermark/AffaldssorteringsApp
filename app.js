const municipalDataSources = {
  "0530": {
    municipality: "Billund Kommune",
    endpoints: ["data/municipal/0530.json"]
  }
};

const utilityCompanyDataSources = {
  "0530": [
    {
      provider: "Lokalt forsynings-/affaldsselskab",
      endpoints: ["data/utility/0530-affaldspartner.json"]
    }
  ]
};

const nationalRecyclingDataSource = {
  provider: "OpenStreetMap Overpass",
  endpoint: "https://overpass-api.de/api/interpreter",
  query: `
    [out:json][timeout:60];
    area["ISO3166-1"="DK"][admin_level=2]->.searchArea;
    (
      nwr["amenity"="recycling"]["recycling_type"="centre"](area.searchArea);
      nwr["amenity"="recycling"]["name"~"genbrugsplads|genbrugsstation|recycling centre|recycling center",i](area.searchArea);
    );
    out center tags;
  `
};

const nationalSitesCacheKey = "sortering:national-sites:v6";
const nationalSitesCacheMaxAge = 1000 * 60 * 60 * 24 * 7;
const layoutFractionAliases = {
  batteries: ["batterier"],
  "bloed-plast-2": ["bloed-plast"],
  cardboard: ["pap", "pap-og-karton"],
  elpaerer: ["lyskilder", "lysstofroer"],
  flamingo: ["eps"],
  genbrug: ["direkte-genbrug"],
  glass: ["glas", "flasker-og-glas"],
  hazardous: ["farligt-affald", "spraydaaser"],
  "haard-plast": ["haardt-plast", "haard-plast"],
  "haard-pvc": ["pvc", "haardt-pvc"],
  "indendoers-trae": ["rent-trae", "trae-til-genbrug"],
  koeleudstyr: ["koel-og-frys"],
  lysstofroer: ["lyskilder"],
  "mad-og-drikkekartoner": ["kartoner"],
  metal: ["jern-og-metal"],
  "mursten-og-tegl": ["murbrokker"],
  "klar-bloed-plast": ["plastfolie"],
  plastic: ["plast", "plastemballage", "pmdk"],
  plasthavemoebler: ["havemoebler", "plastmoebler"],
  "polstrede-moebler": ["stort-braendbart", "smaat-braendbart"],
  "porcelaen-2": ["porcelaen"],
  storskrald: ["stort-braendbart", "smaat-braendbart", "rest-efter-sortering"],
  "stort-elektronik": ["haarde-hvidevarer"],
  tekstilaffald: ["tekstil"],
  "udendoers-trae": ["impraegneret-trae"],
  vinduer: ["glasdoere", "vinduer-og-glasdoere"]
};
const danishMunicipalities = [
  "Albertslund Kommune",
  "Allerød Kommune",
  "Assens Kommune",
  "Ballerup Kommune",
  "Billund Kommune",
  "Bornholms Regionskommune",
  "Brøndby Kommune",
  "Brønderslev Kommune",
  "Dragør Kommune",
  "Egedal Kommune",
  "Esbjerg Kommune",
  "Fanø Kommune",
  "Favrskov Kommune",
  "Faxe Kommune",
  "Fredensborg Kommune",
  "Fredericia Kommune",
  "Frederiksberg Kommune",
  "Frederikshavn Kommune",
  "Frederikssund Kommune",
  "Furesø Kommune",
  "Faaborg-Midtfyn Kommune",
  "Gentofte Kommune",
  "Gladsaxe Kommune",
  "Glostrup Kommune",
  "Greve Kommune",
  "Gribskov Kommune",
  "Guldborgsund Kommune",
  "Haderslev Kommune",
  "Halsnæs Kommune",
  "Hedensted Kommune",
  "Helsingør Kommune",
  "Herlev Kommune",
  "Herning Kommune",
  "Hillerød Kommune",
  "Hjørring Kommune",
  "Holbæk Kommune",
  "Holstebro Kommune",
  "Horsens Kommune",
  "Hvidovre Kommune",
  "Høje-Taastrup Kommune",
  "Hørsholm Kommune",
  "Ikast-Brande Kommune",
  "Ishøj Kommune",
  "Jammerbugt Kommune",
  "Kalundborg Kommune",
  "Kerteminde Kommune",
  "Kolding Kommune",
  "Københavns Kommune",
  "Køge Kommune",
  "Langeland Kommune",
  "Lejre Kommune",
  "Lemvig Kommune",
  "Lolland Kommune",
  "Lyngby-Taarbæk Kommune",
  "Læsø Kommune",
  "Mariagerfjord Kommune",
  "Middelfart Kommune",
  "Morsø Kommune",
  "Norddjurs Kommune",
  "Nordfyns Kommune",
  "Nyborg Kommune",
  "Næstved Kommune",
  "Odder Kommune",
  "Odense Kommune",
  "Odsherred Kommune",
  "Randers Kommune",
  "Rebild Kommune",
  "Ringkøbing-Skjern Kommune",
  "Ringsted Kommune",
  "Roskilde Kommune",
  "Rudersdal Kommune",
  "Rødovre Kommune",
  "Samsø Kommune",
  "Silkeborg Kommune",
  "Skanderborg Kommune",
  "Skive Kommune",
  "Slagelse Kommune",
  "Solrød Kommune",
  "Sorø Kommune",
  "Stevns Kommune",
  "Struer Kommune",
  "Svendborg Kommune",
  "Syddjurs Kommune",
  "Sønderborg Kommune",
  "Thisted Kommune",
  "Tønder Kommune",
  "Tårnby Kommune",
  "Vallensbæk Kommune",
  "Varde Kommune",
  "Vejen Kommune",
  "Vejle Kommune",
  "Vesthimmerlands Kommune",
  "Viborg Kommune",
  "Vordingborg Kommune",
  "Ærø Kommune",
  "Aabenraa Kommune",
  "Aalborg Kommune",
  "Aarhus Kommune"
];

let recyclingSites = [];

let wasteTypes = [
  {
    id: "cardboard",
    keywords: ["pap", "karton", "papkasse"],
    webQueries: ["cardboard box waste recycling", "paper cardboard recycling"],
    pictogram: "assets/pictograms/cardboard.png",
    title: "Pap og karton",
    text: "Læg det i pap-containeren. Fjern plast, flamingo og madrester først.",
    tone: "recycle",
    confidence: 88
  },
  {
    id: "batteries",
    keywords: ["batteri", "batterier", "powerbank"],
    webQueries: ["used batteries recycling", "battery waste collection"],
    pictogram: "assets/pictograms/batteries.png",
    title: "Batterier",
    text: "Afleveres som farligt affald eller i batteriboks. Batterier må ikke i restaffald.",
    tone: "problem",
    confidence: 94
  },
  {
    id: "hazardous",
    keywords: ["maling", "lak", "kemikalie", "spray"],
    webQueries: ["paint can hazardous waste", "chemical waste container"],
    pictogram: "assets/pictograms/hazardous.png",
    title: "Farligt affald",
    text: "Aflever beholderen lukket ved miljøstationen. Spørg personalet, hvis etiketten mangler.",
    tone: "problem",
    confidence: 91
  },
  {
    id: "glass",
    keywords: ["glas", "flaske", "syltetøjsglas"],
    webQueries: ["glass bottle recycling", "glass jar recycling"],
    pictogram: "assets/pictograms/glass.png",
    title: "Glas",
    text: "Tomme glas og flasker skal i glascontaineren. Låg sorteres separat, hvis muligt.",
    tone: "recycle",
    confidence: 86
  },
  {
    id: "metal",
    keywords: ["metal", "dåse", "gryde", "cykel"],
    webQueries: ["scrap metal recycling", "metal cans recycling"],
    pictogram: "assets/pictograms/metal.png",
    title: "Metal",
    text: "Afleveres i metalcontaineren. Elektronik og batterier skal sorteres for sig.",
    tone: "special",
    confidence: 82
  },
  {
    id: "plastic",
    keywords: ["plast", "plastik", "dunk", "pose"],
    webQueries: ["plastic packaging recycling", "plastic bottles waste"],
    pictogram: "assets/pictograms/plastic.png",
    title: "Plast",
    text: "Ren plast sorteres som plast. Beskidt emballage med madrester skal ofte i restaffald.",
    tone: "recycle",
    confidence: 79
  }
];

const camera = document.querySelector("#camera");
const preview = document.querySelector("#preview");
const emptyState = document.querySelector("#empty-state");
const imageLoading = document.querySelector("#image-loading");
const dropOverlay = document.querySelector("#drop-overlay");
const startButton = document.querySelector("#start-camera");
const captureButton = document.querySelector("#capture-photo");
const imageInput = document.querySelector("#image-input");
const canvas = document.querySelector("#snapshot");
const resultTitle = document.querySelector("#result-title");
const resultPictogram = document.querySelector("#result-pictogram");
const resultFractionLabel = document.querySelector("#result-fraction-label");
const resultText = document.querySelector("#result-text");
const confidence = document.querySelector("#confidence");
const confidenceMeter = document.querySelector("#confidence-meter");
const confidenceValue = document.querySelector("#confidence-value");
const searchForm = document.querySelector("#search-form");
const wasteSearch = document.querySelector("#waste-search");
const searchDropdown = document.querySelector("#search-dropdown");
const suggestions = document.querySelector("#suggestions");
const findSiteButton = document.querySelector("#find-site");
const municipalitySelect = document.querySelector("#municipality-select");
const siteSelect = document.querySelector("#site-select");
const siteStatus = document.querySelector("#site-status");
const selectedSiteName = document.querySelector("#selected-site-name");
const selectedSiteDistance = document.querySelector("#selected-site-distance");
const locationCard = document.querySelector("#location-card");
const fractionLocation = document.querySelector("#fraction-location");
const fractionNote = document.querySelector("#fraction-note");
const locationPictogram = document.querySelector("#location-pictogram");
const showSiteMapButton = document.querySelector("#show-site-map");
const siteMapModal = document.querySelector("#site-map-modal");
const siteMapTitle = document.querySelector("#site-map-title");
const siteMapImage = document.querySelector("#site-map-image");
const siteMapFrame = document.querySelector("#site-map-frame");
const siteMapLink = document.querySelector("#site-map-link");
const closeSiteMapButton = document.querySelector("#close-site-map");
const androidStatus = document.querySelector("#android-status");
const installAndroidButton = document.querySelector("#install-android");
const anthropicApiKeyInput = document.querySelector("#anthropic-api-key");
const clearApiKeyButton = document.querySelector("#clear-api-key");
const apiKeyStatus = document.querySelector("#api-key-status");

let stream;
let selectedSite = null;
let selectedDistance = null;
let latestMatch = null;
let latestImageName = "";
let deferredInstallPrompt = null;
let recentWasteSearches = [];
let denmarkSitesLoadPromise = null;
let sitesByMunicipality = new Map();
let municipalitySelectionRequest = 0;
let siteLayoutsById = new Map();
let imageAnalysisRequest = 0;
let wasteFractionCatalogPromise = null;
let dragDepth = 0;

const anthropicMessagesEndpoint = "https://api.anthropic.com/v1/messages";
const openAiResponsesEndpoint = "https://api.openai.com/v1/responses";
const appConfig = window.affaldssorteringConfig || {};
const imageRecognitionProvider = String(appConfig.imageRecognitionProvider || "").toLowerCase() === "openai" ? "openai" : "anthropic";
const anthropicModel = appConfig.anthropicModel || "claude-haiku-4-5-20251001";
const openAiModel = appConfig.openAiModel || "gpt-4.1-mini";
const anthropicApiKeyStorageKey = "sortering:anthropic-api-key";
const openAiApiKeyStorageKey = "sortering:openai-api-key";
const maxFractionsInImagePrompt = 120;
const maxLocalFractionsInImagePrompt = 90;
const findSiteHelpText = "Brug knappen Find nærmeste til at finde den genbrugsplads, der er nærmest, eller vælg kommune og genbrugsplads fra listen.";
const lowConfidenceHelpText = "Kontakt en medarbejder for hjælp.";

const containerCatalog = {
  trae: { label: "Træ", icon: "🪵", desc: "Rent træ, møbler, spånplader", fractionId: "trae" },
  metal: { label: "Metal", icon: "🔩", desc: "Jern, stål, aluminium, dåser", fractionId: "metal" },
  murbrokker: { label: "Murbrokker", icon: "🧱", desc: "Mursten, beton, fliser, tegl", fractionId: "mursten-og-tegl" },
  stort_braendbart: { label: "Stort brændbart", icon: "🔥", desc: "Madrasser, gulvtæpper, plast-møbler", fractionId: "polstrede-moebler" },
  farligt_affald: { label: "Farligt affald", icon: "☠️", desc: "Maling, kemikalier, batterier, olie", fractionId: "hazardous" },
  elektronik: { label: "Elektronik", icon: "🔌", desc: "Hårde hvidevarer, kabler, IT-udstyr", fractionId: "elektronik" },
  pap: { label: "Pap", icon: "📦", desc: "Papkasser, bølgepap, karton", fractionId: "cardboard" },
  haveaffald: { label: "Haveaffald", icon: "🌿", desc: "Grene, blade, græs, jord", fractionId: "haveaffald" },
  glas: { label: "Glas", icon: "🫙", desc: "Flasker, syltetøjsglas, vinduesglas", fractionId: "glass" },
  haardt_plast: { label: "Hård plast", icon: "♻️", desc: "Havemøbler, legetøj, spande", fractionId: "haard-plast" },
  bloed_plast: { label: "Blød plast / folie", icon: "🛍️", desc: "Plastposer, folie, bobleplast", fractionId: "bloed-plast-2" },
  tekstil: { label: "Tekstil & tøj", icon: "👕", desc: "Tøj, sko, tasker, sengetøj", fractionId: "tekstilaffald" },
  daek: { label: "Dæk", icon: "🛞", desc: "Bildæk, cykeldæk", fractionId: "daek" },
  gips: { label: "Gips", icon: "🏗️", desc: "Gipsplader, gipsrester", fractionId: "gips" },
  vinduer: { label: "Vinduer & glasdøre", icon: "🪟", desc: "Termoruder, glasdøre, spejle", fractionId: "vinduer" },
  pvc: { label: "PVC", icon: "🔧", desc: "PVC-rør, tagrender, vinyl", fractionId: "haard-pvc" },
  deponi: { label: "Deponi", icon: "🚫", desc: "Rockwool, asbest, forurenet jord", fractionId: "asbest" },
  sanitet: { label: "Sanitet / porcelæn", icon: "🚽", desc: "Toilet, håndvask, porcelæn", fractionId: "sanitet" },
  flamingo: { label: "Flamingo / EPS", icon: "📐", desc: "Flamingo, styropor, EPS", fractionId: "flamingo" },
  smaat_braendbart: { label: "Småt brændbart", icon: "🗑️", desc: "Restaffald, småt brændbart", fractionId: "storskrald" }
};

const containerColors = {
  trae: "#8b5e34",
  metal: "#607d8b",
  murbrokker: "#b55a3c",
  stort_braendbart: "#c2412d",
  farligt_affald: "#111827",
  elektronik: "#2563eb",
  pap: "#b7791f",
  haveaffald: "#2f855a",
  glas: "#0f766e",
  haardt_plast: "#7c3aed",
  bloed_plast: "#db2777",
  tekstil: "#be185d",
  daek: "#374151",
  gips: "#64748b",
  vinduer: "#0284c7",
  pvc: "#475569",
  deponi: "#991b1b",
  sanitet: "#6b7280",
  flamingo: "#0891b2",
  smaat_braendbart: "#57534e"
};

function distanceInMeters(from, to) {
  const radius = 6371000;
  const lat1 = from.lat * Math.PI / 180;
  const lat2 = to.lat * Math.PI / 180;
  const deltaLat = (to.lat - from.lat) * Math.PI / 180;
  const deltaLon = (to.lon - from.lon) * Math.PI / 180;
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters) {
  if (meters === null) return "-";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

function getSiteLabel(site) {
  const name = site.displayName || site.name;
  const label = site.address ? `${name} - ${site.address}` : name;
  return site.operator ? `${label} (${site.operator})` : label;
}

function getSortableSiteName(site) {
  return site.displayName || site.name;
}

function getMunicipalityName(site) {
  return site.municipality || site.tags?.["addr:municipality"] || site.tags?.municipality || "Ukendt kommune";
}

function getMunicipalityCodeByName(municipalityName) {
  return Object.entries(municipalDataSources)
    .find(([, source]) => source.municipality === municipalityName)?.[0] || "";
}

function buildSiteIndex() {
  sitesByMunicipality = new Map();
  recyclingSites.forEach((site) => {
    const municipality = getMunicipalityName(site);
    site.searchText = [site.name, site.displayName, site.operator, site.address, site.source, municipality]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!sitesByMunicipality.has(municipality)) {
      sitesByMunicipality.set(municipality, []);
    }
    sitesByMunicipality.get(municipality).push(site);
  });

  sitesByMunicipality.forEach((sites) => {
    sites.sort((a, b) => getSortableSiteName(a).localeCompare(getSortableSiteName(b), "da"));
  });
}

function populateMunicipalities() {
  municipalitySelect.innerHTML = "";
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = "Vælg kommune";
  municipalitySelect.append(emptyOption);

  const municipalities = [...new Set([...danishMunicipalities, ...sitesByMunicipality.keys()])]
    .sort((a, b) => a.localeCompare(b, "da"));

  municipalities.forEach((municipality) => {
    const option = document.createElement("option");
    option.value = municipality;
    option.textContent = municipality;
    municipalitySelect.append(option);
  });

  municipalitySelect.value = selectedSite ? getMunicipalityName(selectedSite) : "";
}

function populateSites(municipality = municipalitySelect?.value || "") {
  siteSelect.innerHTML = "";
  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = municipality ? "Vælg genbrugsplads" : "Vælg kommune først";
  siteSelect.append(emptyOption);

  const filteredSites = municipality ? (sitesByMunicipality.get(municipality) || []) : [];
  if (municipality && filteredSites.length === 0) {
    emptyOption.textContent = "Ingen genbrugsplads indlæst endnu";
  }

  filteredSites.forEach((site) => {
    const option = document.createElement("option");
    option.value = site.id;
    option.textContent = getSiteLabel(site);
    siteSelect.append(option);
  });

  siteSelect.disabled = !municipality || filteredSites.length === 0;
  if (selectedSite && !filteredSites.some((site) => site.id === selectedSite.id)) {
    const option = document.createElement("option");
    option.value = selectedSite.id;
    option.textContent = `${getSiteLabel(selectedSite)} - valgt`;
    siteSelect.prepend(option);
  }
}

function replaceRecyclingSites(sites) {
  const activeMunicipality = selectedSite
    ? getMunicipalityName(selectedSite)
    : municipalitySelect?.value || "";
  recyclingSites = sites;
  applySiteLayoutsToSites();
  buildSiteIndex();
  populateMunicipalities();
  if (activeMunicipality && Array.from(municipalitySelect.options).some((option) => option.value === activeMunicipality)) {
    municipalitySelect.value = activeMunicipality;
  }
  populateSites(municipalitySelect.value);
}

function mergeRecyclingSitesForMunicipality(municipality, sites) {
  const incomingIds = new Set(sites.map((site) => site.id));
  recyclingSites = [
    ...recyclingSites.filter((site) => getMunicipalityName(site) !== municipality && !incomingIds.has(site.id)),
    ...sites
  ];
  applySiteLayoutsToSites();
  buildSiteIndex();
  populateMunicipalities();
  municipalitySelect.value = municipality;
  populateSites(municipality);
}

function applySiteLayoutsToSites() {
  if (siteLayoutsById.size === 0) return;
  recyclingSites.forEach((site) => {
    const layout = siteLayoutsById.get(site.id);
    if (!layout) return;
    site.map = {
      ...(site.map || {}),
      ...(layout.map || {})
    };
    site.layoutSource = layout.source || null;
  });
}

async function loadSiteLayouts() {
  try {
    const layouts = Array.isArray(window.bundledSiteLayouts)
      ? window.bundledSiteLayouts
      : await fetchJson("data/site-layouts.json");
    if (!Array.isArray(layouts)) return;

    siteLayoutsById = new Map(
      layouts
        .filter((layout) => layout.siteId && layout.map)
        .map((layout) => [layout.siteId, layout])
    );
    applySiteLayoutsToSites();
    buildSiteIndex();
    populateSites(municipalitySelect.value);
    if (selectedSite) {
      selectedSite = recyclingSites.find((site) => site.id === selectedSite.id) || selectedSite;
      updateSiteMapButton();
    }
    if (latestMatch) {
      updateLocalFractionLocation(latestMatch);
    }
  } catch (error) {
    // Site layouts are optional and can be added municipality by municipality.
  }
}

function readCachedNationalSites() {
  try {
    const raw = localStorage.getItem(nationalSitesCacheKey);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached.savedAt || Date.now() - cached.savedAt > nationalSitesCacheMaxAge) return null;
    if (!Array.isArray(cached.sites) || cached.sites.length === 0) return null;
    const municipalityCount = new Set(cached.sites.map(getMunicipalityName)).size;
    if (municipalityCount < 2) return null;
    return cached.sites;
  } catch (error) {
    return null;
  }
}

function writeCachedNationalSites(sites) {
  try {
    localStorage.setItem(nationalSitesCacheKey, JSON.stringify({
      savedAt: Date.now(),
      sites
    }));
  } catch (error) {
    // Cache is an optimization only.
  }
}

async function loadBundledNationalSites() {
  try {
    const sites = Array.isArray(window.bundledNationalSites)
      ? window.bundledNationalSites
      : await fetchJson("data/national-sites.json");
    if (Array.isArray(sites) && sites.length > 0) {
      replaceRecyclingSites(sites);
      selectedSiteName.textContent = "Ikke valgt";
      selectedSiteDistance.textContent = "-";
      siteStatus.textContent = findSiteHelpText;
    }
  } catch (error) {
    // Bundled national data is a fallback only.
  }
}

function normalizeWasteFraction(item) {
  return {
    id: item.id,
    title: item.title,
    keywords: Array.isArray(item.keywords) ? item.keywords : [item.title],
    webQueries: Array.isArray(item.webQueries) ? item.webQueries : [`${item.title} waste recycling`],
    pictogram: item.pictogram || "assets/pictograms/unknown.svg",
    tone: item.tone || "recycle",
    confidence: Number(item.confidence) || 78,
    text: item.text || `Sortér som ${item.title}. Kontroller den lokale skiltning på genbrugspladsen.`
  };
}

function applyWasteFractionCorrections(fractions) {
  const hazardous = fractions.find((item) => item.id === "hazardous");
  if (hazardous) {
    hazardous.keywords = Array.from(new Set([
      ...hazardous.keywords,
      "spray",
      "spraydåse",
      "spraydåser",
      "spraydaase",
      "spraydaaser",
      "aerosol"
    ]));
    hazardous.text = "Spraydåser afleveres som farligt affald. Aflever beholderen lukket ved miljøstationen, og spørg personalet hvis etiketten mangler.";
  }

  return fractions.filter((item) => item.id !== "spraydaaser");
}

async function loadWasteFractionCatalog() {
  if (wasteFractionCatalogPromise) return wasteFractionCatalogPromise;
  wasteFractionCatalogPromise = (async () => {
  try {
    const payload = Array.isArray(window.generatedWasteFractions)
      ? window.generatedWasteFractions
      : await fetchJson("data/fractions.json");
    const fractions = Array.isArray(payload)
      ? applyWasteFractionCorrections(payload.map(normalizeWasteFraction))
      : [];
    if (fractions.length === 0) {
      throw new Error("Fraktionskataloget er tomt.");
    }

    wasteTypes = fractions;
    renderRecentWasteSearches();
    resultText.textContent = `${fractions.length} affaldsfraktioner er indlæst fra piktogrammappen. Upload et billede eller søg efter en fraktion.`;
  } catch (error) {
    renderRecentWasteSearches();
  }
  })();
  return wasteFractionCatalogPromise;
}

function getTag(tags, keys, fallback = "") {
  for (const key of keys) {
    if (tags?.[key]) return tags[key];
  }
  return fallback;
}

function getOsmCoordinates(element) {
  return {
    lat: Number(element.lat ?? element.center?.lat),
    lon: Number(element.lon ?? element.center?.lon)
  };
}

function isMunicipalRecyclingSiteName(name) {
  const includePattern = /genbrugsplads|genbrugplads|genbrugsplad\b|genbrugsstation|genbrugstation|containerplads|affaldscenter|genbrugscenter|ressourcecenter|værdipark/i;
  const excludePattern = /nærgenbrug|haveaffald|miljøstation|recycling room|recycling containers|flasker|metal- og glas|skrot|produktforretning|gen-tek|rgs\b|grenplads|storskrald|materialeplads|havn$|kvickly|modtageanlæg|\buglen\b|\bjatob\b|^revas$|^reno djurs(?: i\/s)?$|brumleby|christiania recycling|vognmandsparken|gejlhavegård|bronzevej|netto/i;
  return includePattern.test(name) && !excludePattern.test(name);
}

function normalizeOsmRecyclingSites(payload) {
  const elements = Array.isArray(payload.elements) ? payload.elements : [];
  const seen = new Set();
  return elements.map((element) => {
    const tags = element.tags || {};
    const coords = getOsmCoordinates(element);
    const id = `osm-${element.type}-${element.id}`;
    const name = getTag(tags, ["name", "official_name"], "Genbrugsplads");
    const operator = getTag(tags, ["operator", "brand"]);
    const address = [
      getTag(tags, ["addr:street"]),
      getTag(tags, ["addr:housenumber"]),
      getTag(tags, ["addr:postcode"]),
      getTag(tags, ["addr:city"])
    ].filter(Boolean).join(" ");

    if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lon) || seen.has(id) || !isMunicipalRecyclingSiteName(name)) {
      return null;
    }

    seen.add(id);
    return {
      id,
      name,
      operator,
      address,
      municipality: getTag(tags, ["addr:municipality", "is_in:municipality"], "Ukendt kommune"),
      lat: coords.lat,
      lon: coords.lon,
      website: getTag(tags, ["contact:website", "website"]),
      source: "OpenStreetMap",
      map: {}
    };
  }).filter(Boolean);
}

async function fetchOverpassJson(query) {
  const response = await fetch(nationalRecyclingDataSource.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
    },
    body: new URLSearchParams({ data: query })
  });

  if (!response.ok) {
    throw new Error(`Overpass svarede ${response.status}`);
  }

  return response.json();
}

async function loadAllDanishRecyclingSites() {
  if (denmarkSitesLoadPromise) return denmarkSitesLoadPromise;

  denmarkSitesLoadPromise = (async () => {
    if (Array.isArray(window.bundledNationalSites) && window.bundledNationalSites.length > 100) {
      return;
    }

    const cachedSites = readCachedNationalSites();
    if (cachedSites) {
      replaceRecyclingSites(cachedSites);
      siteStatus.textContent = findSiteHelpText;
    } else {
      siteStatus.textContent = "Henter landsdækkende genbrugspladser i baggrunden.";
    }

    try {
      const payload = await fetchOverpassJson(nationalRecyclingDataSource.query);
      const sites = normalizeOsmRecyclingSites(payload);
      if (sites.length === 0) {
        throw new Error("OpenStreetMap returnerede ingen genbrugspladser.");
      }

      replaceRecyclingSites(sites);
      writeCachedNationalSites(sites);
      siteStatus.textContent = findSiteHelpText;
    } catch (error) {
      if (!cachedSites) {
        siteStatus.textContent = "Kunne ikke indlæse landsdækkende data. Appen bruger lokale/kommunale fallback-data.";
      }
    }
  })();

  return denmarkSitesLoadPromise;
}

function normalizeMunicipalSitesPayload(payload) {
  const sites = Array.isArray(payload) ? payload : payload.sites;
  if (!Array.isArray(sites) || sites.length === 0) {
    throw new Error("Datakilden indeholder ingen genbrugspladser.");
  }

  return sites.map((site) => ({
    id: site.id,
    name: site.name,
    address: site.address || "",
    municipality: site.municipality || payload.municipality || "Ukendt kommune",
    lat: Number(site.lat),
    lon: Number(site.lon),
    map: site.map || {}
  })).filter((site) => site.id && site.name && Number.isFinite(site.lat) && Number.isFinite(site.lon));
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Datakilde svarede ${response.status}`);
  }
  return response.json();
}

async function resolveMunicipalityFromPosition(position) {
  const lon = position.coords.longitude;
  const lat = position.coords.latitude;
  const url = `https://api.dataforsyningen.dk/adgangsadresser/reverse?x=${lon}&y=${lat}&struktur=mini`;
  const data = await fetchJson(url);
  return {
    code: data.kommunekode,
    name: municipalDataSources[data.kommunekode]?.municipality || `Kommune ${data.kommunekode}`
  };
}

async function fetchMunicipalRecyclingSites(municipalityCode) {
  const source = municipalDataSources[municipalityCode];
  if (!source) {
    throw new Error("Der er ikke konfigureret en datakilde for kommunen endnu.");
  }

  return fetchRecyclingSitesFromSource({
    ...source,
    provider: source.municipality,
    type: "kommunal datakilde"
  });
}

async function fetchUtilityCompanyRecyclingSites(municipalityCode) {
  const sources = utilityCompanyDataSources[municipalityCode] || [];
  if (sources.length === 0) {
    throw new Error("Der er ikke konfigureret en lokal forsyningsdatakilde for kommunen endnu.");
  }

  let latestError;
  for (const source of sources) {
    try {
      return await fetchRecyclingSitesFromSource({
        ...source,
        type: "forsyningsdatakilde"
      });
    } catch (error) {
      latestError = error;
    }
  }

  throw latestError || new Error("Forsyningsselskabets datakilder kunne ikke læses.");
}

async function loadSitesForSelectedMunicipality(municipality) {
  if (!municipality) return;

  const requestId = ++municipalitySelectionRequest;
  const municipalityCode = getMunicipalityCodeByName(municipality);
  if (!municipalityCode) {
    const siteCount = (sitesByMunicipality.get(municipality) || []).length;
    siteStatus.textContent = siteCount > 0
      ? `Kommune valgt: ${municipality}. Vælg genbrugsplads i feltet Vælg.`
      : `Kommune valgt: ${municipality}. Ingen genbrugspladser er indlæst for kommunen endnu.`;
    return;
  }

  try {
    siteStatus.textContent = `Henter genbrugspladser for ${municipality}.`;
    const municipalData = await fetchMunicipalRecyclingSites(municipalityCode);
    if (requestId !== municipalitySelectionRequest || municipalitySelect.value !== municipality) return;

    if (municipalData.sites.length > 0) {
      mergeRecyclingSitesForMunicipality(municipality, municipalData.sites);
    }
    const siteCount = (sitesByMunicipality.get(municipality) || []).length;
    siteStatus.textContent = siteCount > 0
      ? `Kommune valgt: ${municipality}. Vælg genbrugsplads i feltet Vælg.`
      : `Kommune valgt: ${municipality}. Der er ikke fundet genbrugspladser for kommunen endnu.`;
  } catch (municipalError) {
    try {
      const utilityData = await fetchUtilityCompanyRecyclingSites(municipalityCode);
      if (requestId !== municipalitySelectionRequest || municipalitySelect.value !== municipality) return;

      mergeRecyclingSitesForMunicipality(municipality, utilityData.sites);
      siteStatus.textContent = `${utilityData.sites.length} genbrugspladser fundet for ${municipality}. Vælg genbrugsplads i feltet Vælg.`;
    } catch (utilityError) {
      if (requestId !== municipalitySelectionRequest || municipalitySelect.value !== municipality) return;

      const siteCount = (sitesByMunicipality.get(municipality) || []).length;
      siteStatus.textContent = siteCount > 0
        ? `Kommune valgt: ${municipality}. Vælg genbrugsplads i feltet Vælg.`
        : `Kommune valgt: ${municipality}. Der er ikke fundet genbrugspladser for kommunen endnu.`;
    }
  }
}

async function fetchRecyclingSitesFromSource(source) {
  let latestError;
  for (const endpoint of source.endpoints) {
    try {
      const payload = await fetchJson(endpoint);
      const sites = normalizeMunicipalSitesPayload(payload);
      if (sites.length > 0) {
        return { sites, source };
      }
    } catch (error) {
      latestError = error;
    }
  }

  throw latestError || new Error(`${source.type} kunne ikke læses.`);
}

function setSelectedSite(site, distance = null, status = "Manuelt valgt genbrugsplads.") {
  if (!site) return;
  selectedSite = site;
  selectedDistance = distance;
  municipalitySelect.value = getMunicipalityName(site);
  populateSites(municipalitySelect.value);
  siteSelect.value = site.id;
  selectedSiteName.textContent = site.name;
  selectedSiteDistance.textContent = formatDistance(distance);
  siteStatus.textContent = status;
  if (latestMatch) {
    updateLocalFractionLocation(latestMatch);
  }
  updateSiteMapButton();
}

function getSiteMapUrl(site = selectedSite) {
  return site?.layoutSource?.localFile || site?.layoutSource?.localMap || site?.layoutSource?.url || site?.layoutSource?.pageUrl || "";
}

function getSiteMapImageUrl(site = selectedSite) {
  const source = site?.layoutSource;
  const imageUrl = source?.imageFile || source?.imageUrl || source?.localImage || "";
  if (imageUrl) return imageUrl;
  const localMap = source?.localMap || "";
  return /\.(png|jpe?g|webp|gif|avif)$/i.test(localMap) ? localMap : "";
}

function toAbsoluteUrl(url) {
  if (!url) return "";
  return new URL(url, window.location.href).href;
}

function updateSiteMapButton() {
  const hasMap = Boolean(getSiteMapImageUrl() || getSiteMapUrl());
  showSiteMapButton.hidden = !hasMap;
  showSiteMapButton.disabled = !hasMap;
}

function openSelectedSiteMap() {
  const imageUrl = toAbsoluteUrl(getSiteMapImageUrl());
  const mapUrl = toAbsoluteUrl(getSiteMapUrl());
  if (!imageUrl && !mapUrl) return;
  siteMapTitle.textContent = selectedSite?.name
    ? `Oversigtskort: ${selectedSite.name}`
    : "Oversigtskort";
  siteMapImage.hidden = !imageUrl;
  siteMapFrame.hidden = Boolean(imageUrl) || !mapUrl;
  if (imageUrl) {
    siteMapImage.src = imageUrl;
    siteMapImage.alt = selectedSite?.name
      ? `Oversigtskort for ${selectedSite.name}`
      : "Oversigtskort for valgt genbrugsplads";
    siteMapFrame.removeAttribute("src");
  } else {
    siteMapImage.removeAttribute("src");
    siteMapFrame.src = mapUrl;
  }
  siteMapLink.href = mapUrl || imageUrl;
  siteMapModal.hidden = false;
  document.body.classList.add("modal-open");
  closeSiteMapButton.focus();
}

function closeSelectedSiteMap() {
  siteMapModal.hidden = true;
  siteMapImage.removeAttribute("src");
  siteMapImage.hidden = true;
  siteMapFrame.removeAttribute("src");
  siteMapFrame.hidden = true;
  siteMapLink.href = "#";
  document.body.classList.remove("modal-open");
  showSiteMapButton.focus();
}

function getLocalFractionLocation(site, fractionId) {
  if (!site?.map || !fractionId) return null;
  if (site.map[fractionId]) return site.map[fractionId];
  const aliases = layoutFractionAliases[fractionId] || [];
  return aliases.map((alias) => site.map[alias]).find(Boolean) || null;
}

function updateLocalFractionLocation(match) {
  const local = getLocalFractionLocation(selectedSite, match.id);
  locationCard.hidden = false;
  updateSiteMapButton();
  locationPictogram.src = match.pictogram || "assets/pictograms/unknown.svg";
  locationPictogram.alt = `Piktogram for ${match.title}`;
  locationPictogram.onerror = () => {
    locationPictogram.src = "assets/pictograms/unknown.svg";
  };
  if (!selectedSite || !local) {
    fractionLocation.textContent = "Ingen lokal placering fundet";
    fractionNote.textContent = selectedSite?.layoutSource
      ? "Fraktionen er ikke fundet på det officielle pladskort for denne plads."
      : "Der mangler stadig officielle pladskort/fraktionsplaceringer for denne genbrugsstation.";
    return;
  }

  fractionLocation.textContent = local.location;
  const sourceText = selectedSite.layoutSource?.provider
    ? ` Kilde: ${selectedSite.layoutSource.provider}.`
    : "";
  fractionNote.textContent = `${selectedSite.name}: ${local.note}${sourceText}`;
}

function findNearestSite(position) {
  const userPosition = {
    lat: position.coords.latitude,
    lon: position.coords.longitude
  };
  return recyclingSites
    .map((site) => ({
      site,
      distance: distanceInMeters(userPosition, site)
    }))
    .sort((a, b) => a.distance - b.distance)[0];
}

async function loadBestRecyclingDataForPosition(position) {
  const municipality = await resolveMunicipalityFromPosition(position);
  try {
    const municipalData = await fetchMunicipalRecyclingSites(municipality.code);
    replaceRecyclingSites(municipalData.sites);
    return {
      municipality,
      provider: municipalData.source.provider,
      type: municipalData.source.type
    };
  } catch (municipalError) {
    const utilityData = await fetchUtilityCompanyRecyclingSites(municipality.code);
    replaceRecyclingSites(utilityData.sites);
    return {
      municipality,
      provider: utilityData.source.provider,
      type: utilityData.source.type
    };
  }
}

function requestLocation() {
  if (!navigator.geolocation) {
    siteStatus.textContent = "Placering understøttes ikke i denne browser. Vælg genbrugsplads manuelt.";
    return;
  }

  findSiteButton.disabled = true;
  findSiteButton.textContent = "Finder...";
  siteStatus.textContent = "Finder din placering og vælger nærmeste genbrugsplads.";

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const cachedSites = readCachedNationalSites();
      if (cachedSites && recyclingSites.length <= 3) {
        replaceRecyclingSites(cachedSites);
      }

      const nearest = findNearestSite(position);
      setSelectedSite(
        nearest.site,
        nearest.distance,
        `Nærmeste genbrugsplads er ${nearest.site.name}. Friske data opdateres i baggrunden.`
      );
      municipalitySelect.value = getMunicipalityName(nearest.site);
      populateSites(municipalitySelect.value);
      findSiteButton.disabled = false;
      findSiteButton.textContent = "Find nærmeste";
      loadAllDanishRecyclingSites();
    },
    () => {
      siteStatus.textContent = "Placering blev ikke godkendt eller kunne ikke læses. Vælg genbrugsplads manuelt.";
      findSiteButton.disabled = false;
      findSiteButton.textContent = "Find nærmeste";
    },
    {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 300000
    }
  );
}

function escapeSvgText(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function emojiPictogramDataUrl(icon) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="16" fill="#edf3ef"/><text x="64" y="78" text-anchor="middle" font-size="58">${escapeSvgText(icon || "♻️")}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function setResult(match, source = "AI-forslag") {
  latestMatch = match;
  resultTitle.textContent = `${source}: ${match.title}`;
  resultPictogram.src = match.icon ? emojiPictogramDataUrl(match.icon) : match.pictogram || "assets/pictograms/unknown.svg";
  resultPictogram.alt = `Piktogram for ${match.title}`;
  resultPictogram.onerror = () => {
    resultPictogram.src = "assets/pictograms/unknown.svg";
  };
  resultPictogram.style.borderColor = match.color || "";
  resultPictogram.style.backgroundColor = match.color ? `${match.color}18` : "";
  resultFractionLabel.style.color = match.color || "";
  resultFractionLabel.textContent = `Fraktion: ${match.title}`;
  resultText.textContent = match.confidence < 90 ? lowConfidenceHelpText : match.text;
  confidence.hidden = false;
  confidenceMeter.value = match.confidence;
  confidenceValue.textContent = `${match.confidence}%`;
  updateLocalFractionLocation(match);
}

function setFallbackResult() {
  setResult({
    id: "unknown",
    pictogram: "assets/pictograms/unknown.svg",
    title: "Ukendt affald",
    text: "Billedet bør sendes videre til manuel kontrol. I app-forsøget kan brugeren stadig søge på affaldstypen nedenfor.",
    confidence: 54
  });
}

function setImageLoading(isLoading) {
  imageLoading.hidden = !isLoading;
  imageInput.disabled = isLoading;
  captureButton.disabled = isLoading || !stream;
}

function getStoredAnthropicApiKey() {
  try {
    return localStorage.getItem(anthropicApiKeyStorageKey) || "";
  } catch {
    return "";
  }
}

function setStoredAnthropicApiKey(value) {
  try {
    if (value) {
      localStorage.setItem(anthropicApiKeyStorageKey, value);
    } else {
      localStorage.removeItem(anthropicApiKeyStorageKey);
    }
  } catch {
    apiKeyStatus.textContent = "Nøglen kunne ikke gemmes i browseren.";
  }
}

function getStoredOpenAiApiKey() {
  try {
    return localStorage.getItem(openAiApiKeyStorageKey) || "";
  } catch {
    return "";
  }
}

function setStoredOpenAiApiKey(value) {
  try {
    if (value) {
      localStorage.setItem(openAiApiKeyStorageKey, value);
    } else {
      localStorage.removeItem(openAiApiKeyStorageKey);
    }
  } catch {
    apiKeyStatus.textContent = "Nøglen kunne ikke gemmes i browseren.";
  }
}

function getAnthropicApiKey() {
  return (anthropicApiKeyInput?.value || getStoredAnthropicApiKey() || appConfig.anthropicApiKey || "").trim();
}

function getOpenAiApiKey() {
  return (anthropicApiKeyInput?.value || getStoredOpenAiApiKey() || appConfig.openAiApiKey || "").trim();
}

function getActiveApiKey() {
  return imageRecognitionProvider === "openai" ? getOpenAiApiKey() : getAnthropicApiKey();
}

function setStoredActiveApiKey(value) {
  if (imageRecognitionProvider === "openai") {
    setStoredOpenAiApiKey(value);
  } else {
    setStoredAnthropicApiKey(value);
  }
}

function getRecognitionProviderLabel() {
  return imageRecognitionProvider === "openai" ? "OpenAI" : "Anthropic";
}

function updateApiKeyStatus() {
  const hasKey = Boolean(getActiveApiKey());
  const provider = getRecognitionProviderLabel();
  apiKeyStatus.textContent = hasKey
    ? `Billedgenkendelse bruger ${provider}.`
    : `Indsæt ${provider} API-nøgle for at aktivere billedanalyse.`;
}

function initializeApiKeyInput() {
  const configuredKey = imageRecognitionProvider === "openai"
    ? getStoredOpenAiApiKey() || appConfig.openAiApiKey || ""
    : getStoredAnthropicApiKey() || appConfig.anthropicApiKey || "";
  if (configuredKey) {
    anthropicApiKeyInput.value = configuredKey;
  }
  updateApiKeyStatus();
}

function dataUrlToBase64(dataUrl) {
  return dataUrl.split(",")[1] || "";
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

async function compressImageToJpegDataUrl(src, maxSize = 800, quality = 0.8) {
  const image = await loadImage(src);
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function parseAnthropicJson(data) {
  const text = data.content?.map((content) => content.text || "").join("") || "";
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function parseOpenAiJson(data) {
  const text = data.output_text
    || data.output?.flatMap((item) => item.content || []).map((content) => content.text || "").join("")
    || "";
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function normalizeClassificationToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildImageFractionCatalog() {
  return wasteTypes
    .slice(0, maxFractionsInImagePrompt)
    .map((item) => {
      const keywords = (item.keywords || [])
        .filter(Boolean)
        .slice(0, 4)
        .join(", ");
      return keywords
        ? `${item.id}: ${item.title} (${keywords})`
        : `${item.id}: ${item.title}`;
    })
    .join("\n");
}

function buildLocalImageFractionCatalog(site = selectedSite) {
  if (!site?.map || wasteTypes.length === 0) {
    return "";
  }

  const localRows = wasteTypes
    .map((item) => {
      const local = getLocalFractionLocation(site, item.id);
      if (!local) return null;
      const keywords = (item.keywords || [])
        .filter(Boolean)
        .slice(0, 6)
        .join(", ");
      const context = [
        `ID=${item.id}`,
        `titel=${item.title}`,
        keywords ? `soegeord: ${keywords}` : "",
        local.location ? `lokal placering: ${local.location}` : ""
      ].filter(Boolean);
      return context.join(" | ");
    })
    .filter(Boolean)
    .slice(0, maxLocalFractionsInImagePrompt);

  if (wasteTypes.some((item) => item.id === "unknown")) {
    localRows.push("ID=unknown | titel=Ukendt affald");
  }

  return localRows.join("\n");
}

function buildImageClassificationPrompt() {
  const localFractionCatalog = buildLocalImageFractionCatalog();
  const fractionCatalog = localFractionCatalog || buildImageFractionCatalog();
  const siteContext = localFractionCatalog && selectedSite
    ? `Den valgte genbrugsplads er ${selectedSite.name}. Vaelg kun blandt de fraktioner, containere og lokale placeringer, der findes paa denne plads.`
    : "Der er ikke valgt en genbrugsplads med lokale containerdata, saa vaelg den bedste piktogram-fraktion fra standardkataloget.";

  return `Klassificer det primaere affaldsobjekt paa billedet.

${siteContext}

Tilgaengelige fraktioner:
${fractionCatalog}

Svar kun med JSON:
{"name":"kort navn paa objektet","fractionId":"eksakt id fra kataloget","confidence":0.9,"tip":"kort praktisk tip"}

Regler:
- fractionId skal vaere den rae ID-vaerdi efter "ID=" i kataloget.
- fractionId maa aldrig vaere placeringstekst, containernavn, "Container - ...", titel, label eller oversaettelse.
- Eksempel: Hvis kataloget har "ID=batterier | titel=Batterier | lokal placering=Container - Batterier", skal svaret vaere "fractionId":"batterier".
- Eksempel: Hvis kataloget har "ID=farligt-affald | titel=Farligt affald | lokal placering=Container - Farligt affald", skal svaret vaere "fractionId":"farligt-affald".
- Hvis der er lokale containerdata, maa du kun bruge en fraktion fra listen for den valgte genbrugsplads.
- Vaelg den naermeste lokale fraktion/container, ogsa hvis objektet ikke er perfekt.
- Brug kun "unknown", hvis billedet ikke viser et affaldsobjekt.
- Kun et objekt. Ingen array. Ingen markdown.`;
}

function getFractionForContainer(category) {
  const container = containerCatalog[category];
  const fraction = wasteTypes.find((item) => item.id === container?.fractionId);
  return { container, fraction };
}

function getFractionByIdOrAlias(fractionId) {
  const normalizedId = normalizeClassificationToken(fractionId);
  return wasteTypes.find((item) => item.id === fractionId || normalizeClassificationToken(item.id) === normalizedId)
    || wasteTypes.find((item) => (layoutFractionAliases[item.id] || []).some((alias) => normalizeClassificationToken(alias) === normalizedId))
    || null;
}

function findFractionByClassification(result) {
  const requestedId = String(result.fractionId || result.fraction_id || result.id || "").trim();
  if (requestedId) {
    const directMatch = getFractionByIdOrAlias(requestedId);
    if (directMatch) return directMatch;
  }

  const category = String(result.category || "").trim();
  if (category) {
    const { fraction } = getFractionForContainer(category);
    if (fraction) return fraction;
  }

  const name = normalizeClassificationToken(result.name);
  if (!name) return null;
  return wasteTypes.find((item) => {
    const title = normalizeClassificationToken(item.title);
    const keywords = (item.keywords || []).map(normalizeClassificationToken);
    return title === name || item.id === name || keywords.includes(name);
  }) || null;
}

function normalizeConfidencePercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  const ratio = number > 1 ? number / 100 : number;
  return Math.round(Math.max(0, Math.min(1, ratio)) * 100);
}

function buildMatchFromClassification(result) {
  const requestedId = String(result.fractionId || result.fraction_id || result.id || "").trim();
  const localContainer = selectedSite?.map?.[requestedId] || null;
  const localContainerLabel = containerCatalog[requestedId]?.label || localContainer?.location || requestedId;
  const fraction = findFractionByClassification(result);
  if (localContainer && !fraction) {
    const confidenceValue = normalizeConfidencePercent(result.confidence);
    const name = String(result.name || localContainerLabel).trim();
    const tip = String(result.tip || "").trim();
    return {
      id: requestedId,
      title: localContainerLabel,
      text: `${name}. Afleveres som ${localContainerLabel}.${tip ? ` Tip: ${tip}` : ""}`,
      pictogram: "assets/pictograms/unknown.svg",
      color: "#0b5f4a",
      confidence: confidenceValue,
      keywords: [localContainerLabel],
      webQueries: [`${localContainerLabel} affald`]
    };
  }
  if (!fraction) {
    const candidate = requestedId || result.category || result.name || "tom";
    throw new Error(`Ukendt piktogramfraktion: ${candidate}`);
  }

  const confidenceValue = normalizeConfidencePercent(result.confidence);
  const name = String(result.name || fraction.title).trim();
  const tip = String(result.tip || "").trim();
  return {
    id: fraction.id,
    title: fraction.title,
    text: `${name}. ${fraction.text}${tip ? ` Tip: ${tip}` : ""}`,
    pictogram: fraction.pictogram || "assets/pictograms/unknown.svg",
    color: "#0b5f4a",
    confidence: confidenceValue,
    keywords: fraction.keywords || [fraction.title],
    webQueries: fraction.webQueries || [`${fraction.title} waste recycling`]
  };
}

async function classifyWasteImage(jpegDataUrl) {
  if (!getActiveApiKey()) {
    throw new Error("MISSING_API_KEY");
  }
  if (wasteTypes.length === 0) {
    await loadWasteFractionCatalog();
  }
  if (wasteTypes.length === 0) {
    throw new Error("Fraktionskataloget med piktogrammer kunne ikke indlaeses.");
  }

  resultFractionLabel.textContent = "Der ledes efter affald";
  if (imageRecognitionProvider === "openai") {
    return classifyWasteImageWithOpenAi(jpegDataUrl);
  }

  return classifyWasteImageWithAnthropic(jpegDataUrl);
}

async function classifyWasteImageWithAnthropic(jpegDataUrl) {
  const apiKey = getAnthropicApiKey();
  const response = await fetch(anthropicMessagesEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: anthropicModel,
      max_tokens: 400,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: dataUrlToBase64(jpegDataUrl)
              }
            },
            {
              type: "text",
              text: buildImageClassificationPrompt()
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Anthropic API svarede ${response.status}: ${detail.slice(0, 220)}`);
  }

  resultFractionLabel.textContent = "Affald fundet";
  return parseAnthropicJson(await response.json());
}

async function classifyWasteImageWithOpenAi(jpegDataUrl) {
  const response = await fetch(openAiResponsesEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${getOpenAiApiKey()}`
    },
    body: JSON.stringify({
      model: openAiModel,
      max_output_tokens: 400,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildImageClassificationPrompt()
            },
            {
              type: "input_image",
              image_url: jpegDataUrl,
              detail: "low"
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI API svarede ${response.status}: ${detail.slice(0, 220)}`);
  }

  resultFractionLabel.textContent = "Affald fundet";
  return parseOpenAiJson(await response.json());
}

async function analyzeSelectedImage(src, fileName = "billede") {
  const requestId = ++imageAnalysisRequest;
  latestImageName = fileName;
  setImageLoading(true);
  resultTitle.textContent = "Der ledes efter affald";
  resultFractionLabel.textContent = "Der ledes efter affald";
  resultText.textContent = "Billedet undersøges for at finde den bedste piktogramfraktion.";

  try {
    const jpegDataUrl = await compressImageToJpegDataUrl(src);
    if (requestId !== imageAnalysisRequest) return;
    showPreview(jpegDataUrl);
    const classification = await classifyWasteImage(jpegDataUrl);
    if (requestId !== imageAnalysisRequest) return;
    const match = buildMatchFromClassification(classification);
    setResult(match, "Billedgenkendelse");
  } catch (error) {
    if (requestId !== imageAnalysisRequest) return;
    setFallbackResult();
    resultTitle.textContent = "Billedgenkendelse fejlede";
    resultFractionLabel.textContent = "Ingen container valgt";
    resultText.textContent = error.message === "MISSING_API_KEY"
      ? "Billedgenkendelse er ikke konfigureret på denne enhed."
      : `Kunne ikke analysere billedet lige nu. ${error.message}`;
  } finally {
    if (requestId === imageAnalysisRequest) {
      setImageLoading(false);
    }
  }
}

function inferWasteTypeFromFilename(fileName) {
  const normalized = fileName.toLowerCase();
  return wasteTypes.find((item) =>
    item.keywords.some((keyword) => normalized.includes(keyword))
  );
}

function simulateImageAnalysis(fileName = "") {
  const inferredMatch = inferWasteTypeFromFilename(fileName);
  if (inferredMatch) {
    setResult(inferredMatch, "AI + webforslag");
    return;
  }

  const likelyMatches = wasteTypes.filter((item) => item.confidence >= 82);
  const match = likelyMatches[Math.floor(Math.random() * likelyMatches.length)];
  setResult(match, "AI + webforslag");
}

function showPreview(src) {
  preview.src = src;
  preview.hidden = false;
  camera.hidden = true;
  emptyState.hidden = true;
}

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    camera.srcObject = stream;
    camera.hidden = false;
    preview.hidden = true;
    emptyState.hidden = true;
    captureButton.disabled = false;
    startButton.textContent = "Kamera aktivt";
  } catch (error) {
    resultTitle.textContent = "Kamera kunne ikke startes";
    resultText.textContent = "Vælg et billede i stedet, eller giv browseren adgang til kameraet.";
  }
}

function capturePhoto() {
  if (!stream) return;
  canvas.width = camera.videoWidth || 1280;
  canvas.height = camera.videoHeight || 720;
  canvas.getContext("2d").drawImage(camera, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  showPreview(dataUrl);
  analyzeSelectedImage(dataUrl, "kamera");
}

async function handleImageFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    resultTitle.textContent = "Filen er ikke et billede";
    resultText.textContent = "Vælg eller slip en billedfil, så starter analysen automatisk.";
    return;
  }

  const dataUrl = await readFileAsDataUrl(file);
  showPreview(dataUrl);
  analyzeSelectedImage(dataUrl, file.name || "billede");
}

function handleImageSelection(event) {
  const [file] = event.target.files;
  handleImageFile(file);
  event.target.value = "";
}

function renderSuggestions(items) {
  suggestions.innerHTML = "";
  items.forEach((item) => {
    const suggestion = document.createElement("li");
    const pictogram = document.createElement("img");
    pictogram.className = "suggestion-pictogram";
    pictogram.src = item.pictogram || "assets/pictograms/unknown.svg";
    pictogram.alt = `Piktogram for ${item.title}`;
    pictogram.onerror = () => {
      pictogram.src = "assets/pictograms/unknown.svg";
    };
    const textWrap = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = item.title;
    const description = document.createElement("span");
    description.textContent = item.text;
    textWrap.append(title, description);
    suggestion.append(pictogram, textWrap);
    suggestions.append(suggestion);
  });
}

function rememberWasteSearch(item) {
  recentWasteSearches = [
    item,
    ...recentWasteSearches.filter((recent) => recent.id !== item.id)
  ].slice(0, 3);
  renderRecentWasteSearches();
}

function renderRecentWasteSearches() {
  renderSuggestions(recentWasteSearches);
}

function getWasteMatches(query, limit = Infinity) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return wasteTypes.slice(0, limit);

  return wasteTypes
    .filter((item) =>
      item.keywords.some((keyword) => keyword.includes(normalized) || normalized.includes(keyword)) ||
      item.title.toLowerCase().includes(normalized)
    )
    .slice(0, limit);
}

function selectWasteFraction(item, source = "Manuel søgning") {
  wasteSearch.value = item.title;
  searchDropdown.hidden = true;
  rememberWasteSearch(item);
  setResult(item, source);
}

function renderSearchDropdown(query) {
  const matches = getWasteMatches(query, 8);
  searchDropdown.innerHTML = "";
  if (matches.length === 0 || !query.trim()) {
    searchDropdown.hidden = true;
    return;
  }

  matches.forEach((item) => {
    const option = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    const pictogram = document.createElement("img");
    pictogram.src = item.pictogram || "assets/pictograms/unknown.svg";
    pictogram.alt = "";
    pictogram.onerror = () => {
      pictogram.src = "assets/pictograms/unknown.svg";
    };
    const title = document.createElement("span");
    title.textContent = item.title;
    button.append(pictogram, title);
    button.addEventListener("click", () => selectWasteFraction(item, "Valgt forslag"));
    option.append(button);
    searchDropdown.append(option);
  });

  searchDropdown.hidden = false;
}

function searchWaste(event) {
  event.preventDefault();
  const query = wasteSearch.value.trim().toLowerCase();
  if (!query) {
    renderRecentWasteSearches();
    searchDropdown.hidden = true;
    return;
  }

  const matches = getWasteMatches(query);

  if (matches.length === 0) {
    renderSuggestions([{
      title: "Ingen sikker match",
      text: "Prøv et andet ord, eller spørg personalet på genbrugspladsen.",
      tone: "special"
    }]);
    setFallbackResult();
    return;
  }

  selectWasteFraction(matches[0]);
}

function updateAndroidStatus() {
  const isSecure = window.isSecureContext;
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (isStandalone) {
    androidStatus.textContent = "Appen kører som installeret Android-app.";
    return;
  }

  if (!isSecure) {
    androidStatus.textContent = "Åbn appen via HTTPS for at bruge kamera, placering og Android-installation.";
    return;
  }

  androidStatus.textContent = "Android er klar. Brug Chrome-menuen eller knappen her, når installation tilbydes.";
}

function hasImageFile(dataTransfer) {
  return [...(dataTransfer?.items || [])].some((item) => item.kind === "file" && item.type.startsWith("image/"));
}

function showDropOverlay() {
  dropOverlay.hidden = false;
}

function hideDropOverlay() {
  dragDepth = 0;
  dropOverlay.hidden = true;
}

function handleDragEnter(event) {
  if (!hasImageFile(event.dataTransfer)) return;
  event.preventDefault();
  dragDepth += 1;
  showDropOverlay();
}

function handleDragOver(event) {
  if (!hasImageFile(event.dataTransfer)) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
}

function handleDragLeave(event) {
  if (!hasImageFile(event.dataTransfer)) return;
  event.preventDefault();
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) {
    dropOverlay.hidden = true;
  }
}

function handleDrop(event) {
  if (!hasImageFile(event.dataTransfer)) return;
  event.preventDefault();
  const file = [...event.dataTransfer.files].find((item) => item.type.startsWith("image/"));
  hideDropOverlay();
  handleImageFile(file);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:" || location.hostname === "localhost" || location.hostname === "127.0.0.1") {
    navigator.serviceWorker?.getRegistrations?.().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
    return;
  }

  navigator.serviceWorker.register("./service-worker.js").catch(() => {
    androidStatus.textContent = "Service worker kunne ikke registreres. Appen virker stadig i browseren.";
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installAndroidButton.hidden = false;
  androidStatus.textContent = "Appen kan installeres på Android.";
});

installAndroidButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installAndroidButton.hidden = true;
  updateAndroidStatus();
});

findSiteButton.addEventListener("click", requestLocation);
municipalitySelect.addEventListener("change", () => {
  selectedSite = null;
  selectedDistance = null;
  populateSites(municipalitySelect.value);
  siteSelect.value = "";
  selectedSiteName.textContent = "Ikke valgt";
  selectedSiteDistance.textContent = "-";
  if (municipalitySelect.value) {
    const siteCount = (sitesByMunicipality.get(municipalitySelect.value) || []).length;
    siteStatus.textContent = siteCount > 0
      ? `Kommune valgt: ${municipalitySelect.value}. Vælg genbrugsplads i feltet Vælg.`
      : `Kommune valgt: ${municipalitySelect.value}. Genbrugspladser hentes fra landsdata i baggrunden.`;
    loadSitesForSelectedMunicipality(municipalitySelect.value);
  } else {
    municipalitySelectionRequest += 1;
    siteStatus.textContent = findSiteHelpText;
  }
});
siteSelect.addEventListener("change", () => {
  if (!siteSelect.value) return;
  const site = recyclingSites.find((item) => item.id === siteSelect.value);
  setSelectedSite(site, null, "Manuelt valgt genbrugsplads.");
});
showSiteMapButton.addEventListener("click", openSelectedSiteMap);
closeSiteMapButton.addEventListener("click", closeSelectedSiteMap);
startButton.addEventListener("click", startCamera);
captureButton.addEventListener("click", capturePhoto);
imageInput.addEventListener("change", handleImageSelection);
anthropicApiKeyInput.addEventListener("input", () => {
  setStoredActiveApiKey(anthropicApiKeyInput.value.trim());
  updateApiKeyStatus();
});
clearApiKeyButton.addEventListener("click", () => {
  anthropicApiKeyInput.value = "";
  setStoredActiveApiKey("");
  updateApiKeyStatus();
});
window.addEventListener("dragenter", handleDragEnter);
window.addEventListener("dragover", handleDragOver);
window.addEventListener("dragleave", handleDragLeave);
window.addEventListener("drop", handleDrop);
searchForm.addEventListener("submit", searchWaste);
wasteSearch.addEventListener("input", () => renderSearchDropdown(wasteSearch.value));
wasteSearch.addEventListener("focus", () => renderSearchDropdown(wasteSearch.value));
wasteSearch.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    searchDropdown.hidden = true;
  }
});
document.addEventListener("click", (event) => {
  if (!searchForm.contains(event.target)) {
    searchDropdown.hidden = true;
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !siteMapModal.hidden) {
    closeSelectedSiteMap();
  }
});
buildSiteIndex();
initializeApiKeyInput();
populateMunicipalities();
populateSites();
selectedSiteName.textContent = "Ikke valgt";
selectedSiteDistance.textContent = "-";
siteStatus.textContent = findSiteHelpText;
renderRecentWasteSearches();
loadWasteFractionCatalog();
loadBundledNationalSites();
loadSiteLayouts();
loadAllDanishRecyclingSites();
updateAndroidStatus();
registerServiceWorker();
