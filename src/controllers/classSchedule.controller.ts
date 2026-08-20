import type { Request, Response } from "express";
import type { AuthRequest } from "../auth/auth.types.js";
import { getRequestScope } from "../auth/accessScope.js";
import * as service from "../services/classSchedule.service.js";

const param = (req: Request, key: string) => {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : value;
};

export const listEvents = async (req: AuthRequest, res: Response) => {
  res.status(200).json({
    success: true,
    data: await service.listEvents(req.query, await getRequestScope(req.auth?.id))
  });
};

export const createEvents = async (req: AuthRequest, res: Response) => {
  res.status(201).json({
    success: true,
    data: await service.createEvents(req.body, await getRequestScope(req.auth?.id))
  });
};

export const updateEvent = async (req: AuthRequest, res: Response) => {
  res.status(200).json({
    success: true,
    data: await service.updateEvent(
      param(req, "id"),
      req.body,
      await getRequestScope(req.auth?.id)
    )
  });
};

export const deleteEvent = async (req: AuthRequest, res: Response) => {
  const scope = typeof req.query.scope === "string" ? req.query.scope : "single";
  await service.deleteEvent(
    param(req, "id"),
    scope,
    await getRequestScope(req.auth?.id)
  );
  res.status(200).json({
    success: true,
    message: "Class schedule event deleted successfully"
  });
};
