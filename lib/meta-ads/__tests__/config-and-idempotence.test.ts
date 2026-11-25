import assert from "node:assert/strict";
import test from "node:test";
import { parseAccountMappings } from "@/lib/meta-ads/config";
import { stablePayloadHash } from "@/lib/meta-ads/hash";

test("account mappings keep SPETER and IRISMOMENT explicitly separated", () => {
  const mappings = parseAccountMappings(JSON.stringify([
    { brand: "SPETER", accountId: "123" },
    { brand: "IRISMOMENT", accountId: "act_456" }
  ]));
  assert.deepEqual(mappings.map((item) => [item.brand, item.accountId]), [["SPETER", "act_123"], ["IRISMOMENT", "act_456"]]);
});

test("duplicate account mappings are rejected", () => {
  assert.throws(() => parseAccountMappings(JSON.stringify([
    { brand: "SPETER", accountId: "123" },
    { brand: "IRISMOMENT", accountId: "act_123" }
  ])), /Duplicate/);
});

test("snapshot hashes are stable across object key ordering", () => {
  assert.equal(stablePayloadHash({ status: "ACTIVE", daily_budget: 100, nested: { b: 2, a: 1 } }), stablePayloadHash({ nested: { a: 1, b: 2 }, daily_budget: 100, status: "ACTIVE" }));
});
