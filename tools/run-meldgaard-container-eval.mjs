import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const model = process.argv[2] || "claude-haiku-4-5-20251001";
const evalPath = "data/billund-meldgaard-container-eval.json";
const layoutsPath = "data/site-layouts.json";
const configPath = "config.js";
const endpoint = "https://api.anthropic.com/v1/messages";

function readApiKey() {
  const config = fs.readFileSync(configPath, "utf8");
  const match = config.match(/anthropicApiKey:\s*["']([^"']+)["']/);
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

function parseJsonResponse(data) {
  const text = data.content?.map((part) => part.text || "").join("") || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

function buildContainerCatalog(map) {
  return Object.entries(map)
    .map(([id, value]) => `${id}: ${value.location}`)
    .join("\n");
}

function buildPrompt(siteName, containerCatalog) {
  return `Klassificer det primaere affaldsobjekt paa billedet og vaelg den bedste container paa ${siteName}.

Aktuelle containere:
${containerCatalog}

Svar kun med JSON:
{"name":"kort navn paa objektet","containerId":"eksakt id fra listen","confidence":0.9,"tip":"kort praktisk tip"}

Regler:
- containerId skal vaere et eksakt id fra listen.
- Vaelg kun blandt de aktuelle containere.
- Klassificer materialet og affaldsobjektet, ikke baggrund eller tidligere indhold.
- Tom emballage sorteres normalt efter materialet; madrester er madaffald.
- Hvis der er flere materialer, vaelg den mest relevante afleveringscontainer paa genbrugspladsen.
- Brug ikke "unknown", medmindre billedet ikke viser affald.`;
}

async function classify({ apiKey, prompt, item }) {
  const imageFile = evalImagePath(item.file);
  const image = fs.readFileSync(imageFile).toString("base64");
  const started = performance.now();
  const response = await fetch(endpoint, {
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
  const latencyMs = Math.round(performance.now() - started);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`HTTP ${response.status}: ${detail.slice(0, 500)}`);
  }
  return { imageFile, latencyMs, result: parseJsonResponse(await response.json()) };
}

const apiKey = readApiKey();
if (!apiKey) throw new Error("Missing Anthropic API key in config.js");

const evalData = JSON.parse(fs.readFileSync(evalPath, "utf8"));
const layouts = JSON.parse(fs.readFileSync(layoutsPath, "utf8"));
const site = layouts.find((layout) => layout.siteId === evalData.siteId);
if (!site) throw new Error(`Missing site layout: ${evalData.siteId}`);

const prompt = buildPrompt(evalData.siteName, buildContainerCatalog(site.map));
const runnable = evalData.items.filter((item) => item.expectedContainerId);
const skipped = evalData.items.filter((item) => item.skipReason);
const results = [];

for (const [index, item] of runnable.entries()) {
  process.stdout.write(`[${index + 1}/${runnable.length}] ${item.label} ... `);
  try {
    const { imageFile, latencyMs, result } = await classify({ apiKey, prompt, item });
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
      tip: result.tip || ""
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
  mode: "direct",
  model,
  siteId: evalData.siteId,
  siteName: evalData.siteName,
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
const reportPath = `reports/meldgaard-container-eval-direct-${model}-${timestamp}.json`;
fs.writeFileSync(reportPath, JSON.stringify({ summary, results }, null, 2));

console.log(JSON.stringify({ summary, reportPath }, null, 2));
