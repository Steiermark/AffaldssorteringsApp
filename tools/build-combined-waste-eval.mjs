import fs from "node:fs";

const inputs = [
  "data/wikimedia-waste-eval.json",
  "data/affaldplus-images.json",
  "data/bolius-waste-images.json",
  "data/kredslob-images.json",
  "data/manual-review-waste-images.json"
];
const outputPath = "data/combined-waste-eval.json";

function normalizeItems(data, sourceName) {
  return (data.items || []).map((item) => ({
    ...item,
    dataset: sourceName,
    expectedContainerId: item.expectedContainerId || "",
    skipReason: item.expectedContainerId ? item.skipReason || "" : item.skipReason || "Mangler forventet container-id."
  }));
}

const items = [];
for (const input of inputs) {
  const data = JSON.parse(fs.readFileSync(input, "utf8").replace(/^\uFEFF/, ""));
  items.push(...normalizeItems(data, data.source || input));
}
const dedupedItems = [...new Map(items.map((item) => [item.file, item])).values()];

const combined = {
  source: "combined",
  siteId: "mit-affald-billund-kommune-billund-genbrugsplads-havremarken-8-7190-billund",
  siteName: "Billund Genbrugsplads",
  createdAt: new Date().toISOString(),
  inputs,
  items: dedupedItems
};

fs.writeFileSync(outputPath, JSON.stringify(combined, null, 2));
console.log(JSON.stringify({
  outputPath,
  total: dedupedItems.length,
  runnable: dedupedItems.filter((item) => item.expectedContainerId).length,
  skipped: dedupedItems.filter((item) => !item.expectedContainerId).length
}, null, 2));
