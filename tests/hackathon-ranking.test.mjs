import assert from "node:assert/strict";
import test from "node:test";
import { hackathons, prizeForMarket, rankedForCountry } from "../data/hackathons.ts";

for (const country of ["US", "IN", "UK", "SG"]) {
  test(`${country} exposes a prize-ranked top ten`, () => {
    const ranked = rankedForCountry(hackathons, country);
    assert.equal(ranked.length, 10);
    assert.ok(ranked.every((item) => item.eligibleCountries.includes(country)));
    for (let index = 1; index < ranked.length; index += 1) {
      assert.ok((ranked[index - 1].prizeUsd ?? -1) >= (ranked[index].prizeUsd ?? -1));
    }
  });
}

test("WORLD exposes one deduplicated prize-ranked leaderboard", () => {
  const mirror = { ...hackathons[0], id: "mirror-provider-id", source: "Mirror provider" };
  const ranked = rankedForCountry([...hackathons, mirror], "WORLD");
  assert.equal(ranked.length, 10);
  assert.equal(new Set(ranked.map((item) => item.id)).size, 10);
  assert.equal(ranked.filter((item) => item.title === mirror.title).length, 1);
  for (let index = 1; index < ranked.length; index += 1) {
    assert.ok((ranked[index - 1].prizeUsd ?? -1) >= (ranked[index].prizeUsd ?? -1));
  }
});

test("country prize presentation includes local currency and canonical USD", () => {
  const india = prizeForMarket(1000, "IN");
  const uk = prizeForMarket(1000, "UK");
  const singapore = prizeForMarket(1000, "SG");
  assert.match(india.local, /₹/);
  assert.match(uk.local, /£/);
  assert.match(singapore.local, /\$|SGD/);
  assert.equal(india.usd, "$1,000");
  assert.equal(uk.usd, "$1,000");
  assert.equal(singapore.usd, "$1,000");
});

test("unknown prize values remain undisclosed instead of fabricating FX", () => {
  assert.equal(prizeForMarket(null, "WORLD"), null);
});

test("every published entry preserves a public source and effort disclosure", () => {
  for (const item of hackathons) {
    assert.match(item.sourceUrl, /^https:\/\//);
    assert.ok(item.title && item.organizer && item.summary);
    assert.ok(["Weekend", "Focused", "Marathon"].includes(item.effort));
    assert.match(item.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
});
