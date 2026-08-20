import { StudentStatus, TeacherStatus } from "../generated/prisma/enums.js";
import type { Teacher } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import type { ActorScope } from "../auth/accessScope.js";
import { assertTeacherAccess, teacherAccessWhere } from "../auth/accessScope.js";
import { listEvents } from "./classSchedule.service.js";
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

type TeacherWithLeftLogs = Teacher & {
  studentLeftLogs: StudentLeftLogInput[];
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

const parsePayrollRate = (value: unknown, fieldName = "hourlyRateBdt") => {
  const numberValue = typeof value === "string" ? Number(value) : value;

  if (typeof numberValue !== "number" || !Number.isFinite(numberValue)) {
    throw createHttpError(400, `${fieldName} must be a number`);
  }
  if (numberValue < 0 || numberValue > 100000) {
    throw createHttpError(400, `${fieldName} must be between 0 and 100000`);
  }

  return numberValue.toFixed(2);
};

const assertSuperAdmin = async (actorUserId: string) => {
  const actor = await prisma.user.findUnique({
    where: { id: actorUserId },
    select: { role: { select: { code: true } } }
  });

  if (actor?.role.code !== "SUPER_ADMIN") {
    throw createHttpError(403, "Only Super Admin can edit teacher payroll");
  }
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

const numberOrZero = (value: number | null | undefined) => value ?? 0;

const decimalToNumber = (value: unknown, fallback = 300) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return fallback;
};

const pad = (value: number) => String(value).padStart(2, "0");

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const parsePayrollMonth = (month?: string) => {
  const fallback = new Date();
  const rawMonth =
    month && /^\d{4}-\d{2}$/.test(month)
      ? month
      : `${fallback.getFullYear()}-${pad(fallback.getMonth() + 1)}`;
  const [year, monthNumber] = rawMonth.split("-").map(Number);

  if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) {
    throw createHttpError(400, "month must use YYYY-MM format");
  }

  const start = new Date(year, monthNumber - 1, 1);
  const end = new Date(year, monthNumber, 0);

  return {
    key: rawMonth,
    startDate: toDateKey(start),
    endDate: toDateKey(end)
  };
};

const nextMonthKey = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
};

export const isPayrollEligibleAttendance = (attendanceStatus?: string | null) => {
  if (!attendanceStatus) return false;

  return attendanceStatus.trim().toLowerCase() !== "unrecorded";
};

const distinctStudentIds = (students: { id?: string; studentId?: string }[]) =>
  new Set(
    students
      .map((student) => student.id ?? student.studentId)
      .filter((id): id is string => Boolean(id))
  );

const calculateTeacherStats = async (teacher: TeacherWithLeftLogs) => {
  const currentStudents = await prisma.student.findMany({
    where: {
      teacherId: teacher.id,
      OR: [{ status: null }, { status: { not: StudentStatus.INACTIVE } }]
    },
    select: {
      id: true
    }
  });

  const teacherChangeMatches = teacher.name
    ? await prisma.teacherChange.findMany({
        where: {
          OR: [
            { previousTeacherName: teacher.name },
            { newTeacherName: teacher.name }
          ]
        },
        select: {
          studentId: true,
          previousTeacherName: true
        }
      })
    : [];

  const leftStudentIds = distinctStudentIds(
    teacherChangeMatches.filter(
      (change) => change.previousTeacherName === teacher.name
    )
  );
  const lifetimeStudentIds = distinctStudentIds([
    ...currentStudents,
    ...teacherChangeMatches
  ]);
  const currentStudentCount = currentStudents.length;
  const leftLogCount = teacher.studentLeftLogs.length;
  const storedCurrentStudents = numberOrZero(teacher.currentActiveStudents);
  const storedStudentsLeft = numberOrZero(teacher.studentLeftLifetime);
  const storedLifetimeStudents = numberOrZero(
    teacher.totalStudentsAssignedLifetime
  );
  const calculatedStudentsLeft = Math.max(leftLogCount, leftStudentIds.size);
  const currentActiveStudents =
    currentStudentCount > 0 ? currentStudentCount : storedCurrentStudents;
  const studentLeftLifetime =
    calculatedStudentsLeft > 0 ? calculatedStudentsLeft : storedStudentsLeft;
  const totalStudentsAssignedLifetime = Math.max(
    storedLifetimeStudents,
    lifetimeStudentIds.size,
    currentActiveStudents + studentLeftLifetime
  );

  return {
    ...teacher,
    totalStudentsAssignedLifetime,
    totalStudentsAssigned: totalStudentsAssignedLifetime,
    lifetimeStudents: totalStudentsAssignedLifetime,
    currentActiveStudents,
    activeStudents: currentActiveStudents,
    studentLeftLifetime,
    studentsLeft: studentLeftLifetime,
    leaveRecords: teacher.studentLeftLogs
  };
};

const calculateTeachersStats = async (teachers: TeacherWithLeftLogs[]) =>
  Promise.all(teachers.map((teacher) => calculateTeacherStats(teacher)));

const compactStudentLeftLogs = (
  payload: CreateTeacherInput | UpdateTeacherInput
) => {
  const studentLeftLogs: StudentLeftLogInput[] = [];

  if (payload.leaveRecords) {
    studentLeftLogs.push(...payload.leaveRecords);
  }

  if (payload.studentLeftDetails) {
    studentLeftLogs.push(...payload.studentLeftDetails);
  }

  if (payload.studentLeftLogs) {
    studentLeftLogs.push(...payload.studentLeftLogs);
  }

  return studentLeftLogs.map((log) => ({
    studentName: log.studentName,
    leavingReason: log.leavingReason ?? log.reason
  }));
};

export const createTeacher = async (payload: CreateTeacherInput) => {
  const studentLeftLogs = compactStudentLeftLogs(payload);

  const teacher = await prisma.teacher.create({
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

  return calculateTeacherStats(teacher);
};

export const getTeachers = async (scope?: ActorScope) => {
  let where = scope ? teacherAccessWhere(scope) : undefined;
  if (scope?.studentId && !scope.isPrivileged && !scope.teacherId) {
    const student = await prisma.student.findUnique({
      where: { id: scope.studentId },
      select: { teacherId: true }
    });
    where = student?.teacherId ? { id: student.teacherId } : { id: "__no_access__" };
  }
  const teachers = await prisma.teacher.findMany({
    ...(where ? { where } : {}),
    include: teacherInclude,
    orderBy: {
      createdAt: "desc"
    }
  });

  return calculateTeachersStats(teachers);
};

export const getTeacherOptions = async (scope?: ActorScope) => {
  let where = scope ? teacherAccessWhere(scope) : undefined;
  if (scope?.studentId && !scope.isPrivileged && !scope.teacherId) {
    const student = await prisma.student.findUnique({
      where: { id: scope.studentId },
      select: { teacherId: true }
    });
    where = student?.teacherId ? { id: student.teacherId } : { id: "__no_access__" };
  }
  const teachers = await prisma.teacher.findMany({
    ...(where ? { where } : {}),
    select: {
      id: true,
      name: true
    },
    orderBy: {
      name: "asc"
    }
  });

  return [{ id: "", name: "Select option" }, ...teachers];
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
  const teacherWithStats = await calculateTeacherStats(teacher);

  return {
    ...teacherWithStats,
    classReportAverage
  };
};

export const assertTeacherVisible = (id: string, scope: ActorScope) =>
  assertTeacherAccess(scope, id);

export { getTeacherClassReportAverage };

export const getTeacherPayroll = async (id: string, month?: string) => {
  const teacher = await prisma.teacher.findUnique({
    where: { id },
    include: {
      payrollCategoryRates: {
        orderBy: { category: "asc" }
      }
    }
  });
  if (!teacher) {
    throw createHttpError(404, "Teacher not found");
  }

  const selectedMonth = parsePayrollMonth(month);
  const estimateMonth = parsePayrollMonth(nextMonthKey(selectedMonth.key));
  const hourlyRateBdt = decimalToNumber(
    (teacher as { hourlyPayrollRateBdt?: unknown }).hourlyPayrollRateBdt
  );
  const categoryRates = teacher.payrollCategoryRates.map((rate) => ({
    id: rate.id,
    category: rate.category,
    hourlyRateBdt: decimalToNumber(rate.hourlyRateBdt)
  }));
  const rateByCategory = new Map(
    categoryRates.map((rate) => [rate.category.trim().toLowerCase(), rate])
  );

  const [currentEvents, nextMonthEvents] = await Promise.all([
    listEvents({
      teacherId: id,
      status: "CONFIRMED",
      startDate: selectedMonth.startDate,
      endDate: selectedMonth.endDate
    }),
    listEvents({
      teacherId: id,
      status: "CONFIRMED",
      startDate: estimateMonth.startDate,
      endDate: estimateMonth.endDate
    })
  ]);

  const chronologicalRows = currentEvents
    .filter((event) => event.status === "confirmed")
    .sort((left, right) =>
      `${left.date}T${left.start}`.localeCompare(`${right.date}T${right.start}`)
    )
    .reduce<{
      balance: number;
      rows: {
        id: string;
        date: string;
        time: string;
        description: string;
        durationMinutes: number;
        incomeBdt: number;
        paymentBdt: number;
        balanceBdt: number;
        attachments: string;
        studentName: string;
        source: string;
        status: string;
      }[];
    }>(
      (state, event) => {
        const categoryRate = rateByCategory.get(event.category.trim().toLowerCase());
        const appliedHourlyRate = categoryRate?.hourlyRateBdt ?? hourlyRateBdt;
        const isPayable = isPayrollEligibleAttendance(event.attendanceStatus);
        const incomeBdt = Number(
          (isPayable ? (event.duration / 60) * appliedHourlyRate : 0).toFixed(2)
        );
        const balance = Number((state.balance + incomeBdt).toFixed(2));

        state.rows.push({
          id: event.id,
          date: event.date,
          time: event.start,
          description: event.category || "Class session",
          durationMinutes: event.duration,
          incomeBdt,
          paymentBdt: 0,
          balanceBdt: balance,
          attachments: "-",
          studentName: event.title,
          source: isPayable
            ? categoryRate
              ? `${categoryRate.category} payroll rate`
              : "Teacher default payroll rate"
            : "Attendance unrecorded",
          status: event.attendanceStatus
        });
        state.balance = balance;
        return state;
      },
      { balance: 0, rows: [] }
  );

  const nextMonthEstimateBdt = Number(
    nextMonthEvents
      .filter((event) => event.status === "confirmed")
      .reduce((total, event) => {
        const categoryRate = rateByCategory.get(event.category.trim().toLowerCase());
        return total + (event.duration / 60) * (categoryRate?.hourlyRateBdt ?? hourlyRateBdt);
      }, 0)
      .toFixed(2)
  );

  return {
    teacherId: id,
    month: selectedMonth.key,
    hourlyRateBdt,
    totalBdt: chronologicalRows.balance,
    classCount: chronologicalRows.rows.length,
    totalMinutes: chronologicalRows.rows.reduce(
      (total, row) => total + row.durationMinutes,
      0
    ),
    nextMonth: {
      month: estimateMonth.key,
      estimatedAmountBdt: nextMonthEstimateBdt
    },
    categoryRates,
    rows: chronologicalRows.rows.reverse()
  };
};

export const updateTeacherPayrollSettings = async (
  actorUserId: string,
  id: string,
  raw: unknown
) => {
  await assertSuperAdmin(actorUserId);
  await getTeacherById(id);

  const body =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};

  const teacher = await prisma.teacher.update({
    where: { id },
    data: {
      hourlyPayrollRateBdt: parsePayrollRate(body.hourlyRateBdt)
    }
  });

  return {
    teacherId: teacher.id,
    hourlyRateBdt: decimalToNumber(teacher.hourlyPayrollRateBdt)
  };
};

export const upsertTeacherPayrollCategoryRate = async (
  actorUserId: string,
  teacherId: string,
  raw: unknown
) => {
  await assertSuperAdmin(actorUserId);
  await getTeacherById(teacherId);

  const body =
    typeof raw === "object" && raw !== null
      ? (raw as Record<string, unknown>)
      : {};
  const category =
    typeof body.category === "string" ? body.category.trim() : "";

  if (!category) {
    throw createHttpError(400, "category is required");
  }

  const rate = await prisma.teacherPayrollCategoryRate.upsert({
    where: { teacherId_category: { teacherId, category } },
    create: {
      teacherId,
      category,
      hourlyRateBdt: parsePayrollRate(body.hourlyRateBdt)
    },
    update: {
      hourlyRateBdt: parsePayrollRate(body.hourlyRateBdt)
    }
  });

  return {
    id: rate.id,
    category: rate.category,
    hourlyRateBdt: decimalToNumber(rate.hourlyRateBdt)
  };
};

export const deleteTeacherPayrollCategoryRate = async (
  actorUserId: string,
  teacherId: string,
  rateId: string
) => {
  await assertSuperAdmin(actorUserId);
  await getTeacherById(teacherId);

  await prisma.teacherPayrollCategoryRate.deleteMany({
    where: { id: rateId, teacherId }
  });
};

export const updateTeacher = async (
  id: string,
  payload: UpdateTeacherInput
) => {
  await getTeacherById(id);

  const studentLeftLogs = compactStudentLeftLogs(payload);

  const teacher = await prisma.teacher.update({
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

  return calculateTeacherStats(teacher);
};

export const deleteTeacher = async (id: string) => {
  await getTeacherById(id);

  await prisma.teacher.delete({
    where: { id }
  });
};
