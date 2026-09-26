import assert from "node:assert/strict";
import test from "node:test";
import { findStudentPackage, packageAmount } from "./packageCatalog.js";

void test("matches the 45-minute three-day package", () => {
  const item = findStudentPackage({ durationMinutes: 45, classesPerWeek: 3, weeklyHours: 2.25 });
  assert.equal(item?.code, "G");
  assert.equal(item && packageAmount(item, "MONTHLY"), 6000);
  assert.equal(item && packageAmount(item, "QUARTERLY"), 17000);
});

void test("matches the 60-minute one-day package", () => {
  assert.equal(findStudentPackage({ durationMinutes: 60, classesPerWeek: 1, weeklyHours: 1 })?.code, "K");
});

void test("matches the group package separately", () => {
  assert.equal(findStudentPackage({ durationMinutes: 60, classesPerWeek: 3, weeklyHours: 3, groupClass: true })?.code, "S");
});
