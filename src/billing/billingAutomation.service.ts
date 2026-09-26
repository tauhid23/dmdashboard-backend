import { prisma } from "../config/prisma.js";

const RATE_PER_HOUR_BDT = 500;
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const startOfMonth = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
const monthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
const mondayDay = (date: Date) => (date.getUTCDay() + 6) % 7;
const asDhakaCalendarDate = (date: Date) => {
  const dhaka = new Date(date.getTime() + DHAKA_OFFSET_MS);
  return new Date(Date.UTC(dhaka.getUTCFullYear(), dhaka.getUTCMonth(), dhaka.getUTCDate()));
};

export const missedClassSummary = (classStartDate: Date, classDays: number[], durationMinutes: number) => {
  if (classStartDate.getUTCDate() <= 15) return { classes: 0, minutes: 0, discountBdt: 0 };
  const selectedDays = new Set(classDays);
  let classes = 0;
  const cursor = startOfMonth(classStartDate);
  while (cursor < classStartDate) {
    if (selectedDays.has(mondayDay(cursor))) classes += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const minutes = classes * durationMinutes;
  return { classes, minutes, discountBdt: Math.round((minutes / 60) * RATE_PER_HOUR_BDT * 100) / 100 };
};

export const materializeStudentBillingThrough = async (studentId: string, throughDate: Date) => {
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student?.scheduleConfirmed || !student.billingAmountBdt) return;
  const schedule = await prisma.classScheduleEvent.findFirst({
    where: { studentId, status: "CONFIRMED", recurrenceSourceId: null, isRecurring: true },
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }]
  });
  const effectiveStartDate = schedule?.scheduledDate
    ? asDhakaCalendarDate(schedule.scheduledDate)
    : student.classStartDate;
  if (!effectiveStartDate) return;
  const effectiveClassDays = student.classDays.length ? student.classDays : schedule?.repeatDays ?? [];
  const effectiveDuration = student.classDurationMinutes ?? schedule?.durationMinutes ?? 0;
  const firstBillingMonth = startOfMonth(effectiveStartDate);
  const lastBillingMonth = startOfMonth(throughDate);
  if (firstBillingMonth > lastBillingMonth) return;
  const interval = student.billingCycle === "QUARTERLY" ? 3 : 1;
  const creates = [];
  const cursor = new Date(firstBillingMonth);
  while (cursor <= lastBillingMonth) {
    const key = monthKey(cursor);
    creates.push(prisma.studentBillingTransaction.upsert({
      where: { automationKey: `package:${student.id}:${key}` },
      update: student.billingManualOverride ? { amountBdt: student.billingAmountBdt, frequency: interval === 3 ? "QUARTERLY" : "MONTHLY" } : {},
      create: { studentId: student.id, type: "PACKAGE", amountBdt: student.billingAmountBdt, date: new Date(cursor), description: `Package ${student.packageCode ?? "Custom"} · ${Number(student.weeklyHours ?? 0).toFixed(2)} hrs/week · ${interval === 3 ? "Quarterly" : "Monthly"}`, category: "Tuition package", recurring: true, frequency: interval === 3 ? "QUARTERLY" : "MONTHLY", repeatsEvery: interval, automationKey: `package:${student.id}:${key}` }
    }));
    cursor.setUTCMonth(cursor.getUTCMonth() + interval);
  }
  const missed = missedClassSummary(effectiveStartDate, effectiveClassDays, effectiveDuration);
  if (missed.discountBdt > 0) {
    const key = monthKey(firstBillingMonth);
    creates.push(prisma.studentBillingTransaction.upsert({
      where: { automationKey: `start-discount:${student.id}:${key}` }, update: { amountBdt: missed.discountBdt, description: `Missed class adjustment: ${missed.classes} missed classes` },
      create: { studentId: student.id, type: "DISCOUNT", amountBdt: missed.discountBdt, date: firstBillingMonth, description: `Missed class adjustment: ${missed.classes} missed classes`, category: "Late-month start", recurring: false, automationKey: `start-discount:${student.id}:${key}` }
    }));
  }
  if (creates.length) await prisma.$transaction(creates);
};

export const materializeBillingThrough = async (studentIds: string[], throughDate: Date) => {
  for (const studentId of studentIds) await materializeStudentBillingThrough(studentId, throughDate);
};
