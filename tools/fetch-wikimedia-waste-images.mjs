import fs from "node:fs";
import path from "node:path";

const outputDir = "assets/wikimedia-waste-test";
const manifestPath = "data/wikimedia-waste-eval.json";

const targets = [
  { id: "car-battery", query: "car battery", expectedContainerId: "bilbatterier", terms: ["bilbatteri", "akkumulator"] },
  { id: "small-batteries", query: "AA batteries", expectedContainerId: "batterier", terms: ["batterier"] },
  { id: "fluorescent-tube", query: "fluorescent tube lamp", expectedContainerId: "lysstofroer", terms: ["lysstofrør"] },
  { id: "spray-can", query: "aerosol spray can", expectedContainerId: "farligt-affald", terms: ["spraydåse"] },
  { id: "paint-can", query: "paint can", expectedContainerId: "farligt-affald", terms: ["maling"] },
  { id: "toner-cartridge", query: "toner cartridge", expectedContainerId: "printerpatroner", terms: ["tonerpatron"] },
  { id: "concrete-rubble", query: "concrete rubble", expectedContainerId: "beton", terms: ["beton"] },
  { id: "asphalt", query: "asphalt rubble", expectedContainerId: "asfalt", terms: ["asfalt"] },
  { id: "mineral-wool", query: "mineral wool insulation", expectedContainerId: "mineraluld", terms: ["mineraluld", "isolering"] },
  { id: "gypsum-board", query: "gypsum drywall board", expectedContainerId: "gips", terms: ["gipsplade"] },
  { id: "window-glass", query: "broken window glass", expectedContainerId: "vinduer", terms: ["vinduesglas"] },
  { id: "flat-glass", query: "flat glass sheets", expectedContainerId: "fladt-glas", terms: ["planglas"] },
  { id: "plastic-bumper", query: "car bumper plastic", expectedContainerId: "haardt-plast", terms: ["kofanger"] },
  { id: "pvc-pipe", query: "PVC pipe", expectedContainerId: "haardt-pvc", terms: ["pvc"] },
  { id: "plastic-bottle", query: "plastic bottle", expectedContainerId: "haardt-plast", terms: ["plastflaske"] },
  { id: "metal-scrap", query: "metal scrap", expectedContainerId: "metal", terms: ["metal"] },
  { id: "soil", query: "pile of soil", expectedContainerId: "jord", terms: ["jord"] },
  { id: "railway-sleeper", query: "railway sleeper wood", expectedContainerId: "impraegneret-trae", terms: ["jernbanesvelle"] },
  { id: "wood", query: "wood waste", expectedContainerId: "trae", terms: ["træ"] },
  { id: "sanitary-ceramic", query: "toilet ceramic", expectedContainerId: "sanitet", terms: ["toilet", "sanitet"] }
];

function safeName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function extensionFromUrl(url) {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp"].includes(ext)) return ext;
  return ".jpg";
}

async function findImage(target) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: target.query,
    gsrlimit: "8",
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "900",
    format: "json",
    origin: "*"
  });
  const response = await fetchWithRetry(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!response.ok) throw new Error(`Wikimedia search failed ${response.status}`);
  const data = await response.json();
  const pages = Object.values(data.query?.pages || {});
  return pages
    .map((page) => ({ page, image: page.imageinfo?.[0] }))
    .find(({ image }) => image?.thumburl || image?.url);
}

async function download(url, filePath) {
  const response = await fetchWithRetry(url);
  if (!response.ok) throw new Error(`Download failed ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  fs.writeFileSync(filePath, bytes);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "user-agent": "AffaldssorteringsApp test image fetcher"
      }
    });
    if (response.status !== 429) return response;
    await delay(2500 * (attempt + 1));
  }
  return fetch(url);
}

fs.mkdirSync(outputDir, { recursive: true });

const items = [];
for (const target of targets) {
  await delay(800);
  process.stdout.write(`${target.id} ... `);
  try {
    const found = await findImage(target);
    if (!found) {
      process.stdout.write("skipped\n");
      continue;
    }
    const image = found.image;
    const url = image.thumburl || image.url;
    const file = path.join(outputDir, `${safeName(target.id)}${extensionFromUrl(url)}`);
    await download(url, file);
    items.push({
      file,
      label: target.id,
      expectedContainerId: target.expectedContainerId,
      expectedTerms: target.terms,
      source: {
        title: found.page.title,
        url: image.descriptionurl,
        license: image.extmetadata?.LicenseShortName?.value || "",
        artist: image.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, "") || ""
      }
    });
    process.stdout.write(`${file}\n`);
  } catch (error) {
    process.stdout.write(`error ${error.message}\n`);
  }
}

fs.writeFileSync(manifestPath, JSON.stringify({
  source: "Wikimedia Commons",
  createdAt: new Date().toISOString(),
  items
}, null, 2));

console.log(JSON.stringify({ count: items.length, manifestPath, outputDir }, null, 2));
