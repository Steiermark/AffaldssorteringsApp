import fs from "node:fs";
import path from "node:path";

const pageUrl = "https://affaldplus.dk/sortering-i-hjemmet";
const outputDir = "assets/wikimedia-waste-test";
const manifestPath = "data/affaldplus-images.json";

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function safeName(value) {
  return decodeURIComponent(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function imageExtension(url) {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
}

function absoluteUrl(value) {
  return new URL(decodeHtml(value), pageUrl).href;
}

function extractImageUrls(html) {
  const urls = new Set();
  for (const match of html.matchAll(/\s(?:src|data-src)=["']([^"']+)["']/g)) {
    urls.add(absoluteUrl(match[1]));
  }
  for (const match of html.matchAll(/\s(?:srcset|data-srcset)=["']([^"']+)["']/g)) {
    const entries = decodeHtml(match[1]).split(",");
    for (const entry of entries) {
      const candidate = entry.trim().split(/\s+/)[0];
      if (candidate) urls.add(absoluteUrl(candidate));
    }
  }
  return [...urls]
    .filter((url) => url.startsWith("https://affaldplus.dk/"))
    .filter((url) => /\/sites\/default\/files\//.test(url))
    .filter((url) => /\.(jpe?g|png|webp)(\?|$)/i.test(url));
}

async function download(url, filePath) {
  const response = await fetch(url, { headers: { "user-agent": "AffaldssorteringsApp test image fetcher" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  fs.writeFileSync(filePath, bytes);
}

fs.mkdirSync(outputDir, { recursive: true });

const pageResponse = await fetch(pageUrl, { headers: { "user-agent": "AffaldssorteringsApp test image fetcher" } });
if (!pageResponse.ok) throw new Error(`Page HTTP ${pageResponse.status}`);

const html = await pageResponse.text();
const urls = extractImageUrls(html);
const byFileName = new Map();

for (const url of urls) {
  const parsed = new URL(url);
  const baseName = safeName(path.basename(parsed.pathname, path.extname(parsed.pathname)));
  const ext = imageExtension(url);
  const existing = byFileName.get(baseName);
  const width = Number(parsed.searchParams.get("width") || parsed.searchParams.get("itok") || 0);
  if (!existing || width >= existing.width) {
    byFileName.set(baseName, { url, width, fileName: `affaldplus-${baseName}${ext}` });
  }
}

const items = [];
for (const item of byFileName.values()) {
  const file = path.join(outputDir, item.fileName);
  process.stdout.write(`${item.fileName} ... `);
  try {
    await download(item.url, file);
    items.push({ file, sourceUrl: item.url, pageUrl });
    process.stdout.write("ok\n");
  } catch (error) {
    process.stdout.write(`${error.message}\n`);
  }
}

fs.writeFileSync(manifestPath, JSON.stringify({
  source: "AffaldPlus",
  pageUrl,
  createdAt: new Date().toISOString(),
  items
}, null, 2));

console.log(JSON.stringify({ count: items.length, outputDir, manifestPath }, null, 2));
