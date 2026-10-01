DROP INDEX IF EXISTS "User_normalizedEmail_key";
CREATE INDEX "User_normalizedEmail_idx" ON "User"("normalizedEmail");
