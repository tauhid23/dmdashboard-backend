-- CreateEnum
CREATE TYPE "TeacherStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "imageUrl" TEXT,
    "joiningDate" TIMESTAMP(3),
    "status" "TeacherStatus" DEFAULT 'ACTIVE',
    "strongArea" TEXT,
    "totalStudentsAssignedLifetime" INTEGER DEFAULT 0,
    "currentActiveStudents" INTEGER DEFAULT 0,
    "studentLeftLifetime" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentLeftLog" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "studentName" TEXT,
    "leavingReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentLeftLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentLeftLog_teacherId_idx" ON "StudentLeftLog"("teacherId");

-- AddForeignKey
ALTER TABLE "StudentLeftLog" ADD CONSTRAINT "StudentLeftLog_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
