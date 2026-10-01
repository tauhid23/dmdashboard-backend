import assert from "node:assert/strict";
import { prisma } from "../config/prisma.js";
import { syncMakeupCredit, settleStudentMakeupCredits } from "../services/makeupCredit.service.js";

// All fixtures and billing entries are rolled back, including on assertion failure.
const rollback = new Error("ROLLBACK_TEST_FIXTURES");
try {
  await prisma.$transaction(async (tx) => {
    const teacher = await tx.teacher.create({ data: { name: "Makeup integration fixture" } });
    const student = await tx.student.create({ data: { name: "Makeup integration fixture", teacherId: teacher.id } });
    const now = new Date("2026-06-15T12:00:00Z");
    const data = { studentId: student.id, teacherId: teacher.id, category: "Test", scheduledDate: new Date("2026-06-01T00:00:00Z"), startTime: "12:00", endTime: "12:45", durationMinutes: 45 };
    const missed = await tx.classScheduleEvent.create({ data: { ...data, attendanceStatus: "ABSENT_ISSUE_MAKEUP_CREDIT" } });
    await syncMakeupCredit(tx, missed, undefined, now);
    await syncMakeupCredit(tx, missed, undefined, now);
    assert.equal(await tx.makeupCredit.count({ where: { studentId: student.id } }), 1);
    const makeup = await tx.classScheduleEvent.create({ data: { ...data, durationMinutes: 30, makeupCredit: true } });
    await syncMakeupCredit(tx, makeup, undefined, now);
    assert.equal((await tx.makeupCreditUse.findFirstOrThrow({ where: { eventId: makeup.id } })).status, "RESERVED");
    const cutoff = new Date("2026-06-30T18:00:00Z");
    await settleStudentMakeupCredits(tx, student.id, cutoff);
    assert.equal(await tx.studentBillingTransaction.count({ where: { studentId: student.id } }), 0);
    await syncMakeupCredit(tx, { ...makeup, status: "CANCELLED" }, undefined, now);
    assert.equal((await tx.makeupCreditUse.findFirstOrThrow({ where: { eventId: makeup.id } })).status, "RELEASED");
    await syncMakeupCredit(tx, makeup, undefined, now);
    await syncMakeupCredit(tx, { ...makeup, attendanceStatus: "PRESENT" }, undefined, cutoff);
    assert.equal((await tx.makeupCreditUse.findFirstOrThrow({ where: { eventId: makeup.id } })).status, "USED");
    await settleStudentMakeupCredits(tx, student.id, cutoff);
    await settleStudentMakeupCredits(tx, student.id, cutoff);
    const discount = await tx.studentBillingTransaction.findFirstOrThrow({ where: { studentId: student.id } });
    assert.equal(discount.type, "DISCOUNT");
    assert.equal(Number(discount.amountBdt), 125);
    assert.match(discount.description!, /1 credit\(s\), 15 minutes/);
    assert.equal(await tx.studentBillingTransaction.count({ where: { studentId: student.id } }), 1);
    await assert.rejects(syncMakeupCredit(tx, { ...missed, attendanceStatus: "PRESENT" }, undefined, cutoff), /cannot be changed/);
    await assert.rejects(syncMakeupCredit(tx, { ...makeup, status: "CANCELLED" }, undefined, cutoff), /cannot be reversed/);
    const unfunded = await tx.classScheduleEvent.create({ data: { ...data, makeupCredit: true } });
    await assert.rejects(syncMakeupCredit(tx, unfunded, undefined, cutoff), /Not enough make-up credit/);
    for (const minutes of [30, 45]) {
      const extra = await tx.classScheduleEvent.create({ data: { ...data, durationMinutes: minutes, attendanceStatus: "TUTOR_CANCELLED_ISSUE_MAKEUP_CREDIT" } });
      await syncMakeupCredit(tx, extra, undefined, now);
      await syncMakeupCredit(tx, { ...extra, attendanceStatus: "PRESENT" }, undefined, now);
      assert.ok((await tx.makeupCredit.findUniqueOrThrow({ where: { sourceEventId: extra.id } })).revokedAt);
      await syncMakeupCredit(tx, extra, undefined, now);
    }
    await settleStudentMakeupCredits(tx, student.id, cutoff);
    assert.equal(await tx.studentBillingTransaction.count({ where: { studentId: student.id } }), 1, "Unfunded historical booking holds adjustment");
    await tx.classScheduleEvent.update({ where: { id: unfunded.id }, data: { status: "CANCELLED" } });
    await settleStudentMakeupCredits(tx, student.id, cutoff);
    const discounts = await tx.studentBillingTransaction.findMany({ where: { studentId: student.id }, orderBy: { createdAt: "asc" } });
    assert.equal(discounts.length, 2);
    assert.equal(discounts.reduce((sum, item) => sum + Number(item.amountBdt), 0), 750);
    assert.ok(discounts.some((item) => item.description?.includes("2 credit(s), 75 minutes")));
    throw rollback;
  }, { timeout: 30_000 });
} catch (error) {
  if (error !== rollback) throw error;
  console.log("PASS: duplicate attendance, reserve, release, use, cutoff, partial adjustment, idempotency, immutable settlement and insufficient balance; all fixtures rolled back.");
} finally {
  await prisma.$disconnect();
}
