import type { ActorScope } from "../auth/accessScope.js";

const teacherHiddenStudentFields = [
  "email",
  "studentEmail",
  "parentEmail",
  "guardianEmail",
  "phone",
  "studentPhone",
  "mobile",
  "parentPhone",
  "guardianPhone",
  "country",
  "address",
  "city",
  "studentSince",
  "createdAt",
  "parentName",
  "guardianName",
  "fatherName",
  "familyCode",
  "familyId",
  "guardianId"
] as const;

export const redactStudentPersonalInformation = <T extends object>(
  student: T,
  scope: ActorScope
): T => {
  if (scope.roleCode.trim().toUpperCase() !== "TEACHER") {
    return student;
  }

  const redactedStudent = { ...student } as T & Record<string, unknown>;

  for (const field of teacherHiddenStudentFields) {
    delete redactedStudent[field];
  }

  return redactedStudent;
};
