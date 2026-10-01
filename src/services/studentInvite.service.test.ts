import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../config/prisma.js";
import { verifyPassword } from "../auth/security.js";
import { createStudentWithCredentials } from "./student.service.js";

void test("a duplicate username is rejected before creating the student", async (context) => {
  const findRole = prisma.role.findUnique;
  const countUsers = prisma.user.count;
  const transaction = prisma.$transaction;
  let started = false;
  prisma.role.findUnique = (async () => ({ id: "student-role" })) as unknown as typeof findRole;
  prisma.user.count = (async () => 1) as typeof countUsers;
  prisma.$transaction = (async () => { started = true; throw new Error("Unexpected transaction"); }) as typeof transaction;
  context.after(() => { prisma.role.findUnique = findRole; prisma.user.count = countUsers; prisma.$transaction = transaction; });
  await assert.rejects(createStudentWithCredentials({ name: "Student", parentEmail: "shared@example.com", status: "ACTIVE" },
    { username: "usedname", password: "Password123" }), { statusCode: 409 });
  assert.equal(started, false);
});

void test("a student login uses the chosen credentials and a shared parent email", async (context) => {
  const findRole = prisma.role.findUnique;
  const countUsers = prisma.user.count;
  const transaction = prisma.$transaction;
  let createdUserData: Record<string, unknown> | undefined;
  prisma.role.findUnique = (async () => ({ id: "student-role" })) as unknown as typeof findRole;
  prisma.user.count = (async () => 0) as typeof countUsers;
  prisma.$transaction = (async (callback: (database: unknown) => Promise<unknown>) => callback({
    student: { create: async () => ({ id: "student-1", name: "Student" }) },
    user: { create: async (input: { data: Record<string, unknown> }) => { createdUserData = input.data; return { id: "user-1" }; } },
  })) as typeof transaction;
  context.after(() => { prisma.role.findUnique = findRole; prisma.user.count = countUsers; prisma.$transaction = transaction; });
  const result = await createStudentWithCredentials({ name: "Student", parentEmail: " Shared@Example.com ", status: "ACTIVE" },
    { username: "Ahmad.2026", password: "Password123" });
  assert.equal(createdUserData?.studentId, "student-1");
  assert.equal(createdUserData?.normalizedUsername, "ahmad.2026");
  assert.equal(createdUserData?.normalizedEmail, "shared@example.com");
  assert.equal(createdUserData?.mustChangePassword, false);
  assert.equal(await verifyPassword("Password123", String(createdUserData?.passwordHash)), true);
  assert.equal(result.credentials.username, "ahmad.2026");
});
