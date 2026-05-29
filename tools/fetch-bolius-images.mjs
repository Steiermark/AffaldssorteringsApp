import fs from "node:fs";
import path from "node:path";

const pageUrl = "https://www.bolius.dk/20-stykker-affald-du-er-i-tvivl-om-hvor-skal-det-hen-98217";
const outputDir = "assets/wikimedia-waste-test";
const manifestPath = "data/bolius-waste-images.json";

const expectedByTitle = new Map([
  ["Bobleplastkuverter", "restaffald"],
  ["Chipsposer", "restaffald"],
  ["Elpærer", "farligt-affald"],
  ["Flamingo", "flamingo"],
  ["Foliebakker", "metal"],
  ["Kaffefilter", "madaffald"],
  ["Gavepapir", "restaffald"],
  ["Kaffekapsler", "metal"],
  ["Kosmetik", "farligt-affald"],
  ["Mad- og fritureolie", "farligt-affald"],
  ["Medicin", "farligt-affald"],
  ["Mælke- og andre drikkevarekartoner", "mad-og-drikkekartoner"],
  ["Pizzabakken", "restaffald"],
  ["Porcelæn", "porcelaen"],
  ["Poser fra havregryn, mel og brødposer fra bageren", "papir"],
  ["Sutter", "restaffald"],
  ["Tegne- og skriveredskaber", "restaffald"],
  ["Tomme blisterpakker fra piller", "restaffald"],
  ["Tyggegummi", "restaffald"],
  ["Æggebakker", "cardboard"]
]);

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
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
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function absoluteUrl(value) {
  return new URL(decodeHtml(value), pageUrl).href;
}

function imageExtension(url) {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg";
}

function extractArticleItems(html) {
  const matches = [...html.matchAll(/<h[23][^>]*>\s*(\d+)\.\s*([^<]+)<\/h[23]>([\s\S]*?)(?=<h[23][^>]*>\s*\d+\.|<h2|$)/g)];
  return matches.map((match) => {
    const number = Number(match[1]);
    const title = stripTags(match[2]);
    const block = match[3];
    const imageMatch = block.match(/<img[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/)
      || block.match(/(?:src|data-src)=["']([^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?)["']/i);
    return imageMatch ? { number, title, imageUrl: absoluteUrl(imageMatch[1]) } : null;
  }).filter(Boolean);
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
const articleItems = extractArticleItems(html);
const items = [];

for (const articleItem of articleItems) {
  const fileName = `bolius-${String(articleItem.number).padStart(2, "0")}-${safeName(articleItem.title)}${imageExtension(articleItem.imageUrl)}`;
  const file = path.join(outputDir, fileName);
  process.stdout.write(`${fileName} ... `);
  try {
    await download(articleItem.imageUrl, file);
    items.push({
      file,
      label: articleItem.title,
      expectedContainerId: expectedByTitle.get(articleItem.title) || "",
      source: {
        pageUrl,
        imageUrl: articleItem.imageUrl,
        title: articleItem.title
      }
    });
    process.stdout.write("ok\n");
  } catch (error) {
    process.stdout.write(`${error.message}\n`);
  }
}

fs.writeFileSync(manifestPath, JSON.stringify({
  source: "Bolius",
  pageUrl,
  createdAt: new Date().toISOString(),
  items
}, null, 2));

console.log(JSON.stringify({ count: items.length, outputDir, manifestPath }, null, 2));
