import { prisma } from "../config/prisma.js";
import { materializeBillingThrough } from "./billingAutomation.service.js";

type StudentRow = Awaited<ReturnType<typeof prisma.student.findMany>>[number];
const number = (value: unknown) => Number(value ?? 0);
const dateOnly = (value: unknown, name: string) => {
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw Object.assign(new Error(`${name} must be a valid date`), { statusCode: 400 });
  return date;
};
const requiredAmount = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error("Amount must be greater than zero"), { statusCode: 400 });
  return amount;
};
const familyKey = (student: StudentRow) => student.parentEmail?.trim().toLowerCase() || student.parentPhone?.replace(/\s+/g, "") || `student:${student.id}`;
const transactionEffect = (type: string, amount: number) => ["PAYMENT", "DISCOUNT"].includes(type) ? -amount : amount;

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
  const date = dateOnly(value, "As-of date");
  date.setHours(23, 59, 59, 999);
  return date;
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
    autoInvoice: students.some((student) => student.scheduleConfirmed),
    hasTransactions: Boolean(latestTransaction)
  };
};

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
  return { ...family, transactions, invoices: invoices.map((item) => ({ ...item, amountBdt: number(item.amountBdt), paidAmountBdt: number(item.paidAmountBdt) })) };
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

export const createInvoice = async (familyId: string, raw: Record<string, unknown>) => {
  const students = await getFamilyStudents(familyId);
  const invoiceDate = dateOnly(raw.invoiceDate ?? new Date(), "Invoice date");
  const rangeStart = dateOnly(raw.rangeStart, "Range start");
  const rangeEnd = dateOnly(raw.rangeEnd, "Range end");
  if (rangeEnd < rangeStart) throw Object.assign(new Error("Range end cannot be before range start"), { statusCode: 400 });
  const calculated = students.reduce((sum, student) => sum + (student.scheduleConfirmed ? number(student.billingAmountBdt) : 0), 0);
  const amountBdt = raw.amountBdt ? requiredAmount(raw.amountBdt) : calculated;
  if (amountBdt <= 0) throw Object.assign(new Error("This family has no confirmed package amount to invoice"), { statusCode: 400 });
  const count = await prisma.studentInvoice.count();
  const invoiceNumber = `DM-${invoiceDate.getFullYear().toString().slice(-2)}-${String(invoiceDate.getMonth() + 1).padStart(2, "0")}-${String(count + 1).padStart(4, "0")}`;
  return prisma.studentInvoice.create({ data: { studentId: students[0].id, invoiceNumber, invoiceDate, rangeStart, rangeEnd, dueDate: raw.dueDate ? dateOnly(raw.dueDate, "Due date") : null, amountBdt, emailedAt: raw.emailed === true ? new Date() : null } });
};
