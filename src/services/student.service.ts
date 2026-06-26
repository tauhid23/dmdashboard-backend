import { prisma } from "../config/prisma.js";
import type {
  CreateStudentInput,
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
  if (value === null) {
    return null;
  }

  return parseDate(value, fieldName);
};

const compactCourses = (payload: CreateStudentInput | UpdateStudentInput) => {
  const courses: StudentCourseInput[] = [];

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

export const createStudent = async (payload: CreateStudentInput) => {
  const courses = compactCourses(payload);

  return prisma.student.create({
    data: {
      ...(payload.image !== undefined ? { image: payload.image } : {}),
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.country !== undefined ? { country: payload.country } : {}),
      ...(payload.studentSince !== undefined
        ? { studentSince: parseOptionalDate(payload.studentSince, "studentSince") }
        : {}),
      ...(payload.weeklySchedule !== undefined
        ? { weeklySchedule: payload.weeklySchedule }
        : {}),
      ...(payload.parentName !== undefined ? { parentName: payload.parentName } : {}),
      ...(payload.parentEmail !== undefined
        ? { parentEmail: payload.parentEmail }
        : {}),
      ...(payload.parentPhone !== undefined
        ? { parentPhone: payload.parentPhone }
        : {}),
      ...(payload.groupClassSchedule !== undefined
        ? { groupClassSchedule: payload.groupClassSchedule }
        : {}),
      ...(payload.groupTeacher !== undefined
        ? { groupTeacher: payload.groupTeacher }
        : {}),
      ...(payload.subject !== undefined ? { subject: payload.subject } : {}),
      ...(courses.length > 0
        ? {
            courses: {
              create: courses
            }
          }
        : {}),
      ...(payload.teacherChanges && payload.teacherChanges.length > 0
        ? {
            teacherChanges: {
              create: payload.teacherChanges.map(mapTeacherChange)
            }
          }
        : {})
    },
    include: studentInclude
  });
};

export const getStudents = async () => {
  return prisma.student.findMany({
    include: studentInclude,
    orderBy: {
      createdAt: "desc"
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
        ? { weeklySchedule: payload.weeklySchedule }
        : {}),
      ...(payload.parentName !== undefined ? { parentName: payload.parentName } : {}),
      ...(payload.parentEmail !== undefined
        ? { parentEmail: payload.parentEmail }
        : {}),
      ...(payload.parentPhone !== undefined
        ? { parentPhone: payload.parentPhone }
        : {}),
      ...(payload.groupClassSchedule !== undefined
        ? { groupClassSchedule: payload.groupClassSchedule }
        : {}),
      ...(payload.groupTeacher !== undefined
        ? { groupTeacher: payload.groupTeacher }
        : {}),
      ...(payload.subject !== undefined ? { subject: payload.subject } : {}),
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
              create: payload.teacherChanges.map(mapTeacherChange)
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
