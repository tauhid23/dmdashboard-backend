-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TRIAL', 'NEW_SIGN_UP');

-- Clear previous student data for the new student table shape.
TRUNCATE TABLE "Student" CASCADE;

-- AlterTable
ALTER TABLE "Student"
  ADD COLUMN "courseName" TEXT,
  ADD COLUMN "courseStage" TEXT,
  ADD COLUMN "teacherId" TEXT,
  ADD COLUMN "teacherName" TEXT,
  ADD COLUMN "groupClass" BOOLEAN DEFAULT false,
  ADD COLUMN "groupSchedule" TEXT,
  ADD COLUMN "groupSubject" TEXT,
  ADD COLUMN "teacherChanged" BOOLEAN DEFAULT false,
  ADD COLUMN "previousTeacherName" TEXT,
  ADD COLUMN "teacherChangeReason" TEXT,
  ADD COLUMN "status" "StudentStatus" DEFAULT 'ACTIVE';
