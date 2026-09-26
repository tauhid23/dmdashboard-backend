import { StudentStatus } from "../generated/prisma/enums.js";
import type { StudentStatus as PrismaStudentStatus } from "../generated/prisma/enums.js";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import type { ActorScope } from "../auth/accessScope.js";
import { assertStudentAccess, studentAccessWhere } from "../auth/accessScope.js";
import { courseLevelFromDisplay } from "../exam/course-progression.js";
import type {
  CreateStudentInput,
  StudentFilters,
  StudentStatus as StudentStatusInput,
  StudentCourseInput,
  TeacherChangeInput,
  UpdateStudentInput
} from "../types/student.types.js";
import { calculateBillingPlan } from "../billing/studentBilling.service.js";
import type { BillingCycle } from "../billing/packageCatalog.js";

const studentInclude = {
  courses: true,
  teacherChanges: {
    orderBy: {
      changedAt: "desc" as const
    }
  }
};

const createHttpError = (statusCode: number, message: string) => {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
};

const parseDate = (value: string, fieldName: string) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw createHttpError(400, `${fieldName} must be a valid date`);
  }

  return date;
};

const parseOptionalDate = (value: string | null, fieldName: string) => {
  if (value === null || value.trim() === "") {
    return null;
  }

  return parseDate(value, fieldName);
};

const parseOptionalStatus = (value: StudentStatusInput | "" | null) => {
  if (value === null || value.trim() === "") {
    return null;
  }

  const status = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") as PrismaStudentStatus;

  if (!Object.values(StudentStatus).includes(status)) {
    throw createHttpError(
      400,
      "status must be ACTIVE, INACTIVE, TRIAL, or NEW_SIGN_UP"
    );
  }

  return status;
};

const stringifyOptional = (value: number | string | null) => {
  if (value === null) {
    return null;
  }

  return String(value);
};

const parseOptionalClassStartTime = (value: unknown) => {
  if (value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw createHttpError(400, "classStartTime must use 24-hour HH:mm format");
  }

  const time = value.trim();
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw createHttpError(400, "classStartTime must use 24-hour HH:mm format");
  }

  return time;
};

const parseOptionalClassDuration = (value: unknown) => {
  if (value === null || String(value).trim() === "") {
    return null;
  }

  const duration = Number(value);
  if (![30, 45, 60].includes(duration)) {
    throw createHttpError(400, "classDurationMinutes must be 30, 45, or 60");
  }

  return duration;
};

const parseClassDays = (value: unknown) => {
  if (!Array.isArray(value)) {
    throw createHttpError(400, "classDays must be an array");
  }

  const days = [...new Set(value)];
  if (days.length === 0) {
    throw createHttpError(400, "Choose at least one class day");
  }

  if (
    days.some(
      (day) => !Number.isInteger(day) || day < 0 || day > 6
    )
  ) {
    throw createHttpError(400, "classDays must contain day numbers from 0 to 6");
  }

  return days.sort((first, second) => first - second);
};

const parseBillingCycle = (value: unknown): BillingCycle => {
  const cycle = String(value ?? "MONTHLY").trim().toUpperCase();
  if (cycle !== "MONTHLY" && cycle !== "QUARTERLY") {
    throw createHttpError(400, "billingCycle must be MONTHLY or QUARTERLY");
  }
  return cycle;
};

const compactCourses = (payload: CreateStudentInput | UpdateStudentInput) => {
  const courses: StudentCourseInput[] = [];

  if (payload.courseName !== undefined || payload.courseStage !== undefined) {
    courses.push({
      courseInformation: payload.courseName,
      courseStage: payload.courseStage
    });
  }

  if (payload.course) {
    courses.push(payload.course);
  }

  if (payload.courses) {
    courses.push(...payload.courses);
  }

  return courses;
};

const mapTeacherChange = (teacherChange: TeacherChangeInput) => ({
  previousTeacherName: teacherChange.previousTeacherName,
  newTeacherName: teacherChange.newTeacherName,
  changingReason: teacherChange.changingReason,
  ...(teacherChange.changedAt
    ? { changedAt: parseDate(teacherChange.changedAt, "changedAt") }
    : {})
});

const compactTeacherChanges = (
  payload: CreateStudentInput | UpdateStudentInput
) => {
  const teacherChanges: TeacherChangeInput[] = [];

  if (
    payload.previousTeacherName !== undefined ||
    payload.teacherName !== undefined ||
    payload.teacherChangeReason !== undefined
  ) {
    teacherChanges.push({
      previousTeacherName: payload.previousTeacherName,
      newTeacherName: payload.teacherName,
      changingReason: payload.teacherChangeReason
    });
  }

  if (payload.teacherChanges) {
    teacherChanges.push(...payload.teacherChanges);
  }

  return teacherChanges;
};

const buildStudentWhere = (filters?: StudentFilters, scope?: ActorScope) => {
  const teacherId = filters?.teacherId?.trim();
  const teacherName = filters?.teacherName?.trim();
  const where: Prisma.StudentWhereInput = {};

  if (teacherId) {
    where.teacherId = teacherId;
  }

  if (teacherName) {
    where.teacherName = teacherName;
  }

  const scopeWhere = scope ? studentAccessWhere(scope) : undefined;
  if (scopeWhere) {
    return { AND: [where, scopeWhere] } as Prisma.StudentWhereInput;
  }

  return Object.keys(where).length > 0 ? where : undefined;
};

export const createStudent = async (payload: CreateStudentInput) => {
  const courses = compactCourses(payload);
  const teacherChanges = compactTeacherChanges(payload);
  const currentCourseLevel = courseLevelFromDisplay(payload.courseName, payload.courseStage);
  const classDays = payload.classDays !== undefined ? parseClassDays(payload.classDays) : [];
  const duration = payload.classDurationMinutes !== undefined
    ? parseOptionalClassDuration(payload.classDurationMinutes)
    : null;
  const billingCycle = parseBillingCycle(payload.billingCycle);
  const billingPlan = duration && classDays.length
    ? calculateBillingPlan({ durationMinutes: duration, classDays, groupClass: payload.groupClass ?? false, billingCycle })
    : null;

  return prisma.student.create({
    data: {
      ...(payload.image !== undefined ? { image: payload.image } : {}),
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.country !== undefined ? { country: payload.country } : {}),
      ...(payload.studentSince !== undefined
        ? { studentSince: parseOptionalDate(payload.studentSince, "studentSince") }
        : {}),
      ...(payload.weeklySchedule !== undefined
        ? { weeklySchedule: stringifyOptional(payload.weeklySchedule) }
        : {}),
      ...(payload.classStartDate !== undefined
        ? { classStartDate: parseOptionalDate(payload.classStartDate, "classStartDate") }
        : {}),
      ...(payload.classStartTime !== undefined
        ? { classStartTime: parseOptionalClassStartTime(payload.classStartTime) }
        : {}),
      ...(payload.classDurationMinutes !== undefined
        ? { classDurationMinutes: duration }
        : {}),
      ...(payload.classDays !== undefined
        ? { classDays }
        : {}),
      billingCycle,
      ...(billingPlan ? { ...billingPlan, billingManualOverride: false } : {}),
      ...(payload.parentName !== undefined ? { parentName: payload.parentName } : {}),
      ...(payload.parentEmail !== undefined
        ? { parentEmail: payload.parentEmail }
        : {}),
      ...(payload.parentPhone !== undefined
        ? { parentPhone: payload.parentPhone }
        : {}),
      ...(payload.courseName !== undefined
        ? { courseName: payload.courseName }
        : {}),
      ...(payload.courseStage !== undefined
        ? { courseStage: payload.courseStage }
        : {}),
      ...(payload.teacherId !== undefined ? { teacherId: payload.teacherId } : {}),
      ...(payload.teacherName !== undefined
        ? { teacherName: payload.teacherName }
        : {}),
      ...(payload.groupClass !== undefined
        ? { groupClass: payload.groupClass }
        : {}),
      ...(payload.groupSchedule !== undefined
        ? { groupSchedule: payload.groupSchedule }
        : {}),
      ...(payload.groupClassSchedule !== undefined
        ? { groupClassSchedule: payload.groupClassSchedule }
        : {}),
      ...(payload.groupTeacher !== undefined
        ? { groupTeacher: payload.groupTeacher }
        : {}),
      ...(payload.groupSubject !== undefined
        ? { groupSubject: payload.groupSubject }
        : {}),
      ...(payload.subject !== undefined ? { subject: payload.subject } : {}),
      ...(payload.teacherChanged !== undefined
        ? { teacherChanged: payload.teacherChanged }
        : {}),
      ...(payload.previousTeacherName !== undefined
        ? { previousTeacherName: payload.previousTeacherName }
        : {}),
      ...(payload.teacherChangeReason !== undefined
        ? { teacherChangeReason: payload.teacherChangeReason }
        : {}),
      ...(payload.status !== undefined
        ? { status: parseOptionalStatus(payload.status) }
        : {}),
      ...(currentCourseLevel
        ? {
            currentCourseLevel,
            courseCompleted: false,
            courseUpdatedAt: new Date()
          }
        : {}),
      ...(courses.length > 0
        ? {
            courses: {
              create: courses
            }
          }
        : {}),
      ...(teacherChanges.length > 0
        ? {
            teacherChanges: {
              create: teacherChanges.map(mapTeacherChange)
            }
          }
        : {})
    },
    include: studentInclude
  });
};

export const getStudents = async (filters?: StudentFilters, scope?: ActorScope) => {
  const where = buildStudentWhere(filters, scope);

  return prisma.student.findMany({
    ...(where ? { where } : {}),
    include: studentInclude,
    orderBy: {
      createdAt: "desc"
    }
  });
};

export const getStudentOptions = async (filters?: StudentFilters, scope?: ActorScope) => {
  const where = buildStudentWhere(filters, scope);

  const students = await prisma.student.findMany({
    ...(where ? { where } : {}),
    select: {
      id: true,
      name: true
    },
    orderBy: {
      name: "asc"
    }
  });

  return [{ id: "", name: "Select option" }, ...students];
};

export const getParentOptions = async (searchValue?: string) => {
  const search = searchValue?.trim();
  const students = await prisma.student.findMany({
    where: {
      OR: [
        { parentName: { not: null, ...(search ? { contains: search, mode: "insensitive" as const } : {}) } },
        ...(search ? [{ parentEmail: { contains: search, mode: "insensitive" as const } }] : [])
      ]
    },
    select: { parentName: true, parentEmail: true, parentPhone: true, name: true },
    orderBy: { parentName: "asc" },
    take: 100
  });
  const families = new Map<string, { id: string; name: string; email: string; phone: string; students: string[] }>();
  for (const student of students) {
    if (!student.parentName && !student.parentEmail) continue;
    const key = student.parentEmail?.trim().toLowerCase() || `${student.parentName?.trim().toLowerCase()}|${student.parentPhone ?? ""}`;
    const existing = families.get(key);
    if (existing) {
      if (student.name && !existing.students.includes(student.name)) existing.students.push(student.name);
    } else {
      families.set(key, { id: key, name: student.parentName ?? "Parent", email: student.parentEmail ?? "", phone: student.parentPhone ?? "", students: student.name ? [student.name] : [] });
    }
  }
  return [...families.values()].slice(0, 20);
};

export const getStudentById = async (id: string) => {
  const student = await prisma.student.findUnique({
    where: { id },
    include: studentInclude
  });

  if (!student) {
    throw createHttpError(404, "Student not found");
  }

  return student;
};

export const assertStudentVisible = (id: string, scope: ActorScope) =>
  assertStudentAccess(scope, id);

export const updateStudent = async (id: string, payload: UpdateStudentInput) => {
  const existingStudent = await getStudentById(id);

  const courses = compactCourses(payload);
  const teacherChanges = compactTeacherChanges(payload);
  const currentCourseLevel = courseLevelFromDisplay(
    payload.courseName !== undefined ? payload.courseName : existingStudent.courseName,
    payload.courseStage !== undefined ? payload.courseStage : existingStudent.courseStage
  );
  const classDays = payload.classDays !== undefined ? parseClassDays(payload.classDays) : existingStudent.classDays;
  const duration = payload.classDurationMinutes !== undefined
    ? parseOptionalClassDuration(payload.classDurationMinutes)
    : existingStudent.classDurationMinutes;
  const groupClass = payload.groupClass !== undefined ? payload.groupClass : existingStudent.groupClass ?? false;
  const billingCycle = parseBillingCycle(payload.billingCycle ?? existingStudent.billingCycle);
  const manualOverride = payload.billingManualOverride ?? existingStudent.billingManualOverride;
  const billingPlan = !manualOverride && duration && classDays.length
    ? calculateBillingPlan({ durationMinutes: duration, classDays, groupClass, billingCycle })
    : null;

  return prisma.student.update({
    where: { id },
    data: {
      ...(payload.image !== undefined ? { image: payload.image } : {}),
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.country !== undefined ? { country: payload.country } : {}),
      ...(payload.studentSince !== undefined
        ? { studentSince: parseOptionalDate(payload.studentSince, "studentSince") }
        : {}),
      ...(payload.weeklySchedule !== undefined
        ? { weeklySchedule: stringifyOptional(payload.weeklySchedule) }
        : {}),
      ...(payload.classStartDate !== undefined
        ? { classStartDate: parseOptionalDate(payload.classStartDate, "classStartDate") }
        : {}),
      ...(payload.classStartTime !== undefined
        ? { classStartTime: parseOptionalClassStartTime(payload.classStartTime) }
        : {}),
      ...(payload.classDurationMinutes !== undefined
        ? { classDurationMinutes: duration }
        : {}),
      ...(payload.classDays !== undefined
        ? { classDays }
        : {}),
      billingCycle,
      billingManualOverride: manualOverride,
      ...(manualOverride && payload.billingAmountBdt !== undefined
        ? { billingAmountBdt: Number(payload.billingAmountBdt) }
        : billingPlan ?? {}),
      ...(payload.parentName !== undefined ? { parentName: payload.parentName } : {}),
      ...(payload.parentEmail !== undefined
        ? { parentEmail: payload.parentEmail }
        : {}),
      ...(payload.parentPhone !== undefined
        ? { parentPhone: payload.parentPhone }
        : {}),
      ...(payload.courseName !== undefined
        ? { courseName: payload.courseName }
        : {}),
      ...(payload.courseStage !== undefined
        ? { courseStage: payload.courseStage }
        : {}),
      ...(payload.teacherId !== undefined ? { teacherId: payload.teacherId } : {}),
      ...(payload.teacherName !== undefined
        ? { teacherName: payload.teacherName }
        : {}),
      ...(payload.groupClass !== undefined
        ? { groupClass: payload.groupClass }
        : {}),
      ...(payload.groupSchedule !== undefined
        ? { groupSchedule: payload.groupSchedule }
        : {}),
      ...(payload.groupClassSchedule !== undefined
        ? { groupClassSchedule: payload.groupClassSchedule }
        : {}),
      ...(payload.groupTeacher !== undefined
        ? { groupTeacher: payload.groupTeacher }
        : {}),
      ...(payload.groupSubject !== undefined
        ? { groupSubject: payload.groupSubject }
        : {}),
      ...(payload.subject !== undefined ? { subject: payload.subject } : {}),
      ...(payload.teacherChanged !== undefined
        ? { teacherChanged: payload.teacherChanged }
        : {}),
      ...(payload.previousTeacherName !== undefined
        ? { previousTeacherName: payload.previousTeacherName }
        : {}),
      ...(payload.teacherChangeReason !== undefined
        ? { teacherChangeReason: payload.teacherChangeReason }
        : {}),
      ...(payload.status !== undefined
        ? { status: parseOptionalStatus(payload.status) }
        : {}),
      ...(currentCourseLevel && currentCourseLevel !== existingStudent.currentCourseLevel
        ? {
            currentCourseLevel,
            courseCompleted: false,
            courseUpdatedAt: new Date()
          }
        : {}),
      ...(courses.length > 0
        ? {
            courses: {
              deleteMany: {},
              create: courses
            }
          }
        : {}),
      ...(payload.teacherChanges !== undefined
        ? {
            teacherChanges: {
              deleteMany: {},
              create: teacherChanges.map(mapTeacherChange)
            }
          }
        : teacherChanges.length > 0
          ? {
              teacherChanges: {
                create: teacherChanges.map(mapTeacherChange)
              }
            }
          : {})
    },
    include: studentInclude
  });
};

export const deleteStudent = async (id: string) => {
  await getStudentById(id);

  await prisma.student.delete({
    where: { id }
  });
};
