ALTER TABLE "Student"
ADD COLUMN "classStartTime" TEXT,
ADD COLUMN "classDurationMinutes" INTEGER,
ADD COLUMN "classDays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];

ALTER TABLE "Student"
ADD CONSTRAINT "Student_classDurationMinutes_check"
CHECK ("classDurationMinutes" IS NULL OR "classDurationMinutes" IN (30, 45, 60));

ALTER TABLE "Student"
ADD CONSTRAINT "Student_classStartTime_check"
CHECK ("classStartTime" IS NULL OR "classStartTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');

ALTER TABLE "Student"
ADD CONSTRAINT "Student_classDays_check"
CHECK (
  "classDays" <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[]
);
