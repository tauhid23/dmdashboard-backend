import assert from "node:assert/strict";
import test from "node:test";

import { defaultSettings, normalizeSettings } from "./settings.service.js";

void test("invoice PDF settings receive stable defaults", () => {
  const settings = normalizeSettings({});

  assert.deepEqual(settings.invoicing, defaultSettings.invoicing);
});

void test("invoice PDF settings normalize saved admin choices", () => {
  const settings = normalizeSettings({
    invoicing: {
      pdfTemplate: "modern",
      pdfAccentColor: "#12ABEF",
      pdfNotes: "  Payment instructions  ",
      emailSubject: "  Your invoice {{invoiceNumber}}  ",
      emailBody: "  Hello {{familyName}}  ",
    },
  });

  assert.deepEqual(settings.invoicing, {
    pdfTemplate: "MODERN",
    pdfAccentColor: "#12abef",
    pdfNotes: "Payment instructions",
    emailSubject: "Your invoice {{invoiceNumber}}",
    emailBody: "Hello {{familyName}}",
  });
});

void test("invalid invoice PDF settings fall back safely", () => {
  const settings = normalizeSettings({
    invoicing: {
      pdfTemplate: "unknown",
      pdfAccentColor: "red",
    },
  });

  assert.equal(settings.invoicing.pdfTemplate, defaultSettings.invoicing.pdfTemplate);
  assert.equal(settings.invoicing.pdfAccentColor, defaultSettings.invoicing.pdfAccentColor);
});

void test("manager notification addresses are normalized and deduplicated", () => {
  const settings = normalizeSettings({ notifications: {
    managerEmails: [" Manager@Example.com ", "manager@example.com", "principal@example.com"],
  } });
  assert.deepEqual(settings.notifications.managerEmails, ["manager@example.com", "principal@example.com"]);
});

void test("invalid manager notification addresses are rejected", () => {
  assert.throws(
    () => normalizeSettings({ notifications: { managerEmails: ["not-an-email"] } }),
    /Validation failed/,
  );
});
