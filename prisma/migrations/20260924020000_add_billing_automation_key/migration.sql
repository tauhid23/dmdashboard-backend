ALTER TABLE "StudentBillingTransaction" ADD COLUMN "automationKey" TEXT;
CREATE UNIQUE INDEX "StudentBillingTransaction_automationKey_key" ON "StudentBillingTransaction"("automationKey");
