import fs from "node:fs";
import path from "node:path";

const startUrl = "https://www.kredslob.dk/privat/genbrug-og-affald/genbrugsstationerne";
const outputDir = "assets/wikimedia-waste-test";
const manifestPath = "data/kredslob-images.json";

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function safeName(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function absoluteUrl(value, baseUrl = startUrl) {
  return new URL(decodeHtml(value), baseUrl).href;
}

function imageExtension(url) {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
}

function extractLinks(html, pageUrl) {
  return [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/g)]
    .map((match) => ({ url: absoluteUrl(match[1], pageUrl), text: stripTags(match[2]) }))
    .filter((link) => link.url.startsWith("https://www.kredslob.dk/privat/genbrug-og-affald/"))
    .filter((link) => !link.url.includes("#"));
}

function extractImages(html, pageUrl) {
  const urls = new Map();
  for (const match of html.matchAll(/<img\b([^>]+)>/g)) {
    const tag = match[0];
    const attrs = match[1];
    const src = attrs.match(/\s(?:src|data-src)=["']([^"']+)["']/)?.[1];
    const alt = attrs.match(/\salt=["']([^"']*)["']/)?.[1] || "";
    const title = attrs.match(/\stitle=["']([^"']*)["']/)?.[1] || "";
    if (src) urls.set(absoluteUrl(src, pageUrl), { alt: decodeHtml(alt), title: decodeHtml(title) });
    for (const setMatch of attrs.matchAll(/\s(?:srcset|data-srcset)=["']([^"']+)["']/g)) {
      const entries = decodeHtml(setMatch[1]).split(",");
      for (const entry of entries) {
        const candidate = entry.trim().split(/\s+/)[0];
        if (candidate) urls.set(absoluteUrl(candidate, pageUrl), { alt: decodeHtml(alt), title: decodeHtml(title) });
      }
    }
  }
  return [...urls.entries()]
    .map(([url, meta]) => ({ url, ...meta }))
    .filter((item) => /\.(jpe?g|png|webp)(\?|$)/i.test(item.url))
    .filter((item) => !/logo|icon|favicon|sprite|tilgaengelighed|skema|plads-paa-genbrugsstationer/i.test(item.url + " " + item.alt));
}

async function fetchHtml(url) {
  const response = await fetch(url, { headers: { "user-agent": "AffaldssorteringsApp test image fetcher" } });
  if (!response.ok) throw new Error(`Page HTTP ${response.status}: ${url}`);
  return response.text();
}

async function download(url, filePath) {
  const response = await fetch(url, { headers: { "user-agent": "AffaldssorteringsApp test image fetcher" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  fs.writeFileSync(filePath, bytes);
}

fs.mkdirSync(outputDir, { recursive: true });

const startHtml = await fetchHtml(startUrl);
const pages = new Map([[startUrl, "Genbrugsstationerne"]]);
for (const link of extractLinks(startHtml, startUrl)) {
  pages.set(link.url, link.text || path.basename(new URL(link.url).pathname));
}

const imageByUrl = new Map();
for (const [pageUrl, pageTitle] of pages) {
  process.stdout.write(`scan ${pageTitle} ... `);
  try {
    const html = pageUrl === startUrl ? startHtml : await fetchHtml(pageUrl);
    const images = extractImages(html, pageUrl);
    for (const image of images) {
      imageByUrl.set(image.url, { ...image, pageUrl, pageTitle });
    }
    process.stdout.write(`${images.length}\n`);
  } catch (error) {
    process.stdout.write(`${error.message}\n`);
  }
}

const items = [];
let index = 0;
for (const image of imageByUrl.values()) {
  index += 1;
  const nameSeed = image.alt || image.title || image.pageTitle || `image-${index}`;
  const fileName = `kredslob-${String(index).padStart(2, "0")}-${safeName(nameSeed).slice(0, 70)}${imageExtension(image.url)}`;
  const file = path.join(outputDir, fileName);
  process.stdout.write(`${fileName} ... `);
  try {
    await download(image.url, file);
    items.push({
      file,
      expectedContainerId: "",
      skipReason: "Mangler kurateret forventet container-id.",
      source: {
        pageUrl: image.pageUrl,
        imageUrl: image.url,
        pageTitle: image.pageTitle,
        alt: image.alt,
        title: image.title
      }
    });
    process.stdout.write("ok\n");
  } catch (error) {
    process.stdout.write(`${error.message}\n`);
  }
}

fs.writeFileSync(manifestPath, JSON.stringify({
  source: "Kredsløb",
  startUrl,
  createdAt: new Date().toISOString(),
  items
}, null, 2));

console.log(JSON.stringify({ pages: pages.size, count: items.length, outputDir, manifestPath }, null, 2));
