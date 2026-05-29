import fs from "node:fs";

const pageUrl = "https://www.kredslob.dk/privat/genbrug-og-affald/genbrugsstationerne/saadan-sorterer-du-paa-genbrugsstationen/";
const outputPath = "data/kredslob-sorting-rules.json";

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
  return decodeHtml(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}

function normalizeId(value) {
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

function splitExamples(text) {
  return text
    .split(/\n|,|;|•|·/g)
    .map((item) => item.trim().replace(/[.:]+$/g, ""))
    .filter(Boolean)
    .filter((item) => !/^ja tak$/i.test(item))
    .filter((item) => !/^nej tak$/i.test(item));
}

function extractRules(html) {
  const blocks = [...html.matchAll(/<div class="tab-item[^"]*">([\s\S]*?)(?=<div class="tab-item|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>)/g)]
    .map((match) => match[1])
    .filter((block) => /Ja tak/i.test(block) && /Nej tak/i.test(block));
  const candidates = blocks.length ? blocks : [html];
  const rules = [];

  for (const block of candidates) {
    if (!/Ja tak/i.test(block) || !/Nej tak/i.test(block)) continue;
    const imageAlt = block.match(/<img[^>]+alt=["']([^"']+)["']/i)?.[1] || "";
    const paneTitle = block.match(/<div class="tab-pane"[\s\S]*?<p>([\s\S]*?)<span/i)?.[1] || "";
    const headings = [...block.matchAll(/<h[234][^>]*>([\s\S]*?)<\/h[234]>/gi)].map((match) => stripTags(match[1]));
    const title = stripTags(paneTitle) || headings.find((heading) => !/ja tak|nej tak/i.test(heading)) || stripTags(imageAlt);
    const rte = block.match(/<div class="tw-rte">([\s\S]*?)<\/div>/i)?.[1] || block;
    const yesMatch = rte.match(/<p><strong>Ja tak:?\s*<\/strong><\/p>\s*<p>([\s\S]*?)<\/p>\s*<p><strong>Nej tak:?\s*<\/strong><\/p>/i)
      || rte.match(/Ja tak:?\s*<\/strong><\/p>\s*<p>([\s\S]*?)<\/p>[\s\S]*?Nej tak/i)
      || rte.match(/Ja tak:?([\s\S]*?)Nej tak/i);
    const noMatch = rte.match(/<p><strong>Nej tak:?\s*<\/strong><\/p>\s*<p>([\s\S]*?)<\/p>/i)
      || rte.match(/Nej tak:?\s*<\/strong><\/p>\s*<p>([\s\S]*?)<\/p>/i)
      || rte.match(/Nej tak:?([\s\S]*?)(?:<p><strong>|<ul|$)/i);
    const yes = yesMatch ? splitExamples(stripTags(yesMatch[1])) : [];
    const no = noMatch ? splitExamples(stripTags(noMatch[1])) : [];
    if (!title || (yes.length === 0 && no.length === 0)) continue;
    rules.push({
      id: normalizeId(title),
      title,
      yes,
      no
    });
  }

  const deduped = new Map();
  for (const rule of rules) {
    if (!deduped.has(rule.id) || rule.yes.length + rule.no.length > deduped.get(rule.id).yes.length + deduped.get(rule.id).no.length) {
      deduped.set(rule.id, rule);
    }
  }
  return [...deduped.values()];
}

const response = await fetch(pageUrl, { headers: { "user-agent": "AffaldssorteringsApp sorting rule extractor" } });
if (!response.ok) throw new Error(`HTTP ${response.status}`);

const html = await response.text();
const rules = extractRules(html);

fs.writeFileSync(outputPath, JSON.stringify({
  source: "Kredsløb",
  pageUrl,
  createdAt: new Date().toISOString(),
  rules
}, null, 2));

console.log(JSON.stringify({
  outputPath,
  rules: rules.length,
  examples: rules.slice(0, 5).map((rule) => ({ title: rule.title, yes: rule.yes.slice(0, 3), no: rule.no.slice(0, 3) }))
}, null, 2));
