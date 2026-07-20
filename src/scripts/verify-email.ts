import { env } from "../config/env.js";
import { verifyMailConnection } from "../config/mail.js";

try {
  const result = await verifyMailConnection();

  if (!result.enabled) {
    console.error("Email is disabled. Set EMAIL_ENABLED=true before verifying SMTP.");
    process.exitCode = 1;
  } else {
    console.log(`SMTP connection verified for ${env.SMTP_HOST}:${env.SMTP_PORT}.`);
  }
} catch (error) {
  console.error("SMTP verification failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
