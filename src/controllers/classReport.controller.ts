import type { Request, Response } from "express";

import * as classReportService from "../services/classReport.service.js";

const getRouteId = (req: Request, key = "id") => {
  const value = req.params[key];

  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

export const createClassReport = async (req: Request, res: Response) => {
  const classReport = await classReportService.createClassReport(req.body);

  res.status(201).json({
    success: true,
    data: classReport
  });
};

export const getClassReports = async (req: Request, res: Response) => {
  const classReports = await classReportService.getClassReports(
    classReportService.parseClassReportFilters(req.query)
  );

  res.status(200).json({
    success: true,
    data: classReports
  });
};

export const getStudentClassReports = async (req: Request, res: Response) => {
  const classReports = await classReportService.getClassReports({
    ...classReportService.parseClassReportFilters(req.query),
    reportType: "student"
  });

  res.status(200).json({
    success: true,
    data: classReports
  });
};

export const getTeacherClassReports = async (req: Request, res: Response) => {
  const classReports = await classReportService.getClassReports({
    ...classReportService.parseClassReportFilters(req.query),
    reportType: "teacher"
  });

  res.status(200).json({
    success: true,
    data: classReports
  });
};

export const getFullClassReports = async (req: Request, res: Response) => {
  const classReports = await classReportService.getClassReports({
    ...classReportService.parseClassReportFilters(req.query),
    reportType: "full"
  });

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
    getRouteId(req, "teacherId")
  );

  res.status(200).json({
    success: true,
    data: average
  });
};

export const getClassReportById = async (req: Request, res: Response) => {
  const classReport = await classReportService.getClassReportById(
    getRouteId(req)
  );

  res.status(200).json({
    success: true,
    data: classReport
  });
};

export const updateClassReport = async (req: Request, res: Response) => {
  const classReport = await classReportService.updateClassReport(
    getRouteId(req),
    req.body
  );

  res.status(200).json({
    success: true,
    data: classReport
  });
};

export const deleteClassReport = async (req: Request, res: Response) => {
  await classReportService.deleteClassReport(getRouteId(req));

  res.status(200).json({
    success: true,
    message: "Class report deleted successfully"
  });
};
