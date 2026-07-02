import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import type {
  ClassReportFilters,
  CreateClassReportInput,
  ReportType,
  UpdateClassReportInput
} from "../types/classReport.types.js";

const teacherScoreFields = [
  "teacherWebcamPosition",
  "teacherWebcamQuality",
  "recommendedHeadphone",
  "teacherNoiseFree",
  "tutorDevice",
  "tutorDressup",
  "teachingFocus",
  "teachingTone",
  "toolsAndContentUse",
  "studentInteraction",
  "correctionQuality"
] as const;

const classReportInclude = {
  student: {
    select: {
      id: true,
      name: true
    }
  },
  teacher: {
    select: {
      id: true,
      name: true
    }
  }
};

const createHttpError = (statusCode: number, message: string) => {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
};

const cleanString = (value: unknown) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();

  return trimmedValue === "" ? undefined : trimmedValue;
};

const cleanReportType = (value: unknown): ReportType | undefined => {
  const reportType = cleanString(value)?.toLowerCase();

  if (!reportType) {
    return undefined;
  }

  if (!["student", "teacher", "full"].includes(reportType)) {
    throw createHttpError(400, "reportType must be student, teacher, or full");
  }

  return reportType as ReportType;
};

export const parseClassReportFilters = (
  query: Record<string, unknown>
): ClassReportFilters => ({
  reportType: cleanReportType(query.reportType ?? query.type),
  studentId: cleanString(query.studentId),
  teacherId: cleanString(query.teacherId),
  month: cleanString(query.month)
});

const hasStudentReportFilter = (): Prisma.ClassReportWhereInput => ({
  OR: [
    { studentWebcamOn: { not: null } },
    { studentWebcamPosition: { not: null } },
    { studentWebcamQuality: { not: null } },
    { studentNoiseFree: { not: null } },
    { studentDevice: { not: null } },
    { studentDressup: { not: null } },
    { attentionFocus: { not: null } },
    { activityInClass: { not: null } },
    { lessonUnderstanding: { not: null } },
    { languageUnderstanding: { not: null } },
    { teacherNote: { not: null } }
  ]
});

const hasTeacherReportFilter = (): Prisma.ClassReportWhereInput => ({
  OR: [
    { teacherWebcamOn: { not: null } },
    { teacherWebcamPosition: { not: null } },
    { teacherWebcamQuality: { not: null } },
    { recommendedHeadphone: { not: null } },
    { teacherNoiseFree: { not: null } },
    { tutorDevice: { not: null } },
    { tutorDressup: { not: null } },
    { teachingFocus: { not: null } },
    { teachingTone: { not: null } },
    { toolsAndContentUse: { not: null } },
    { studentInteraction: { not: null } },
    { correctionQuality: { not: null } },
    { adminNote: { not: null } }
  ]
});

const buildClassReportWhere = (filters?: ClassReportFilters) => {
  const andFilters: Prisma.ClassReportWhereInput[] = [];

  if (filters?.studentId) {
    andFilters.push({ studentId: filters.studentId });
  }

  if (filters?.teacherId) {
    andFilters.push({ teacherId: filters.teacherId });
  }

  if (filters?.month) {
    andFilters.push({ month: filters.month });
  }

  if (filters?.reportType === "student") {
    andFilters.push(hasStudentReportFilter());
  }

  if (filters?.reportType === "teacher") {
    andFilters.push(hasTeacherReportFilter());
  }

  if (filters?.reportType === "full") {
    andFilters.push(hasStudentReportFilter(), hasTeacherReportFilter());
  }

  return andFilters.length > 0 ? { AND: andFilters } : undefined;
};

const getNestedValue = <TKey extends string>(
  payload: CreateClassReportInput | UpdateClassReportInput,
  section: "studentReport" | "teacherReport",
  key: TKey
) => {
  const nestedSection = payload[section] as Record<string, unknown> | undefined;

  return nestedSection?.[key];
};

const pickValue = <TValue>(
  value: TValue | undefined,
  fallback: unknown
) => (value !== undefined ? value : fallback);

const mapClassReportData = (
  payload: CreateClassReportInput | UpdateClassReportInput
) => ({
  ...(payload.month !== undefined ? { month: payload.month } : {}),
  ...(payload.studentId !== undefined ? { studentId: payload.studentId } : {}),
  ...(payload.teacherId !== undefined ? { teacherId: payload.teacherId } : {}),
  ...(payload.studentName !== undefined ? { studentName: payload.studentName } : {}),
  ...(payload.teacherName !== undefined ? { teacherName: payload.teacherName } : {}),
  ...(payload.studentWebcamOn !== undefined || payload.studentReport?.webcamOn !== undefined
    ? {
        studentWebcamOn: pickValue(
          payload.studentWebcamOn,
          getNestedValue(payload, "studentReport", "webcamOn")
        ) as boolean | null
      }
    : {}),
  ...(payload.studentWebcamPosition !== undefined ||
  payload.studentReport?.webcamPosition !== undefined
    ? {
        studentWebcamPosition: pickValue(
          payload.studentWebcamPosition,
          getNestedValue(payload, "studentReport", "webcamPosition")
        ) as string | null
      }
    : {}),
  ...(payload.studentWebcamQuality !== undefined ||
  payload.studentReport?.webcamQuality !== undefined
    ? {
        studentWebcamQuality: pickValue(
          payload.studentWebcamQuality,
          getNestedValue(payload, "studentReport", "webcamQuality")
        ) as string | null
      }
    : {}),
  ...(payload.studentNoiseFree !== undefined || payload.studentReport?.noiseFree !== undefined
    ? {
        studentNoiseFree: pickValue(
          payload.studentNoiseFree,
          getNestedValue(payload, "studentReport", "noiseFree")
        ) as string | null
      }
    : {}),
  ...(payload.studentDevice !== undefined || payload.studentReport?.studentDevice !== undefined
    ? {
        studentDevice: pickValue(
          payload.studentDevice,
          getNestedValue(payload, "studentReport", "studentDevice")
        ) as string | null
      }
    : {}),
  ...(payload.studentDressup !== undefined || payload.studentReport?.studentDressup !== undefined
    ? {
        studentDressup: pickValue(
          payload.studentDressup,
          getNestedValue(payload, "studentReport", "studentDressup")
        ) as string | null
      }
    : {}),
  ...(payload.attentionFocus !== undefined || payload.studentReport?.attentionFocus !== undefined
    ? {
        attentionFocus: pickValue(
          payload.attentionFocus,
          getNestedValue(payload, "studentReport", "attentionFocus")
        ) as string | null
      }
    : {}),
  ...(payload.activityInClass !== undefined || payload.studentReport?.activityInClass !== undefined
    ? {
        activityInClass: pickValue(
          payload.activityInClass,
          getNestedValue(payload, "studentReport", "activityInClass")
        ) as string | null
      }
    : {}),
  ...(payload.lessonUnderstanding !== undefined ||
  payload.studentReport?.lessonUnderstanding !== undefined
    ? {
        lessonUnderstanding: pickValue(
          payload.lessonUnderstanding,
          getNestedValue(payload, "studentReport", "lessonUnderstanding")
        ) as string | null
      }
    : {}),
  ...(payload.languageUnderstanding !== undefined ||
  payload.studentReport?.languageUnderstanding !== undefined
    ? {
        languageUnderstanding: pickValue(
          payload.languageUnderstanding,
          getNestedValue(payload, "studentReport", "languageUnderstanding")
        ) as string | null
      }
    : {}),
  ...(payload.teacherNote !== undefined || payload.studentReport?.teacherNote !== undefined
    ? {
        teacherNote: pickValue(
          payload.teacherNote,
          getNestedValue(payload, "studentReport", "teacherNote")
        ) as string | null
      }
    : {}),
  ...(payload.teacherWebcamOn !== undefined || payload.teacherReport?.webcamOn !== undefined
    ? {
        teacherWebcamOn: pickValue(
          payload.teacherWebcamOn,
          getNestedValue(payload, "teacherReport", "webcamOn")
        ) as boolean | null
      }
    : {}),
  ...(payload.teacherWebcamPosition !== undefined ||
  payload.teacherReport?.webcamPosition !== undefined
    ? {
        teacherWebcamPosition: pickValue(
          payload.teacherWebcamPosition,
          getNestedValue(payload, "teacherReport", "webcamPosition")
        ) as string | null
      }
    : {}),
  ...(payload.teacherWebcamQuality !== undefined ||
  payload.teacherReport?.webcamQuality !== undefined
    ? {
        teacherWebcamQuality: pickValue(
          payload.teacherWebcamQuality,
          getNestedValue(payload, "teacherReport", "webcamQuality")
        ) as string | null
      }
    : {}),
  ...(payload.recommendedHeadphone !== undefined ||
  payload.teacherReport?.recommendedHeadphone !== undefined
    ? {
        recommendedHeadphone: pickValue(
          payload.recommendedHeadphone,
          getNestedValue(payload, "teacherReport", "recommendedHeadphone")
        ) as string | null
      }
    : {}),
  ...(payload.teacherNoiseFree !== undefined || payload.teacherReport?.noiseFree !== undefined
    ? {
        teacherNoiseFree: pickValue(
          payload.teacherNoiseFree,
          getNestedValue(payload, "teacherReport", "noiseFree")
        ) as string | null
      }
    : {}),
  ...(payload.tutorDevice !== undefined || payload.teacherReport?.tutorDevice !== undefined
    ? {
        tutorDevice: pickValue(
          payload.tutorDevice,
          getNestedValue(payload, "teacherReport", "tutorDevice")
        ) as string | null
      }
    : {}),
  ...(payload.tutorDressup !== undefined || payload.teacherReport?.tutorDressup !== undefined
    ? {
        tutorDressup: pickValue(
          payload.tutorDressup,
          getNestedValue(payload, "teacherReport", "tutorDressup")
        ) as string | null
      }
    : {}),
  ...(payload.teachingFocus !== undefined || payload.teacherReport?.teachingFocus !== undefined
    ? {
        teachingFocus: pickValue(
          payload.teachingFocus,
          getNestedValue(payload, "teacherReport", "teachingFocus")
        ) as string | null
      }
    : {}),
  ...(payload.teachingTone !== undefined || payload.teacherReport?.teachingTone !== undefined
    ? {
        teachingTone: pickValue(
          payload.teachingTone,
          getNestedValue(payload, "teacherReport", "teachingTone")
        ) as string | null
      }
    : {}),
  ...(payload.toolsAndContentUse !== undefined ||
  payload.teacherReport?.toolsAndContentUse !== undefined
    ? {
        toolsAndContentUse: pickValue(
          payload.toolsAndContentUse,
          getNestedValue(payload, "teacherReport", "toolsAndContentUse")
        ) as string | null
      }
    : {}),
  ...(payload.studentInteraction !== undefined ||
  payload.teacherReport?.studentInteraction !== undefined
    ? {
        studentInteraction: pickValue(
          payload.studentInteraction,
          getNestedValue(payload, "teacherReport", "studentInteraction")
        ) as string | null
      }
    : {}),
  ...(payload.correctionQuality !== undefined ||
  payload.teacherReport?.correctionQuality !== undefined
    ? {
        correctionQuality: pickValue(
          payload.correctionQuality,
          getNestedValue(payload, "teacherReport", "correctionQuality")
        ) as string | null
      }
    : {}),
  ...(payload.adminNote !== undefined || payload.teacherReport?.adminNote !== undefined
    ? {
        adminNote: pickValue(
          payload.adminNote,
          getNestedValue(payload, "teacherReport", "adminNote")
        ) as string | null
      }
    : {})
});

const scoreTextValue = (value: string) => {
  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === "") {
    return null;
  }

  if (
    normalizedValue.includes("excellent") ||
    normalizedValue.includes("highly") ||
    normalizedValue.includes("high quality") ||
    normalizedValue.includes("proper") ||
    normalizedValue.includes("quiet") ||
    normalizedValue.includes("full face") ||
    normalizedValue.includes("clear & engaging") ||
    normalizedValue.includes("islamic dress") ||
    normalizedValue === "laptop"
  ) {
    return 5;
  }

  if (
    normalizedValue.includes("good") ||
    normalizedValue.includes("active") ||
    normalizedValue.includes("clear") ||
    normalizedValue.includes("engaging")
  ) {
    return 4;
  }

  if (
    normalizedValue.includes("average") ||
    normalizedValue.includes("medium") ||
    normalizedValue.includes("partial") ||
    normalizedValue.includes("tablet")
  ) {
    return 3;
  }

  if (
    normalizedValue.includes("low") ||
    normalizedValue.includes("poor") ||
    normalizedValue.includes("noisy") ||
    normalizedValue.includes("not") ||
    normalizedValue.includes("bad") ||
    normalizedValue.includes("mobile")
  ) {
    return 1;
  }

  return null;
};

export const getClassReports = async (filters?: ClassReportFilters) => {
  const where = buildClassReportWhere(filters);

  return prisma.classReport.findMany({
    ...(where ? { where } : {}),
    include: classReportInclude,
    orderBy: {
      createdAt: "desc"
    }
  });
};

export const createClassReport = async (payload: CreateClassReportInput) => {
  return prisma.classReport.create({
    data: mapClassReportData(payload),
    include: classReportInclude
  });
};

export const getClassReportById = async (id: string) => {
  const classReport = await prisma.classReport.findUnique({
    where: { id },
    include: classReportInclude
  });

  if (!classReport) {
    throw createHttpError(404, "Class report not found");
  }

  return classReport;
};

export const updateClassReport = async (
  id: string,
  payload: UpdateClassReportInput
) => {
  await getClassReportById(id);

  return prisma.classReport.update({
    where: { id },
    data: mapClassReportData(payload),
    include: classReportInclude
  });
};

export const deleteClassReport = async (id: string) => {
  await getClassReportById(id);

  await prisma.classReport.delete({
    where: { id }
  });
};

export const getTeacherClassReportAverage = async (teacherId: string) => {
  const reports = await prisma.classReport.findMany({
    where: {
      teacherId,
      AND: [hasTeacherReportFilter()]
    }
  });

  const scores = reports.flatMap((report) => {
    const fieldScores = teacherScoreFields
      .map((field) => report[field])
      .flatMap((value) => (value ? [scoreTextValue(value)] : []))
      .filter((score): score is number => score !== null);

    if (report.teacherWebcamOn !== null) {
      fieldScores.push(report.teacherWebcamOn ? 5 : 1);
    }

    return fieldScores;
  });

  const averageScore =
    scores.length > 0
      ? Number((scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(2))
      : null;

  return {
    teacherId,
    reportCount: reports.length,
    scoredFieldCount: scores.length,
    averageScore
  };
};
