ALTER TABLE "StudentCourse"
  ALTER COLUMN "courseInformation" DROP NOT NULL,
  ALTER COLUMN "courseStage" DROP NOT NULL;

ALTER TABLE "TeacherChange"
  ALTER COLUMN "previousTeacherName" DROP NOT NULL,
  ALTER COLUMN "changingReason" DROP NOT NULL;
