-- PostgreSQL partial uniqueness guarantees that a course level cannot expose
-- two active rule versions simultaneously.
CREATE UNIQUE INDEX "ExamRule_one_enabled_per_courseLevel_key"
ON "ExamRule" ("courseLevel")
WHERE "enabled" = true;
