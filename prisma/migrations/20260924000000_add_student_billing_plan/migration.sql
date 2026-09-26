ALTER TABLE "Student"
ADD COLUMN "packageCode" TEXT,
ADD COLUMN "weeklyHours" DECIMAL(5,2),
ADD COLUMN "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN "monthlyPriceBdt" DECIMAL(10,2),
ADD COLUMN "quarterlyPriceBdt" DECIMAL(10,2),
ADD COLUMN "billingAmountBdt" DECIMAL(10,2),
ADD COLUMN "billingManualOverride" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "scheduleConfirmed" BOOLEAN NOT NULL DEFAULT false;
