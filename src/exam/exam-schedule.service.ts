import type { Prisma } from "../generated/prisma/client.js";
import { ExamScheduleStatus } from "../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import type { ActorScope } from "../auth/accessScope.js";
import { assertStudentAccess, assertTeacherAccess, scheduleAccessWhere } from "../auth/accessScope.js";

type CreateScheduleInput = {
  studentId: string;
  teacherId: string;
  courseName: string;
  level: string;
  scheduledAt: Date;
};

const httpError = (statusCode: number, message: string) =>
  Object.assign(new Error(message), { statusCode });

const include = {
  student: { select: { id: true, name: true } },
  teacher: { select: { id: true, name: true } }
} satisfies Prisma.ExamScheduleInclude;

type ScheduleWithDetails = Prisma.ExamScheduleGetPayload<{ include: typeof include }>;

const displayStatus = (status: ExamScheduleStatus) =>
  status
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());

const publicSchedule = (schedule: ScheduleWithDetails) => ({
  id: schedule.id,
  studentId: schedule.studentId,
  teacherId: schedule.teacherId,
  studentName: schedule.student.name,
  teacherName: schedule.teacher.name,
  courseName: schedule.courseName,
  level: schedule.level,
  scheduledAt: schedule.scheduledAt,
  status: displayStatus(schedule.status),
  createdAt: schedule.createdAt,
  updatedAt: schedule.updatedAt
});

const stringField = (body: Record<string, unknown>, key: string) => {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw httpError(400, `${key} is required`);
  }

  return value.trim();
};

const parseScheduledAt = (body: Record<string, unknown>) => {
  const scheduledAt = body.scheduledAt;
  if (typeof scheduledAt === "string" && scheduledAt.trim()) {
    const date = new Date(scheduledAt);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const examDate = stringField(body, "examDate");
  const examTime = typeof body.examTime === "string" && body.examTime.trim()
    ? body.examTime.trim()
    : "09:00";
  const date = new Date(`${examDate}T${examTime}`);

  if (Number.isNaN(date.getTime())) {
    throw httpError(400, "scheduledAt must be a valid date and time");
  }

  return date;
};

const validateCreatePayload = (raw: unknown): CreateScheduleInput => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw httpError(400, "Request body must be an object");
  }

  const body = raw as Record<string, unknown>;

  return {
    studentId: stringField(body, "studentId"),
    teacherId: stringField(body, "teacherId"),
    courseName: stringField(body, "courseName"),
    level: stringField(body, "level"),
    scheduledAt: parseScheduledAt(body)
  };
};

export const createSchedule = async (raw: unknown, scope?: ActorScope) => {
  const input = validateCreatePayload(raw);
  if (scope && !scope.isPrivileged) {
    await assertStudentAccess(scope, input.studentId);
    await assertTeacherAccess(scope, input.teacherId);
  }
  const student = await prisma.student.findUnique({ where: { id: input.studentId } });
  if (!student) throw httpError(404, "Student not found");

  const teacher = await prisma.teacher.findUnique({ where: { id: input.teacherId } });
  if (!teacher) throw httpError(404, "Teacher not found");
  if (student.teacherId !== input.teacherId) {
    throw httpError(403, "Teacher is not assigned to this student");
  }

  const schedule = await prisma.examSchedule.create({
    data: {
      studentId: input.studentId,
      teacherId: input.teacherId,
      courseName: input.courseName,
      level: input.level,
      scheduledAt: input.scheduledAt
    },
    include
  });

  return publicSchedule(schedule);
};

export const listSchedules = async (query: Record<string, unknown>, scope?: ActorScope) => {
  const where: Prisma.ExamScheduleWhereInput = {};

  for (const key of ["studentId", "teacherId"] as const) {
    if (typeof query[key] === "string" && query[key].trim()) {
      Object.assign(where, { [key]: query[key].trim() });
    }
  }

  if (typeof query.status === "string") {
    const status = query.status.trim().toUpperCase() as ExamScheduleStatus;
    if (Object.values(ExamScheduleStatus).includes(status)) {
      where.status = status;
    }
  }
  const scopeWhere = scope ? scheduleAccessWhere(scope) : undefined;
  const finalWhere = scopeWhere
    ? ({ AND: [where, scopeWhere] } as Prisma.ExamScheduleWhereInput)
    : where;

  const schedules = await prisma.examSchedule.findMany({
    where: finalWhere,
    include,
    orderBy: { scheduledAt: "asc" }
  });

  return schedules.map(publicSchedule);
};

export const listStudentSchedules = async (studentId: string, scope?: ActorScope) => {
  const exists = await prisma.student.count({ where: { id: studentId } });
  if (!exists) throw httpError(404, "Student not found");

  return listSchedules({ studentId }, scope);
};
