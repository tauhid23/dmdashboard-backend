import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import app from "../app.js";
import { prisma } from "../config/prisma.js";
import { signAccessToken } from "./security.js";

void test("pending student access is enforced on the API", async (context) => {
  const original = prisma.user.findUnique;
  const originalCount = prisma.student.count;
  const originalFindMany = prisma.student.findMany;
  let status = "NEW_SIGN_UP";
  let roleCode = "STUDENT";
  prisma.user.findUnique = (async () => ({ id: "pending-student", status: "ACTIVE", deletedAt: null, sessionVersion: 0,
    role: { code: roleCode, permissions: roleCode === "MODERATOR" ? [{ permission: { resource: "students", action: "view" } }] : [] }, permissionOverrides: [], student: { status, id: "student-record" } })) as unknown as typeof prisma.user.findUnique;
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = { cookie: `access_token=${signAccessToken({ sub: "pending-student", ver: 0 })}` };
  context.after(async () => {
    prisma.user.findUnique = original;
    prisma.student.count = originalCount;
    prisma.student.findMany = originalFindMany;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });
  assert.equal((await fetch(`${base}/api/auth/registration-options`)).status, 200);
  assert.equal((await fetch(`${base}/api/auth/enrollment`)).status, 401);
  assert.equal((await fetch(`${base}/api/auth/enrollment`, { headers })).status, 200);
  for (const path of ["/api/students", "/api/v1/students", "/api/auth/registrations", "/api/settings"]) {
    const response = await fetch(`${base}${path}`, { headers });
    assert.equal(response.status, 403);
    assert.equal((await response.json() as { code: string }).code, "ENROLLMENT_PENDING");
  }
  const update = await fetch(`${base}/api/auth/me`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ role: "ADMIN" }) });
  assert.equal(update.status, 403);
  status = "INACTIVE";
  assert.equal((await fetch(`${base}/api/students`, { headers })).status, 403);
  status = "ACTIVE";
  const active = await fetch(`${base}/api/students`, { headers });
  assert.equal(active.status, 403);
  assert.equal((await active.json() as { code: string }).code, "FORBIDDEN", "Normal permissions still apply after approval");
  prisma.student.count = (async () => 1) as unknown as typeof prisma.student.count;
  prisma.student.findMany = (async () => [{ id: "new-student", name: "Fixture", createdAt: new Date() }]) as unknown as typeof prisma.student.findMany;
  for (const code of ["SUPER_ADMIN", "MODERATOR"]) {
    roleCode = code;
    const response = await fetch(`${base}/api/auth/registrations`, { headers });
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { count: number }).count, 1);
  }
  for (let attempt = 0; attempt < 11; attempt += 1) {
    const response = await fetch(`${base}/api/auth/register`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(response.status, attempt < 10 ? 422 : 429);
  }
});
