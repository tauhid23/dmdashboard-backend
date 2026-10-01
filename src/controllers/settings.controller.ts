import type { Response } from "express";
import type { AuthRequest } from "../auth/auth.types.js";
import * as service from "../services/settings.service.js";
import { env } from "../config/env.js";
import { verifyMailConnection } from "../config/mail.js";

export async function getSettings(_req: AuthRequest, res: Response) {
  res.json({ data: await service.getSettings() });
}

export async function updateSettings(req: AuthRequest, res: Response) {
  res.json({ data: await service.updateSettings(req.auth!.id, req.body) });
}

export async function getMailStatus(_req: AuthRequest, res: Response) {
  res.json({ data: {
    enabled: env.EMAIL_ENABLED,
    sender: env.EMAIL_ENABLED ? env.EMAIL_FROM_ADDRESS : null,
    host: env.EMAIL_ENABLED ? env.SMTP_HOST : null,
    port: env.EMAIL_ENABLED ? env.SMTP_PORT : null,
  } });
}

export async function verifyMail(_req: AuthRequest, res: Response) {
  try {
    const result = await verifyMailConnection();
    if (!result.enabled) {
      res.status(503).json({ message: "Email delivery is not configured on the server" });
      return;
    }
    res.json({ data: { connected: true } });
  } catch (cause) {
    console.error("SMTP verification failed", cause);
    throw Object.assign(new Error("SMTP verification failed. Check the server credentials and TLS settings."), {
      statusCode: 503,
      code: "SMTP_VERIFICATION_FAILED",
    });
  }
}
