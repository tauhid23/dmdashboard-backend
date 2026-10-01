import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { hashToken } from "../auth/security.js";
import { createManualPasswordLink } from "./passwordEmail.service.js";

void test("manual account setup creates a 24-hour one-time link", async (context) => {
  const create = prisma.passwordResetToken.create;
  const updateMany = prisma.passwordResetToken.updateMany;
  let tokenHash = "";
  let expiresAt: Date | undefined;
  let previousLinksRevoked = false;
  prisma.passwordResetToken.create = (async (input: { data: { tokenHash: string; expiresAt: Date } }) => {
    tokenHash = input.data.tokenHash;
    expiresAt = input.data.expiresAt;
    return { id: "new-token" };
  }) as unknown as typeof create;
  prisma.passwordResetToken.updateMany = (async (input: { where: { userId: string; id: { not: string } } }) => {
    previousLinksRevoked = input.where.userId === "test-user" && input.where.id.not === "new-token";
    return { count: 1 };
  }) as unknown as typeof updateMany;
  context.after(() => {
    prisma.passwordResetToken.create = create;
    prisma.passwordResetToken.updateMany = updateMany;
  });

  const before = Date.now();
  const link = new URL(await createManualPasswordLink({ id: "test-user", name: "Student", email: "student@example.com" }));
  assert.equal(link.origin, new URL(env.FRONTEND_ORIGIN).origin);
  assert.equal(link.pathname, "/forgot-password/reset");
  assert.equal(hashToken(link.searchParams.get("token") ?? ""), tokenHash);
  assert.ok(expiresAt);
  assert.ok(Math.abs(expiresAt.getTime() - before - 24 * 60 * 60 * 1000) < 5000);
  assert.equal(previousLinksRevoked, true);
});
