import type { Request, Response } from "express";

import { uploadImageBuffer } from "../config/cloudinary.js";
import * as studentService from "../services/student.service.js";
import { getUploadedImageFile } from "../middlewares/imageUpload.js";
import { normalizeStudentRequestBody } from "../utils/normalizeRequestBody.js";
import { getStudentExamDetails } from "../exam/exam.service.js";

const getStudentId = (req: Request) => {
  const { id } = req.params;

  if (Array.isArray(id)) {
    return id[0];
  }

  return id;
};

const getQueryString = (value: unknown) => {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (typeof rawValue !== "string") {
    return undefined;
  }

  const trimmedValue = rawValue.trim();

  return trimmedValue === "" ? undefined : trimmedValue;
};

const getStudentFilters = (req: Request) => ({
  teacherId: getQueryString(req.query.teacherId),
  teacherName: getQueryString(req.query.teacherName)
});

export const createStudent = async (req: Request, res: Response) => {
  const payload = normalizeStudentRequestBody(req.body);
  const imageFile = getUploadedImageFile(req);

  if (imageFile) {
    const uploadedImage = await uploadImageBuffer(imageFile, "dmdashboard/students");
    payload.image = uploadedImage.secure_url;
  }

  const student = await studentService.createStudent(payload);

  res.status(201).json({
    success: true,
    data: student
  });
};

export const getStudents = async (req: Request, res: Response) => {
  const students = await studentService.getStudents(getStudentFilters(req));

  res.status(200).json({
    success: true,
    data: students
  });
};

export const getStudentOptions = async (req: Request, res: Response) => {
  const students = await studentService.getStudentOptions(getStudentFilters(req));

  res.status(200).json({
    success: true,
    data: students
  });
};

export const getStudentById = async (req: Request, res: Response) => {
  const student = await getStudentExamDetails(getStudentId(req));

  res.status(200).json({
    success: true,
    data: student
  });
};

export const updateStudent = async (req: Request, res: Response) => {
  const payload = normalizeStudentRequestBody(req.body);
  const imageFile = getUploadedImageFile(req);

  if (imageFile) {
    const uploadedImage = await uploadImageBuffer(imageFile, "dmdashboard/students");
    payload.image = uploadedImage.secure_url;
  }

  const student = await studentService.updateStudent(getStudentId(req), payload);

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
