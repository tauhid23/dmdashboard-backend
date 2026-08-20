CREATE TABLE "ClassScheduleEvent" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "scheduledDate" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
  "attendanceStatus" TEXT NOT NULL DEFAULT 'UNRECORDED',
  "makeupCredit" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "recurrenceGroupId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClassScheduleEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClassScheduleEvent_scheduledDate_idx" ON "ClassScheduleEvent"("scheduledDate");
CREATE INDEX "ClassScheduleEvent_studentId_scheduledDate_idx" ON "ClassScheduleEvent"("studentId", "scheduledDate");
CREATE INDEX "ClassScheduleEvent_teacherId_scheduledDate_idx" ON "ClassScheduleEvent"("teacherId", "scheduledDate");
CREATE INDEX "ClassScheduleEvent_status_scheduledDate_idx" ON "ClassScheduleEvent"("status", "scheduledDate");
CREATE INDEX "ClassScheduleEvent_recurrenceGroupId_idx" ON "ClassScheduleEvent"("recurrenceGroupId");

ALTER TABLE "ClassScheduleEvent" ADD CONSTRAINT "ClassScheduleEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassScheduleEvent" ADD CONSTRAINT "ClassScheduleEvent_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
