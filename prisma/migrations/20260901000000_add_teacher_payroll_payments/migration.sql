CREATE TABLE "TeacherPayrollPayment" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amountBdt" DECIMAL(10,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "method" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherPayrollPayment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeacherPayrollPayment_teacherId_month_idx" ON "TeacherPayrollPayment"("teacherId", "month");
CREATE INDEX "TeacherPayrollPayment_paymentDate_idx" ON "TeacherPayrollPayment"("paymentDate");
ALTER TABLE "TeacherPayrollPayment" ADD CONSTRAINT "TeacherPayrollPayment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;