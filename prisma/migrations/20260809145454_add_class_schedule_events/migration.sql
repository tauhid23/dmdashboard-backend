-- DropIndex
DROP INDEX "ClassReport_adminNote_trgm_idx";

-- DropIndex
DROP INDEX "ClassReport_createdAt_id_idx";

-- DropIndex
DROP INDEX "ClassReport_month_createdAt_idx";

-- DropIndex
DROP INDEX "ClassReport_studentId_createdAt_idx";

-- DropIndex
DROP INDEX "ClassReport_studentName_trgm_idx";

-- DropIndex
DROP INDEX "ClassReport_teacherId_createdAt_idx";

-- DropIndex
DROP INDEX "ClassReport_teacherName_trgm_idx";

-- DropIndex
DROP INDEX "ClassReport_teacherNote_trgm_idx";

-- DropIndex
DROP INDEX "Student_name_trgm_idx";

-- DropIndex
DROP INDEX "Teacher_name_trgm_idx";

-- CreateIndex
CREATE INDEX "ClassReport_createdAt_id_idx" ON "ClassReport"("createdAt", "id");

-- CreateIndex
CREATE INDEX "ClassReport_studentId_createdAt_idx" ON "ClassReport"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "ClassReport_teacherId_createdAt_idx" ON "ClassReport"("teacherId", "createdAt");

-- CreateIndex
CREATE INDEX "ClassReport_month_createdAt_idx" ON "ClassReport"("month", "createdAt");
