import { randomUUID } from "node:crypto";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import type { ActorScope } from "../auth/accessScope.js";
import { forbidden, scheduleAccessWhere } from "../auth/accessScope.js";
import type {
  ClassAttendanceStatus,
  ClassScheduleFilters,
  ClassScheduleStatus,
  CreateClassScheduleEventInput,
  UpdateClassScheduleEventInput
} from "../types/classSchedule.types.js";

const include = {
  student: { select: { id: true, name: true } },
  teacher: { select: { id: true, name: true } }
} satisfies Prisma.ClassScheduleEventInclude;

type EventWithDetails = Prisma.ClassScheduleEventGetPayload<{
  include: typeof include;
}>;

const scheduleStatuses = ["CONFIRMED", "CANCELLED"] as const;
const attendanceStatuses = [
  "UNRECORDED",
  "PRESENT",
  "ABSENT_NO_MAKEUP_CREDIT",
  "ABSENT_ISSUE_MAKEUP_CREDIT",
  "ABSENT_NOTICE_GIVEN",
  "TUTOR_CANCELLED_ISSUE_MAKEUP_CREDIT"
] as const;

const httpError = (
  statusCode: number,
  message: string,
  extras: Record<string, unknown> = {}
) => Object.assign(new Error(message), { statusCode, ...extras });

const pad = (value: number) => String(value).padStart(2, "0");

const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const normalizeStatus = (status: string) =>
  status
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const displayStatus = (status: string) =>
  status === "CANCELLED" ? "cancelled" : "confirmed";

const displayAttendanceStatus = (status: string) =>
  status.toLowerCase().replace(/_/g, "-");

const publicEvent = (event: EventWithDetails) => ({
  id: event.id,
  studentId: event.studentId,
  teacherId: event.teacherId,
  title: event.student.name ?? "Unnamed student",
  teacher: event.teacher.name ?? "Unassigned tutor",
  category: event.category,
  date: toDateKey(event.scheduledDate),
  start: event.startTime,
  end: event.endTime,
  duration: event.durationMinutes,
  status: displayStatus(event.status),
  attendanceStatus: displayAttendanceStatus(event.attendanceStatus),
  makeupCredit: event.makeupCredit,
  note: event.note,
  recurrenceGroupId: event.recurrenceGroupId,
  recurrenceSourceId: event.recurrenceSourceId,
  isRecurring: event.isRecurring,
  repeatDays: event.repeatDays,
  repeatIndefinitely: event.repeatIndefinitely,
  recurrenceEndDate: event.recurrenceEndDate,
  createdAt: event.createdAt,
  updatedAt: event.updatedAt
});

const assertEventAccess = (
  event: { teacherId: string; studentId: string },
  scope?: ActorScope
) => {
  if (!scope || scope.isPrivileged) return;
  if (scope.teacherId && event.teacherId === scope.teacherId) return;
  if (scope.studentId && event.studentId === scope.studentId) return;

  throw forbidden("You can only access schedules assigned to your account");
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requiredString = (
  body: Record<string, unknown>,
  key: string,
  label = key
) => {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw httpError(400, `${label} is required`);
  }
  return value.trim();
};

const optionalString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const parseBoolean = (value: unknown, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
};

const parseInteger = (value: unknown, label: string) => {
  const numberValue = typeof value === "string" ? Number(value) : value;
  if (!Number.isInteger(numberValue)) {
    throw httpError(400, `${label} must be an integer`);
  }
  return numberValue as number;
};

const parseTimeToMinutes = (value: string, label: string) => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) throw httpError(400, `${label} must use HH:mm format`);

  return Number(match[1]) * 60 + Number(match[2]);
};

const parseDateOnly = (value: string, label: string) => {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw httpError(400, `${label} must be a valid date`);
  }
  return date;
};

const addMinutes = (time: string, minutes: number) => {
  const totalMinutes = parseTimeToMinutes(time, "start") + minutes;
  return `${pad(Math.floor(totalMinutes / 60) % 24)}:${pad(totalMinutes % 60)}`;
};

const parseRepeatDays = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((day) => parseInteger(day, "repeatDays"));
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parseRepeatDays(parsed);
    } catch {
      throw httpError(400, "repeatDays must be an array");
    }
  }

  return [];
};

const parseFilterString = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" && item.trim());
    return typeof first === "string" ? first.trim() : "";
  }
  return "";
};

const parseStudentFilterIds = (filters: ClassScheduleFilters) => {
  const rawValues = [
    ...(Array.isArray(filters.studentIds) ? filters.studentIds : [filters.studentIds]),
    filters.studentId
  ];

  return Array.from(
    new Set(
      rawValues
        .flatMap((value) => parseFilterString(value).split(","))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
};

const validateCreatePayload = (raw: unknown) => {
  if (!isRecord(raw)) throw httpError(400, "Request body must be an object");

  const body = raw as CreateClassScheduleEventInput & Record<string, unknown>;
  const teacherId = requiredString(body, "teacherId", "Tutor");
  const category = requiredString(body, "category", "Category");
  const date = requiredString(body, "date", "Date");
  const start = requiredString(body, "start", "Start time");
  const duration = parseInteger(body.duration, "Duration");
  const attendeeIds = Array.isArray(body.attendeeIds)
    ? body.attendeeIds
    : body.studentId
      ? [body.studentId]
      : [];

  if (attendeeIds.length === 0) {
    throw httpError(400, "At least one attendee is required");
  }
  if (duration < 5 || duration > 480) {
    throw httpError(400, "Duration must be between 5 and 480 minutes");
  }

  parseTimeToMinutes(start, "Start time");

  return {
    teacherId,
    attendeeIds: attendeeIds.map((id) => String(id)),
    category,
    startDate: parseDateOnly(date, "Date"),
    start,
    duration,
    makeupCredit: parseBoolean(body.makeupCredit),
    recurring: parseBoolean(body.recurring),
    repeatDays: parseRepeatDays(body.repeatDays),
    repeatIndefinitely: parseBoolean(body.repeatIndefinitely, true),
    endDate: optionalString(body.endDate),
    note: optionalString(body.note),
    ignoreConflicts: parseBoolean(body.ignoreConflicts)
  };
};

const buildRecurringDates = (
  startDate: Date,
  repeatDays: number[],
  limit: Date,
  includeStartDate = true
) => {
  const dates = includeStartDate ? [startDate] : [];
  const startKey = toDateKey(startDate);
  const cursor = new Date(startDate);

  while (cursor <= limit) {
    const mondayDay = (cursor.getDay() + 6) % 7;
    if (
      repeatDays.includes(mondayDay) &&
      (includeStartDate || toDateKey(cursor) !== startKey)
    ) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates.slice(0, 400);
};

const validateRecurringInput = (input: ReturnType<typeof validateCreatePayload>) => {
  if (!input.recurring) return null;

  if (input.repeatDays.length === 0) {
    throw httpError(400, "Choose at least one repeat day");
  }

  const recurrenceEndDate =
    input.repeatIndefinitely
      ? null
      : input.endDate
        ? parseDateOnly(input.endDate, "Repeat end date")
        : null;

  if (!input.repeatIndefinitely && !recurrenceEndDate) {
    throw httpError(400, "Repeat end date is required");
  }

  if (recurrenceEndDate && recurrenceEndDate < input.startDate) {
    throw httpError(400, "Repeat end date cannot be before the start date");
  }

  return recurrenceEndDate;
};

const assertTeacherAndStudents = async (teacherId: string, studentIds: string[]) => {
  const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
  if (!teacher) throw httpError(404, "Tutor not found");

  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, teacherId: true }
  });
  if (students.length !== new Set(studentIds).size) {
    throw httpError(404, "One or more attendees could not be found");
  }

  const unassigned = students.find((student) => student.teacherId !== teacherId);
  if (unassigned) {
    throw httpError(403, "One or more attendees are not assigned to this tutor");
  }
};

const maxDate = (dates: Date[]) =>
  dates.reduce((latest, date) => (date > latest ? date : latest), dates[0]);

const getCreateScheduleDates = (
  input: ReturnType<typeof validateCreatePayload>,
  recurrenceEndDate: Date | null
) => {
  if (!input.recurring) return [input.startDate];

  const limit = recurrenceEndDate ?? new Date(input.startDate);
  if (!recurrenceEndDate) {
    limit.setDate(limit.getDate() + 399);
  }

  return buildRecurringDates(input.startDate, input.repeatDays, limit, true);
};

const findTeacherScheduleConflicts = async (
  input: ReturnType<typeof validateCreatePayload>,
  recurrenceEndDate: Date | null,
  endTime: string
) => {
  const dates = getCreateScheduleDates(input, recurrenceEndDate);
  if (dates.length === 0) return [];

  const rangeEnd = maxDate(dates);

  await materializeRecurringEvents(
    { teacherId: input.teacherId, status: "CONFIRMED" },
    input.startDate,
    rangeEnd
  );

  const requestStartMinutes = parseTimeToMinutes(input.start, "Start time");
  const requestEndMinutes = parseTimeToMinutes(endTime, "End time");

  const possibleConflicts = await prisma.classScheduleEvent.findMany({
    where: {
      teacherId: input.teacherId,
      status: "CONFIRMED",
      scheduledDate: { in: dates }
    },
    include,
    orderBy: [{ scheduledDate: "asc" }, { startTime: "asc" }]
  });

  return possibleConflicts
    .filter((event) => {
      const existingStartMinutes = parseTimeToMinutes(
        event.startTime,
        "Existing start time"
      );
      const existingEndMinutes = parseTimeToMinutes(
        event.endTime,
        "Existing end time"
      );

      return (
        requestStartMinutes < existingEndMinutes &&
        requestEndMinutes > existingStartMinutes
      );
    })
    .map(publicEvent);
};

export const createEvents = async (raw: unknown, scope?: ActorScope) => {
  const input = validateCreatePayload(raw);
  if (scope && !scope.isPrivileged) {
    if (!scope.teacherId || input.teacherId !== scope.teacherId) {
      throw forbidden("You can only create schedules for your own tutor account");
    }
  }
  await assertTeacherAndStudents(input.teacherId, input.attendeeIds);

  const recurrenceEndDate = validateRecurringInput(input);
  const endTime = addMinutes(input.start, input.duration);
  if (!input.ignoreConflicts) {
    const conflicts = await findTeacherScheduleConflicts(
      input,
      recurrenceEndDate,
      endTime
    );

    if (conflicts.length > 0) {
      throw httpError(
        409,
        "Tutor already has events during this schedule time.",
        {
          code: "SCHEDULE_CONFLICT",
          errors: conflicts
        }
      );
    }
  }

  const recurrenceGroupId =
    input.recurring || input.attendeeIds.length > 1
      ? randomUUID()
      : null;

  const events = await prisma.$transaction(
    input.attendeeIds.map((studentId) =>
      prisma.classScheduleEvent.create({
        data: {
          studentId,
          teacherId: input.teacherId,
          category: input.category,
          scheduledDate: input.startDate,
          startTime: input.start,
          endTime,
          durationMinutes: input.duration,
          attendanceStatus: "UNRECORDED",
          makeupCredit: input.makeupCredit,
          note: input.note,
          recurrenceGroupId,
          isRecurring: input.recurring,
          repeatDays: input.recurring ? input.repeatDays : [],
          repeatIndefinitely: input.recurring ? input.repeatIndefinitely : false,
          recurrenceEndDate
        },
        include
      })
    )
  );

  return events.map(publicEvent);
};

const materializeRecurringEvents = async (
  filters: ClassScheduleFilters,
  rangeStart: Date,
  rangeEnd: Date
) => {
  const teacherId = parseFilterString(filters.teacherId);
  const studentIds = parseStudentFilterIds(filters);
  const status = parseFilterString(filters.status);

  const seeds = await prisma.classScheduleEvent.findMany({
    where: {
      isRecurring: true,
      recurrenceSourceId: null,
      scheduledDate: { lte: rangeEnd },
      OR: [
        { repeatIndefinitely: true },
        { recurrenceEndDate: null },
        { recurrenceEndDate: { gte: rangeStart } }
      ],
      ...(teacherId ? { teacherId } : {}),
      ...(studentIds.length > 0 ? { studentId: { in: studentIds } } : {}),
      ...(status ? { status: normalizeStatus(status) } : {})
    }
  });

  const creates = [];

  for (const seed of seeds) {
    const limit =
      seed.recurrenceEndDate && seed.recurrenceEndDate < rangeEnd
        ? seed.recurrenceEndDate
        : rangeEnd;
    const dates = buildRecurringDates(seed.scheduledDate, seed.repeatDays, limit, false)
      .filter((date) => date >= rangeStart);
    if (dates.length === 0) continue;

    const existingDates = await prisma.classScheduleEvent.findMany({
      where: {
        recurrenceSourceId: seed.id,
        scheduledDate: { in: dates }
      },
      select: { scheduledDate: true }
    });
    const existingKeys = new Set(
      existingDates.map((event) => toDateKey(event.scheduledDate))
    );

    for (const scheduledDate of dates) {
      if (existingKeys.has(toDateKey(scheduledDate))) continue;

      creates.push(
        prisma.classScheduleEvent.create({
          data: {
            studentId: seed.studentId,
            teacherId: seed.teacherId,
            category: seed.category,
            scheduledDate,
            startTime: seed.startTime,
            endTime: seed.endTime,
            durationMinutes: seed.durationMinutes,
            status: seed.status,
            attendanceStatus: "UNRECORDED",
            makeupCredit: seed.makeupCredit,
            note: seed.note,
            recurrenceGroupId: seed.recurrenceGroupId,
            recurrenceSourceId: seed.id
          }
        })
      );
    }
  }

  if (creates.length > 0) {
    await prisma.$transaction(creates);
  }
};

export const listEvents = async (
  filters: ClassScheduleFilters,
  scope?: ActorScope
) => {
  const where: Prisma.ClassScheduleEventWhereInput = {};
  const teacherId = parseFilterString(filters.teacherId);
  const studentIds = parseStudentFilterIds(filters);
  const status = parseFilterString(filters.status);
  const startDate = parseFilterString(filters.startDate);
  const endDate = parseFilterString(filters.endDate);

  if (teacherId) where.teacherId = teacherId;
  if (studentIds.length > 0) where.studentId = { in: studentIds };
  if (status) where.status = normalizeStatus(status);
  if (startDate || endDate) {
    const rangeStart = startDate
      ? parseDateOnly(startDate, "startDate")
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const rangeEnd = endDate
      ? parseDateOnly(endDate, "endDate")
      : new Date(rangeStart.getFullYear(), rangeStart.getMonth() + 1, 0);

    await materializeRecurringEvents(filters, rangeStart, rangeEnd);

    where.scheduledDate = {
      gte: rangeStart,
      lte: rangeEnd
    };
  }
  const scopeWhere = scope ? scheduleAccessWhere(scope) : undefined;
  const finalWhere = scopeWhere
    ? ({ AND: [where, scopeWhere] } as Prisma.ClassScheduleEventWhereInput)
    : where;

  const events = await prisma.classScheduleEvent.findMany({
    where: finalWhere,
    include,
    orderBy: [{ scheduledDate: "asc" }, { startTime: "asc" }]
  });

  return events.map(publicEvent);
};

export const updateEvent = async (
  id: string,
  raw: unknown,
  scope?: ActorScope
) => {
  if (!isRecord(raw)) throw httpError(400, "Request body must be an object");
  const body = raw as UpdateClassScheduleEventInput & Record<string, unknown>;
  const existing = await prisma.classScheduleEvent.findUnique({ where: { id } });
  if (!existing) throw httpError(404, "Class schedule event not found");
  assertEventAccess(existing, scope);

  const teacherId = optionalString(body.teacherId) ?? existing.teacherId;
  const studentId = optionalString(body.studentId) ?? existing.studentId;

  if (teacherId !== existing.teacherId || studentId !== existing.studentId) {
    await assertTeacherAndStudents(teacherId, [studentId]);
  }

  const start = optionalString(body.start) ?? existing.startTime;
  parseTimeToMinutes(start, "Start time");
  const duration =
    body.duration === undefined || body.duration === null
      ? existing.durationMinutes
      : parseInteger(body.duration, "Duration");

  if (duration < 5 || duration > 480) {
    throw httpError(400, "Duration must be between 5 and 480 minutes");
  }

  const status = optionalString(body.status);
  const normalizedStatus = status ? normalizeStatus(status) : existing.status;
  if (!scheduleStatuses.includes(normalizedStatus as ClassScheduleStatus)) {
    throw httpError(400, "status must be CONFIRMED or CANCELLED");
  }

  const attendanceStatus = optionalString(body.attendanceStatus);
  const normalizedAttendanceStatus = attendanceStatus
    ? normalizeStatus(attendanceStatus)
    : existing.attendanceStatus;
  if (
    !attendanceStatuses.includes(
      normalizedAttendanceStatus as ClassAttendanceStatus
    )
  ) {
    throw httpError(400, "attendanceStatus is invalid");
  }

  const event = await prisma.classScheduleEvent.update({
    where: { id },
    data: {
      teacherId,
      studentId,
      ...(body.category !== undefined
        ? { category: optionalString(body.category) ?? existing.category }
        : {}),
      ...(body.date !== undefined
        ? { scheduledDate: parseDateOnly(requiredString(body, "date"), "Date") }
        : {}),
      startTime: start,
      endTime: addMinutes(start, duration),
      durationMinutes: duration,
      status: normalizedStatus,
      attendanceStatus: normalizedAttendanceStatus,
      ...(body.makeupCredit !== undefined
        ? { makeupCredit: parseBoolean(body.makeupCredit) }
        : {}),
      ...(body.note !== undefined ? { note: optionalString(body.note) } : {})
    },
    include
  });
  assertEventAccess(event, scope);

  return publicEvent(event);
};

const previousDay = (date: Date) => {
  const value = new Date(date);
  value.setDate(value.getDate() - 1);
  return value;
};

const moveRecurringSourceForward = async (event: EventWithDetails) => {
  if (!event.isRecurring || event.recurrenceSourceId) return;

  const nextEvent = await prisma.classScheduleEvent.findFirst({
    where: {
      recurrenceSourceId: event.id,
      scheduledDate: { gt: event.scheduledDate }
    },
    orderBy: [{ scheduledDate: "asc" }, { startTime: "asc" }]
  });

  if (!nextEvent) return;

  await prisma.$transaction([
    prisma.classScheduleEvent.update({
      where: { id: nextEvent.id },
      data: {
        recurrenceSourceId: null,
        isRecurring: true,
        repeatDays: event.repeatDays,
        repeatIndefinitely: event.repeatIndefinitely,
        recurrenceEndDate: event.recurrenceEndDate
      }
    }),
    prisma.classScheduleEvent.updateMany({
      where: { recurrenceSourceId: event.id, id: { not: nextEvent.id } },
      data: { recurrenceSourceId: nextEvent.id }
    })
  ]);
};

export const deleteEvent = async (
  id: string,
  scope = "single",
  actorScope?: ActorScope
) => {
  const event = await prisma.classScheduleEvent.findUnique({
    where: { id },
    include
  });
  if (!event) throw httpError(404, "Class schedule event not found");
  assertEventAccess(event, actorScope);

  if (scope !== "future") {
    await moveRecurringSourceForward(event);
    await prisma.classScheduleEvent.delete({ where: { id } });
    return;
  }

  const sourceId = event.recurrenceSourceId ?? (event.isRecurring ? event.id : null);
  const cutoffEndDate = previousDay(event.scheduledDate);

  if (event.recurrenceGroupId) {
    const groupSources = await prisma.classScheduleEvent.findMany({
      where: {
        recurrenceGroupId: event.recurrenceGroupId,
        isRecurring: true,
        recurrenceSourceId: null
      },
      select: { id: true, scheduledDate: true }
    });
    const sourceIds = groupSources.map((source) => source.id);

    await prisma.$transaction([
      prisma.classScheduleEvent.updateMany({
        where: { id: { in: sourceIds }, scheduledDate: { lt: event.scheduledDate } },
        data: {
          repeatIndefinitely: false,
          recurrenceEndDate: cutoffEndDate
        }
      }),
      prisma.classScheduleEvent.deleteMany({
        where: {
          recurrenceGroupId: event.recurrenceGroupId,
          scheduledDate: { gte: event.scheduledDate }
        }
      })
    ]);
    return;
  }

  if (sourceId) {
    await prisma.$transaction([
      prisma.classScheduleEvent.updateMany({
        where: { id: sourceId, scheduledDate: { lt: event.scheduledDate } },
        data: {
          repeatIndefinitely: false,
          recurrenceEndDate: cutoffEndDate
        }
      }),
      prisma.classScheduleEvent.deleteMany({
        where: {
          OR: [{ id: sourceId }, { recurrenceSourceId: sourceId }],
          scheduledDate: { gte: event.scheduledDate }
        }
      })
    ]);
    return;
  }

  await prisma.classScheduleEvent.delete({ where: { id } });
};
