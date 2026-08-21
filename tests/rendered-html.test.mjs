import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
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
  assert.match(html, /name="market"/);
  assert.match(html, /name="q"/);
  assert.doesNotMatch(html, /collectors online|c_gpu_|verified feed/i);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site|Starter Project/);
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
  assert.match(detailHtml, /Lowest fixture in this market/);
  assert.doesNotMatch(detailHtml, /USD|GBP|SGD/);
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
  assert.match(html, /last-known-good|last known-good/i);
  assert.match(html, /quarantine/);
  assert.match(html, /self-heal|heal/i);
  assert.match(html, /brightdata\.com/);
  assert.doesNotMatch(html, /c_gpu_|collectors online/i);
});
