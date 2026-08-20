import type { Request, Response } from "express";
import type { AuthRequest } from "../auth/auth.types.js";
import { getRequestScope } from "../auth/accessScope.js";

import { uploadImageBuffer } from "../config/cloudinary.js";
import * as teacherService from "../services/teacher.service.js";
import { getUploadedImageFile } from "../middlewares/imageUpload.js";
import { normalizeTeacherRequestBody } from "../utils/normalizeRequestBody.js";

const getTeacherId = (req: Request) => {
  const { id } = req.params;

  if (Array.isArray(id)) {
    return id[0];
  }

  return id;
};

const handleControllerError = (error: unknown, res: Response) => {
  const statusCode =
    error instanceof Error && "statusCode" in error
      ? Number(error.statusCode)
      : 500;
  const message = error instanceof Error ? error.message : "Internal server error";

  res.status(Number.isInteger(statusCode) ? statusCode : 500).json({
    success: false,
    message
  });
};

export const createTeacher = async (req: Request, res: Response) => {
  try {
    const payload = normalizeTeacherRequestBody(req.body);
    const imageFile = getUploadedImageFile(req);

    if (imageFile) {
      const uploadedImage = await uploadImageBuffer(imageFile, "dmdashboard/teachers");
      payload.imageUrl = uploadedImage.secure_url;
    }

    const teacher = await teacherService.createTeacher(payload);

    res.status(201).json({
      success: true,
      data: teacher
    });
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const getTeachers = async (req: AuthRequest, res: Response) => {
  try {
    const teachers = await teacherService.getTeachers(
      await getRequestScope(req.auth?.id)
    );

    res.status(200).json({
      success: true,
      data: teachers
    });
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const getTeacherOptions = async (req: AuthRequest, res: Response) => {
  try {
    const teachers = await teacherService.getTeacherOptions(
      await getRequestScope(req.auth?.id)
    );

    res.status(200).json({
      success: true,
      data: teachers
    });
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const getTeacherById = async (req: AuthRequest, res: Response) => {
  try {
    const scope = await getRequestScope(req.auth?.id);
    await teacherService.assertTeacherVisible(getTeacherId(req), scope);
    const teacher = await teacherService.getTeacherById(getTeacherId(req));

    res.status(200).json({
      success: true,
      data: teacher
    });
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const getTeacherClassReportAverage = async (
  req: Request,
  res: Response
) => {
  try {
    const scope = await getRequestScope((req as AuthRequest).auth?.id);
    await teacherService.assertTeacherVisible(getTeacherId(req), scope);
    const average = await teacherService.getTeacherClassReportAverage(getTeacherId(req));

    res.status(200).json({
      success: true,
      data: average
    });
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const getTeacherPayroll = async (req: Request, res: Response) => {
  try {
    const scope = await getRequestScope((req as AuthRequest).auth?.id);
    await teacherService.assertTeacherVisible(getTeacherId(req), scope);
    const month = typeof req.query.month === "string" ? req.query.month : undefined;
    const payroll = await teacherService.getTeacherPayroll(getTeacherId(req), month);

    res.status(200).json({
      success: true,
      data: payroll
    });
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const updateTeacherPayrollSettings = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const settings = await teacherService.updateTeacherPayrollSettings(
      req.auth!.id,
      getTeacherId(req),
      req.body
    );

    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const upsertTeacherPayrollCategoryRate = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const rate = await teacherService.upsertTeacherPayrollCategoryRate(
      req.auth!.id,
      getTeacherId(req),
      req.body
    );

    res.status(200).json({
      success: true,
      data: rate
    });
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const deleteTeacherPayrollCategoryRate = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    await teacherService.deleteTeacherPayrollCategoryRate(
      req.auth!.id,
      getTeacherId(req),
      String(req.params.rateId)
    );

    res.status(200).json({
      success: true,
      message: "Payroll category rate deleted successfully"
    });
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const updateTeacher = async (req: Request, res: Response) => {
  try {
    const payload = normalizeTeacherRequestBody(req.body);
    const imageFile = getUploadedImageFile(req);

    if (imageFile) {
      const uploadedImage = await uploadImageBuffer(imageFile, "dmdashboard/teachers");
      payload.imageUrl = uploadedImage.secure_url;
    }

    const teacher = await teacherService.updateTeacher(
      getTeacherId(req),
      payload
    );

    res.status(200).json({
      success: true,
      data: teacher
    });
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const deleteTeacher = async (req: Request, res: Response) => {
  try {
    await teacherService.deleteTeacher(getTeacherId(req));

    res.status(200).json({
      success: true,
      message: "Teacher deleted successfully"
    });
  } catch (error) {
    handleControllerError(error, res);
  }
};
