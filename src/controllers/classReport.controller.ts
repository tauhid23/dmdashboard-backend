import type { Request, Response } from "express";
import type { AuthRequest } from "../auth/auth.types.js";
import { getRequestScope } from "../auth/accessScope.js";

import * as classReportService from "../services/classReport.service.js";

const getRouteId = (req: Request, key = "id") => {
  const value = req.params[key];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const createClassReport = async (req: AuthRequest, res: Response) => {
  const classReport = await classReportService.createClassReport(
    req.body,
    await getRequestScope(req.auth?.id)
  );

  res.status(201).json({
    success: true,
    data: classReport
  });
};

export const getClassReports = async (req: AuthRequest, res: Response) => {
  const classReports = await classReportService.getClassReports(
    classReportService.parseClassReportFilters(req.query),
    await getRequestScope(req.auth?.id)
  );

  res.status(200).json({
    success: true,
    data: classReports
  });
};

export const getStudentClassReports = async (req: AuthRequest, res: Response) => {
  const classReports = await classReportService.getClassReports({
    ...classReportService.parseClassReportFilters(req.query),
    reportType: "student"
  }, await getRequestScope(req.auth?.id));

  res.status(200).json({
    success: true,
    data: classReports
  });
};

export const getTeacherClassReports = async (req: AuthRequest, res: Response) => {
  const classReports = await classReportService.getClassReports({
    ...classReportService.parseClassReportFilters(req.query),
    reportType: "teacher"
  }, await getRequestScope(req.auth?.id));

  res.status(200).json({
    success: true,
    data: classReports
  });
};

export const getFullClassReports = async (req: AuthRequest, res: Response) => {
  const classReports = await classReportService.getFullClassReports(
    classReportService.parseClassReportFilters(req.query),
    await getRequestScope(req.auth?.id)
  );

  res.status(200).json({
    success: true,
    data: classReports
  });
};

export const getTeacherClassReportAverage = async (
  req: Request,
  res: Response
) => {
  const average = await classReportService.getTeacherClassReportAverage(
    getRouteId(req, "teacherId"),
    classReportService.parseClassReportYear(req.query.year),
    await getRequestScope((req as AuthRequest).auth?.id)
  );

  res.status(200).json({
    success: true,
    data: average
  });
};

export const getClassReportById = async (req: AuthRequest, res: Response) => {
  const classReport = await classReportService.getClassReportById(
    getRouteId(req),
    await getRequestScope(req.auth?.id)
  );

  res.status(200).json({
    success: true,
    data: classReport
  });
};

export const updateClassReport = async (req: AuthRequest, res: Response) => {
  const classReport = await classReportService.updateClassReport(
    getRouteId(req),
    req.body,
    await getRequestScope(req.auth?.id)
  );

  res.status(200).json({
    success: true,
    data: classReport
  });
};

export const deleteClassReport = async (req: AuthRequest, res: Response) => {
  await classReportService.deleteClassReport(
    getRouteId(req),
    await getRequestScope(req.auth?.id)
  );

  res.status(200).json({
    success: true,
    message: "Class report deleted successfully"
  });
};
