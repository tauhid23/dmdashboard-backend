ALTER TABLE "StudentInvoice" ADD COLUMN "automationKey" TEXT;
ALTER TABLE "StudentInvoice" ADD COLUMN "autoSendAt" TIMESTAMP(3);
ALTER TABLE "StudentInvoice" ADD COLUMN "sendingUntil" TIMESTAMP(3);

CREATE UNIQUE INDEX "StudentInvoice_automationKey_key" ON "StudentInvoice"("automationKey");
CREATE INDEX "StudentInvoice_autoSendAt_emailedAt_idx" ON "StudentInvoice"("autoSendAt", "emailedAt");

CREATE SEQUENCE "StudentInvoiceNumber_seq";
SELECT setval(
  '"StudentInvoiceNumber_seq"',
  GREATEST(
    COALESCE((SELECT MAX(substring("invoiceNumber" FROM '([0-9]+)$')::bigint) FROM "StudentInvoice" WHERE "invoiceNumber" ~ '[0-9]+$'), 0),
    (SELECT COUNT(*) FROM "StudentInvoice")
  ) + 1,
  false
);
