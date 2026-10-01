import assert from "node:assert/strict";
import test from "node:test";
import { convertRegistrationSchedule as convert } from "./registrationSchedule.js";

const input = { country: "GB", timeZone: "Europe/London", startDate: "2026-06-01", classStartTime: "17:00", classDays: [0, 2, 4], classDurationMinutes: 45 };
void test("local schedule uses seasonal offsets, not a fixed country offset", () => {
  assert.equal(convert(input).classStartTime, "22:00");
  assert.equal(convert({ ...input, startDate: "2026-01-05" }).classStartTime, "23:00");
});
void test("conversion moves local weekdays forward across midnight", () => {
  const result = convert({ ...input, classStartTime: "22:00", classDays: [0, 6] });
  assert.equal(result.classStartTime, "03:00");
  assert.deepEqual(result.classDays, [0, 1]);
  assert.equal(result.classStartDate.toISOString().slice(0, 10), "2026-06-02");
  assert.deepEqual(result.preferredLocalDays, [0, 6]);
});
void test("conversion moves local weekdays backward across midnight", () => {
  const result = convert({ ...input, country: "NZ", timeZone: "Pacific/Auckland", classStartTime: "01:00", classDays: [0] });
  assert.equal(result.classStartTime, "19:00");
  assert.deepEqual(result.classDays, [6]);
  assert.equal(result.classStartDate.toISOString().slice(0, 10), "2026-05-31");
});
void test("fractional-hour zones convert precisely", () => {
  assert.equal(convert({ ...input, country: "IN", timeZone: "Asia/Kolkata", classStartTime: "09:00" }).classStartTime, "09:30");
  assert.equal(convert({ ...input, country: "NP", timeZone: "Asia/Kathmandu", classStartTime: "09:00" }).classStartTime, "09:15");
});
void test("clock-change gaps and repeated local times require an explicit correction", () => {
  assert.throws(() => convert({ ...input, startDate: "2026-03-29", classDays: [6], classStartTime: "01:30" }), /unavailable/);
  assert.throws(() => convert({ ...input, startDate: "2026-10-25", classDays: [6], classStartTime: "01:30" }), /ambiguous/);
  assert.throws(() => convert({ ...input, startDate: "2026-03-27" }), /daylight-saving/);
});
void test("invalid dates, country-zone mismatches and Bangladesh overnight classes are rejected", () => {
  assert.throws(() => convert({ ...input, startDate: "2026-02-30" }), /date/);
  assert.throws(() => convert({ ...input, timeZone: "Asia/Dhaka" }), /time zone/);
  assert.throws(() => convert({ ...input, timeZone: "Invalid/Zone" }), /time zone/);
  assert.throws(() => convert({ ...input, classStartTime: "18:45" }), /midnight/);
});
