import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { isEmailDeliveryEnabled, sendEmail } from "./email.service.js";
import { getSettings } from "./settings.service.js";

const cleanEmail = (value: string) => value.trim().toLowerCase();
const validRecipient = (value: string) => value !== "admin@admin.com" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const mergeStaffRecipients = (...groups: string[][]) =>
  [...new Set(groups.flat().map(cleanEmail).filter(validRecipient))];

export const resolveStaffRecipients = async () => {
  const [settings, admins] = await Promise.all([
    getSettings(),
    prisma.user.findMany({
      where: { deletedAt: null, status: "ACTIVE", role: { code: { in: ["SUPER_ADMIN", "ADMIN", "MODERATOR"] } } },
      select: { email: true },
    }),
  ]);
  return mergeStaffRecipients(
    admins.map((user) => user.email),
    env.ADMIN_NOTIFICATION_EMAILS,
    settings.notifications.managerEmails,
  );
};

const recipientList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];

export const remainingRecipients = (requested: string[], accepted: Array<string | { address: string }>) => {
  const delivered = new Set(accepted.map((recipient) => cleanEmail(typeof recipient === "string" ? recipient : recipient.address)));
  return requested.filter((recipient) => !delivered.has(cleanEmail(recipient)));
};

let dispatching = false;

export const dispatchPendingNotifications = async () => {
  if (dispatching || !isEmailDeliveryEnabled()) return;
  dispatching = true;
  try {
    const now = new Date();
    const pending = await prisma.emailNotification.findMany({
      where: { sentAt: null, nextAttemptAt: { lte: now } },
      orderBy: { createdAt: "asc" },
      take: 20,
    });
    for (const item of pending) {
      const claim = await prisma.emailNotification.updateMany({
        where: { id: item.id, sentAt: null, nextAttemptAt: { lte: now } },
        data: { nextAttemptAt: new Date(Date.now() + 60_000), attempts: { increment: 1 } },
      });
      if (!claim.count) continue;
      try {
        const recipients = recipientList(item.recipients);
        if (!recipients.length) recipients.push(...await resolveStaffRecipients());
        if (!recipients.length) throw new Error("No notification recipients configured");
        const result = await sendEmail({ to: recipients, subject: item.subject, text: item.body });
        const remaining = remainingRecipients(recipients, result.accepted);
        if (remaining.length) {
          const delay = Math.min(60 * 60_000, 30_000 * 2 ** Math.min(item.attempts, 7));
          await prisma.emailNotification.update({
            where: { id: item.id },
            data: { recipients: remaining, nextAttemptAt: new Date(Date.now() + delay), lastError: "Some recipients were not accepted by SMTP" },
          });
        } else {
          await prisma.emailNotification.update({
            where: { id: item.id },
            data: { sentAt: new Date(), lastError: null },
          });
        }
      } catch (cause) {
        const delay = Math.min(60 * 60_000, 30_000 * 2 ** Math.min(item.attempts, 7));
        await prisma.emailNotification.update({
          where: { id: item.id },
          data: {
            nextAttemptAt: new Date(Date.now() + delay),
            lastError: cause instanceof Error ? cause.message.slice(0, 500) : "Email delivery failed",
          },
        });
        console.error(`Notification ${item.eventKey} delivery failed`, cause);
      }
    }
  } finally {
    dispatching = false;
  }
};

export const startNotificationWorker = () => {
  const run = () => void dispatchPendingNotifications().catch((cause: unknown) => {
    console.error("Email notification queue check failed", cause);
  });
  run();
  const timer = setInterval(run, 30_000);
  timer.unref();
  return () => clearInterval(timer);
};
