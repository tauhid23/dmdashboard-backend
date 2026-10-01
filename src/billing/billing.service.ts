import { prisma } from "../config/prisma.js";
import { settleStudentMakeupCredits } from "../services/makeupCredit.service.js";
import { Prisma } from "../generated/prisma/client.js";
import { isEmailDeliveryEnabled, sendEmail } from "../services/email.service.js";
import { getSettings } from "../services/settings.service.js";
import { buildInvoicePdf, type InvoicePdfLineItem, type InvoicePdfSnapshot } from "./invoicePdf.js";
import { materializeBillingThrough } from "./billingAutomation.service.js";

type StudentRow = Awaited<ReturnType<typeof prisma.student.findMany>>[number];
type LedgerTransaction = Awaited<ReturnType<typeof prisma.studentBillingTransaction.findMany>>[number] & {
  student?: { name: string | null };
};

const number = (value: unknown) => Number(value ?? 0);
const roundMoney = (value: number) => Math.round(value * 100) / 100;
const dateOnly = (value: unknown, name: string) => {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw Object.assign(new Error(`${name} must be a valid date`), { statusCode: 400 });
  return date;
};
const endOfDay = (date: Date) => {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
};
const requiredAmount = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error("Amount must be greater than zero"), { statusCode: 400 });
  return amount;
};
const optionalText = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const familyKey = (student: StudentRow) => student.parentEmail?.trim().toLowerCase() || student.parentPhone?.replace(/\s+/g, "") || `student:${student.id}`;
const transactionEffect = (type: string, amount: number) => ["PAYMENT", "DISCOUNT"].includes(type) ? -amount : amount;
const transactionDescription = (item: LedgerTransaction) => item.description?.trim() || item.category?.trim() || (item.type === "PACKAGE" ? "Tuition package" : item.type);
const toDateKey = (date: Date) => date.toISOString().slice(0, 10);
const formatDate = (date?: Date | null) => date ? date.toLocaleDateString("en-GB") : "No due date";
const money = (value: number) => `${new Intl.NumberFormat("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} BDT`;

const allStudents = () => prisma.student.findMany({ orderBy: [{ parentName: "asc" }, { name: "asc" }] });
const getFamilyStudents = async (familyId: string) => {
  const students = await allStudents();
  const anchor = students.find((student) => student.id === familyId);
  if (!anchor) throw Object.assign(new Error("Family account not found"), { statusCode: 404 });
  const key = familyKey(anchor);
  return students.filter((student) => familyKey(student) === key);
};

const endOfDate = (value?: string) => {
  if (!value) return undefined;
  return endOfDay(dateOnly(value, "As-of date"));
};

const familyBalance = async (students: StudentRow[], asOf?: Date) => {
  const ids = students.map((student) => student.id);
  const transactions = await prisma.studentBillingTransaction.findMany({ where: { studentId: { in: ids }, ...(asOf ? { date: { lte: asOf } } : {}) } });
  return transactions.reduce((sum, item) => sum + transactionEffect(item.type, number(item.amountBdt)), 0);
};

const publicFamily = async (students: StudentRow[], asOf?: Date) => {
  const latestTransaction = await prisma.studentBillingTransaction.findFirst({
    where: { studentId: { in: students.map((student) => student.id) }, ...(asOf ? { date: { lte: asOf } } : {}) },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { date: true }
  });
  const lastActivityDate = latestTransaction?.date ?? null;
  return {
    id: students[0].id,
    family: students[0].parentName?.trim() || students[0].name?.trim() || "Family Account",
    students: students.map((student) => ({ id: student.id, name: student.name || "Student", packageCode: student.packageCode, weeklyHours: number(student.weeklyHours), billingCycle: student.billingCycle, billingAmountBdt: number(student.billingAmountBdt), scheduleConfirmed: student.scheduleConfirmed })),
    contacts: [...new Set(students.map((student) => student.parentEmail).filter(Boolean))].map((value) => ({ type: "email", value })).concat([...new Set(students.map((student) => student.parentPhone).filter(Boolean))].map((value) => ({ type: "phone", value }))),
    balance: await familyBalance(students, asOf),
    lastActivityDate,
    autoInvoice: students.some((student) => student.scheduleConfirmed && student.status !== "INACTIVE"),
    hasTransactions: Boolean(latestTransaction)
  };
};

const publicInvoice = (item: Awaited<ReturnType<typeof prisma.studentInvoice.findMany>>[number]) => ({
  ...item,
  amountBdt: number(item.amountBdt),
  paidAmountBdt: number(item.paidAmountBdt),
  previousBalanceBdt: number(item.previousBalanceBdt),
  currentChargesBdt: number(item.currentChargesBdt),
  currentPaymentsBdt: number(item.currentPaymentsBdt),
});

export const listFamilies = async (asOfValue?: string) => {
  const asOf = endOfDate(asOfValue) ?? new Date();
  const students = await allStudents();
  await materializeBillingThrough(students.map((student) => student.id), asOf);
  const groups = new Map<string, StudentRow[]>();
  for (const student of students) groups.set(familyKey(student), [...(groups.get(familyKey(student)) ?? []), student]);
  return Promise.all([...groups.values()].map((students) => publicFamily(students, asOf)));
};

export const getFamily = async (familyId: string, asOfValue?: string) => {
  const asOf = endOfDate(asOfValue) ?? new Date();
  const students = await getFamilyStudents(familyId);
  const ids = students.map((student) => student.id);
  await materializeBillingThrough(ids, asOf);
  const family = await publicFamily(students, asOf);
  const storedTransactions = await prisma.studentBillingTransaction.findMany({ where: { studentId: { in: ids }, ...(asOf ? { date: { lte: asOf } } : {}) }, include: { student: { select: { name: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
  const transactions = storedTransactions.map((item) => ({ id: item.id, date: item.date, studentId: item.studentId, studentName: item.student.name || "Student", type: item.type, amountBdt: number(item.amountBdt), description: item.description, category: item.category, recurring: item.recurring, frequency: item.frequency, repeatsEvery: item.repeatsEvery, automated: Boolean(item.automationKey) })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const invoices = await prisma.studentInvoice.findMany({ where: { studentId: { in: ids }, ...(asOf ? { invoiceDate: { lte: asOf } } : {}) }, orderBy: { invoiceDate: "desc" } });
  return { ...family, transactions, invoices: invoices.map(publicInvoice) };
};

export const createTransaction = async (familyId: string, raw: Record<string, unknown>) => {
  const students = await getFamilyStudents(familyId);
  const studentId = typeof raw.studentId === "string" && students.some((item) => item.id === raw.studentId) ? raw.studentId : students[0].id;
  const type = String(raw.type ?? "").trim().toUpperCase();
  if (!["PAYMENT", "CHARGE", "DISCOUNT", "PACKAGE", "REFUND"].includes(type)) throw Object.assign(new Error("Invalid transaction type"), { statusCode: 400 });
  const amount = requiredAmount(raw.amountBdt ?? raw.amount);
  const transaction = await prisma.studentBillingTransaction.create({ data: { studentId, type, amountBdt: amount, date: dateOnly(raw.date ?? new Date(), "Date"), description: typeof raw.description === "string" ? raw.description.trim() || null : null, category: typeof raw.category === "string" ? raw.category.trim() || null : null, recurring: raw.recurring === true, frequency: typeof raw.frequency === "string" ? raw.frequency.toUpperCase() : null, repeatsEvery: raw.repeatsEvery ? Number(raw.repeatsEvery) : null } });
  if (type === "PAYMENT" && Array.isArray(raw.invoiceIds)) {
    let remaining = amount;
    const invoices = await prisma.studentInvoice.findMany({ where: { id: { in: raw.invoiceIds.map(String) }, studentId: { in: students.map((item) => item.id) } }, orderBy: { invoiceDate: "asc" } });
    for (const invoice of invoices) {
      const outstanding = number(invoice.amountBdt) - number(invoice.paidAmountBdt);
      const applied = Math.min(outstanding, remaining);
      if (applied <= 0) continue;
      const paidAmountBdt = number(invoice.paidAmountBdt) + applied;
      await prisma.studentInvoice.update({ where: { id: invoice.id }, data: { paidAmountBdt, status: paidAmountBdt >= number(invoice.amountBdt) ? "PAID" : "PARTIALLY_PAID" } });
      remaining -= applied;
      if (remaining <= 0) break;
    }
  }
  return transaction;
};

export const updateTransaction = async (familyId: string, transactionId: string, raw: Record<string, unknown>) => {
  const students = await getFamilyStudents(familyId);
  const studentIds = students.map((student) => student.id);
  if (transactionId.startsWith("plan-")) {
    const studentId = transactionId.slice(5);
    if (!studentIds.includes(studentId)) throw Object.assign(new Error("Billing plan not found"), { statusCode: 404 });
    const billingCycle = String(raw.billingCycle ?? "MONTHLY").toUpperCase();
    if (!["MONTHLY", "QUARTERLY"].includes(billingCycle)) throw Object.assign(new Error("Billing cycle must be monthly or quarterly"), { statusCode: 400 });
    const billingAmountBdt = requiredAmount(raw.amountBdt ?? raw.amount);
    return prisma.student.update({ where: { id: studentId }, data: { billingCycle, billingAmountBdt, billingManualOverride: true } });
  }
  const existing = await prisma.studentBillingTransaction.findFirst({ where: { id: transactionId, studentId: { in: studentIds } } });
  if (!existing) throw Object.assign(new Error("Transaction not found"), { statusCode: 404 });
  if (existing.automationKey?.startsWith("makeup:")) {
    throw Object.assign(new Error("Make-up credit adjustments are audit records and cannot be edited. Add a separate correction transaction instead."), { statusCode: 409 });
  }
  if (existing.automationKey?.startsWith("package:") && raw.billingCycle !== undefined) {
    const billingCycle = String(raw.billingCycle).toUpperCase();
    if (!["MONTHLY", "QUARTERLY"].includes(billingCycle)) throw Object.assign(new Error("Billing cycle must be monthly or quarterly"), { statusCode: 400 });
    const billingAmountBdt = requiredAmount(raw.amountBdt ?? existing.amountBdt);
    await prisma.student.update({ where: { id: existing.studentId }, data: { billingCycle, billingAmountBdt, billingManualOverride: true } });
    return prisma.studentBillingTransaction.update({ where: { id: existing.id }, data: { amountBdt: billingAmountBdt, frequency: billingCycle, repeatsEvery: billingCycle === "QUARTERLY" ? 3 : 1 } });
  }
  const type = raw.type === undefined ? existing.type : String(raw.type).trim().toUpperCase();
  if (!["PAYMENT", "CHARGE", "DISCOUNT", "PACKAGE", "REFUND"].includes(type)) throw Object.assign(new Error("Invalid transaction type"), { statusCode: 400 });
  return prisma.studentBillingTransaction.update({ where: { id: transactionId }, data: {
    type,
    ...(raw.amountBdt !== undefined || raw.amount !== undefined ? { amountBdt: requiredAmount(raw.amountBdt ?? raw.amount) } : {}),
    ...(raw.date !== undefined ? { date: dateOnly(raw.date, "Date") } : {}),
    ...(raw.description !== undefined ? { description: String(raw.description).trim() || null } : {}),
    ...(raw.category !== undefined ? { category: String(raw.category).trim() || null } : {}),
    ...(raw.recurring !== undefined ? { recurring: raw.recurring === true } : {}),
    ...(raw.frequency !== undefined ? { frequency: String(raw.frequency).toUpperCase() } : {}),
    ...(raw.repeatsEvery !== undefined ? { repeatsEvery: Number(raw.repeatsEvery) || 1 } : {})
  } });
};

const parseRecipients = (value: unknown) => {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return optionalText(value).split(/[;,]/).map((item) => item.trim()).filter(Boolean);
};
const validEmail = (value: string) => /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(value);

const defaultRecipients = (students: StudentRow[]) =>
  [...new Set(students.map((student) => student.parentEmail?.trim()).filter((email): email is string => Boolean(email)))];

const toDateFromInput = (value: string | Date | null | undefined) => {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const textToHtml = (value: string) =>
  value.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`).join("");

const templateText = (value: string, snapshot: InvoicePdfSnapshot) => {
  const replacements: Record<string, string> = {
    parentName: snapshot.familyName,
    familyName: snapshot.familyName,
    invoiceNumber: snapshot.invoiceNumber,
    dateRange: `${formatDate(toDateFromInput(snapshot.rangeStart))} to ${formatDate(toDateFromInput(snapshot.rangeEnd))}`,
    dueDate: formatDate(toDateFromInput(snapshot.dueDate)),
    previousBalance: money(snapshot.summary.previousBalanceBdt),
    newCharges: money(snapshot.summary.currentChargesBdt),
    payments: money(snapshot.summary.currentPaymentsBdt),
    totalDue: money(snapshot.summary.totalDueBdt),
  };
  return Object.entries(replacements).reduce((text, [key, replacement]) => text.replaceAll(`{{${key}}}`, replacement), value);
};

const invoiceLineFromTransaction = (item: LedgerTransaction, studentName: string): InvoicePdfLineItem => {
  const effect = transactionEffect(item.type, number(item.amountBdt));
  const quarterlyEnd = new Date(Date.UTC(item.date.getUTCFullYear(), item.date.getUTCMonth() + 3, 0));
  const description = item.type === "PACKAGE" && item.frequency === "QUARTERLY"
    ? `${transactionDescription(item)} (covers ${item.date.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })} to ${quarterlyEnd.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })})`
    : transactionDescription(item);
  return {
    date: toDateKey(item.date),
    studentId: item.studentId,
    studentName,
    description,
    kind: item.type,
    chargesBdt: effect > 0 ? roundMoney(effect) : 0,
    paymentsBdt: effect < 0 ? roundMoney(Math.abs(effect)) : 0,
  };
};

const buildInvoiceSnapshot = async (
  students: StudentRow[],
  invoiceNumber: string,
  invoiceDate: Date,
  rangeStart: Date,
  rangeEnd: Date,
  dueDate: Date | null,
  raw: Record<string, unknown>
): Promise<InvoicePdfSnapshot> => {
  const ids = students.map((student) => student.id);
  const rangeStartDate = dateOnly(rangeStart, "Range start");
  const rangeEndDate = endOfDay(dateOnly(rangeEnd, "Range end"));
  await materializeBillingThrough(ids, rangeEndDate);

  const storedTransactions = await prisma.studentBillingTransaction.findMany({
    where: { studentId: { in: ids }, date: { lte: rangeEndDate } },
    include: { student: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }]
  });
  const transactions = storedTransactions as LedgerTransaction[];
  const previousTransactions = transactions.filter((item) => item.date < rangeStartDate);
  const currentTransactions = transactions.filter((item) => item.date >= rangeStartDate && item.date <= rangeEndDate);
  const includeBalanceForward = raw.includeBalanceForward !== false && raw.invoiceContents !== "range-only";
  const previousBalanceBdt = roundMoney(previousTransactions.reduce((sum, item) => sum + transactionEffect(item.type, number(item.amountBdt)), 0));
  let currentChargesBdt = 0;
  let currentPaymentsBdt = 0;
  const studentSubtotals = new Map(students.map((student) => [student.id, 0]));
  const lineItems: InvoicePdfLineItem[] = [];

  if (includeBalanceForward && previousBalanceBdt !== 0) {
    lineItems.push({
      date: toDateKey(rangeStartDate),
      studentName: "Balance forward",
      description: previousBalanceBdt > 0 ? "Unpaid balance from before this invoice period" : "Credit balance from before this invoice period",
      kind: "BALANCE",
      chargesBdt: previousBalanceBdt > 0 ? previousBalanceBdt : 0,
      paymentsBdt: previousBalanceBdt < 0 ? Math.abs(previousBalanceBdt) : 0,
    });
  }

  for (const item of currentTransactions) {
    const studentName = item.student?.name || students.find((student) => student.id === item.studentId)?.name || "Student";
    const effect = transactionEffect(item.type, number(item.amountBdt));
    if (effect > 0) currentChargesBdt += effect;
    if (effect < 0) currentPaymentsBdt += Math.abs(effect);
    studentSubtotals.set(item.studentId, roundMoney((studentSubtotals.get(item.studentId) ?? 0) + effect));
    lineItems.push(invoiceLineFromTransaction(item, studentName));
  }

  currentChargesBdt = roundMoney(currentChargesBdt);
  currentPaymentsBdt = roundMoney(currentPaymentsBdt);
  let totalDueBdt = roundMoney((includeBalanceForward ? previousBalanceBdt : 0) + currentChargesBdt - currentPaymentsBdt);

  if (raw.amountBdt !== undefined || raw.amount !== undefined) {
    const requestedAmount = requiredAmount(raw.amountBdt ?? raw.amount);
    const delta = roundMoney(requestedAmount - totalDueBdt);
    if (Math.abs(delta) >= 0.01) {
      lineItems.push({
        date: toDateKey(invoiceDate),
        studentName: "Invoice adjustment",
        description: "Admin-entered invoice total adjustment",
        kind: "ADJUSTMENT",
        chargesBdt: delta > 0 ? delta : 0,
        paymentsBdt: delta < 0 ? Math.abs(delta) : 0,
      });
      if (delta > 0) currentChargesBdt = roundMoney(currentChargesBdt + delta);
      if (delta < 0) currentPaymentsBdt = roundMoney(currentPaymentsBdt + Math.abs(delta));
      totalDueBdt = requestedAmount;
    }
  }

  if (totalDueBdt <= 0) throw Object.assign(new Error("This family has no positive amount due for the selected invoice period"), { statusCode: 400 });

  const parentEmail = students.find((student) => student.parentEmail)?.parentEmail ?? null;
  const parentPhone = students.find((student) => student.parentPhone)?.parentPhone ?? null;
  const familyName = students[0].parentName?.trim() || students[0].name?.trim() || "Family Account";
  const template = String(raw.pdfTemplate ?? "CLASSIC").toUpperCase();
  const pdfTemplate = ["CLASSIC", "MODERN", "MINIMAL"].includes(template) ? template : "CLASSIC";
  const accent = /^#?[0-9a-f]{6}$/i.test(optionalText(raw.pdfAccentColor)) ? optionalText(raw.pdfAccentColor) : null;

  return {
    invoiceNumber,
    invoiceDate,
    rangeStart,
    rangeEnd,
    dueDate,
    familyName,
    billTo: { name: familyName, email: parentEmail, phone: parentPhone, country: students.find((student) => student.country)?.country ?? null },
    students: students.map((student) => ({
      id: student.id,
      name: student.name || "Student",
      billingCycle: student.billingCycle,
      subtotalBdt: studentSubtotals.get(student.id) ?? 0,
    })),
    summary: {
      previousBalanceBdt,
      currentChargesBdt,
      currentPaymentsBdt,
      totalDueBdt,
    },
    includeBalanceForward,
    lineItems,
    pdfTemplate,
    pdfAccentColor: accent,
    pdfNotes: optionalText(raw.pdfNotes) || null,
  };
};

type CreateInvoiceOptions = { automationKey?: string; autoSendAt?: Date; allowMissingRecipient?: boolean };

export const createInvoice = async (familyId: string, raw: Record<string, unknown>, options: CreateInvoiceOptions = {}) => {
  const students = await getFamilyStudents(familyId);
  const invoiceDate = dateOnly(raw.invoiceDate ?? new Date(), "Invoice date");
  const rangeStart = dateOnly(raw.rangeStart, "Range start");
  const rangeEnd = dateOnly(raw.rangeEnd, "Range end");
  if (rangeEnd < rangeStart) throw Object.assign(new Error("Range end cannot be before range start"), { statusCode: 400 });
  const recipients = parseRecipients(raw.emailTo);
  let emailTo = recipients.length ? recipients : defaultRecipients(students);
  const settings = await getSettings();
  const emailSubject = optionalText(raw.emailSubject ?? settings.invoicing.emailSubject);
  const emailBody = optionalText(raw.emailBody ?? settings.invoicing.emailBody);

  if (!emailTo.length && !options.allowMissingRecipient) throw Object.assign(new Error("Enter at least one invoice recipient"), { statusCode: 400 });
  if (emailTo.some((recipient) => !validEmail(recipient))) {
    if (!options.allowMissingRecipient) throw Object.assign(new Error("Enter valid invoice recipient email addresses"), { statusCode: 400 });
    emailTo = [];
  }
  if (!emailSubject) throw Object.assign(new Error("Enter an email subject"), { statusCode: 400 });
  if (!emailBody) throw Object.assign(new Error("Write the email message before creating the invoice"), { statusCode: 400 });

  for (const student of students) {
    await prisma.$transaction((tx) => settleStudentMakeupCredits(tx, student.id, new Date()), { timeout: 30_000 });
  }

  const sequence = await prisma.$queryRaw<Array<{ next: bigint }>>`SELECT nextval('"StudentInvoiceNumber_seq"') AS next`;
  const invoiceNumber = `DM-${invoiceDate.getUTCFullYear().toString().slice(-2)}-${String(invoiceDate.getUTCMonth() + 1).padStart(2, "0")}-${String(sequence[0].next).padStart(4, "0")}`;
  const snapshot = await buildInvoiceSnapshot(students, invoiceNumber, invoiceDate, rangeStart, rangeEnd, raw.dueDate ? dateOnly(raw.dueDate, "Due date") : null, {
    ...raw,
    pdfTemplate: settings.invoicing.pdfTemplate,
    pdfAccentColor: settings.invoicing.pdfAccentColor,
    pdfNotes: settings.invoicing.pdfNotes,
  });

  const invoice = await prisma.studentInvoice.create({ data: {
    studentId: students[0].id,
    invoiceNumber,
    automationKey: options.automationKey,
    invoiceDate,
    rangeStart,
    rangeEnd,
    dueDate: snapshot.dueDate,
    includeBalanceForward: snapshot.includeBalanceForward,
    previousBalanceBdt: snapshot.summary.previousBalanceBdt,
    currentChargesBdt: snapshot.summary.currentChargesBdt,
    currentPaymentsBdt: snapshot.summary.currentPaymentsBdt,
    amountBdt: snapshot.summary.totalDueBdt,
    autoSendAt: options.autoSendAt,
    sentTo: emailTo.join(", "),
    emailSubject,
    emailBody,
    pdfTemplate: snapshot.pdfTemplate ?? "CLASSIC",
    pdfAccentColor: snapshot.pdfAccentColor,
    pdfNotes: snapshot.pdfNotes,
    lineItems: snapshot.lineItems as Prisma.InputJsonValue,
  } });
  return publicInvoice(invoice);
};

export const updateInvoiceEmail = async (familyId: string, invoiceId: string, raw: Record<string, unknown>) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Object.assign(new Error("Enter an email recipient, subject, and message"), { statusCode: 400 });
  const students = await getFamilyStudents(familyId);
  const invoice = await prisma.studentInvoice.findFirst({ where: { id: invoiceId, studentId: { in: students.map((student) => student.id) } } });
  if (!invoice) throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });
  if (invoice.emailedAt) throw Object.assign(new Error("A sent invoice email cannot be edited"), { statusCode: 409 });
  if (invoice.status === "VOID") throw Object.assign(new Error("A void invoice cannot be emailed"), { statusCode: 409 });
  if (invoice.sendingUntil && invoice.sendingUntil > new Date()) throw Object.assign(new Error("This invoice is being emailed; try again shortly"), { statusCode: 409 });
  const emailTo = parseRecipients(raw.emailTo);
  const emailSubject = optionalText(raw.emailSubject);
  const emailBody = optionalText(raw.emailBody);
  if (!emailTo.length || emailTo.some((recipient) => !validEmail(recipient))) throw Object.assign(new Error("Enter valid invoice recipient email addresses"), { statusCode: 400 });
  if (!emailSubject || !emailBody) throw Object.assign(new Error("Enter an email subject and message"), { statusCode: 400 });
  const updated = await prisma.studentInvoice.updateMany({
    where: { id: invoice.id, emailedAt: null, OR: [{ sendingUntil: null }, { sendingUntil: { lte: new Date() } }] },
    data: { sentTo: emailTo.join(", "), emailSubject, emailBody, autoRetryAt: null },
  });
  if (!updated.count) throw Object.assign(new Error("This invoice is being emailed; try again shortly"), { statusCode: 409 });
  return publicInvoice(await prisma.studentInvoice.findUniqueOrThrow({ where: { id: invoice.id } }));
};

export const sendInvoice = async (familyId: string, invoiceId: string) => {
  const students = await getFamilyStudents(familyId);
  const invoice = await prisma.studentInvoice.findFirst({
    where: { id: invoiceId, studentId: { in: students.map((student) => student.id) } },
  });
  if (!invoice) throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });
  if (invoice.emailedAt) return invoice;
  if (invoice.status === "VOID") throw Object.assign(new Error("A void invoice cannot be emailed"), { statusCode: 409 });
  if (!isEmailDeliveryEnabled()) throw Object.assign(new Error("Email delivery must be configured before sending invoices."), { statusCode: 400 });

  const emailTo = parseRecipients(invoice.sentTo);
  if (!emailTo.length || emailTo.some((recipient) => !validEmail(recipient)) || !invoice.emailSubject || !invoice.emailBody) {
    throw Object.assign(new Error("This invoice has no saved recipient or email message"), { statusCode: 400 });
  }
  const snapshot = await snapshotFromInvoice(familyId, invoiceId);
  const subject = templateText(invoice.emailSubject, snapshot);
  const body = templateText(invoice.emailBody, snapshot);
  const pdf = buildInvoicePdf(snapshot);
  const now = new Date();
  const claimed = await prisma.studentInvoice.updateMany({
    where: { id: invoiceId, emailedAt: null, OR: [{ sendingUntil: null }, { sendingUntil: { lte: now } }] },
    data: { sendingUntil: new Date(now.getTime() + 60_000) },
  });
  if (!claimed.count) throw Object.assign(new Error("This invoice is already being emailed"), { statusCode: 409 });
  try {
    const result = await sendEmail({
      to: emailTo,
      subject,
      text: body,
      html: textToHtml(body),
      attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdf, contentType: "application/pdf" }],
    });
    if (result.rejected.length) throw new Error("Some invoice recipients were rejected by SMTP");
    return await prisma.studentInvoice.update({ where: { id: invoiceId }, data: { emailedAt: new Date(), sendingUntil: null, autoRetryAt: null } });
  } catch (cause) {
    await prisma.studentInvoice.update({ where: { id: invoiceId }, data: { sendingUntil: null } });
    console.error(`Invoice ${invoice.invoiceNumber} email delivery failed`, cause);
    throw Object.assign(new Error("Invoice saved, but email delivery failed. Retry from the invoice list."), {
      statusCode: 502,
      code: "INVOICE_EMAIL_FAILED",
    });
  }
};

const lineItemsFromJson = (value: unknown): InvoicePdfLineItem[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = typeof item === "object" && item !== null ? item as Record<string, unknown> : {};
    return {
      date: optionalText(row.date),
      studentId: optionalText(row.studentId) || undefined,
      studentName: optionalText(row.studentName) || "Student",
      description: optionalText(row.description) || "Invoice line item",
      kind: optionalText(row.kind) || "CHARGE",
      chargesBdt: number(row.chargesBdt),
      paymentsBdt: number(row.paymentsBdt),
    };
  });
};

const snapshotFromInvoice = async (familyId: string, invoiceId: string): Promise<InvoicePdfSnapshot> => {
  const students = await getFamilyStudents(familyId);
  const ids = students.map((student) => student.id);
  const invoice = await prisma.studentInvoice.findFirst({ where: { id: invoiceId, studentId: { in: ids } } });
  if (!invoice) throw Object.assign(new Error("Invoice not found"), { statusCode: 404 });
  const lineItems = lineItemsFromJson(invoice.lineItems);
  if (!lineItems.length) {
    return buildInvoiceSnapshot(students, invoice.invoiceNumber, invoice.invoiceDate, invoice.rangeStart, invoice.rangeEnd, invoice.dueDate, {
      includeBalanceForward: invoice.includeBalanceForward,
      pdfTemplate: invoice.pdfTemplate,
      pdfAccentColor: invoice.pdfAccentColor,
      pdfNotes: invoice.pdfNotes,
      amountBdt: number(invoice.amountBdt),
    });
  }

  const familyName = students[0].parentName?.trim() || students[0].name?.trim() || "Family Account";
  const parentEmail = students.find((student) => student.parentEmail)?.parentEmail ?? null;
  const parentPhone = students.find((student) => student.parentPhone)?.parentPhone ?? null;
  const subtotals = new Map(students.map((student) => [student.id, 0]));
  for (const item of lineItems) {
    if (!item.studentId || !subtotals.has(item.studentId)) continue;
    subtotals.set(item.studentId, roundMoney((subtotals.get(item.studentId) ?? 0) + item.chargesBdt - item.paymentsBdt));
  }

  return {
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    rangeStart: invoice.rangeStart,
    rangeEnd: invoice.rangeEnd,
    dueDate: invoice.dueDate,
    familyName,
    billTo: { name: familyName, email: parentEmail, phone: parentPhone, country: students.find((student) => student.country)?.country ?? null },
    students: students.map((student) => ({ id: student.id, name: student.name || "Student", billingCycle: student.billingCycle, subtotalBdt: subtotals.get(student.id) ?? 0 })),
    summary: {
      previousBalanceBdt: number(invoice.previousBalanceBdt),
      currentChargesBdt: number(invoice.currentChargesBdt),
      currentPaymentsBdt: number(invoice.currentPaymentsBdt),
      totalDueBdt: number(invoice.amountBdt),
    },
    includeBalanceForward: invoice.includeBalanceForward,
    lineItems,
    pdfTemplate: invoice.pdfTemplate,
    pdfAccentColor: invoice.pdfAccentColor,
    pdfNotes: invoice.pdfNotes,
  };
};

export const getInvoicePdf = async (familyId: string, invoiceId: string) => {
  const snapshot = await snapshotFromInvoice(familyId, invoiceId);
  return {
    filename: `${snapshot.invoiceNumber}.pdf`,
    buffer: buildInvoicePdf(snapshot),
  };
};
