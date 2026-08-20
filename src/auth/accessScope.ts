import { prisma } from "../config/prisma.js";

const privilegedRoleCodes = new Set(["SUPER_ADMIN", "ADMIN"]);

export type ActorScope = {
  userId: string;
  roleCode: string;
  teacherId: string | null;
  studentId: string | null;
  isPrivileged: boolean;
};

export const forbidden = (message = "You do not have access to this record") =>
  Object.assign(new Error(message), { statusCode: 403, code: "FORBIDDEN" });

export const getActorScope = async (userId: string): Promise<ActorScope> => {
  const user = await (prisma.user.findUnique as unknown as (args: unknown) => Promise<{
    id: string;
    teacherId: string | null;
    studentId: string | null;
    role: { code: string };
  } | null>)({
    where: { id: userId },
    select: {
      id: true,
      teacherId: true,
      studentId: true,
      role: { select: { code: true } }
    }
  });

  if (!user) {
    throw Object.assign(new Error("Authentication required"), {
      statusCode: 401,
      code: "UNAUTHENTICATED"
    });
  }

  return {
    userId: user.id,
    roleCode: user.role.code,
    teacherId: user.teacherId,
    studentId: user.studentId,
    isPrivileged: privilegedRoleCodes.has(user.role.code)
  };
};

export const getRequestScope = async (userId?: string) => {
  if (!userId) {
    throw Object.assign(new Error("Authentication required"), {
      statusCode: 401,
      code: "UNAUTHENTICATED"
    });
  }

  return getActorScope(userId);
};

export const assertTeacherAccess = async (
  scope: ActorScope,
  teacherId: string
) => {
  if (scope.isPrivileged) return;
  if (scope.teacherId && scope.teacherId === teacherId) return;
  if (scope.studentId) {
    const student = await prisma.student.findFirst({
      where: { id: scope.studentId, teacherId },
      select: { id: true }
    });
    if (student) return;
  }

  throw forbidden("You can only access your own tutor account");
};

export const assertStudentAccess = async (
  scope: ActorScope,
  studentId: string
) => {
  if (scope.isPrivileged) return;
  if (scope.studentId && scope.studentId === studentId) return;

  if (scope.teacherId) {
    const student = await prisma.student.findFirst({
      where: { id: studentId, teacherId: scope.teacherId },
      select: { id: true }
    });
    if (student) return;
  }

  throw forbidden("You can only access records assigned to your account");
};

export const studentAccessWhere = (scope: ActorScope) => {
  if (scope.isPrivileged) return undefined;
  if (scope.studentId) return { id: scope.studentId };
  if (scope.teacherId) return { teacherId: scope.teacherId };
  return { id: "__no_access__" };
};

export const teacherAccessWhere = (scope: ActorScope) => {
  if (scope.isPrivileged) return undefined;
  if (scope.teacherId) return { id: scope.teacherId };
  return { id: "__no_access__" };
};

export const scheduleAccessWhere = (scope: ActorScope) => {
  if (scope.isPrivileged) return undefined;
  if (scope.studentId) return { studentId: scope.studentId };
  if (scope.teacherId) return { teacherId: scope.teacherId };
  return { id: "__no_access__" };
};

export const classReportAccessWhere = (scope: ActorScope) => {
  if (scope.isPrivileged) return undefined;
  if (scope.studentId) return { studentId: scope.studentId };
  if (scope.teacherId) return { teacherId: scope.teacherId };
  return { id: "__no_access__" };
};
