import { randomUUID } from "node:crypto";
import { prisma } from "../config/prisma.js";
import type { ClassScheduleEvent, Prisma } from "../generated/prisma/client.js";
import { MAKEUP_RATE_BDT, makeupAmount, makeupPeriod, remainingMinutes } from "./makeupCreditMath.js";

type Tx = Prisma.TransactionClient;
const issueStatuses = ["ABSENT_ISSUE_MAKEUP_CREDIT", "TUTOR_CANCELLED_ISSUE_MAKEUP_CREDIT"];
const conflict = (message: string) => Object.assign(new Error(message), { statusCode: 409 });

// All attendance, reservations and settlements serialize on the same student row.
export const lockMakeupStudents = async (tx: Tx, ids: string[]) => {
  for (const id of [...new Set(ids)].sort()) {
    await tx.$queryRaw`SELECT id FROM "Student" WHERE id = ${id} FOR UPDATE`;
  }
};

export const syncMakeupCredit = async (tx: Tx, event: ClassScheduleEvent, actorId?: string, now = new Date()) => {
  const earned = await tx.makeupCredit.findUnique({ where: { sourceEventId: event.id }, include: { uses: true } });
  const issue = !event.makeupCredit && issueStatuses.includes(event.attendanceStatus);
  if (earned) {
    const changed = !issue || earned.studentId !== event.studentId || earned.durationMinutes !== event.durationMinutes
      || earned.periodKey !== makeupPeriod(event.scheduledDate).key;
    if (changed && (earned.adjustmentId || earned.uses.some((use) => use.status !== "RELEASED"))) {
      throw conflict("This attendance credit has been used, reserved or adjusted. Its original attendance and duration cannot be changed.");
    }
    if (!issue && !earned.revokedAt) {
      await tx.makeupCredit.update({ where: { id: earned.id }, data: { revokedAt: now } });
    }
  }
  if (issue) {
    if (event.scheduledDate > now) throw conflict("Make-up credits can only be issued for classes whose date has arrived.");
    const period = makeupPeriod(event.scheduledDate);
    await tx.makeupCredit.upsert({
      where: { sourceEventId: event.id },
      create: { studentId: event.studentId, sourceEventId: event.id, durationMinutes: event.durationMinutes,
        periodKey: period.key, expiresAt: period.expiresAt, createdById: actorId },
      update: { studentId: event.studentId, durationMinutes: event.durationMinutes, periodKey: period.key,
        expiresAt: period.expiresAt, revokedAt: null },
    });
  }

  const uses = await tx.makeupCreditUse.findMany({ where: { eventId: event.id, status: { not: "RELEASED" } } });
  const settledUses = await tx.makeupCreditUse.count({ where: { eventId: event.id, status: "USED", credit: { adjustmentId: { not: null } } } });
  if (settledUses && (!event.makeupCredit || event.status === "CANCELLED" || event.attendanceStatus !== "PRESENT")) {
    throw conflict("This make-up class is part of a settled half-year adjustment. Its attendance cannot be reversed.");
  }
  const requiresCredit = event.makeupCredit && event.status !== "CANCELLED"
    && ["UNRECORDED", "PRESENT"].includes(event.attendanceStatus);
  if (requiresCredit && event.isRecurring) throw conflict("Make-up classes must be scheduled individually against available credits.");
  if (requiresCredit && event.attendanceStatus === "PRESENT" && event.scheduledDate > now) {
    throw conflict("A future make-up class cannot be marked present.");
  }
  if (requiresCredit && uses.reduce((sum, use) => sum + use.minutes, 0) === event.durationMinutes) {
    await tx.makeupCreditUse.updateMany({ where: { eventId: event.id, status: { not: "RELEASED" } },
      data: { status: event.attendanceStatus === "PRESENT" ? "USED" : "RESERVED" } });
    return;
  }
  await tx.makeupCreditUse.updateMany({ where: { eventId: event.id }, data: { status: "RELEASED" } });
  if (!requiresCredit) return;
  const credits = await tx.makeupCredit.findMany({
    where: { studentId: event.studentId, revokedAt: null, adjustmentId: null,
      expiresAt: { gt: now > event.scheduledDate ? now : event.scheduledDate },
      sourceEvent: { scheduledDate: { lte: event.scheduledDate } } },
    include: { uses: true }, orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  let needed = event.durationMinutes;
  for (const credit of credits) {
    const minutes = Math.min(needed, remainingMinutes(credit));
    if (!minutes) continue;
    const status = event.attendanceStatus === "PRESENT" ? "USED" : "RESERVED";
    await tx.makeupCreditUse.upsert({ where: { creditId_eventId: { creditId: credit.id, eventId: event.id } },
      create: { creditId: credit.id, eventId: event.id, minutes, status }, update: { minutes, status } });
    needed -= minutes;
    if (!needed) break;
  }
  if (needed) throw conflict(`Not enough make-up credit: this class needs ${event.durationMinutes} minutes, but only ${event.durationMinutes - needed} minutes are available before the half-year cutoff.`);
};

export const settleStudentMakeupCredits = async (tx: Tx, studentId: string, now: Date) => {
  await lockMakeupStudents(tx, [studentId]);
  // Legacy make-up classes without enough linked minutes need review before any refund.
  const unresolved = await getUnreconciledMakeupClasses(tx, studentId);
  if (unresolved.length) return;
  const credits = await tx.makeupCredit.findMany({ where: { studentId, expiresAt: { lte: now }, revokedAt: null, adjustmentId: null }, include: { uses: true } });
  const eligible = credits.filter((credit) => !credit.uses.some((use) => use.status === "RESERVED") && remainingMinutes(credit) > 0);
  for (const key of new Set(eligible.map((credit) => credit.periodKey))) {
    const group = eligible.filter((credit) => credit.periodKey === key);
    const minutes = group.reduce((sum, credit) => sum + remainingMinutes(credit), 0);
    const [year, half] = key.split("-");
    const period = `${half === "H1" ? "January-June" : "July-December"} ${year}`;
    const transaction = await tx.studentBillingTransaction.create({ data: {
      studentId, type: "DISCOUNT", amountBdt: makeupAmount(minutes), date: now,
      category: "MAKEUP_CREDIT_ADJUSTMENT", automationKey: `makeup:${studentId}:${key}:${randomUUID()}`,
      description: `Make-up credit adjusted: ${group.length} credit(s), ${minutes} minutes (${Number((minutes / 60).toFixed(4))} hours) at BDT ${MAKEUP_RATE_BDT}/hour; ${period}.`,
    } });
    for (const credit of group) {
      await tx.makeupCredit.update({ where: { id: credit.id }, data: { adjustedMinutes: remainingMinutes(credit), adjustmentId: transaction.id } });
    }
  }
};

const getUnreconciledMakeupClasses = async (tx: Tx, studentId: string) => {
  const events = await tx.classScheduleEvent.findMany({ where: { studentId, makeupCredit: true,
    status: { not: "CANCELLED" }, attendanceStatus: { in: ["UNRECORDED", "PRESENT"] } },
    select: { id: true, durationMinutes: true, makeupUses: { where: { status: { not: "RELEASED" } }, select: { minutes: true } } } });
  return events.filter((event) => event.makeupUses.reduce((sum, use) => sum + use.minutes, 0) < event.durationMinutes);
};

export const getStudentMakeupReviewCount = async (studentId: string) =>
  (await getUnreconciledMakeupClasses(prisma, studentId)).length;

export const settleMakeupCredits = async (now = new Date()) => {
  const students = await prisma.makeupCredit.findMany({
    where: { expiresAt: { lte: now }, revokedAt: null, adjustmentId: null },
    distinct: ["studentId"], select: { studentId: true },
  });
  for (const { studentId } of students) {
    await prisma.$transaction((tx) => settleStudentMakeupCredits(tx, studentId, now), { timeout: 30_000 });
  }
};

export const getStudentMakeupCredits = async (studentId: string, now = new Date()) => {
  const credits = await prisma.makeupCredit.findMany({ where: { studentId, revokedAt: null },
    include: { uses: true, sourceEvent: { select: { scheduledDate: true } }, adjustment: true },
    orderBy: { createdAt: "desc" } });
  return credits.map((credit) => ({
    id: credit.id, date: credit.sourceEvent.scheduledDate, durationMinutes: credit.durationMinutes,
    period: credit.periodKey, expiresAt: credit.expiresAt,
    availableMinutes: credit.expiresAt > now ? remainingMinutes(credit) : 0,
    pendingAdjustmentMinutes: credit.expiresAt <= now ? remainingMinutes(credit) : 0,
    reservedMinutes: credit.uses.filter((use) => use.status === "RESERVED").reduce((sum, use) => sum + use.minutes, 0),
    usedMinutes: credit.uses.filter((use) => use.status === "USED").reduce((sum, use) => sum + use.minutes, 0),
    adjustedMinutes: credit.adjustedMinutes,
    adjustment: credit.adjustment ? { id: credit.adjustment.id, date: credit.adjustment.date,
      amountBdt: Number(credit.adjustment.amountBdt), description: credit.adjustment.description } : null,
  }));
};
