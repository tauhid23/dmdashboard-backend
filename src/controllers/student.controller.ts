import type { Request, Response } from "express";

import * as studentService from "../services/student.service.js";

const getStudentId = (req: Request) => {
  const { id } = req.params;

  if (Array.isArray(id)) {
    return id[0];
  }

  return id;
};

export const createStudent = async (req: Request, res: Response) => {
  const student = await studentService.createStudent(req.body);

  res.status(201).json({
    success: true,
    data: student
  });
};

export const getStudents = async (_req: Request, res: Response) => {
  const students = await studentService.getStudents();

  res.status(200).json({
    success: true,
    data: students
  });
};

export const getStudentOptions = async (_req: Request, res: Response) => {
  const students = await studentService.getStudentOptions();

  res.status(200).json({
    success: true,
    data: students
  });
};

export const getStudentById = async (req: Request, res: Response) => {
  const student = await studentService.getStudentById(getStudentId(req));

  res.status(200).json({
    success: true,
    data: student
  });
};

export const updateStudent = async (req: Request, res: Response) => {
  const student = await studentService.updateStudent(getStudentId(req), req.body);

  res.status(200).json({
    success: true,
    data: student
  });
};

export const deleteStudent = async (req: Request, res: Response) => {
  await studentService.deleteStudent(getStudentId(req));

  res.status(200).json({
    success: true,
    message: "Student deleted successfully"
  });
};
