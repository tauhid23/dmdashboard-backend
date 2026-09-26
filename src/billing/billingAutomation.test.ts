import assert from "node:assert/strict";
import test from "node:test";
import { missedClassSummary } from "./billingAutomation.service.js";

void test("does not discount students starting on or before the fifteenth", () => {
  assert.deepEqual(missedClassSummary(new Date("2026-09-15T00:00:00.000Z"), [0, 2, 4], 60), { classes: 0, minutes: 0, discountBdt: 0 });
});

void test("discounts scheduled classes missed before a late-month start", () => {
  const result = missedClassSummary(new Date("2026-09-20T00:00:00.000Z"), [0, 2, 4], 60);
  assert.equal(result.classes, 8);
  assert.equal(result.minutes, 480);
  assert.equal(result.discountBdt, 4000);
});

void test("uses duration when calculating partial hours", () => {
  const result = missedClassSummary(new Date("2026-09-20T00:00:00.000Z"), [0, 2, 4], 45);
  assert.equal(result.discountBdt, 3000);
});

void test("counts a September 26 Monday/Saturday start correctly", () => {
  const result = missedClassSummary(new Date("2026-09-26T00:00:00.000Z"), [0, 5], 45);
  assert.equal(result.classes, 6);
  assert.equal(result.discountBdt, 2250);
});
