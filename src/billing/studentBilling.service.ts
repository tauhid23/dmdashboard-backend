import { prisma } from "../config/prisma.js";
import { findStudentPackage, packageAmount, type BillingCycle } from "./packageCatalog.js";

export const calculateBillingPlan = (input: { durationMinutes: number; classDays: number[]; groupClass: boolean; billingCycle: BillingCycle }) => {
  const classesPerWeek = new Set(input.classDays).size;
  const weeklyHours = input.durationMinutes * classesPerWeek / 60;
  const matchedPackage = findStudentPackage({ durationMinutes: input.durationMinutes, classesPerWeek, weeklyHours, groupClass: input.groupClass });
  if (!matchedPackage) return null;
  return { packageCode: matchedPackage.code, weeklyHours, monthlyPriceBdt: matchedPackage.monthlyPriceBdt, quarterlyPriceBdt: matchedPackage.quarterlyPriceBdt, billingAmountBdt: packageAmount(matchedPackage, input.billingCycle) };
};

export const recalculateStudentBillingFromSchedule = async (studentId: string) => {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student || student.billingManualOverride) return;
  const sources = await prisma.classScheduleEvent.findMany({ where: { studentId, status: "CONFIRMED", makeupCredit: false, recurrenceSourceId: null, isRecurring: true } });
  if (!sources.length) {
    await prisma.student.update({ where: { id: studentId }, data: { scheduleConfirmed: false } });
    return;
  }
  const weeklyMinutes = sources.reduce((sum, event) => sum + event.durationMinutes * new Set(event.repeatDays).size, 0);
  const weeklyHours = weeklyMinutes / 60;
  const singlePattern = sources.length === 1 ? sources[0] : null;
  const matchedPackage = findStudentPackage({ durationMinutes: singlePattern?.durationMinutes, classesPerWeek: singlePattern ? new Set(singlePattern.repeatDays).size : null, weeklyHours, groupClass: student.groupClass ?? false });
  if (!matchedPackage) return;
  const billingCycle = (student.billingCycle === "QUARTERLY" ? "QUARTERLY" : "MONTHLY") as BillingCycle;
  await prisma.student.update({ where: { id: studentId }, data: {
    packageCode: matchedPackage.code, weeklyHours, monthlyPriceBdt: matchedPackage.monthlyPriceBdt,
    quarterlyPriceBdt: matchedPackage.quarterlyPriceBdt, billingAmountBdt: packageAmount(matchedPackage, billingCycle), scheduleConfirmed: true
  } });
};
