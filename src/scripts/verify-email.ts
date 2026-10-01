import { env } from "../config/env.js";
import { verifyMailConnection } from "../config/mail.js";
import { prisma } from "../config/prisma.js";
import { resolveStaffRecipients } from "../services/notification.service.js";

try {
  const result = await verifyMailConnection();

  if (!result.enabled) {
    console.error("Email is disabled. Set EMAIL_ENABLED=true before verifying SMTP.");
    process.exitCode = 1;
  } else {
    console.log(`SMTP connection verified for ${env.SMTP_HOST}:${env.SMTP_PORT}.`);
    const recipients = await resolveStaffRecipients();
    if (!recipients.length) {
      console.error("No staff alert recipients found. Set a real email on an active Admin account or add a manager email in Settings.");
      process.exitCode = 1;
    } else {
      console.log(`Staff alert recipients ready: ${recipients.length}.`);
    }
  }
} catch (error) {
  console.error("SMTP verification failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
