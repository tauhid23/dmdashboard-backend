CREATE INDEX "ClassReport_createdAt_id_idx"
  ON "ClassReport"("createdAt" DESC, "id" DESC);

CREATE INDEX "ClassReport_studentId_createdAt_idx"
  ON "ClassReport"("studentId", "createdAt" DESC);

CREATE INDEX "ClassReport_teacherId_createdAt_idx"
  ON "ClassReport"("teacherId", "createdAt" DESC);

CREATE INDEX "ClassReport_month_createdAt_idx"
  ON "ClassReport"("month", "createdAt" DESC);

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "ClassReport_studentName_trgm_idx"
  ON "ClassReport" USING GIN ("studentName" gin_trgm_ops);

CREATE INDEX "ClassReport_teacherName_trgm_idx"
  ON "ClassReport" USING GIN ("teacherName" gin_trgm_ops);

CREATE INDEX "ClassReport_teacherNote_trgm_idx"
  ON "ClassReport" USING GIN ("teacherNote" gin_trgm_ops);

CREATE INDEX "ClassReport_adminNote_trgm_idx"
  ON "ClassReport" USING GIN ("adminNote" gin_trgm_ops);

CREATE INDEX "Student_name_trgm_idx"
  ON "Student" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "Teacher_name_trgm_idx"
  ON "Teacher" USING GIN ("name" gin_trgm_ops);
