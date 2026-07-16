import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import type {
  ClassReportFilters,
  CreateClassReportInput,
  ReportType,
  UpdateClassReportInput
} from "../types/classReport.types.js";

const teacherScoreFields = [
  {
    key: "teacherWebcamOn",
    label: "Webcam On"
  },
  {
    key: "teacherWebcamPosition",
    label: "Webcam Position"
  },
  {
    key: "teacherWebcamQuality",
    label: "Webcam Quality"
  },
  {
    key: "recommendedHeadphone",
    label: "Recommended Headphone"
  },
  {
    key: "teacherNoiseFree",
    label: "Noise Free"
  },
  {
    key: "tutorDevice",
    label: "Tutor Device"
  },
  {
    key: "tutorDressup",
    label: "Tutor Dressup"
  },
  {
    key: "teachingFocus",
    label: "Teacher Focus & Presence"
  },
  {
    key: "teachingTone",
    label: "Teaching Tone & Delivery Style"
  },
  {
    key: "toolsAndContentUse",
    label: "Tools & Content Use"
  },
  {
    key: "studentInteraction",
    label: "Student Interaction"
  },
  {
    key: "correctionQuality",
    label: "Correction & Attention to Mistakes"
  }
] as const;

type TeacherScoreField = (typeof teacherScoreFields)[number]["key"];

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
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

export const parseClassReportYear = (value: unknown) => {
  const rawYear = cleanString(Array.isArray(value) ? value[0] : value);

  if (!rawYear) {
    return new Date().getFullYear();
  }

  const year = Number(rawYear);

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw createHttpError(400, "year must be a valid year");
  }

  return year;
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

const normalizeScoreText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const scoreTeacherField = (
  field: TeacherScoreField,
  value: boolean | string | null
) => {
  if (value === null || value === "") {
    return null;
  }

  if (field === "teacherWebcamOn") {
    if (typeof value === "boolean") {
      return value ? 100 : 0;
    }

    const normalizedValue = normalizeScoreText(value);

    if (normalizedValue.includes("camera on")) {
      return 100;
    }

    if (normalizedValue.includes("camera off")) {
      return 0;
    }

    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = normalizeScoreText(value);

  if (field === "teacherWebcamPosition") {
    if (normalizedValue.includes("full face visible")) {
      return 100;
    }

    if (normalizedValue.includes("partially visible")) {
      return 66;
    }

    if (normalizedValue.includes("face not visible")) {
      return 33;
    }

    if (normalizedValue.includes("only background visible")) {
      return 0;
    }
  }

  if (field === "teacherWebcamQuality") {
    if (normalizedValue.includes("high quality")) {
      return 100;
    }

    if (normalizedValue.includes("average quality")) {
      return 66;
    }

    if (normalizedValue.includes("low quality")) {
      return 0;
    }
  }

  if (field === "recommendedHeadphone") {
    if (normalizedValue.includes("using rec headset")) {
      return 100;
    }

    if (normalizedValue.includes("using basic headset")) {
      return 66;
    }

    if (normalizedValue.includes("not using headset")) {
      return 0;
    }
  }

  if (field === "teacherNoiseFree") {
    if (normalizedValue.includes("quiet")) {
      return 100;
    }

    if (
      normalizedValue.includes("some noise") ||
      normalizedValue.includes("wind noise")
    ) {
      return 66;
    }

    if (normalizedValue.includes("noisy")) {
      return 0;
    }
  }

  if (field === "tutorDevice") {
    if (normalizedValue.includes("laptop/desktop")) {
      return 100;
    }

    if (normalizedValue.includes("tablet")) {
      return 66;
    }

    if (normalizedValue.includes("mobile phone")) {
      return 0;
    }
  }

  if (field === "tutorDressup") {
    if (
      normalizedValue.includes("withcap") ||
      normalizedValue.includes("with cap") ||
      normalizedValue.includes("with hijab")
    ) {
      return 100;
    }

    if (
      normalizedValue.includes("without cap") ||
      normalizedValue.includes("without hijab")
    ) {
      return 66;
    }

    if (normalizedValue.includes("casual")) {
      return 0;
    }
  }

  if (field === "teachingFocus") {
    if (normalizedValue.includes("fully focused")) {
      return 100;
    }

    if (normalizedValue.includes("partially focused")) {
      return 66;
    }

    if (
      normalizedValue.includes("distracted") ||
      normalizedValue.includes("inattentive")
    ) {
      return 0;
    }
  }

  if (field === "teachingTone") {
    if (normalizedValue.includes("polite") && normalizedValue.includes("engaging")) {
      return 100;
    }

    if (normalizedValue.includes("sometimes harsh")) {
      return 66;
    }

    if (normalizedValue.includes("harsh or rude")) {
      return 0;
    }
  }

  if (field === "toolsAndContentUse") {
    if (normalizedValue.includes("effectively uses tools")) {
      return 100;
    }

    if (normalizedValue.includes("uses tools occasionally")) {
      return 66;
    }

    if (
      normalizedValue.includes("rarely uses tools") ||
      normalizedValue.includes("ignores")
    ) {
      return 0;
    }
  }

  if (field === "studentInteraction") {
    if (normalizedValue.includes("friendly") && normalizedValue.includes("effective")) {
      return 100;
    }

    if (normalizedValue.includes("needs better balance")) {
      return 66;
    }

    if (normalizedValue.includes("poor communication")) {
      return 0;
    }
  }

  if (field === "correctionQuality") {
    if (normalizedValue.includes("corrects all mistakes")) {
      return 100;
    }

    if (normalizedValue.includes("misses some mistakes")) {
      return 66;
    }

    if (normalizedValue.includes("rarely corrects")) {
      return 0;
    }
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

type TeacherAverageColumnAccumulator = {
  label: string;
  scoreTotal: number;
  scoredCount: number;
};

type TeacherAverageBucket = {
  reportCount: number;
  scoreTotal: number;
  scoredFieldCount: number;
  columns: Record<TeacherScoreField, TeacherAverageColumnAccumulator>;
};

const createTeacherAverageColumns = () =>
  teacherScoreFields.reduce(
    (columns, field) => ({
      ...columns,
      [field.key]: {
        label: field.label,
        scoreTotal: 0,
        scoredCount: 0
      }
    }),
    {} as Record<TeacherScoreField, TeacherAverageColumnAccumulator>
  );

const createTeacherAverageBucket = (): TeacherAverageBucket => ({
  reportCount: 0,
  scoreTotal: 0,
  scoredFieldCount: 0,
  columns: createTeacherAverageColumns()
});

const getAverageScore = (scoreTotal: number, scoredCount: number) =>
  scoredCount > 0 ? Number((scoreTotal / scoredCount).toFixed(2)) : null;

const summarizeTeacherAverageBucket = (bucket: TeacherAverageBucket) => ({
  reportCount: bucket.reportCount,
  scoredFieldCount: bucket.scoredFieldCount,
  averageScore: getAverageScore(bucket.scoreTotal, bucket.scoredFieldCount),
  columns: teacherScoreFields.reduce(
    (columns, field) => {
      const column = bucket.columns[field.key];

      return {
        ...columns,
        [field.key]: {
          label: column.label,
          scoredCount: column.scoredCount,
          averageScore: getAverageScore(column.scoreTotal, column.scoredCount)
        }
      };
    },
    {} as Record<
      TeacherScoreField,
      {
        label: string;
        scoredCount: number;
        averageScore: number | null;
      }
    >
  )
});

const getReportMonthIndex = (month: string | null, createdAt: Date) => {
  const normalizedMonth = month?.trim().toLowerCase();

  if (normalizedMonth) {
    const yearMonthMatch = normalizedMonth.match(/^\d{4}[-/](\d{1,2})/);
    const monthNumber = yearMonthMatch
      ? Number(yearMonthMatch[1])
      : Number(normalizedMonth);

    if (Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12) {
      return monthNumber - 1;
    }

    const monthNameIndex = monthNames.findIndex((monthName) =>
      normalizedMonth.startsWith(monthName.toLowerCase())
    );

    if (monthNameIndex >= 0) {
      return monthNameIndex;
    }
  }

  return createdAt.getMonth();
};

const addReportToTeacherAverageBucket = (
  bucket: TeacherAverageBucket,
  report: Prisma.ClassReportGetPayload<{}>
) => {
  bucket.reportCount += 1;

  teacherScoreFields.forEach((field) => {
    const score = scoreTeacherField(
      field.key,
      report[field.key] as boolean | string | null
    );

    if (score === null) {
      return;
    }

    const column = bucket.columns[field.key];
    column.scoreTotal += score;
    column.scoredCount += 1;
    bucket.scoreTotal += score;
    bucket.scoredFieldCount += 1;
  });
};

export const getTeacherClassReportAverage = async (
  teacherId: string,
  year = new Date().getFullYear()
) => {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const nextYearStart = new Date(Date.UTC(year + 1, 0, 1));
  const reports = await prisma.classReport.findMany({
    where: {
      teacherId,
      createdAt: {
        gte: yearStart,
        lt: nextYearStart
      },
      AND: [hasTeacherReportFilter()]
    },
    include: {
      teacher: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  const monthlyBuckets = monthNames.map(() => createTeacherAverageBucket());
  const totalBucket = createTeacherAverageBucket();

  reports.forEach((report) => {
    const monthIndex = getReportMonthIndex(report.month, report.createdAt);

    addReportToTeacherAverageBucket(monthlyBuckets[monthIndex], report);
    addReportToTeacherAverageBucket(totalBucket, report);
  });

  return {
    teacherId,
    teacherName: reports[0]?.teacher?.name ?? null,
    year,
    months: monthNames.map((monthName, index) => ({
      month: monthName,
      monthNumber: index + 1,
      ...summarizeTeacherAverageBucket(monthlyBuckets[index])
    })),
    totals: summarizeTeacherAverageBucket(totalBucket)
  };
};
