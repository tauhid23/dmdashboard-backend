import { prisma } from "../config/prisma.js";
import { makeupAmount } from "../services/makeupCreditMath.js";

try {
  const credits = await prisma.makeupCredit.findMany({ include: { uses: { include: { event: { select: { studentId: true } } } } } });
  const invalidCredits = credits.filter((credit) => {
    const active = credit.uses.filter((use) => use.status !== "RELEASED");
    return active.reduce((sum, use) => sum + use.minutes, credit.adjustedMinutes) > credit.durationMinutes
      || active.some((use) => use.event.studentId !== credit.studentId);
  });
  const adjustments = await prisma.studentBillingTransaction.findMany({ where: { automationKey: { startsWith: "makeup:" } }, include: { makeupCredits: true } });
  const invalidAdjustments = adjustments.filter((item) => Number(item.amountBdt) !== makeupAmount(item.makeupCredits.reduce((sum, credit) => sum + credit.adjustedMinutes, 0)));
  const events = await prisma.classScheduleEvent.findMany({ where: { makeupCredit: true, status: { not: "CANCELLED" }, attendanceStatus: { in: ["UNRECORDED", "PRESENT"] } }, include: { makeupUses: true } });
  const reviewCount = events.filter((event) => event.makeupUses.filter((use) => use.status !== "RELEASED").reduce((sum, use) => sum + use.minutes, 0) < event.durationMinutes).length;
  console.log(JSON.stringify({ credits: credits.length, adjustments: adjustments.length, historicalClassesNeedingReview: reviewCount, invalidCredits: invalidCredits.length, invalidAdjustments: invalidAdjustments.length }));
  if (invalidCredits.length || invalidAdjustments.length) process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
