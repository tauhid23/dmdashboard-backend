ALTER TABLE "ClassScheduleEvent"
  ADD COLUMN "recurrenceSourceId" TEXT,
  ADD COLUMN "isRecurring" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "repeatDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "repeatIndefinitely" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "recurrenceEndDate" TIMESTAMP(3);

CREATE INDEX "ClassScheduleEvent_recurrenceSourceId_idx" ON "ClassScheduleEvent"("recurrenceSourceId");
