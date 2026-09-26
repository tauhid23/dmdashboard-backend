CREATE TABLE "StudentBillingTransaction" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amountBdt" DECIMAL(10,2) NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "recurring" BOOLEAN NOT NULL DEFAULT false,
  "frequency" TEXT,
  "repeatsEvery" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentBillingTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentBillingTransaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "StudentBillingTransaction_studentId_date_idx" ON "StudentBillingTransaction"("studentId", "date");
CREATE INDEX "StudentBillingTransaction_type_date_idx" ON "StudentBillingTransaction"("type", "date");

CREATE TABLE "StudentInvoice" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "invoiceDate" TIMESTAMP(3) NOT NULL,
  "rangeStart" TIMESTAMP(3) NOT NULL,
  "rangeEnd" TIMESTAMP(3) NOT NULL,
  "dueDate" TIMESTAMP(3),
  "amountBdt" DECIMAL(10,2) NOT NULL,
  "paidAmountBdt" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "emailedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentInvoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentInvoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StudentInvoice_invoiceNumber_key" ON "StudentInvoice"("invoiceNumber");
CREATE INDEX "StudentInvoice_studentId_invoiceDate_idx" ON "StudentInvoice"("studentId", "invoiceDate");
CREATE INDEX "StudentInvoice_status_invoiceDate_idx" ON "StudentInvoice"("status", "invoiceDate");
