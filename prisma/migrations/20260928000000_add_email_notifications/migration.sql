CREATE TABLE "EmailNotification" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "recipients" JSONB NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailNotification_eventKey_key" ON "EmailNotification"("eventKey");
CREATE INDEX "EmailNotification_sentAt_nextAttemptAt_idx" ON "EmailNotification"("sentAt", "nextAttemptAt");
