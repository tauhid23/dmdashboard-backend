CREATE TABLE "MakeupCredit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "studentId" TEXT NOT NULL REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "sourceEventId" TEXT NOT NULL UNIQUE REFERENCES "ClassScheduleEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "durationMinutes" INTEGER NOT NULL CHECK ("durationMinutes" > 0),
  "periodKey" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "adjustedMinutes" INTEGER NOT NULL DEFAULT 0 CHECK ("adjustedMinutes" >= 0 AND "adjustedMinutes" <= "durationMinutes"),
  "adjustmentId" TEXT REFERENCES "StudentBillingTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "MakeupCredit_studentId_expiresAt_idx" ON "MakeupCredit"("studentId", "expiresAt");
CREATE TABLE "MakeupCreditUse" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "creditId" TEXT NOT NULL REFERENCES "MakeupCredit"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "eventId" TEXT NOT NULL REFERENCES "ClassScheduleEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "minutes" INTEGER NOT NULL CHECK ("minutes" > 0),
  "status" TEXT NOT NULL CHECK ("status" IN ('RESERVED', 'USED', 'RELEASED')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "MakeupCreditUse_creditId_eventId_key" ON "MakeupCreditUse"("creditId", "eventId");
CREATE INDEX "MakeupCreditUse_eventId_idx" ON "MakeupCreditUse"("eventId");

-- Preserve existing attendance credits, with their original class duration.
INSERT INTO "MakeupCredit" ("id", "studentId", "sourceEventId", "durationMinutes", "periodKey", "expiresAt", "createdAt", "updatedAt")
SELECT 'legacy:' || "id", "studentId", "id", "durationMinutes",
  to_char("scheduledDate" + interval '6 hours', 'YYYY') || '-H' || CASE WHEN extract(month FROM "scheduledDate" + interval '6 hours') <= 6 THEN '1' ELSE '2' END,
  date_trunc('year', "scheduledDate" + interval '6 hours') + CASE WHEN extract(month FROM "scheduledDate" + interval '6 hours') <= 6 THEN interval '6 months' ELSE interval '12 months' END - interval '6 hours',
  "createdAt", CURRENT_TIMESTAMP
FROM "ClassScheduleEvent"
WHERE NOT "makeupCredit" AND "attendanceStatus" IN ('ABSENT_ISSUE_MAKEUP_CREDIT', 'TUTOR_CANCELLED_ISSUE_MAKEUP_CREDIT') AND "scheduledDate" <= CURRENT_TIMESTAMP;

-- Existing make-up bookings spend the oldest eligible minutes first.
DO $$
DECLARE e RECORD; c RECORD; needed INTEGER; allocation INTEGER;
BEGIN
  FOR e IN SELECT * FROM "ClassScheduleEvent" WHERE "makeupCredit" AND "status" <> 'CANCELLED'
    AND "attendanceStatus" IN ('PRESENT', 'UNRECORDED') ORDER BY "scheduledDate", "startTime", "id"
  LOOP
    needed := e."durationMinutes";
    FOR c IN SELECT mc.*, mc."durationMinutes" - COALESCE((SELECT SUM(u."minutes") FROM "MakeupCreditUse" u WHERE u."creditId" = mc."id"), 0) AS available
      FROM "MakeupCredit" mc JOIN "ClassScheduleEvent" src ON src."id" = mc."sourceEventId"
      WHERE mc."studentId" = e."studentId" AND src."scheduledDate" <= e."scheduledDate" AND mc."expiresAt" > e."scheduledDate"
      ORDER BY mc."expiresAt", src."scheduledDate", mc."id"
    LOOP
      allocation := LEAST(needed, c.available);
      IF allocation > 0 THEN
        INSERT INTO "MakeupCreditUse" ("id", "creditId", "eventId", "minutes", "status", "updatedAt")
        VALUES ('legacy:' || c."id" || ':' || e."id", c."id", e."id", allocation,
          CASE WHEN e."attendanceStatus" = 'PRESENT' THEN 'USED' ELSE 'RESERVED' END, CURRENT_TIMESTAMP);
        needed := needed - allocation;
      END IF;
      EXIT WHEN needed = 0;
    END LOOP;
  END LOOP;
END $$;
