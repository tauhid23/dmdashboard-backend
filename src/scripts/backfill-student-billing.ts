import { prisma } from "../config/prisma.js";
import { recalculateStudentBillingFromSchedule } from "../billing/studentBilling.service.js";
import { materializeStudentBillingThrough } from "../billing/billingAutomation.service.js";

const students = await prisma.student.findMany({ select: { id: true } });
for (const student of students) {
  await recalculateStudentBillingFromSchedule(student.id);
  await materializeStudentBillingThrough(student.id, new Date());
}
console.log(`Recalculated and materialized billing plans for ${students.length} students.`);
await prisma.$disconnect();
