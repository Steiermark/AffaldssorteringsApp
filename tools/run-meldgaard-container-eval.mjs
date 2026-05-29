import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const provider = process.argv[2] || "anthropic";
const model = process.argv[3] || (provider === "openai" ? "gpt-4.1-mini" : "claude-haiku-4-5-20251001");
const mode = process.argv[4] || "direct";
const evalPath = process.argv[5] || "data/billund-meldgaard-container-eval.json";
const layoutsPath = "data/site-layouts.json";
const fractionsPath = "data/fractions.js";
const sortingRulesPath = "data/kredslob-sorting-rules.json";
const configPath = "config.js";
const anthropicEndpoint = "https://api.anthropic.com/v1/messages";
const openAiEndpoint = "https://api.openai.com/v1/responses";

function readApiKey() {
  const config = fs.readFileSync(configPath, "utf8");
  const keyName = provider === "openai" ? "openAiApiKey" : "anthropicApiKey";
  const match = config.match(new RegExp(`${keyName}:\\s*["']([^"']+)["']`));
  return match?.[1] || "";
}

function mediaType(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function evalImagePath(file) {
  const parsed = path.parse(file);
  const base = parsed.name.replace(/-scaled$/, "");
  const candidates = [
    path.join(parsed.dir, `${base}-800x600${parsed.ext}`),
    path.join(parsed.dir, `${base}-600x450${parsed.ext}`),
    path.join(parsed.dir, `${base}-400x300${parsed.ext}`),
    path.join(parsed.dir, `${base}-200x150${parsed.ext}`)
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || file;
}

function parseAnthropicJsonResponse(data) {
  const text = data.content?.map((part) => part.text || "").join("") || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

function parseOpenAiJsonResponse(data) {
  const text = data.output_text
    || data.output?.flatMap((item) => item.content || []).map((content) => content.text || "").join("")
    || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

const layoutFractionAliases = {
  elpaerer: ["lyskilder", "lysstofroer"],
  "farligt-affald": ["spraydaaser"],
  flamingo: ["eps"],
  genbrug: ["direkte-genbrug"],
  glas: ["flasker-og-glas"],
  "haardt-plast": ["haard-plast"],
  "haardt-pvc": ["pvc"],
  "indendoers-trae": ["rent-trae", "trae-til-genbrug"],
  koeleudstyr: ["koel-og-frys"],
  lysstofroer: ["lyskilder"],
  "mad-og-drikkekartoner": ["kartoner"],
  metal: ["jern-og-metal"],
  "mursten-og-tegl": ["murbrokker"],
  "klar-bloed-plast": ["plastfolie"],
  pap: ["pap-og-karton"],
  plast: ["plastemballage", "pmdk"],
  plasthavemoebler: ["havemoebler", "plastmoebler"],
  "polstrede-moebler": ["stort-braendbart", "smaat-braendbart"],
  storskrald: ["stort-braendbart", "smaat-braendbart", "rest-efter-sortering"],
  "stort-elektronik": ["haarde-hvidevarer"],
  tekstilaffald: ["tekstil"],
  toej: ["tekstilaffald"],
  "udendoers-trae": ["impraegneret-trae"],
  vinduer: ["glasdoere", "vinduer-og-glasdoere"]
};

function normalizeId(id) {
  return id.toLowerCase()
    .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
    .replace(/\s+/g, "-");
}

function resolveToContainerId(fractionId, siteMap) {
  const normalized = normalizeId(fractionId);
  if (siteMap[normalized]) return normalized;
  if (siteMap[fractionId]) return fractionId;
  for (const alias of (layoutFractionAliases[normalized] || layoutFractionAliases[fractionId] || [])) {
    if (siteMap[alias]) return alias;
  }
  return normalized;
}

function getLocalFractionLocation(site, fractionId) {
  if (!site?.map) return null;
  if (site.map[fractionId]) return site.map[fractionId];
  for (const alias of (layoutFractionAliases[fractionId] || [])) {
    if (site.map[alias]) return site.map[alias];
  }
  return null;
}

function buildLocalFractionCatalog(site, wasteTypes) {
  const rows = wasteTypes
    .map((item) => {
      const local = getLocalFractionLocation(site, item.id);
      if (!local) return null;
      const keywords = (item.keywords || []).filter(Boolean).slice(0, 6).join(", ");
      return [
        `ID=${item.id}`,
        `titel=${item.title}`,
        keywords ? `soegeord: ${keywords}` : "",
        local.location ? `lokal placering: ${local.location}` : ""
      ].filter(Boolean).join(" | ");
    })
    .filter(Boolean)
    .slice(0, 90);
  if (wasteTypes.some((item) => item.id === "unknown")) {
    rows.push("ID=unknown | titel=Ukendt affald");
  }
  return rows.join("\n");
}

function buildPrompt(siteName, fractionCatalog) {
  return `Klassificer det primaere affaldsobjekt paa billedet.

Den valgte genbrugsplads er ${siteName}. Vaelg kun blandt de fraktioner, containere og lokale placeringer, der findes paa denne plads.

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

function buildVisionPrompt() {
  return `Identificer det primaere affaldsobjekt paa billedet.

Svar kun med JSON:
{"object":"kort dansk navn","materials":["materiale"],"hazards":["risiko"],"isPackaging":false,"isConstructionWaste":false,"confidence":0.9}

Regler:
- Beskriv objektet og materialerne, ikke containeren.
- Brug korte danske ord.
- Ingen markdown.`;
}

function buildResolvePrompt(siteName, containerCatalog, vision) {
  const rulesCatalog = mode.includes("rules") ? buildSortingRulesCatalog() : "";
  return `Vaelg den bedste lokale container paa ${siteName} ud fra objektbeskrivelsen og de aktuelle containere.

Objektbeskrivelse:
${JSON.stringify(vision)}

Aktuelle containere:
${containerCatalog}

${rulesCatalog ? `Officielle sorteringseksempler:\n${rulesCatalog}\n` : ""}

Svar kun med JSON:
{"containerId":"eksakt id fra listen","confidence":0.9,"tip":"kort praktisk tip"}

Regler:
- containerId skal vaere den rae ID-vaerdi efter "ID=" i listen.
- containerId maa aldrig vaere placeringstekst, containernavn, "Container - ...", titel, label eller oversaettelse.
- Vaelg kun blandt de aktuelle containere.
- Vaelg den smalleste relevante lokale fraktion, naar en specialfraktion passer tydeligt.
- Hvis specialfraktionen kun passer ved en bestemt type, og objektbeskrivelsen er mere generel, vaelg den generelle fraktion.
- Farligt affald, batterier, lyskilder, maling, spraydaaser og kemikalier maa ikke vaelges som rest, plast eller metal, hvis en relevant sikkerhedsfraktion findes.
- Glasflasker/emballage er glas; vinduesglas, autoglas og fladt glas er ikke flaskeglas.
- Imprægneret, behandlet eller jernbane-trae er ikke almindeligt trae.
- Brug ikke "unknown", medmindre objektbeskrivelsen ikke beskriver affald.`;
}

function buildSortingRulesCatalog() {
  if (!fs.existsSync(sortingRulesPath)) return "";
  const data = JSON.parse(fs.readFileSync(sortingRulesPath, "utf8").replace(/^\uFEFF/, ""));
  return (data.rules || [])
    .map((rule) => {
      const yes = (rule.yes || []).slice(0, 8).join(", ");
      const no = (rule.no || []).slice(0, 5).join(", ");
      return `ID=${rule.id} | titel=${rule.title} | ja tak: ${yes}${no ? ` | nej tak: ${no}` : ""}`;
    })
    .join("\n");
}

async function classify({ apiKey, prompt, item }) {
  const imageFile = evalImagePath(item.file);
  const image = fs.readFileSync(imageFile).toString("base64");
  const started = performance.now();
  const response = provider === "openai"
    ? await classifyOpenAi({ apiKey, prompt, imageFile, image })
    : await classifyAnthropic({ apiKey, prompt, imageFile, image });
  const latencyMs = Math.round(performance.now() - started);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`HTTP ${response.status}: ${detail.slice(0, 500)}`);
  }
  const data = await response.json();
  const result = provider === "openai" ? parseOpenAiJsonResponse(data) : parseAnthropicJsonResponse(data);
  return { imageFile, latencyMs, result };
}

async function classifyResolved({ apiKey, directPrompt, containerCatalog, item }) {
  const imageFile = evalImagePath(item.file);
  const image = fs.readFileSync(imageFile).toString("base64");
  const started = performance.now();
  const visionResponse = provider === "openai"
    ? await classifyOpenAi({ apiKey, prompt: buildVisionPrompt(), imageFile, image })
    : await classifyAnthropic({ apiKey, prompt: buildVisionPrompt(), imageFile, image });
  if (!visionResponse.ok) {
    const detail = await visionResponse.text();
    throw new Error(`Vision HTTP ${visionResponse.status}: ${detail.slice(0, 500)}`);
  }
  const visionData = await visionResponse.json();
  const vision = provider === "openai" ? parseOpenAiJsonResponse(visionData) : parseAnthropicJsonResponse(visionData);
  const resolvePrompt = buildResolvePrompt(evalData.siteName, containerCatalog, vision);
  const resolveResponse = provider === "openai"
    ? await classifyOpenAiText({ apiKey, prompt: resolvePrompt })
    : await classifyAnthropicText({ apiKey, prompt: resolvePrompt });
  const latencyMs = Math.round(performance.now() - started);
  if (!resolveResponse.ok) {
    const detail = await resolveResponse.text();
    throw new Error(`Resolve HTTP ${resolveResponse.status}: ${detail.slice(0, 500)}`);
  }
  const resolveData = await resolveResponse.json();
  const result = provider === "openai" ? parseOpenAiJsonResponse(resolveData) : parseAnthropicJsonResponse(resolveData);
  return {
    imageFile,
    latencyMs,
    result: {
      ...result,
      name: result.name || vision.object || "",
      vision
    }
  };
}

async function classifyAnthropic({ apiKey, prompt, imageFile, image }) {
  return fetch(anthropicEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType(imageFile),
              data: image
            }
          },
          { type: "text", text: prompt }
        ]
      }]
    })
  });
}

async function classifyAnthropicText({ apiKey, prompt }) {
  return fetch(anthropicEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [{
        role: "user",
        content: [{ type: "text", text: prompt }]
      }]
    })
  });
}

async function classifyOpenAi({ apiKey, prompt, imageFile, image }) {
  return fetch(openAiEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_output_tokens: 300,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: `data:${mediaType(imageFile)};base64,${image}`, detail: "low" }
        ]
      }]
    })
  });
}

async function classifyOpenAiText({ apiKey, prompt }) {
  return fetch(openAiEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      max_output_tokens: 300,
      input: [{
        role: "user",
        content: [{ type: "input_text", text: prompt }]
      }]
    })
  });
}

const apiKey = readApiKey();
if (!apiKey) throw new Error(`Missing ${provider} API key in config.js`);

const fractionsGlobal = {};
eval(fs.readFileSync(fractionsPath, "utf8").replace(/window\./g, "fractionsGlobal."));
const wasteTypes = fractionsGlobal.generatedWasteFractions || [];
if (wasteTypes.length === 0) throw new Error(`No waste types loaded from ${fractionsPath}`);

const rawEvalData = JSON.parse(fs.readFileSync(evalPath, "utf8"));
const evalData = Array.isArray(rawEvalData)
  ? { siteId: "mit-affald-billund-kommune-billund-genbrugsplads-havremarken-8-7190-billund", siteName: "Billund Genbrugsplads", items: rawEvalData }
  : {
      siteId: rawEvalData.siteId || "mit-affald-billund-kommune-billund-genbrugsplads-havremarken-8-7190-billund",
      siteName: rawEvalData.siteName || "Billund Genbrugsplads",
      items: rawEvalData.items || []
    };
const layouts = JSON.parse(fs.readFileSync(layoutsPath, "utf8"));
const site = layouts.find((layout) => layout.siteId === evalData.siteId);
if (!site) throw new Error(`Missing site layout: ${evalData.siteId}`);

const fractionCatalog = buildLocalFractionCatalog(site, wasteTypes);
const prompt = buildPrompt(evalData.siteName, fractionCatalog);
const runnable = evalData.items.filter((item) => item.expectedContainerId);
const skipped = evalData.items.filter((item) => item.skipReason);
const results = [];

for (const [index, item] of runnable.entries()) {
  process.stdout.write(`[${index + 1}/${runnable.length}] ${item.label} ... `);
  try {
    const { imageFile, latencyMs, result } = mode.startsWith("resolved")
      ? await classifyResolved({ apiKey, directPrompt: prompt, containerCatalog: fractionCatalog, item })
      : await classify({ apiKey, prompt, item });
    const rawId = String(result.fractionId || result.containerId || result.id || "").trim();
    const predicted = resolveToContainerId(rawId, site.map);
    const confidence = Number(result.confidence);
    const confidencePercent = Number.isFinite(confidence)
      ? Math.round((confidence > 1 ? confidence / 100 : confidence) * 100)
      : 0;
    const correct = predicted === item.expectedContainerId;
    results.push({
      file: item.file,
      imageFile,
      label: item.label,
      expectedContainerId: item.expectedContainerId,
      predictedContainerId: predicted,
      objectName: result.name || "",
      confidencePercent,
      latencyMs,
      correct,
      tip: result.tip || "",
      vision: result.vision || null
    });
    process.stdout.write(`${correct ? "ok" : "wrong"} ${predicted} ${latencyMs}ms\n`);
  } catch (error) {
    results.push({
      file: item.file,
      label: item.label,
      expectedContainerId: item.expectedContainerId,
      error: error.message,
      correct: false
    });
    process.stdout.write(`error ${error.message}\n`);
  }
}

const latencies = results.filter((item) => Number.isFinite(item.latencyMs)).map((item) => item.latencyMs);
const confidences = results.filter((item) => Number.isFinite(item.confidencePercent)).map((item) => item.confidencePercent);
const completed = results.filter((item) => !item.error).length;
const correct = results.filter((item) => item.correct).length;
const summary = {
  mode,
  provider,
  model,
  siteId: evalData.siteId,
  siteName: evalData.siteName,
  evalPath,
  total: results.length,
  completed,
  errors: results.length - completed,
  correct,
  accuracyPercent: completed ? Math.round((correct / completed) * 100) : 0,
  averageLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
  averageConfidencePercent: confidences.length ? Math.round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length) : null,
  skipped: skipped.map((item) => ({ file: item.file, label: item.label, reason: item.skipReason }))
};

fs.mkdirSync("reports", { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = `reports/meldgaard-container-eval-${mode}-${provider}-${model}-${timestamp}.json`;
fs.writeFileSync(reportPath, JSON.stringify({ summary, results }, null, 2));

console.log(JSON.stringify({ summary, reportPath }, null, 2));
