import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const readJson = async (relativePath) =>
  JSON.parse(await readFile(path.join(root, relativePath), "utf8"));

const sites = await readJson("data/national-sites.json");
const layouts = await readJson("data/site-layouts.json");

const siteById = new Map(sites.map((site) => [site.id, site]));
const layoutById = new Map(layouts.map((layout) => [layout.siteId, layout]));

const getSourceOverviewRef = (source = {}) =>
  source.localFile ||
  source.localMap ||
  source.image ||
  source.imageUrl ||
  source.mapImage ||
  "";

const getAnySourceUrl = (source = {}) => source.url || source.pageUrl || "";

const isLocalRef = (value) =>
  Boolean(value) && !/^https?:\/\//i.test(value) && !/^data:/i.test(value);

const hasExistingLocalFile = (value) => {
  if (!isLocalRef(value)) return false;
  return existsSync(path.join(root, value.replaceAll("/", path.sep)));
};

const getFractionPlacementCount = (layout) =>
  layout?.map && typeof layout.map === "object" ? Object.keys(layout.map).length : 0;

const rows = sites
  .map((site) => {
    const layout = layoutById.get(site.id);
    const source = layout?.source || {};
    const overviewRef = getSourceOverviewRef(source);
    const sourceUrl = getAnySourceUrl(source);
    const fractionPlacementCount = getFractionPlacementCount(layout);

    return {
      id: site.id,
      name: site.displayName || site.name,
      municipality: site.municipality,
      address: site.address,
      provider: source.provider || site.sourceProvider || site.source || "",
      hasLayout: Boolean(layout),
      hasOverviewReference: Boolean(overviewRef || sourceUrl),
      hasLocalOverviewMap: Boolean(overviewRef),
      localOverviewMapExists: hasExistingLocalFile(overviewRef),
      overviewRef,
      sourceUrl,
      fractionPlacementCount,
      status: !layout
        ? "missing-layout-and-fraction-placements"
        : fractionPlacementCount === 0
          ? "missing-fraction-placements"
          : !overviewRef && !sourceUrl
            ? "missing-overview-map-reference"
            : !overviewRef
              ? "source-page-only"
              : isLocalRef(overviewRef) && !hasExistingLocalFile(overviewRef)
                ? "local-overview-map-file-missing"
                : "ok"
    };
  })
  .sort((a, b) =>
    a.municipality.localeCompare(b.municipality, "da") ||
    a.name.localeCompare(b.name, "da")
  );

const groupByMunicipality = (items) =>
  Object.entries(
    items.reduce((groups, item) => {
      groups[item.municipality] = (groups[item.municipality] || 0) + 1;
      return groups;
    }, {})
  )
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "da"))
    .map(([municipality, count]) => ({ municipality, count }));

const missingLayout = rows.filter((row) => !row.hasLayout);
const missingOverviewReference = rows.filter(
  (row) => row.hasLayout && !row.hasOverviewReference
);
const sourcePageOnly = rows.filter((row) => row.status === "source-page-only");
const missingLocalOverviewFile = rows.filter(
  (row) => row.status === "local-overview-map-file-missing"
);
const missingFractionPlacements = rows.filter(
  (row) => row.hasLayout && row.fractionPlacementCount === 0
);

const report = {
  generated: new Date().toISOString().slice(0, 10),
  summary: {
    totalSites: sites.length,
    totalLayouts: layouts.length,
    sitesWithLayout: rows.filter((row) => row.hasLayout).length,
    missingLayout: missingLayout.length,
    missingOverviewReference: missingOverviewReference.length,
    sourcePageOnly: sourcePageOnly.length,
    missingLocalOverviewFile: missingLocalOverviewFile.length,
    missingFractionPlacements: missingFractionPlacements.length
  },
  missingLayout,
  missingOverviewReference,
  sourcePageOnly,
  missingLocalOverviewFile,
  missingFractionPlacements,
  missingLayoutByMunicipality: groupByMunicipality(missingLayout),
  sourcePageOnlyByMunicipality: groupByMunicipality(sourcePageOnly)
};

const markdownRows = (items, maxRows = 120) => {
  if (items.length === 0) return "Ingen fundet.\n";
  const rows = items.slice(0, maxRows).map((item) =>
    `| ${item.municipality} | ${item.name} | ${item.address || ""} | ${item.provider || ""} | ${item.fractionPlacementCount} | ${item.sourceUrl || item.overviewRef || ""} |`
  );
  const extra = items.length > maxRows ? `\n\nViser ${maxRows} af ${items.length} poster.\n` : "\n";
  return [
    "| Kommune | Plads | Adresse | Kilde | Placeringer | Kort/kilde |",
    "| --- | --- | --- | --- | ---: | --- |",
    ...rows,
    extra
  ].join("\n");
};

const markdown = `# Kontrol af genbrugspladskort

Genereret: ${report.generated}

## Samlet status

- Genbrugspladser i alt: ${report.summary.totalSites}
- Pladser med layout/fraktionsdata: ${report.summary.sitesWithLayout}
- Pladser uden layout/fraktionsplaceringer: ${report.summary.missingLayout}
- Layouts uden nogen kortreference: ${report.summary.missingOverviewReference}
- Layouts hvor kort kun er en webside/kildeside: ${report.summary.sourcePageOnly}
- Layouts med manglende lokal kortfil: ${report.summary.missingLocalOverviewFile}
- Layouts uden fraktionsplaceringer: ${report.summary.missingFractionPlacements}

## Mangler layout og fraktionsplaceringer

${markdownRows(missingLayout)}

## Har layout, men kun webside som kort/kilde

${markdownRows(sourcePageOnly)}

## Har layout, men ingen kortreference

${markdownRows(missingOverviewReference)}

## Har layout, men lokal kortfil mangler

${markdownRows(missingLocalOverviewFile)}

## Har layout, men ingen fraktionsplaceringer

${markdownRows(missingFractionPlacements)}
`;

await writeFile(
  path.join(root, "data/site-layout-control-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);
await writeFile(path.join(root, "data/site-layout-control-report.md"), markdown, "utf8");

console.log(JSON.stringify(report.summary, null, 2));
