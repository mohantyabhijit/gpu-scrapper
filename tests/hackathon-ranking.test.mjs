import assert from "node:assert/strict";
import test from "node:test";
import { hackathons, rankedForCountry } from "../data/hackathons.ts";

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

test("every published entry preserves a public source and effort disclosure", () => {
  for (const item of hackathons) {
    assert.match(item.sourceUrl, /^https:\/\//);
    assert.ok(item.title && item.organizer && item.summary);
    assert.ok(["Weekend", "Focused", "Marathon"].includes(item.effort));
    assert.match(item.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
});
