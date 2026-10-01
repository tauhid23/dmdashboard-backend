import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../config/prisma.js";
import { changePassword, login } from "./auth.service.js";

void test("shared parent email cannot select an arbitrary student account", async (context) => {
  const findUsername = prisma.user.findFirst;
  const findEmail = prisma.user.findMany;
  const emailQueries: unknown[] = [];
  prisma.user.findFirst = (async () => null) as unknown as typeof findUsername;
  prisma.user.findMany = (async (query: unknown) => { emailQueries.push(query); return []; }) as unknown as typeof findEmail;
  context.after(() => { prisma.user.findFirst = findUsername; prisma.user.findMany = findEmail; });
  await assert.rejects(login("parent@example.com", "Password123", {}), { statusCode: 401 });
  assert.deepEqual((emailQueries[0] as { where: { role: unknown } }).where.role, { code: { not: "STUDENT" } });
  assert.deepEqual((emailQueries[1] as { where: { role: unknown } }).where.role, { code: "STUDENT" });
});

void test("students cannot change their own password", async (context) => {
  const findUser = prisma.user.findUnique;
  const updateUser = prisma.user.update;
  let updated = false;
  prisma.user.findUnique = (async () => ({ id: "student-user", role: { code: "STUDENT" } })) as unknown as typeof findUser;
  prisma.user.update = (async () => { updated = true; return {}; }) as unknown as typeof updateUser;
  context.after(() => { prisma.user.findUnique = findUser; prisma.user.update = updateUser; });
  await assert.rejects(changePassword("student-user", "OldPassword123", "NewPassword123"), { statusCode: 403 });
  assert.equal(updated, false);
});
