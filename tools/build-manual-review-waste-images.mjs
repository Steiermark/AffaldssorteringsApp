import fs from "node:fs";
import path from "node:path";

const imageDir = "assets/wikimedia-waste-test";
const combinedPath = "data/combined-waste-eval.json";
const outputPath = "data/manual-review-waste-images.json";

const suggestions = new Map([
  ["bottles.jpg", { expectedContainerId: "glas", note: "Filnavn peger på flasker/glas." }],
  ["ds_30-aluminum-4868190_1920.jpg", { expectedContainerId: "metal", note: "Filnavn peger på aluminium." }],
  ["elsemargriet-old-bike-3752735_1920.jpg", { expectedContainerId: "metal", note: "Cykler afleveres typisk som metal på genbrugsplads." }]
]);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
}

const combined = readJson(combinedPath);
const byName = new Map();
for (const item of combined.items || []) {
  if (item.file) byName.set(path.basename(item.file), item);
}

const items = fs.readdirSync(imageDir)
  .filter((file) => fs.statSync(path.join(imageDir, file)).isFile())
  .sort()
  .map((file) => {
    const current = byName.get(file);
    if (current?.expectedContainerId) return null;
    const suggestion = suggestions.get(file) || {};
    return {
      file: path.join(imageDir, file),
      dataset: current?.dataset || "",
      currentReason: current?.skipReason || "",
      suggestedContainerId: suggestion.expectedContainerId || "",
      note: suggestion.note || "",
      expectedContainerId: suggestion.expectedContainerId || "",
      skipReason: suggestion.expectedContainerId ? "" : current?.skipReason || "Manuel vurdering mangler."
    };
  })
  .filter(Boolean);

fs.writeFileSync(outputPath, JSON.stringify({
  createdAt: new Date().toISOString(),
  instructions: "Udfyld expectedContainerId for billeder der skal med i evaluering, eller behold/ret skipReason for billeder der skal springes over.",
  items
}, null, 2));

console.log(JSON.stringify({
  outputPath,
  total: items.length,
  suggested: items.filter((item) => item.suggestedContainerId).length,
  needsReview: items.filter((item) => !item.suggestedContainerId).length
}, null, 2));
