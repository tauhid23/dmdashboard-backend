import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import app from "../app.js";
import { signAccessToken } from "../auth/security.js";
import { prisma } from "../config/prisma.js";

void test("GET /api/class-reports/full integration", async (context) => {
  const originalUserFindUnique = prisma.user.findUnique;
  const originalClassReportFindMany = prisma.classReport.findMany;
  let mayViewClassReports = true;
  let reports: unknown[] = [];
  let lastFindManyArguments: unknown;

  prisma.user.findUnique = (async () => ({
    id: "integration-user",
    status: "ACTIVE",
    deletedAt: null,
    sessionVersion: 0,
    role: {
      code: mayViewClassReports ? "SUPER_ADMIN" : "STAFF",
      permissions: []
    },
    permissionOverrides: []
  })) as unknown as typeof prisma.user.findUnique;

  prisma.classReport.findMany = (async (arguments_: unknown) => {
    lastFindManyArguments = arguments_;
    return reports;
  }) as unknown as typeof prisma.classReport.findMany;

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}/api/class-reports/full`;
  const token = signAccessToken({ sub: "integration-user", ver: 0 });
  const authenticatedHeaders = { cookie: `access_token=${token}` };

  context.after(async () => {
    prisma.user.findUnique = originalUserFindUnique;
    prisma.classReport.findMany = originalClassReportFindMany;
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  });

  await context.test("returns 401 without authentication", async () => {
    const response = await fetch(baseUrl);
    assert.equal(response.status, 401);
  });

  await context.test("returns 403 without Class Reports view permission", async () => {
    mayViewClassReports = false;
    const response = await fetch(baseUrl, { headers: authenticatedHeaders });
    assert.equal(response.status, 403);
    mayViewClassReports = true;
  });

  await context.test("returns 400 for invalid IDs and months", async () => {
    const invalidIdResponse = await fetch(`${baseUrl}?teacherId=bad%20id!`, {
      headers: authenticatedHeaders
    });
    assert.equal(invalidIdResponse.status, 400);
    assert.match(await invalidIdResponse.text(), /teacherId must be a valid ID/);

    const invalidMonthResponse = await fetch(`${baseUrl}?month=Jul`, {
      headers: authenticatedHeaders
    });
    assert.equal(invalidMonthResponse.status, 400);
    assert.match(await invalidMonthResponse.text(), /January, February/);
  });

  await context.test("returns a successful empty list when nothing matches", async () => {
    reports = [];
    const response = await fetch(`${baseUrl}?search=missing`, {
      headers: authenticatedHeaders
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, data: [] });
  });

  await context.test("no filters return the normal nested full-report response", async () => {
    const timestamp = new Date("2026-07-20T08:30:00.000Z");
    reports = [{
      id: "9001",
      month: "July",
      studentId: "105",
      teacherId: "42",
      studentName: "Old student snapshot",
      teacherName: "Old teacher snapshot",
      teacherNote: "Amina showed strong progress",
      adminNote: "Good session quality",
      studentWebcamOn: true,
      teacherWebcamOn: true,
      student: { id: "105", name: "Amina Yusuf" },
      teacher: { id: "42", name: "Fatima Rahman" },
      createdAt: timestamp,
      updatedAt: timestamp
    }];

    const response = await fetch(baseUrl, { headers: authenticatedHeaders });
    const body = await response.json() as {
      data: Array<Record<string, unknown> & {
        studentReport: Record<string, unknown>;
        teacherReport: Record<string, unknown>;
      }>;
    };

    assert.equal(response.status, 200);
    assert.equal(body.data[0].studentName, "Amina Yusuf");
    assert.equal(body.data[0].teacherName, "Fatima Rahman");
    assert.equal(body.data[0].studentReport.teacherNote, "Amina showed strong progress");
    assert.equal(body.data[0].teacherReport.adminNote, "Good session quality");
  });

  await context.test("combines filters and requests stable newest-first ordering", async () => {
    reports = [];
    const response = await fetch(
      `${baseUrl}?search=%20amina%20&month=July&teacherId=42&studentId=105`,
      { headers: authenticatedHeaders }
    );
    assert.equal(response.status, 200);

    const query = lastFindManyArguments as {
      where: { AND: unknown[] };
      orderBy: unknown[];
    };
    assert.equal(query.where.AND.length, 6);
    assert.deepEqual(query.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  });
});
