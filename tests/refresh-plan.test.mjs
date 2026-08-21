import assert from "node:assert/strict";
import test from "node:test";
import { refreshPlanResponse, queryRefreshPlan } from "../lib/postgres/repository.ts";

test("refresh plan response is slug-only and bounded", () => {
  assert.deepEqual(refreshPlanResponse(["z-source", "a-source"]), {
    sourceSlugs: ["a-source", "z-source"],
    count: 2,
  });
  assert.deepEqual(Object.keys(refreshPlanResponse([])), ["sourceSlugs", "count"]);
  assert.equal(typeof queryRefreshPlan, "function");
});
