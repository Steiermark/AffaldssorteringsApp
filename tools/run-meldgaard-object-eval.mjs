import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const model = process.argv[2] || "claude-haiku-4-5-20251001";
const evalPath = "data/meldgaard-object-eval.json";
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

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa");
}

function parseJsonResponse(data) {
  const text = data.content?.map((part) => part.text || "").join("") || "";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

function buildPrompt() {
  return `Identificer det primaere affaldsobjekt paa billedet.

Svar kun med JSON:
{"object":"kort dansk navn","materials":["materiale"],"visualKeywords":["noegleord"],"confidence":0.9}

Regler:
- Beskriv objektet, ikke containeren.
- Brug korte danske ord.
- Ingen markdown.`;
}

async function classify({ apiKey, item }) {
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
      max_tokens: 220,
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
          { type: "text", text: buildPrompt() }
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

const items = JSON.parse(fs.readFileSync(evalPath, "utf8"));
const results = [];

for (const [index, item] of items.entries()) {
  process.stdout.write(`[${index + 1}/${items.length}] ${item.label} ... `);
  try {
    const { imageFile, latencyMs, result } = await classify({ apiKey, item });
    const observed = normalize([
      result.object,
      ...(result.materials || []),
      ...(result.visualKeywords || [])
    ].join(" "));
    const matchedTerm = item.expectedTerms.find((term) => observed.includes(normalize(term)));
    const correct = Boolean(matchedTerm);
    const confidence = Number(result.confidence);
    const confidencePercent = Number.isFinite(confidence)
      ? Math.round((confidence > 1 ? confidence / 100 : confidence) * 100)
      : 0;
    results.push({
      file: item.file,
      imageFile,
      label: item.label,
      expectedTerms: item.expectedTerms,
      matchedTerm: matchedTerm || "",
      objectInfo: result,
      confidencePercent,
      latencyMs,
      correct
    });
    process.stdout.write(`${correct ? "ok" : "wrong"} ${result.object || ""} ${latencyMs}ms\n`);
  } catch (error) {
    results.push({
      file: item.file,
      label: item.label,
      expectedTerms: item.expectedTerms,
      error: error.message,
      correct: false
    });
    process.stdout.write(`error ${error.message}\n`);
  }
}

const completed = results.filter((item) => !item.error).length;
const correct = results.filter((item) => item.correct).length;
const latencies = results.filter((item) => Number.isFinite(item.latencyMs)).map((item) => item.latencyMs);
const confidences = results.filter((item) => Number.isFinite(item.confidencePercent)).map((item) => item.confidencePercent);
const summary = {
  mode: "object-only",
  model,
  total: results.length,
  completed,
  errors: results.length - completed,
  correct,
  accuracyPercent: completed ? Math.round((correct / completed) * 100) : 0,
  averageLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
  averageConfidencePercent: confidences.length ? Math.round(confidences.reduce((sum, value) => sum + value, 0) / confidences.length) : null
};

fs.mkdirSync("reports", { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = `reports/meldgaard-object-eval-${model}-${timestamp}.json`;
fs.writeFileSync(reportPath, JSON.stringify({ summary, results }, null, 2));

console.log(JSON.stringify({ summary, reportPath }, null, 2));
