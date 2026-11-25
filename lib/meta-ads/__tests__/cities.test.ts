import assert from "node:assert/strict";
import test from "node:test";
import { resolveIrisMomentCity } from "../cities";

test("maps known IRISMOMENT campaign names to explicit cities", () => {
  assert.equal(resolveIrisMomentCity("Liezen | Website Lead | 2026.11.28")?.key, "liezen");
  assert.equal(resolveIrisMomentCity("Ried | Website Lead | 2026.12.04-05")?.key, "ried-im-innkreis");
  assert.equal(resolveIrisMomentCity("irisfotografie-in-krems-am-der-donau")?.key, "krems-an-der-donau");
});

test("matches event locations with accented city names", () => {
  assert.equal(resolveIrisMomentCity("Vöcklabruck")?.key, "voecklabruck");
  assert.equal(resolveIrisMomentCity("Spittal an der Drau")?.key, "spittal-an-der-drau");
});

test("does not invent a city for an unknown campaign", () => {
  assert.equal(resolveIrisMomentCity("Irisfoto_Conv_Interest+Remark+LL_Ongoing"), null);
});
