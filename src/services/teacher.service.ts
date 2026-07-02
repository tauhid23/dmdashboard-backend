import { TeacherStatus } from "../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { getTeacherClassReportAverage } from "./classReport.service.js";
import type {
  CreateTeacherInput,
  StudentLeftLogInput,
  TeacherStatusInput,
  UpdateTeacherInput
} from "../types/teacher.types.js";

const teacherInclude = {
  studentLeftLogs: {
    orderBy: {
      createdAt: "desc" as const
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

const parseOptionalNumber = (
  value: number | string | null,
  fieldName: string
) => {
  if (value === null || value === "") {
    return null;
  }

  const numberValue =
    typeof value === "string" ? Number(value) : value;

  if (!Number.isInteger(numberValue)) {
    throw createHttpError(400, `${fieldName} must be an integer`);
  }

  return numberValue;
};

const parseOptionalStatus = (value: TeacherStatusInput | "" | null) => {
  if (value === null || value.trim() === "") {
    return null;
  }

  const status = value.trim().toUpperCase() as TeacherStatusInput;

  if (!Object.values(TeacherStatus).includes(status)) {
    throw createHttpError(400, "status must be ACTIVE or INACTIVE");
  }

  return status;
};

const compactStudentLeftLogs = (
  payload: CreateTeacherInput | UpdateTeacherInput
) => {
  const studentLeftLogs: StudentLeftLogInput[] = [];

  if (payload.studentLeftDetails) {
    studentLeftLogs.push(...payload.studentLeftDetails);
  }

  if (payload.studentLeftLogs) {
    studentLeftLogs.push(...payload.studentLeftLogs);
  }

  return studentLeftLogs;
};

export const createTeacher = async (payload: CreateTeacherInput) => {
  const studentLeftLogs = compactStudentLeftLogs(payload);

  return prisma.teacher.create({
    data: {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl } : {}),
      ...(payload.joiningDate !== undefined
        ? { joiningDate: parseOptionalDate(payload.joiningDate, "joiningDate") }
        : {}),
      ...(payload.status !== undefined
        ? { status: parseOptionalStatus(payload.status) }
        : {}),
      ...(payload.strongArea !== undefined
        ? { strongArea: payload.strongArea }
        : {}),
      ...(payload.totalStudentsAssignedLifetime !== undefined
        ? {
            totalStudentsAssignedLifetime: parseOptionalNumber(
              payload.totalStudentsAssignedLifetime,
              "totalStudentsAssignedLifetime"
            )
          }
        : {}),
      ...(payload.currentActiveStudents !== undefined
        ? {
            currentActiveStudents: parseOptionalNumber(
              payload.currentActiveStudents,
              "currentActiveStudents"
            )
          }
        : {}),
      ...(payload.studentLeftLifetime !== undefined
        ? {
            studentLeftLifetime: parseOptionalNumber(
              payload.studentLeftLifetime,
              "studentLeftLifetime"
            )
          }
        : {}),
      ...(studentLeftLogs.length > 0
        ? {
            studentLeftLogs: {
              create: studentLeftLogs
            }
          }
        : {})
    },
    include: teacherInclude
  });
};

export const getTeachers = async () => {
  return prisma.teacher.findMany({
    include: teacherInclude,
    orderBy: {
      createdAt: "desc"
    }
  });
};

export const getTeacherOptions = async () => {
  return prisma.teacher.findMany({
    select: {
      id: true,
      name: true
    },
    orderBy: {
      name: "asc"
    }
  });
};

export const getTeacherById = async (id: string) => {
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: teacherInclude
  });

  if (!teacher) {
    throw createHttpError(404, "Teacher not found");
  }

  const classReportAverage = await getTeacherClassReportAverage(id);

  return {
    ...teacher,
    classReportAverage
  };
};

export { getTeacherClassReportAverage };

export const updateTeacher = async (
  id: string,
  payload: UpdateTeacherInput
) => {
  await getTeacherById(id);

  const studentLeftLogs = compactStudentLeftLogs(payload);

  return prisma.teacher.update({
    where: { id },
    data: {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.imageUrl !== undefined ? { imageUrl: payload.imageUrl } : {}),
      ...(payload.joiningDate !== undefined
        ? { joiningDate: parseOptionalDate(payload.joiningDate, "joiningDate") }
        : {}),
      ...(payload.status !== undefined
        ? { status: parseOptionalStatus(payload.status) }
        : {}),
      ...(payload.strongArea !== undefined
        ? { strongArea: payload.strongArea }
        : {}),
      ...(payload.totalStudentsAssignedLifetime !== undefined
        ? {
            totalStudentsAssignedLifetime: parseOptionalNumber(
              payload.totalStudentsAssignedLifetime,
              "totalStudentsAssignedLifetime"
            )
          }
        : {}),
      ...(payload.currentActiveStudents !== undefined
        ? {
            currentActiveStudents: parseOptionalNumber(
              payload.currentActiveStudents,
              "currentActiveStudents"
            )
          }
        : {}),
      ...(payload.studentLeftLifetime !== undefined
        ? {
            studentLeftLifetime: parseOptionalNumber(
              payload.studentLeftLifetime,
              "studentLeftLifetime"
            )
          }
        : {}),
      ...(studentLeftLogs.length > 0
        ? {
            studentLeftLogs: {
              create: studentLeftLogs
            }
          }
        : {})
    },
    include: teacherInclude
  });
};

export const deleteTeacher = async (id: string) => {
  await getTeacherById(id);

  await prisma.teacher.delete({
    where: { id }
  });
};
