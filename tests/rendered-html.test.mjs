import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

const basePath = "/scrapper";

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

test("source-desk serialization and brief construction are bounded and provenance-first", async () => {
  const source = await fs.readFile(new URL("../components/sourcing-desk.tsx", import.meta.url), "utf8");
  assert.match(source, /SOURCE_DESK_STORAGE_KEY = "raster\.source-desk\.v1"/);
  assert.match(source, /SOURCE_DESK_LIMIT = 6/);
  assert.match(source, /slice\(0, SOURCE_DESK_LIMIT\)/);
  assert.match(source, /not a like-for-like comparison/);
  assert.match(source, /Retailer link:/);
  assert.match(source, /Reminder \(\$\{reminderDate\}\)/);
  assert.match(source, /isSafeUrl/);
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
