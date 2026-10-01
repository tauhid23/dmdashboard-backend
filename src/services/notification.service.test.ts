import assert from "node:assert/strict";
import test from "node:test";

import { mergeStaffRecipients, remainingRecipients } from "./notification.service.js";

void test("staff alerts include admins and managers without duplicate or placeholder addresses", () => {
  assert.deepEqual(
    mergeStaffRecipients(
      ["ADMIN@example.com", "admin@admin.com"],
      ["shared@example.com"],
      ["manager@example.com", "admin@example.com"],
    ),
    ["admin@example.com", "shared@example.com", "manager@example.com"],
  );
});

void test("partial SMTP acceptance retries only undelivered recipients", () => {
  assert.deepEqual(
    remainingRecipients(["Parent@example.com", "manager@example.com"], ["parent@example.com"]),
    ["manager@example.com"],
  );
  assert.deepEqual(
    remainingRecipients(["admin@example.com", "manager@example.com"], [{ address: "ADMIN@example.com" }]),
    ["manager@example.com"],
  );
});
