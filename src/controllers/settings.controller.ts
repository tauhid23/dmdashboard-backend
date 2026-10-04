import type { Response } from "express";
import type { AuthRequest } from "../auth/auth.types.js";
import * as service from "../services/settings.service.js";
import { env } from "../config/env.js";
import { verifyMailConnection } from "../config/mail.js";
import * as loginAppearance from "../services/loginAppearance.service.js";

export async function getPublicLoginAppearance(_req: AuthRequest, res: Response) {
  res.json({ data: await loginAppearance.getLoginAppearance() });
}

export async function getLoginBackgroundImage(_req: AuthRequest, res: Response) {
  const image = await loginAppearance.getLoginImage();
  if (!image) { res.sendStatus(404); return; }
  res.set("Cache-Control", "public, max-age=300");
  res.set("Cross-Origin-Resource-Policy", "cross-origin");
  res.type(image.mimeType).send(image.buffer);
}

export async function uploadLoginBackgroundImage(req: AuthRequest, res: Response) {
  if (!req.file) { res.status(400).json({ message: "Choose an image to upload." }); return; }
  res.json({ data: await loginAppearance.saveLoginImage(req.auth!.id, req.file) });
}

export async function resetLoginBackgroundImage(_req: AuthRequest, res: Response) {
  res.json({ data: await loginAppearance.removeLoginImage() });
}

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
