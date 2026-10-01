import assert from "node:assert/strict";
import test from "node:test";

import { buildInvoicePdf, type InvoicePdfSnapshot } from "./invoicePdf.js";

const snapshot = (lineItemCount = 1): InvoicePdfSnapshot => ({
  invoiceNumber: "DM-2026-0042",
  invoiceDate: "2026-09-01",
  rangeStart: "2026-09-01",
  rangeEnd: "2026-11-30",
  dueDate: "2026-09-15",
  familyName: "Abdul Sikder",
  billTo: {
    name: "Abdul Sikder",
    email: "parent@example.com",
    phone: "+8801000000000",
    country: "Bangladesh",
  },
  students: [
    {
      id: "student-1",
      name: "Amira Sikder",
      billingCycle: "QUARTERLY",
      subtotalBdt: 9_500,
    },
  ],
  summary: {
    previousBalanceBdt: 3_000,
    currentChargesBdt: 9_500,
    currentPaymentsBdt: 0,
    totalDueBdt: 12_500,
  },
  includeBalanceForward: true,
  lineItems: Array.from({ length: lineItemCount }, (_, index) => ({
    date: "2026-09-01",
    studentId: "student-1",
    studentName: "Amira Sikder",
    description: `Quarterly tuition charge ${index + 1}`,
    kind: "PACKAGE",
    chargesBdt: 9_500,
    paymentsBdt: 0,
  })),
  pdfTemplate: "CLASSIC",
  pdfAccentColor: "#5c4938",
  pdfNotes: "Please include the invoice number with your payment.",
});

void test("buildInvoicePdf creates a readable PDF invoice snapshot", () => {
  const pdf = buildInvoicePdf(snapshot());
  const content = pdf.toString("latin1");

  assert.equal(content.startsWith("%PDF-1.4"), true);
  assert.match(content, /DM-2026-0042/);
  assert.match(content, /Abdul Sikder/);
  assert.match(content, /12,500\.00 BDT/);
  assert.match(content, /%%EOF/);
});

void test("buildInvoicePdf adds pages for a long itemized invoice", () => {
  const content = buildInvoicePdf(snapshot(75)).toString("latin1");
  const pageCount = content.match(/\/Type \/Page\b/g)?.length ?? 0;

  assert.ok(pageCount > 1);
});

void test("invoice PDF templates produce distinct document layouts", () => {
  const classic = buildInvoicePdf({ ...snapshot(), pdfTemplate: "CLASSIC" });
  const modern = buildInvoicePdf({ ...snapshot(), pdfTemplate: "MODERN" });
  const minimal = buildInvoicePdf({ ...snapshot(), pdfTemplate: "MINIMAL" });

  assert.notDeepEqual(classic, modern);
  assert.notDeepEqual(modern, minimal);
  assert.notDeepEqual(classic, minimal);
});
