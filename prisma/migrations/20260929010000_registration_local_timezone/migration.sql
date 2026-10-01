ALTER TABLE "Student"
ADD COLUMN "preferredTimeZone" TEXT,
ADD COLUMN "preferredLocalTime" TEXT,
ADD COLUMN "preferredLocalDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN "preferredStartDate" TIMESTAMP(3);
