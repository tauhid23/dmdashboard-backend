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

    if (month === 9) {
      return [
        makeScheduleEvent({
          id: "october-estimate",
          scheduledDate: new Date("2026-10-10T00:00:00")
        })
      ];
    }

    return [];
  }) as unknown as typeof prisma.classScheduleEvent.findMany;

  context.after(() => {
    prisma.teacher.findUnique = originalTeacherFindUnique;
    prisma.classScheduleEvent.findMany = originalClassScheduleEventFindMany;
  });

  const payroll = await getTeacherPayroll(
    "teacher-1",
    "2026-08",
    undefined,
    undefined,
    new Date("2026-09-09T12:00:00")
  );

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

  const customEstimate = await getTeacherPayroll(
    "teacher-1",
    "2026-08",
    "2026-10",
    "2026-10-15",
    new Date("2026-09-09T12:00:00")
  );
  assert.deepEqual(customEstimate.estimate, {
    month: "2026-10",
    startDate: "2026-09-09",
    throughDate: "2026-10-15",
    estimatedAmountBdt: 300
  });
});

void test("getTeacherPayroll lists recorded payments only in their payroll month", async (context) => {
  const originalTeacherFindUnique = prisma.teacher.findUnique;
  const originalClassScheduleEventFindMany = prisma.classScheduleEvent.findMany;

  prisma.teacher.findUnique = (async () => ({
    id: "teacher-1",
    hourlyPayrollRateBdt: "300.00",
    payrollCategoryRates: [],
    payrollPayments: [
      {
        id: "august-payment",
        month: "2026-08",
        amountBdt: "300.00",
        paymentDate: new Date("2026-08-31T00:00:00"),
        method: "Cash",
        reference: "RCPT-8",
        note: "August salary"
      },
      {
        id: "september-payment",
        month: "2026-09",
        amountBdt: "400.00",
        paymentDate: new Date("2026-09-30T00:00:00"),
        method: "Bank transfer",
        reference: "RCPT-9",
        note: "September salary"
      }
    ]
  })) as unknown as typeof prisma.teacher.findUnique;

  prisma.classScheduleEvent.findMany = (async () => []) as unknown as typeof prisma.classScheduleEvent.findMany;

  context.after(() => {
    prisma.teacher.findUnique = originalTeacherFindUnique;
    prisma.classScheduleEvent.findMany = originalClassScheduleEventFindMany;
  });

  const payroll = await getTeacherPayroll(
    "teacher-1",
    "2026-08",
    undefined,
    undefined,
    new Date("2026-09-09T12:00:00")
  );

  assert.equal(payroll.paidBdt, 300);
  assert.deepEqual(payroll.payments.map((payment) => payment.month), ["2026-08"]);
  assert.deepEqual(
    payroll.rows.map((row) => row.id),
    ["payment-august-payment"]
  );
  assert.equal(payroll.rows[0].date, "2026-08-31");
  assert.equal(payroll.rows[0].entryType, "payment");
  assert.equal(payroll.rows[0].paymentBdt, 300);
  assert.equal(payroll.rows[0].attachments, "RCPT-8");
  assert.equal(payroll.rows[0].source, "August salary");
  assert.equal(payroll.lifetimeEarningsBdt, 700);
});

void test("getTeacherPayroll adds admin income to normal payroll and the ledger", async (context) => {
  const originalTeacherFindUnique = prisma.teacher.findUnique;
  const originalClassScheduleEventFindMany = prisma.classScheduleEvent.findMany;

  prisma.teacher.findUnique = (async () => ({
    id: "teacher-1",
    hourlyPayrollRateBdt: "300.00",
    payrollCategoryRates: [],
    payrollPayments: [
      {
        id: "august-income",
        month: "2026-08",
        amountBdt: "150.00",
        paymentDate: new Date("2026-08-15T00:00:00"),
        method: "Additional income",
        reference: null,
        note: "Admin bonus"
      },
      {
        id: "august-payment",
        month: "2026-08",
        amountBdt: "100.00",
        paymentDate: new Date("2026-08-31T00:00:00"),
        method: "Cash",
        reference: null,
        note: "Partial salary"
      }
    ]
  })) as unknown as typeof prisma.teacher.findUnique;

  prisma.classScheduleEvent.findMany = (async (args: unknown) => {
    const where = (args as { where?: Record<string, unknown> }).where ?? {};
    if (where.isRecurring) return [];

    const scheduledDate = where.scheduledDate as
      | { gte?: Date; lte?: Date }
      | undefined;
    const month = scheduledDate?.gte?.getMonth();

    if (month === 7) {
      return [makeScheduleEvent({ id: "paid-event" })];
    }

    return [];
  }) as unknown as typeof prisma.classScheduleEvent.findMany;

  context.after(() => {
    prisma.teacher.findUnique = originalTeacherFindUnique;
    prisma.classScheduleEvent.findMany = originalClassScheduleEventFindMany;
  });

  const payroll = await getTeacherPayroll(
    "teacher-1",
    "2026-08",
    undefined,
    undefined,
    new Date("2026-09-09T12:00:00")
  );

  assert.equal(payroll.basePayrollBdt, 300);
  assert.equal(payroll.additionalIncomeBdt, 150);
  assert.equal(payroll.totalBdt, 450);
  assert.equal(payroll.paidBdt, 100);
  assert.equal(payroll.balanceOwingBdt, 350);
  assert.deepEqual(
    payroll.rows.map((row) => [row.id, row.entryType, row.incomeBdt, row.paymentBdt]),
    [
      ["payment-august-payment", "payment", 0, 100],
      ["payment-august-income", "income", 150, 0],
      ["paid-event", "class", 300, 0]
    ]
  );
  assert.equal(payroll.rows[1].description, "Additional income");
  assert.equal(payroll.rows[1].status, "Income added");
  assert.equal(payroll.lifetimeEarningsBdt, 100);
});

void test("getTeacherPayroll carries an overpayment forward to future payroll", async (context) => {
  const originalTeacherFindUnique = prisma.teacher.findUnique;
  const originalClassScheduleEventFindMany = prisma.classScheduleEvent.findMany;

  prisma.teacher.findUnique = (async () => ({
    id: "teacher-1",
    hourlyPayrollRateBdt: "300.00",
    payrollCategoryRates: [],
    payrollPayments: [
      {
        id: "august-overpayment",
        month: "2026-08",
        amountBdt: "500.00",
        paymentDate: new Date("2026-08-31T00:00:00"),
        method: "Cash",
        reference: null,
        note: null
      }
    ]
  })) as unknown as typeof prisma.teacher.findUnique;

  prisma.classScheduleEvent.findMany = (async (args: unknown) => {
    const where = (args as {
      where?: { scheduledDate?: { gte?: Date; lt?: Date } };
    }).where;

    if (where?.scheduledDate?.lt?.getMonth() === 8) {
      return [makeScheduleEvent({ id: "august-class" })];
    }
    if (where?.scheduledDate?.gte?.getMonth() === 7) {
      return [makeScheduleEvent({ id: "august-class" })];
    }
    if (where?.scheduledDate?.gte?.getMonth() === 8) {
      return [
        makeScheduleEvent({
          id: "september-class",
          scheduledDate: new Date("2026-09-05T00:00:00")
        })
      ];
    }
    return [];
  }) as unknown as typeof prisma.classScheduleEvent.findMany;

  context.after(() => {
    prisma.teacher.findUnique = originalTeacherFindUnique;
    prisma.classScheduleEvent.findMany = originalClassScheduleEventFindMany;
  });

  const augustPayroll = await getTeacherPayroll(
    "teacher-1",
    "2026-08",
    undefined,
    undefined,
    new Date("2026-09-09T12:00:00")
  );
  assert.equal(augustPayroll.balanceOwingBdt, 0);
  assert.equal(augustPayroll.creditBalanceBdt, 200);
  assert.equal(augustPayroll.netBalanceBdt, -200);

  const septemberPayroll = await getTeacherPayroll(
    "teacher-1",
    "2026-09",
    undefined,
    undefined,
    new Date("2026-09-09T12:00:00")
  );
  assert.equal(septemberPayroll.openingBalanceBdt, -200);
  assert.equal(septemberPayroll.totalBdt, 300);
  assert.equal(septemberPayroll.balanceOwingBdt, 100);
  assert.equal(septemberPayroll.creditBalanceBdt, 0);
  assert.equal(septemberPayroll.rows.at(-1)?.balanceBdt, 100);
});
