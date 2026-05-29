import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const provider = process.argv[2] || "anthropic";
const model = process.argv[3] || (provider === "openai" ? "gpt-4.1-mini" : "claude-haiku-4-5-20251001");
const mode = process.argv[4] || "direct";
const evalPath = process.argv[5] || "data/billund-meldgaard-container-eval.json";
const layoutsPath = "data/site-layouts.json";
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

function buildContainerCatalog(map) {
  return Object.entries(map)
    .map(([id, value]) => `ID=${id} | placering=${value.location}`)
    .join("\n");
}

function buildPrompt(siteName, containerCatalog) {
  return `Klassificer det primaere affaldsobjekt paa billedet og vaelg den bedste container paa ${siteName}.

Aktuelle containere:
${containerCatalog}

Svar kun med JSON:
{"name":"kort navn paa objektet","containerId":"eksakt id fra listen","confidence":0.9,"tip":"kort praktisk tip"}

Regler:
- containerId skal vaere den rae ID-vaerdi efter "ID=" i listen.
- containerId maa aldrig vaere placeringstekst, containernavn, "Container - ...", titel, label eller oversaettelse.
- Eksempel: Hvis listen har "ID=batterier | placering=Container - Batterier", skal svaret vaere "containerId":"batterier".
- Eksempel: Hvis listen har "ID=farligt-affald | placering=Container - Farligt affald", skal svaret vaere "containerId":"farligt-affald".
- Vaelg kun blandt de aktuelle containere.
- Klassificer materialet og affaldsobjektet, ikke baggrund eller tidligere indhold.
- Tom emballage sorteres normalt efter materialet; madrester er madaffald.
- Hvis der er flere materialer, vaelg den mest relevante afleveringscontainer paa genbrugspladsen.
- Brug ikke "unknown", medmindre billedet ikke viser affald.`;
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

const containerCatalog = buildContainerCatalog(site.map);
const prompt = buildPrompt(evalData.siteName, containerCatalog);
const runnable = evalData.items.filter((item) => item.expectedContainerId);
const skipped = evalData.items.filter((item) => item.skipReason);
const results = [];

for (const [index, item] of runnable.entries()) {
  process.stdout.write(`[${index + 1}/${runnable.length}] ${item.label} ... `);
  try {
    const { imageFile, latencyMs, result } = mode.startsWith("resolved")
      ? await classifyResolved({ apiKey, directPrompt: prompt, containerCatalog, item })
      : await classify({ apiKey, prompt, item });
    const predicted = String(result.containerId || result.fractionId || result.id || "").trim();
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
