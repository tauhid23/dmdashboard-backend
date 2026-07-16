-- Versioned, database-owned exam definitions. All new columns on historical
-- attempt tables are nullable so existing exam records remain valid.
CREATE TABLE "ExamRule" (
  "id" TEXT NOT NULL,
  "courseLevel" "CourseLevel" NOT NULL,
  "version" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "totalMaximumMarks" INTEGER NOT NULL,
  "passingMarks" INTEGER,
  "passingPercentage" DECIMAL(5,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExamRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExamRule_totalMaximumMarks_check" CHECK ("totalMaximumMarks" > 0)
);

CREATE TABLE "ExamRuleSection" (
  "id" TEXT NOT NULL,
  "examRuleId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "maximumMarks" INTEGER NOT NULL,
  "passingMarks" INTEGER,
  "sortOrder" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExamRuleSection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExamRuleSection_marks_check" CHECK ("maximumMarks" > 0 AND ("passingMarks" IS NULL OR ("passingMarks" >= 0 AND "passingMarks" <= "maximumMarks")))
);

CREATE TABLE "ExamRuleField" (
  "id" TEXT NOT NULL,
  "examRuleId" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "maximumMarks" INTEGER NOT NULL,
  "minimumMarks" INTEGER NOT NULL DEFAULT 0,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExamRuleField_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExamRuleField_marks_check" CHECK ("maximumMarks" > 0 AND "minimumMarks" >= 0 AND "minimumMarks" <= "maximumMarks")
);

ALTER TABLE "ExamAttempt" ADD COLUMN "examRuleId" TEXT, ADD COLUMN "examRuleVersion" INTEGER;
ALTER TABLE "ExamMark" ADD COLUMN "sectionLabel" TEXT, ADD COLUMN "examRuleFieldId" TEXT;
ALTER TABLE "ExamSectionResult" ALTER COLUMN "passingMarks" DROP NOT NULL, ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "ExamRule_courseLevel_version_key" ON "ExamRule"("courseLevel", "version");
CREATE INDEX "ExamRule_courseLevel_enabled_idx" ON "ExamRule"("courseLevel", "enabled");
CREATE UNIQUE INDEX "ExamRuleSection_examRuleId_key_key" ON "ExamRuleSection"("examRuleId", "key");
CREATE INDEX "ExamRuleSection_examRuleId_sortOrder_idx" ON "ExamRuleSection"("examRuleId", "sortOrder");
CREATE UNIQUE INDEX "ExamRuleField_examRuleId_key_key" ON "ExamRuleField"("examRuleId", "key");
CREATE INDEX "ExamRuleField_sectionId_sortOrder_idx" ON "ExamRuleField"("sectionId", "sortOrder");
CREATE INDEX "ExamAttempt_examRuleId_idx" ON "ExamAttempt"("examRuleId");
CREATE INDEX "ExamMark_examRuleFieldId_idx" ON "ExamMark"("examRuleFieldId");

ALTER TABLE "ExamRuleSection" ADD CONSTRAINT "ExamRuleSection_examRuleId_fkey" FOREIGN KEY ("examRuleId") REFERENCES "ExamRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamRuleField" ADD CONSTRAINT "ExamRuleField_examRuleId_fkey" FOREIGN KEY ("examRuleId") REFERENCES "ExamRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamRuleField" ADD CONSTRAINT "ExamRuleField_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ExamRuleSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_examRuleId_fkey" FOREIGN KEY ("examRuleId") REFERENCES "ExamRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamMark" ADD CONSTRAINT "ExamMark_examRuleFieldId_fkey" FOREIGN KEY ("examRuleFieldId") REFERENCES "ExamRuleField"("id") ON DELETE SET NULL ON UPDATE CASCADE;
