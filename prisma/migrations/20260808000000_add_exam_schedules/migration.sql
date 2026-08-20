CREATE TYPE "ExamScheduleStatus" AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED');

CREATE TABLE "ExamSchedule" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "courseName" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "status" "ExamScheduleStatus" NOT NULL DEFAULT 'UPCOMING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExamSchedule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExamSchedule_studentId_scheduledAt_idx" ON "ExamSchedule"("studentId", "scheduledAt");
CREATE INDEX "ExamSchedule_teacherId_scheduledAt_idx" ON "ExamSchedule"("teacherId", "scheduledAt");
CREATE INDEX "ExamSchedule_status_scheduledAt_idx" ON "ExamSchedule"("status", "scheduledAt");

ALTER TABLE "ExamSchedule" ADD CONSTRAINT "ExamSchedule_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamSchedule" ADD CONSTRAINT "ExamSchedule_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
