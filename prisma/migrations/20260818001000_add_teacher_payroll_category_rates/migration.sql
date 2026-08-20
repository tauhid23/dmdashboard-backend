CREATE TABLE "TeacherPayrollCategoryRate" (
  "id" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "hourlyRateBdt" DECIMAL(10, 2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TeacherPayrollCategoryRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeacherPayrollCategoryRate_teacherId_category_key"
ON "TeacherPayrollCategoryRate"("teacherId", "category");

CREATE INDEX "TeacherPayrollCategoryRate_teacherId_idx"
ON "TeacherPayrollCategoryRate"("teacherId");

ALTER TABLE "TeacherPayrollCategoryRate"
ADD CONSTRAINT "TeacherPayrollCategoryRate_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
