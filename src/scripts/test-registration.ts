import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../config/prisma.js";
import { createRegistration, validateRegistration } from "../auth/registration.service.js";
import { hashPassword, verifyPassword } from "../auth/security.js";

const rollback = new Error("ROLLBACK_REGISTRATION_FIXTURES");
try {
  await prisma.$transaction(async (tx) => {
    const input = validateRegistration({ studentName: "Registration fixture", studentType: "CHILD", age: 12, gender: "MALE", parentName: "Fixture parent", email: `registration-${randomUUID()}@example.test`,
      password: "TestPassword123", country: "GB", timeZone: "Europe/London", startDate: "2026-10-05", whatsapp: "+447911123456", classDurationMinutes: 45,
      classStartTime: "17:00", classDays: [0, 2, 4] });
    const result = await createRegistration(tx, input, await hashPassword(input.password), "https://example.test/student-photo.png");
    const student = await tx.student.findUniqueOrThrow({ where: { id: result.studentId }, include: { userAccount: { include: { role: true } } } });
    assert.equal(student.status, "NEW_SIGN_UP");
    assert.equal(student.image, "https://example.test/student-photo.png");
    assert.equal(student.studentType, "CHILD");
    assert.equal(student.age, 12);
    assert.equal(student.gender, "MALE");
    assert.equal(student.teacherId, null);
    assert.equal(student.scheduleConfirmed, false);
    assert.equal(student.classStartTime, "22:00");
    assert.equal(student.preferredLocalTime, "17:00");
    assert.equal(student.preferredTimeZone, "Europe/London");
    assert.equal(student.billingAmountBdt, null);
    assert.equal(student.packageCode, null);
    assert.equal(student.monthlyPriceBdt, null);
    assert.equal(student.quarterlyPriceBdt, null);
    assert.equal(student.userAccount?.role.code, "STUDENT");
    assert.ok(await verifyPassword(input.password, student.userAccount!.passwordHash));
    assert.equal(await tx.classScheduleEvent.count({ where: { studentId: student.id } }), 0);
    assert.equal(await tx.studentBillingTransaction.count({ where: { studentId: student.id } }), 0);
    const email = await tx.emailNotification.findUniqueOrThrow({ where: { eventKey: `student-registration:${student.id}` } });
    assert.match(email.body, /New Sign-up/);
    assert.ok(!email.body.includes(input.password));
    assert.equal(email.sentAt, null);
    assert.equal(await tx.auditLog.count({ where: { targetUserId: student.userAccount!.id, action: "STUDENT_REGISTERED" } }), 1);
    await tx.student.update({ where: { id: student.id }, data: { status: "ACTIVE" } });
    assert.equal((await tx.user.findUniqueOrThrow({ where: { id: student.userAccount!.id }, include: { student: true } })).student?.status, "ACTIVE");
    await tx.$executeRawUnsafe("SAVEPOINT duplicate_registration");
    await assert.rejects(createRegistration(tx, input, student.userAccount!.passwordHash), (error: unknown) =>
      !!error && typeof error === "object" && "code" in error && error.code === "P2002");
    await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT duplicate_registration");
    assert.equal(await tx.student.count({ where: { parentEmail: input.email } }), 1);
    assert.equal(await tx.emailNotification.count({ where: { eventKey: `student-registration:${student.id}` } }), 1);
    throw rollback;
  }, { timeout: 30_000 });
} catch (error) {
  if (error !== rollback) throw error;
  console.log("PASS: pending registration, student-only account, hashed password, deferred billing, transactional email/audit and approval linkage. All fixtures rolled back; no emails sent.");
} finally { await prisma.$disconnect(); }
