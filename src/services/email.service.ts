import type { SendMailOptions } from "nodemailer";

import { env } from "../config/env.js";
import { mailTransport } from "../config/mail.js";

type EmailRecipient = string | string[];

export type SendEmailInput = {
  to: EmailRecipient;
  subject: string;
  text: string;
  html?: string;
  cc?: EmailRecipient;
  replyTo?: string;
};

export const sendEmail = async (input: SendEmailInput) => {
  if (!mailTransport || !env.EMAIL_FROM_ADDRESS) {
    throw new Error("Email is disabled. Set EMAIL_ENABLED=true and configure SMTP variables.");
  }

  const message: SendMailOptions = {
    from: {
      name: env.EMAIL_FROM_NAME,
      address: env.EMAIL_FROM_ADDRESS
    },
    to: input.to,
    cc: input.cc,
    replyTo: input.replyTo,
    subject: input.subject,
    text: input.text,
    html: input.html
  };

  const result = await mailTransport.sendMail(message);

  return {
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected
  };
};

export const sendEmailToTeacherAndAdmins = async (
  teacherEmail: string,
  message: Omit<SendEmailInput, "to" | "cc">
) =>
  sendEmail({
    ...message,
    to: teacherEmail,
    cc: env.ADMIN_NOTIFICATION_EMAILS
  });
