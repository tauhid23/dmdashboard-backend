import assert from "node:assert/strict";
import test from "node:test";
import { makeupAmount, makeupPeriod, remainingMinutes } from "./makeupCreditMath.js";

void test("half-year boundaries follow Dhaka midnight", () => {
  assert.equal(makeupPeriod(new Date("2026-06-30T17:59:59Z")).key, "2026-H1");
  assert.equal(makeupPeriod(new Date("2026-06-30T18:00:00Z")).key, "2026-H2");
  assert.equal(makeupPeriod(new Date("2026-12-31T18:00:00Z")).key, "2027-H1");
  assert.equal(makeupPeriod(new Date("2026-03-01")).expiresAt.toISOString(), "2026-06-30T18:00:00.000Z");
  assert.equal(makeupPeriod(new Date("2026-08-01")).expiresAt.toISOString(), "2026-12-31T18:00:00.000Z");
});

void test("adjustments use total duration at BDT 500 per hour", () => {
  assert.equal(makeupAmount(30), 250);
  assert.equal(makeupAmount(45), 375);
  assert.equal(makeupAmount(135), 1125);
  assert.equal(makeupAmount(5), 41.67);
});

void test("reserved, used and adjusted minutes cannot be spent again", () => {
  assert.equal(remainingMinutes({ durationMinutes: 90, adjustedMinutes: 15, uses: [
    { minutes: 30, status: "USED" }, { minutes: 15, status: "RESERVED" }, { minutes: 30, status: "RELEASED" },
  ] }), 30);
});
