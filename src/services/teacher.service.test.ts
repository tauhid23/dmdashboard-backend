import assert from "node:assert/strict";
import test from "node:test";

import { prisma } from "../config/prisma.js";
import { getTeacherPayroll } from "./teacher.service.js";

const makeScheduleEvent = (overrides: Record<string, unknown>) => ({
  id: "event",
  studentId: "student-1",
  teacherId: "teacher-1",
  category: "Nazirah",
  scheduledDate: new Date("2026-08-05T00:00:00"),
  startTime: "10:00",
  endTime: "11:00",
  durationMinutes: 60,
  status: "CONFIRMED",
  attendanceStatus: "PRESENT",
  makeupCredit: false,
  note: null,
  recurrenceGroupId: null,
  recurrenceSourceId: null,
  isRecurring: false,
  repeatDays: [],
  repeatIndefinitely: false,
  recurrenceEndDate: null,
  createdAt: new Date("2026-08-01T00:00:00"),
  updatedAt: new Date("2026-08-01T00:00:00"),
  student: { id: "student-1", name: "Student One" },
  teacher: { id: "teacher-1", name: "Teacher One" },
  ...overrides
});

void test("getTeacherPayroll shows unrecorded attendance without counting it as pay", async (context) => {
  const originalTeacherFindUnique = prisma.teacher.findUnique;
  const originalClassScheduleEventFindMany = prisma.classScheduleEvent.findMany;

  prisma.teacher.findUnique = (async () => ({
    id: "teacher-1",
    hourlyPayrollRateBdt: "300.00",
    payrollCategoryRates: []
  })) as unknown as typeof prisma.teacher.findUnique;

  prisma.classScheduleEvent.findMany = (async (args: unknown) => {
    const where = (args as { where?: Record<string, unknown> }).where ?? {};
    if (where.isRecurring) return [];

    const scheduledDate = where.scheduledDate as
      | { gte?: Date; lte?: Date }
      | undefined;
    const month = scheduledDate?.gte?.getMonth();

    if (month === 7) {
      return [
        makeScheduleEvent({ id: "paid-event", attendanceStatus: "PRESENT" }),
        makeScheduleEvent({
          id: "unrecorded-event",
          attendanceStatus: "UNRECORDED",
          scheduledDate: new Date("2026-08-06T00:00:00")
        })
      ];
    }

    if (month === 8) {
      return [
        makeScheduleEvent({
          id: "next-month-unrecorded",
          attendanceStatus: "UNRECORDED",
          scheduledDate: new Date("2026-09-01T00:00:00")
        })
      ];
    }

    return [];
  }) as unknown as typeof prisma.classScheduleEvent.findMany;

  context.after(() => {
    prisma.teacher.findUnique = originalTeacherFindUnique;
    prisma.classScheduleEvent.findMany = originalClassScheduleEventFindMany;
  });

  const payroll = await getTeacherPayroll("teacher-1", "2026-08");

  assert.equal(payroll.totalBdt, 300);
  assert.equal(payroll.classCount, 2);
  assert.equal(payroll.totalMinutes, 120);
  assert.equal(payroll.nextMonth.estimatedAmountBdt, 300);
  assert.deepEqual(
    payroll.rows.map((row) => row.id),
    ["unrecorded-event", "paid-event"]
  );
  assert.equal(payroll.rows[0].incomeBdt, 0);
  assert.equal(payroll.rows[0].source, "Attendance unrecorded");
  assert.equal(payroll.rows[1].incomeBdt, 300);
});
