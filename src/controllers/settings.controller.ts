import type { Response } from "express";
import type { AuthRequest } from "../auth/auth.types.js";
import * as service from "../services/settings.service.js";

export async function getSettings(_req: AuthRequest, res: Response) {
  res.json({ data: await service.getSettings() });
}

export async function updateSettings(req: AuthRequest, res: Response) {
  res.json({ data: await service.updateSettings(req.auth!.id, req.body) });
}
