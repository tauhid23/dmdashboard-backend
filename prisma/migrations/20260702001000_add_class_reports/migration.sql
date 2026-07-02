CREATE TABLE "ClassReport" (
  "id" TEXT NOT NULL,
  "month" TEXT,
  "studentId" TEXT,
  "teacherId" TEXT,
  "studentName" TEXT,
  "teacherName" TEXT,
  "studentWebcamOn" BOOLEAN,
  "studentWebcamPosition" TEXT,
  "studentWebcamQuality" TEXT,
  "studentNoiseFree" TEXT,
  "studentDevice" TEXT,
  "studentDressup" TEXT,
  "attentionFocus" TEXT,
  "activityInClass" TEXT,
  "lessonUnderstanding" TEXT,
  "languageUnderstanding" TEXT,
  "teacherNote" TEXT,
  "teacherWebcamOn" BOOLEAN,
  "teacherWebcamPosition" TEXT,
  "teacherWebcamQuality" TEXT,
  "recommendedHeadphone" TEXT,
  "teacherNoiseFree" TEXT,
  "tutorDevice" TEXT,
  "tutorDressup" TEXT,
  "teachingFocus" TEXT,
  "teachingTone" TEXT,
  "toolsAndContentUse" TEXT,
  "studentInteraction" TEXT,
  "correctionQuality" TEXT,
  "adminNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClassReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClassReport_studentId_idx" ON "ClassReport"("studentId");
CREATE INDEX "ClassReport_teacherId_idx" ON "ClassReport"("teacherId");
CREATE INDEX "ClassReport_month_idx" ON "ClassReport"("month");

ALTER TABLE "ClassReport"
  ADD CONSTRAINT "ClassReport_studentId_fkey"
  FOREIGN KEY ("studentId")
  REFERENCES "Student"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "ClassReport"
  ADD CONSTRAINT "ClassReport_teacherId_fkey"
  FOREIGN KEY ("teacherId")
  REFERENCES "Teacher"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
