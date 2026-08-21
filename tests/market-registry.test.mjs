import assert from "node:assert/strict";
import test from "node:test";
import {
  marketCurrency,
  marketForCode,
  marketRegistry,
  marketSlug,
} from "../config/markets.ts";
import { sourceRegistry } from "../config/sources.ts";

test("one market registry drives slugs, codes, and local currencies", () => {
  for (const [slug, market] of Object.entries(marketRegistry)) {
    assert.equal(marketSlug(slug), slug);
    assert.equal(marketForCode(market.code)?.slug, slug);
    assert.equal(marketCurrency(market.code), market.currency);
  }
  assert.equal(marketSlug("not-onboarded"), "us");
  assert.equal(marketForCode("ZZ"), undefined);
});

test("every configured source belongs to an onboarded market", () => {
  const codes = new Set(Object.values(marketRegistry).map((market) => market.code));
  for (const source of Object.values(sourceRegistry)) {
    assert.ok(codes.has(source.region), `${source.slug} uses unknown market ${source.region}`);
    assert.equal(source.currency, marketCurrency(source.region));
  }
});
