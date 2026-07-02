import { StudentStatus } from "../generated/prisma/enums.js";
import type { StudentStatus as PrismaStudentStatus } from "../generated/prisma/enums.js";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import type {
  CreateStudentInput,
  StudentFilters,
  StudentStatus as StudentStatusInput,
  StudentCourseInput,
  TeacherChangeInput,
  UpdateStudentInput
} from "../types/student.types.js";

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

const buildStudentWhere = (filters?: StudentFilters) => {
  const teacherId = filters?.teacherId?.trim();
  const teacherName = filters?.teacherName?.trim();
  const where: Prisma.StudentWhereInput = {};

  if (teacherId) {
    where.teacherId = teacherId;
  }

  if (teacherName) {
    where.teacherName = teacherName;
  }

  return Object.keys(where).length > 0 ? where : undefined;
};

export const createStudent = async (payload: CreateStudentInput) => {
  const courses = compactCourses(payload);
  const teacherChanges = compactTeacherChanges(payload);

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

export const getStudents = async (filters?: StudentFilters) => {
  const where = buildStudentWhere(filters);

  return prisma.student.findMany({
    ...(where ? { where } : {}),
    include: studentInclude,
    orderBy: {
      createdAt: "desc"
    }
  });
};

export const getStudentOptions = async (filters?: StudentFilters) => {
  const where = buildStudentWhere(filters);

  return prisma.student.findMany({
    ...(where ? { where } : {}),
    select: {
      id: true,
      name: true
    },
    orderBy: {
      name: "asc"
    }
  });
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

export const updateStudent = async (id: string, payload: UpdateStudentInput) => {
  await getStudentById(id);

  const courses = compactCourses(payload);
  const teacherChanges = compactTeacherChanges(payload);

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
