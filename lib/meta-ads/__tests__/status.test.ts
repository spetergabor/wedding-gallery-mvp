import assert from "node:assert/strict";
import test from "node:test";
import { resolveDeliveryStatus } from "../status";

const now = new Date("2026-11-25T12:00:00.000Z");

test("an enabled campaign with an expired schedule is completed", () => {
  assert.equal(resolveDeliveryStatus({ effectiveStatus: "ACTIVE", stopTime: "2026-11-13T12:23:57.000Z" }, now), "COMPLETED");
});

test("a campaign with a future stop time remains active", () => {
  assert.equal(resolveDeliveryStatus({ effectiveStatus: "ACTIVE", stopTime: "2026-12-05T09:45:00.000Z" }, now), "ACTIVE");
});

test("a child entity inherits an expired parent schedule", () => {
  assert.equal(resolveDeliveryStatus({ effectiveStatus: "ACTIVE", parentStopTime: "2026-11-13T12:23:57.000Z" }, now), "COMPLETED");
});

test("deleted and archived states remain explicit", () => {
  assert.equal(resolveDeliveryStatus({ effectiveStatus: "DELETED", stopTime: "2026-11-13T12:23:57.000Z" }, now), "DELETED");
  assert.equal(resolveDeliveryStatus({ effectiveStatus: "ARCHIVED", stopTime: "2026-11-13T12:23:57.000Z" }, now), "ARCHIVED");
});
