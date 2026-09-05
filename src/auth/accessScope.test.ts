import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPrivilegedAccess,
  studentAccessWhere,
  teacherAccessWhere,
  type ActorScope
} from "./accessScope.js";

const scope = (overrides: Partial<ActorScope>): ActorScope => ({
  userId: "user-1",
  roleCode: "TEACHER",
  teacherId: null,
  studentId: null,
  isPrivileged: false,
  ...overrides
});

void test("teacher-linked accounts are scoped to their own teacher and students", () => {
  const teacherScope = scope({ teacherId: "teacher-1" });

  assert.deepEqual(teacherAccessWhere(teacherScope), { id: "teacher-1" });
  assert.deepEqual(studentAccessWhere(teacherScope), { teacherId: "teacher-1" });
});

void test("staff accounts are not record-scoped after permission checks pass", () => {
  const moderatorScope = scope({
    roleCode: "MODERATOR",
    isPrivileged: true
  });

  assert.equal(teacherAccessWhere(moderatorScope), undefined);
  assert.equal(studentAccessWhere(moderatorScope), undefined);
  assert.doesNotThrow(() => assertPrivilegedAccess(moderatorScope));
});

void test("linked teacher accounts cannot manage master profile records", () => {
  assert.throws(
    () => assertPrivilegedAccess(scope({ teacherId: "teacher-1" })),
    /Only staff users can manage this record/
  );
});
