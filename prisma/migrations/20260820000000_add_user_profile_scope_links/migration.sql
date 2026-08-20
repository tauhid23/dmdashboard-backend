ALTER TABLE "User"
ADD COLUMN "teacherId" TEXT,
ADD COLUMN "studentId" TEXT;

CREATE UNIQUE INDEX "User_teacherId_key" ON "User"("teacherId");
CREATE UNIQUE INDEX "User_studentId_key" ON "User"("studentId");

ALTER TABLE "User"
ADD CONSTRAINT "User_teacherId_fkey"
FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User"
ADD CONSTRAINT "User_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
