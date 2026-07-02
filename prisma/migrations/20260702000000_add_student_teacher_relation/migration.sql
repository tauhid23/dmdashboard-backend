CREATE INDEX "Student_teacherId_idx" ON "Student"("teacherId");

ALTER TABLE "Student"
  ADD CONSTRAINT "Student_teacherId_fkey"
  FOREIGN KEY ("teacherId")
  REFERENCES "Teacher"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
