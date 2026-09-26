import assert from "node:assert/strict";
import test from "node:test";

import type { ActorScope } from "../auth/accessScope.js";
import { redactStudentPersonalInformation } from "./studentPrivacy.js";

const scope = (roleCode: string): ActorScope => ({
  userId: "user-1",
  roleCode,
  teacherId: roleCode === "TEACHER" ? "teacher-1" : null,
  studentId: roleCode === "STUDENT" ? "student-1" : null,
  isPrivileged: roleCode === "ADMIN"
});

const student = {
  id: "student-1",
  name: "Student",
  country: "Bangladesh",
  studentSince: new Date("2026-07-01"),
  createdAt: new Date("2026-07-01"),
  parentName: "Parent",
  parentEmail: "parent@example.com",
  parentPhone: "+8801000000000",
  familyCode: "FAMILY-1",
  courseName: "Nazirah"
};

void test("teacher responses omit student and parent personal information", () => {
  const result = redactStudentPersonalInformation(student, scope("TEACHER"));

  assert.deepEqual(result, {
    id: "student-1",
    name: "Student",
    courseName: "Nazirah"
  });
  assert.equal(student.parentEmail, "parent@example.com");
});

void test("student responses retain their personal information", () => {
  assert.equal(
    redactStudentPersonalInformation(student, scope("STUDENT")),
    student
  );
});

void test("admin responses retain student personal information", () => {
  assert.equal(redactStudentPersonalInformation(student, scope("ADMIN")), student);
});
