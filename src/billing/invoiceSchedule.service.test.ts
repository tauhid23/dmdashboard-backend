import assert from "node:assert/strict";
import test from "node:test";

import { billingWindow } from "./invoiceSchedule.service.js";

void test("invoice dates follow Dhaka midnight across UTC dates", () => {
  const before = billingWindow(new Date("2026-10-01T17:59:59Z"));
  const second = billingWindow(new Date("2026-10-01T18:00:00Z"));
  const third = billingWindow(new Date("2026-10-02T18:00:00Z"));
  assert.equal(before.day, 1);
  assert.equal(second.day, 2);
  assert.equal(second.key, "2026-10");
  assert.equal(second.invoiceDate.toISOString(), "2026-10-02T00:00:00.000Z");
  assert.equal(second.quarterlyEnd.toISOString(), "2026-12-31T00:00:00.000Z");
  assert.equal(second.autoSendAt.toISOString(), "2026-10-02T18:00:00.000Z");
  assert.equal(third.day, 3);
});
