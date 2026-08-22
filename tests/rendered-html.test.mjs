import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { aggregateCatalogHealth } from "../app/data-health/health.ts";

const basePath = "/scrapper";

function catalogRead(slug, source, count) {
  const market = { slug, code: slug === "singapore" ? "SG" : "US", label: slug, currency: slug === "singapore" ? "SGD" : "USD", locale: "en-US", symbol: "$" };
  return {
    market,
    snapshot: {
      source,
      offers: Array.from({ length: count }, () => ({})),
      liveOfferCount: source === "postgres" ? count : null,
      rejectedRows: 0,
      markets: [market],
      marketPacks: [],
      selectedMarket: market,
    },
  };
}

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const route = path === "/" ? basePath : `${basePath}${path}`;
  return worker.fetch(new Request(`http://localhost${route}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the Raster market-local fixture desk", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Raster|raster\./i);
  assert.match(html, /The GPU market/);
  assert.match(html, /FIXTURE CATALOG/);
  assert.match(html, /United States/);
  assert.match(html, /USD(?:<!-- -->)? only/);
  assert.match(html, /Micro Center/);
  assert.match(html, /B(?:&|&amp;)H Photo/);
  assert.match(html, /no cross-market price ranking/);
  assert.match(html, /Verify at retailer/);
  assert.match(html, /Compare details/);
  assert.match(html, /href="\/scrapper\/gpu\/rtx-5070-ti\?market=us"/);
  assert.match(html, /name="market"/);
  assert.match(html, /name="q"/);
  assert.match(html, /name="gpu"/);
  assert.match(html, /name="source"/);
  assert.match(html, /name="sort"/);
  assert.match(html, /dateTime="2026-08-21T10:00:00.000Z"/);
  assert.match(html, /fixture source/i);
  assert.match(html, /href="\/scrapper\/how-it-works"/);
  assert.doesNotMatch(html, /collectors online|c_gpu_|verified feed/i);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|Starter Project/);
});

test("server markup keeps the progressive source-desk entry points", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /SOURCE DESK/);
  assert.match(html, /Stored only in this browser/);
  assert.match(html, /Add to source desk/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, /FIXTURE CATALOG/);
});

test("source-desk serialization retains saved offers outside the visible filter and stays provenance-first", async () => {
  const helper = new URL("../components/sourcing-desk-model.ts", import.meta.url).pathname;
  const script = `import { buildSourcingBrief, canonicalizeStored, savedOffersOutsideVisibleNote, selectSourceDeskOffer, serializeSourceDesk } from ${JSON.stringify(helper)};
    const catalog = [{ id: "safe", market: "us", model: "RTX 5090", brand: "Canonical", source: "Retailer", currency: "USD", price: 10, availability: "In stock", observedAt: "2026-08-21T10:00:00.000Z", healthState: "fixture", freshness: "fixture", productUrl: "https://example.com/gpu" }];
    const other = { ...catalog[0], id: "uk", market: "uk", currency: "GBP" };
    const completeCatalog = [...catalog, other];
    const canonical = canonicalizeStored(JSON.stringify([{ id: "safe", market: "evil", price: 999 }]), completeCatalog);
    const pending = selectSourceDeskOffer(canonical, other);
    const storageBefore = serializeSourceDesk(pending.selected);
    const replaced = selectSourceDeskOffer(pending.selected, other, true);
    const storageDuringPending = serializeSourceDesk(pending.selected);
    const storageAfterAcknowledgement = serializeSourceDesk(replaced.selected);
    const filteredVisibleCatalog = completeCatalog.filter((offer) => offer.id !== "safe");
    const persistedSelection = serializeSourceDesk(canonical);
    const retainedAcrossFilter = canonicalizeStored(persistedSelection, completeCatalog);
    const outsideCurrentFilters = savedOffersOutsideVisibleNote(retainedAcrossFilter, filteredVisibleCatalog.map((offer) => offer.id));
    const corrupted = canonicalizeStored(JSON.stringify([{ id: "missing" }]), completeCatalog);
    const mixedMarket = canonicalizeStored(JSON.stringify([{ id: "safe" }, { id: "uk" }]), completeCatalog);
    console.log(JSON.stringify({ canonical, brief: buildSourcingBrief(canonical, "2026-08-22"), pending, replaced, storageBefore, storageDuringPending, storageAfterAcknowledgement, filteredVisibleCatalog, retainedAcrossFilter, outsideCurrentFilters, corrupted, mixedMarket }));`;
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.canonical[0].market, "us");
  assert.equal(output.canonical[0].price, 10);
  assert.match(output.brief, /not a like-for-like comparison/);
  assert.match(output.brief, /Reminder \(2026-08-22\)/);
  assert.match(output.brief, /https:\/\/example\.com\/gpu/);
  assert.equal(output.pending.selected[0].id, "safe");
  assert.equal(output.pending.pending.id, "uk");
  assert.equal(output.replaced.selected[0].id, "uk");
  assert.equal(output.storageDuringPending, output.storageBefore);
  assert.notEqual(output.storageAfterAcknowledgement, output.storageBefore);
  assert.equal(output.filteredVisibleCatalog.length, 1);
  assert.equal(output.retainedAcrossFilter.length, 1);
  assert.equal(output.retainedAcrossFilter[0].id, "safe");
  assert.equal(output.outsideCurrentFilters, "1 saved offer outside current filters");
  assert.equal(output.corrupted.length, 0);
  assert.equal(output.mixedMarket.length, 0);
  const corrupted = spawnSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", `import { canonicalizeStored } from ${JSON.stringify(helper)}; console.log(canonicalizeStored("{broken", []).length);`], { encoding: "utf8" });
  assert.equal(corrupted.stdout.trim(), "0");
});

test("publishes Raster GPU favicon metadata instead of a generic site icon", async () => {
  const response = await render();
  const html = await response.text();
  assert.match(html, /href="\/scrapper\/favicon\.svg\?v3"/);
  assert.match(html, /href="\/scrapper\/favicon-32x32\.png\?v3"/);
  assert.match(html, /href="\/scrapper\/favicon\.ico\?v3"/);
  assert.match(html, /href="\/scrapper\/apple-touch-icon\.png\?v3"/);
  assert.match(html, /href="\/scrapper\/manifest\.webmanifest\?v3"/);
});

test("switches markets without mixing currencies", async () => {
  const india = await render("/?market=india");
  const indiaHtml = await india.text();
  assert.match(indiaHtml, /India/);
  assert.match(indiaHtml, /INR(?:<!-- -->)? only/);
  assert.match(indiaHtml, /MDComputers/);
  assert.match(indiaHtml, /₹/);
  assert.doesNotMatch(indiaHtml, /Micro Center|B&H Photo|\$\s*749|£\s*749/);

  const singapore = await render("/?market=singapore");
  const singaporeHtml = await singapore.text();
  assert.match(singaporeHtml, /Singapore/);
  assert.match(singaporeHtml, /SGD(?:<!-- -->)? only/);
  assert.match(singaporeHtml, /Dynacore/);
  assert.match(singaporeHtml, /\$1,099/);
  assert.doesNotMatch(singaporeHtml, /MDComputers|Vedant Computers|₹\s*84/);
});

test("supports URL-owned filtering and market-local model detail routes", async () => {
  const filtered = await render("/?market=uk&q=5080&source=overclockers-uk");
  assert.equal(filtered.status, 200);
  const filteredHtml = await filtered.text();
  assert.match(filteredHtml, /showing “(?:<!-- -->)?5080(?:<!-- -->)?”/);
  assert.match(filteredHtml, /Overclockers UK/);
  assert.doesNotMatch(filteredHtml, /MSI Ventus 3X/);

  const detail = await render("/gpu/rtx-5070-ti?market=india");
  assert.equal(detail.status, 200);
  const detailHtml = await detail.text();
  assert.match(detailHtml, /GeForce RTX 5070 Ti/);
  assert.match(detailHtml, /India/);
  assert.match(detailHtml, /Compare board partners/);
  assert.match(detailHtml, /Lowest available fixture in this market/);
  assert.match(detailHtml, /Source health:\s*(?:<!-- -->)?fixture/);
  assert.match(detailHtml, /dateTime="2026-08-21T10:20:00.000Z"/);
  assert.doesNotMatch(detailHtml, /USD|GBP|SGD/);
});

test("supports multi-select GPU and retailer filters, sorting, and removable chips", async () => {
  const response = await render("/?market=us&gpu=rtx-5070-ti&gpu=rtx-5080&source=micro-center&sort=price-high");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Active:/);
  assert.match(html, /GeForce RTX 5070 Ti/);
  assert.match(html, /GeForce RTX 5080/);
  assert.match(html, /Micro Center/);
  assert.match(html, /Sort: price high/);
  assert.match(html, /Clear all/);
  assert.match(html, /1(?:<!-- -->)?\s*(?:<!-- -->)?offer/);
  assert.doesNotMatch(html, /PNY XLR8 Gaming/);
  assert.match(html, /gpu=rtx-5080/);
  assert.match(html, /source=micro-center(?:&|&amp;)sort=price-high(?:&|&amp;)gpu=rtx-5080(?:&|&amp;)market=us#offers/);
});

test("publishes an honest method page", async () => {
  const response = await render("/how-it-works");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /From public page/);
  assert.match(html, /Bright Data Scraper Studio/);
  assert.match(html, /market-local/i);
  assert.match(html, /demo fixtures/i);
  assert.doesNotMatch(html, /stable collector ID|bdata scraper heal <collector>/i);
  assert.match(html, /Raster is not the merchant/);
});

test("publishes judge-facing data health without fabricating live state", async () => {
  const response = await render("/data-health");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /DATA HEALTH/);
  assert.match(html, /United States/);
  assert.match(html, /United Kingdom/);
  assert.match(html, /India/);
  assert.match(html, /Singapore/);
  assert.match(html, /USD|GBP|INR|SGD/);
  assert.match(html, /NO LIVE/);
  assert.match(html, /Pending.*not configured/);
  assert.match(html, /What is live vs fixture/);
  assert.match(html, /fixture rows only/);
  assert.match(html, /Live provider/);
  assert.match(html, /Policy: same-ID repair/);
  assert.match(html, /data-evidence-kind="fixture"/);
  assert.match(html, /data-evidence-kind="provider"/);
  assert.match(html, /data-evidence-kind="policy"/);
  assert.match(html, /last-known-good|last known-good/i);
  assert.match(html, /quarantine/);
  assert.match(html, /self-heal|heal/i);
  assert.match(html, /contract break/);
  assert.match(html, /heal preview/);
  assert.match(html, /same-ID rerun/);
  assert.match(html, /Current evidence state: pending/);
  assert.match(html, /brightdata\.com/);
  assert.doesNotMatch(html, /Self-heal proved|Proven · same ID/i);
  assert.doesNotMatch(html, /c_gpu_|collectors online/i);
});

test("data-health aggregation keeps a live Singapore read when the default US market is empty", () => {
  const state = aggregateCatalogHealth([
    catalogRead("us", "fixture", 0),
    catalogRead("singapore", "postgres", 2),
    catalogRead("uk", "fixture", 0),
  ]);
  assert.equal(state.liveRead, true);
  assert.equal(state.liveOfferCount, 2);
  assert.deepEqual(state.liveMarketSlugs, ["singapore"]);
  assert.equal(state.liveOfferCountsByMarket.get("singapore"), 2);
  assert.equal(state.liveOfferCountsByMarket.has("us"), false);
});
