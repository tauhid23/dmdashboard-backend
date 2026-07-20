import nodemailer from "nodemailer";

import { env } from "./env.js";

export const mailTransport = env.EMAIL_ENABLED
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      requireTLS: env.SMTP_REQUIRE_TLS,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD
      }
    })
  : null;

export const verifyMailConnection = async () => {
  if (!mailTransport) {
    return { enabled: false as const };
  }

  await mailTransport.verify();
  return { enabled: true as const };
};
