import type { Request, Response } from "express";
import type { AuthRequest } from "../auth/auth.types.js";
import { assertAdminAccess, assertPrivilegedAccess, getRequestScope } from "../auth/accessScope.js";

import { uploadImageBuffer } from "../config/cloudinary.js";
import * as studentService from "../services/student.service.js";
import { getUploadedImageFile } from "../middlewares/imageUpload.js";
import { normalizeStudentRequestBody } from "../utils/normalizeRequestBody.js";
import { getStudentExamDetails } from "../exam/exam.service.js";
import { redactStudentPersonalInformation } from "../services/studentPrivacy.js";
import { getStudentMakeupCredits, getStudentMakeupReviewCount } from "../services/makeupCredit.service.js";
import { effectivePermissions } from "../auth/permissions.js";

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

export const createStudent = async (req: AuthRequest, res: Response) => {
  assertPrivilegedAccess(
    await getRequestScope(req.auth?.id),
    "Only staff users can create student profiles"
  );
  const payload = normalizeStudentRequestBody(req.body);
  const createLogin = req.body.createLogin === true || req.body.createLogin === "true";
  if (createLogin) assertAdminAccess(await getRequestScope(req.auth?.id));
  if (createLogin && !(await effectivePermissions(req.auth!.id))["user-management"].add) {
    throw Object.assign(new Error("Permission to create login accounts is required"), { statusCode: 403, code: "FORBIDDEN" });
  }
  const imageFile = getUploadedImageFile(req);

  if (imageFile) {
    const uploadedImage = await uploadImageBuffer(imageFile, "dmdashboard/students");
    payload.image = uploadedImage.secure_url;
  }

  const result = createLogin
    ? await studentService.createStudentWithCredentials(payload, { username: String(req.body.loginUsername ?? ""), password: String(req.body.loginPassword ?? "") })
    : { student: await studentService.createStudent(payload), credentials: null };

  res.status(201).json({
    success: true,
    data: result.student,
    credentials: result.credentials
  });
};

export const getStudentCredentials = async (req: AuthRequest, res: Response) => {
  assertAdminAccess(await getRequestScope(req.auth?.id));
  res.json(await studentService.getStudentCredentials(getStudentId(req)));
};

export const saveStudentCredentials = async (req: AuthRequest, res: Response) => {
  assertAdminAccess(await getRequestScope(req.auth?.id));
  res.json(await studentService.saveStudentCredentials(getStudentId(req), {
    username: String(req.body.username ?? ""), password: String(req.body.password ?? ""),
  }));
};

export const getStudents = async (req: AuthRequest, res: Response) => {
  const scope = await getRequestScope(req.auth?.id);
  const students = await studentService.getStudents(
    getStudentFilters(req),
    scope
  );

  res.status(200).json({
    success: true,
    data: students.map((student) =>
      redactStudentPersonalInformation(student, scope)
    )
  });
};

export const getStudentOptions = async (req: AuthRequest, res: Response) => {
  const students = await studentService.getStudentOptions(
    getStudentFilters(req),
    await getRequestScope(req.auth?.id)
  );

  res.status(200).json({
    success: true,
    data: students
  });
};

export const getParentOptions = async (req: AuthRequest, res: Response) => {
  assertPrivilegedAccess(await getRequestScope(req.auth?.id), "Only staff users can search parent contacts");
  const parents = await studentService.getParentOptions(getQueryString(req.query.search));
  res.status(200).json({ success: true, data: parents });
};

export const getStudentById = async (req: AuthRequest, res: Response) => {
  const scope = await getRequestScope(req.auth?.id);
  await studentService.assertStudentVisible(getStudentId(req), scope);
  const student = await getStudentExamDetails(getStudentId(req));

  res.status(200).json({
    success: true,
    data: redactStudentPersonalInformation({ ...student,
      makeupCredits: await getStudentMakeupCredits(getStudentId(req)),
      makeupCreditReviewCount: await getStudentMakeupReviewCount(getStudentId(req)),
    }, scope)
  });
};

export const updateStudent = async (req: AuthRequest, res: Response) => {
  assertPrivilegedAccess(
    await getRequestScope(req.auth?.id),
    "Only staff users can edit student profiles"
  );
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

export const deleteStudent = async (req: AuthRequest, res: Response) => {
  assertPrivilegedAccess(
    await getRequestScope(req.auth?.id),
    "Only staff users can delete student profiles"
  );
  await studentService.deleteStudent(getStudentId(req));

  res.status(200).json({
    success: true,
    message: "Student deleted successfully"
  });
};
