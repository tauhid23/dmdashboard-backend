import { prisma } from "../config/prisma.js";
import { settleMakeupCredits } from "../services/makeupCredit.service.js";
import { isEmailDeliveryEnabled } from "../services/email.service.js";
import { createInvoice, listFamilies, sendInvoice } from "./billing.service.js";

const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const monthKey = (year: number, monthIndex: number) => `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

export const billingWindow = (now: Date) => {
  const local = new Date(now.getTime() + DHAKA_OFFSET_MS);
  const year = local.getUTCFullYear();
  const monthIndex = local.getUTCMonth();
  const day = local.getUTCDate();
  return {
    day,
    key: monthKey(year, monthIndex),
    invoiceDate: new Date(Date.UTC(year, monthIndex, 2)),
    rangeStart: new Date(Date.UTC(year, monthIndex, 1)),
    monthlyEnd: new Date(Date.UTC(year, monthIndex + 1, 0)),
    quarterlyEnd: new Date(Date.UTC(year, monthIndex + 3, 0)),
    autoSendAt: new Date(Date.UTC(year, monthIndex, 2, 18)),
  };
};

export const generateScheduledInvoices = async (now = new Date()) => {
  const window = billingWindow(now);
  if (window.day !== 2 && window.day !== 3) return 0;
  const families = await listFamilies(window.invoiceDate.toISOString().slice(0, 10));
  let generated = 0;
  for (const family of families) {
    if (!family.autoInvoice) continue;
    const studentIds = family.students.map((student) => student.id);
    const dueCharge = await prisma.studentBillingTransaction.count({
      where: { studentId: { in: studentIds }, type: "PACKAGE", date: { gte: window.rangeStart, lte: window.monthlyEnd } },
    });
    if (!dueCharge) continue;
    const existing = await prisma.studentInvoice.count({
      where: {
        studentId: { in: studentIds },
        status: { not: "VOID" },
        rangeStart: { lte: window.rangeStart },
        rangeEnd: { gte: window.monthlyEnd },
      },
    });
    if (existing) continue;
    const quarterly = family.students.filter((student) => student.scheduleConfirmed).every((student) => student.billingCycle === "QUARTERLY");
    try {
      await createInvoice(family.id, {
        invoiceDate: window.invoiceDate,
        rangeStart: window.rangeStart,
        rangeEnd: quarterly ? window.quarterlyEnd : window.monthlyEnd,
        dueDate: new Date(window.invoiceDate.getTime() + (quarterly ? 14 : 7) * 24 * 60 * 60_000),
        includeBalanceForward: true,
      }, {
        automationKey: `scheduled:${window.key}:${family.id}`,
        autoSendAt: window.autoSendAt,
        allowMissingRecipient: true,
      });
      generated += 1;
    } catch (cause) {
      if (typeof cause === "object" && cause !== null && "code" in cause && cause.code === "P2002") continue;
      if (cause instanceof Error && cause.message.includes("no positive amount due")) continue;
      console.error(`Could not generate scheduled invoice for family ${family.id}`, cause);
    }
  }
  return generated;
};

export const sendScheduledInvoices = async (now = new Date()) => {
  if (!isEmailDeliveryEnabled()) return 0;
  let sent = 0;
  for (let batch = 0; batch < 4; batch += 1) {
    const drafts = await prisma.studentInvoice.findMany({
      where: {
        emailedAt: null,
        autoSendAt: { lte: now },
        OR: [{ autoRetryAt: null }, { autoRetryAt: { lte: now } }],
        sentTo: { not: "" },
        status: { not: "VOID" },
      },
      orderBy: { autoSendAt: "asc" },
      take: 25,
    });
    if (!drafts.length) break;
    for (const draft of drafts) {
      try {
        await sendInvoice(draft.studentId, draft.id);
        sent += 1;
      } catch (cause) {
        await prisma.studentInvoice.update({
          where: { id: draft.id },
          data: { autoRetryAt: new Date(Date.now() + 30 * 60_000) },
        });
        console.error(`Scheduled invoice ${draft.invoiceNumber} email failed`, cause);
      }
    }
    if (drafts.length < 25) break;
  }
  return sent;
};

let running = false;

export const runInvoiceSchedule = async (now = new Date()) => {
  if (running) return;
  running = true;
  try {
    try {
      await settleMakeupCredits(now);
      await generateScheduledInvoices(now);
    } catch (cause) {
      console.error("Scheduled invoice generation failed", cause);
    }
    await sendScheduledInvoices(now);
  } finally {
    running = false;
  }
};

export const startInvoiceSchedule = () => {
  const run = () => void runInvoiceSchedule().catch((cause: unknown) => console.error("Invoice schedule check failed", cause));
  run();
  const timer = setInterval(run, 30 * 60_000);
  timer.unref();
  return () => clearInterval(timer);
};
