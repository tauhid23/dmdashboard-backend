import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { hashToken, randomToken } from "../auth/security.js";
import { isEmailDeliveryEnabled, sendEmail } from "./email.service.js";

type Recipient = { id: string; email: string; name: string };

async function issuePasswordLink(user: Recipient, purpose: "invitation" | "reset") {
  const token = randomToken();
  const hours = purpose === "invitation" ? 24 : 1;
  const issued = await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000) },
  });
  const url = new URL("/forgot-password/reset", env.FRONTEND_ORIGIN);
  url.searchParams.set("token", token);
  return { issued, url, hours };
}

export async function createManualPasswordLink(user: Recipient) {
  const { issued, url } = await issuePasswordLink(user, "invitation");
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, id: { not: issued.id }, usedAt: null },
    data: { usedAt: new Date() },
  });
  return url.toString();
}

export async function sendPasswordLink(user: Recipient, purpose: "invitation" | "reset") {
  if (!isEmailDeliveryEnabled()) return false;
  const { issued, url, hours } = await issuePasswordLink(user, purpose);

  try {
    await sendEmail({
      to: user.email,
      subject: purpose === "invitation" ? "Set up your Deeni Madrasa account" : "Reset your Deeni Madrasa password",
      text: `Hello ${user.name},\n\n${purpose === "invitation" ? "Set your account password" : "Reset your password"} using this link:\n${url.toString()}\n\nThis link expires in ${hours} hour${hours === 1 ? "" : "s"}. If you did not request this, you can ignore it.`,
    });
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, id: { not: issued.id }, usedAt: null },
      data: { usedAt: new Date() },
    }).catch((cause) => console.error("Older password links could not be revoked", cause));
    return true;
  } catch (cause) {
    await prisma.passwordResetToken.delete({ where: { id: issued.id } }).catch(() => {});
    console.error("Password email delivery failed", cause);
    return false;
  }
}
