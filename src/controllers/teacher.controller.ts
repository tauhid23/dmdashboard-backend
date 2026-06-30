import type { Request, Response } from "express";

import * as teacherService from "../services/teacher.service.js";

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
    const teacher = await teacherService.createTeacher(req.body);

    res.status(201).json({
      success: true,
      data: teacher
    });
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const getTeachers = async (_req: Request, res: Response) => {
  try {
    const teachers = await teacherService.getTeachers();

    res.status(200).json({
      success: true,
      data: teachers
    });
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const getTeacherById = async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.getTeacherById(getTeacherId(req));

    res.status(200).json({
      success: true,
      data: teacher
    });
  } catch (error) {
    handleControllerError(error, res);
  }
};

export const updateTeacher = async (req: Request, res: Response) => {
  try {
    const teacher = await teacherService.updateTeacher(
      getTeacherId(req),
      req.body
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
