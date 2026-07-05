import type { CreateStudentInput } from "../types/student.types.js";
import type { CreateTeacherInput } from "../types/teacher.types.js";

type BodyRecord = Record<string, unknown>;

const parseJsonField = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue.startsWith("{") && !trimmedValue.startsWith("[")) {
    return value;
  }

  try {
    return JSON.parse(trimmedValue) as unknown;
  } catch {
    return value;
  }
};

const parseBooleanField = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  if (value.toLowerCase() === "true") {
    return true;
  }

  if (value.toLowerCase() === "false") {
    return false;
  }

  return value;
};

export const normalizeStudentRequestBody = (
  body: BodyRecord
): CreateStudentInput => ({
  ...body,
  course: parseJsonField(body.course),
  courses: parseJsonField(body.courses),
  teacherChanges: parseJsonField(body.teacherChanges),
  groupClass: parseBooleanField(body.groupClass),
  teacherChanged: parseBooleanField(body.teacherChanged)
} as CreateStudentInput);

export const normalizeTeacherRequestBody = (
  body: BodyRecord
): CreateTeacherInput => ({
  ...body,
  studentLeftDetails: parseJsonField(body.studentLeftDetails),
  studentLeftLogs: parseJsonField(body.studentLeftLogs)
} as CreateTeacherInput);
