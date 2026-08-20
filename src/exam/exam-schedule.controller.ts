import type { Request, Response } from "express";
import type { AuthRequest } from "../auth/auth.types.js";
import { assertStudentAccess, getRequestScope } from "../auth/accessScope.js";
import * as service from "./exam-schedule.service.js";

const param = (req: Request, key: string) => {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] : value;
};

export const create = async (req: AuthRequest, res: Response) => {
  res.status(201).json({ success: true, data: await service.createSchedule(req.body, await getRequestScope(req.auth?.id)) });
};

export const list = async (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: await service.listSchedules(req.query, await getRequestScope(req.auth?.id)) });
};

export const listForStudent = async (req: AuthRequest, res: Response) => {
  const scope = await getRequestScope(req.auth?.id);
  await assertStudentAccess(scope, param(req, "studentId"));
  res.json({ success: true, data: await service.listStudentSchedules(param(req, "studentId"), scope) });
};
