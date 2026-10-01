import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import app from "../app.js";
import { prisma } from "../config/prisma.js";
import { signAccessToken } from "../auth/security.js";
import { getDashboard } from "../services/dashboard.service.js";

const server = app.listen(0);
await new Promise<void>((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
try {
  assert.equal((await fetch(`${base}/api/dashboard`)).status, 401);
  for (const code of ["SUPER_ADMIN", "ADMIN", "MODERATOR", "TEACHER"]) {
    const user = await prisma.user.findFirst({ where: { role: { code }, deletedAt: null, status: "ACTIVE" }, select: { id: true, sessionVersion: true } });
    if (!user) {
      console.log(`${code}: no active account to inspect`);
      continue;
    }
    const snapshot = await getDashboard(user.id);
    const response = await fetch(`${base}/api/dashboard`, { headers: { cookie: `access_token=${signAccessToken({ sub: user.id, ver: user.sessionVersion })}` } });
    assert.equal(response.status, 200);
    assert.equal((await response.json() as { role: string }).role, code);
    assert.equal(snapshot.role, code);
    assert.ok(snapshot.stats.every((stat) => Number.isFinite(stat.value)));
    if (code === "TEACHER") assert.ok(snapshot.activity.every((item) => item.kind !== "registration" && item.kind !== "teacher"));
    console.log(`${code}: ${snapshot.stats.length} figures, ${snapshot.activity.length} activity items, ${snapshot.actions.length} next steps`);
  }
} finally {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
}
