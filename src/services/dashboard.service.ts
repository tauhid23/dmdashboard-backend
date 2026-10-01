import { prisma } from "../config/prisma.js";
import { effectivePermissions } from "../auth/permissions.js";
import { getRequestScope } from "../auth/accessScope.js";

type Activity = { id: string; kind: string; title: string; detail: string; at: Date; href: string };
type Action = { title: string; detail: string; href: string; priority: "high" | "normal" };

const dayBounds = (now: Date) => {
  const dhaka = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  const start = new Date(Date.UTC(dhaka.getUTCFullYear(), dhaka.getUTCMonth(), dhaka.getUTCDate()) - 6 * 60 * 60 * 1000);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};
const formatDhaka = (date: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }).format(date);

export async function getDashboard(userId: string) {
  const scope = await getRequestScope(userId);
  const permissions = await effectivePermissions(userId);
  const now = new Date();
  const { start, end } = dayBounds(now);
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const staff = scope.isPrivileged;
  const manager = scope.roleCode === "MODERATOR";
  const teacher = !!scope.teacherId && !staff;
  const can = (resource: keyof typeof permissions) => permissions[resource].view;
  // Older records have a null status and are shown as Active in the rosters.
  const studentWhere = staff ? {} : teacher ? { teacherId: scope.teacherId! } : { id: scope.studentId ?? "__none__" };
  const reportWhere = staff ? {} : teacher ? { teacherId: scope.teacherId! } : { studentId: scope.studentId ?? "__none__" };
  const examWhere = staff ? {} : teacher ? { examinerId: scope.teacherId! } : { studentId: scope.studentId ?? "__none__" };
  const scheduleWhere = staff ? {} : teacher ? { teacherId: scope.teacherId! } : { studentId: scope.studentId ?? "__none__" };
  const [activeStudents, activeTeachers, pendingSignups, unassignedStudents, classesToday, reportsToday, examsToday, upcomingExamCount,
    students, teachers, reports, examSchedules, attempts, classUpdates, upcomingExams, signupAudits] = await Promise.all([
    can("students") ? prisma.student.count({ where: { ...studentWhere, OR: [{ status: "ACTIVE" }, { status: null }] } }) : 0,
    staff && can("teachers") ? prisma.teacher.count({ where: { OR: [{ status: "ACTIVE" }, { status: null }] } }) : 0,
    staff && can("students") ? prisma.student.count({ where: { status: "NEW_SIGN_UP" } }) : 0,
    staff && can("students") ? prisma.student.count({ where: { teacherId: null, OR: [{ status: { in: ["ACTIVE", "NEW_SIGN_UP"] } }, { status: null }] } }) : 0,
    can("class-reports") ? prisma.classScheduleEvent.count({ where: { ...scheduleWhere, scheduledDate: { gte: start, lt: end }, status: { not: "CANCELLED" } } }) : 0,
    can("class-reports") ? prisma.classReport.count({ where: { ...reportWhere, createdAt: { gte: start, lt: end } } }) : 0,
    can("results") ? prisma.examAttempt.count({ where: { ...examWhere, submittedAt: { gte: start, lt: end } } }) : 0,
    can("exams") ? prisma.examSchedule.count({ where: { ...scheduleWhere, status: "UPCOMING", scheduledAt: { gte: now, lt: nextWeek } } }) : 0,
    can("students") ? prisma.student.findMany({ where: { ...studentWhere, createdAt: { gte: since } }, select: { id: true, name: true, status: true, studentType: true, age: true, gender: true, country: true, parentName: true, parentEmail: true, parentPhone: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 25 }) : [],
    staff && can("teachers") ? prisma.teacher.findMany({ where: { createdAt: { gte: since } }, select: { id: true, name: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 15 }) : [],
    can("class-reports") ? prisma.classReport.findMany({ where: { ...reportWhere, updatedAt: { gte: since } }, select: { id: true, studentId: true, studentName: true, teacherName: true, studentWebcamOn: true, studentNoiseFree: true, lessonUnderstanding: true, teacherNote: true, teacherWebcamOn: true, teacherNoiseFree: true, teachingFocus: true, adminNote: true, createdAt: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 25 }) : [],
    can("exams") ? prisma.examSchedule.findMany({ where: { ...scheduleWhere, updatedAt: { gte: since } }, select: { id: true, studentId: true, student: { select: { name: true } }, courseName: true, level: true, scheduledAt: true, createdAt: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 25 }) : [],
    can("results") ? prisma.examAttempt.findMany({ where: { ...examWhere, submittedAt: { gte: since } }, select: { id: true, studentId: true, student: { select: { name: true } }, courseLevel: true, outcome: true, submittedAt: true }, orderBy: { submittedAt: "desc" }, take: 25 }) : [],
    can("class-reports") ? prisma.classScheduleEvent.findMany({ where: { ...scheduleWhere, updatedAt: { gte: since } }, select: { id: true, studentId: true, student: { select: { name: true } }, status: true, createdAt: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 40 }) : [],
    can("exams") ? prisma.examSchedule.findMany({ where: { ...scheduleWhere, status: "UPCOMING", scheduledAt: { gte: now, lt: nextWeek } }, select: { id: true, studentId: true, student: { select: { name: true } }, courseName: true, scheduledAt: true }, orderBy: { scheduledAt: "asc" }, take: 5 }) : [],
    staff && can("students") ? prisma.auditLog.findMany({ where: { action: "STUDENT_REGISTERED", createdAt: { gte: since } }, select: { after: true }, orderBy: { createdAt: "desc" }, take: 100 }) : []
  ]);
  const registeredIds = new Set(signupAudits.flatMap((log) => {
    const after = log.after;
    return after && typeof after === "object" && !Array.isArray(after) && typeof after.studentId === "string" ? [after.studentId] : [];
  }));

  const activity: Activity[] = [
    ...students.map((item) => ({ id: `student:${item.id}`, kind: staff && (registeredIds.has(item.id) || item.status === "NEW_SIGN_UP") ? "registration" : "student", title: staff && (registeredIds.has(item.id) || item.status === "NEW_SIGN_UP") ? "New student signup" : "Student added", detail: staff && (registeredIds.has(item.id) || item.status === "NEW_SIGN_UP") ? [item.name ?? "Student", item.studentType?.toLowerCase(), item.age ? `Age ${item.age}` : null, item.gender?.toLowerCase().replaceAll("_", " "), item.country, item.parentName ? `Parent: ${item.parentName}` : null, item.parentEmail, item.parentPhone ? `WhatsApp: ${item.parentPhone}` : null].filter(Boolean).join(" · ") : item.name ?? "Student", at: item.createdAt, href: `/students/${item.id}` })),
    ...teachers.map((item) => ({ id: `teacher:${item.id}`, kind: "teacher", title: "Teacher added", detail: item.name ?? "Teacher", at: item.createdAt, href: `/teachers/${item.id}` })),
    ...reports.map((item) => {
      const studentReport = item.studentWebcamOn !== null || item.studentNoiseFree !== null || item.lessonUnderstanding !== null || item.teacherNote !== null;
      const teacherReport = item.teacherWebcamOn !== null || item.teacherNoiseFree !== null || item.teachingFocus !== null || item.adminNote !== null;
      const subject = studentReport && !teacherReport ? "Student class report" : teacherReport && !studentReport ? "Teacher class report" : "Class report";
      return { id: `report:${item.id}`, kind: "report", title: `${subject} ${item.updatedAt.getTime() - item.createdAt.getTime() > 1000 ? "updated" : "submitted"}`, detail: `${item.studentName ?? "Student"}${item.teacherName ? ` · Teacher: ${item.teacherName}` : ""}`, at: item.updatedAt, href: "/class-reports" };
    }),
    ...examSchedules.map((item) => ({ id: `schedule:${item.id}`, kind: "exam-schedule", title: item.updatedAt.getTime() - item.createdAt.getTime() > 1000 ? "Exam schedule updated" : "Exam scheduled", detail: `${item.student.name ?? "Student"} · ${item.courseName} ${item.level} · ${formatDhaka(item.scheduledAt)} (Bangladesh)`, at: item.updatedAt, href: "/exams" })),
    ...attempts.map((item) => ({ id: `exam:${item.id}`, kind: "exam", title: "Student exam taken", detail: `${item.student.name ?? "Student"} · ${item.courseLevel.replaceAll("_", " ")} · ${item.outcome.replaceAll("_", " ")}`, at: item.submittedAt, href: "/results" })),
    ...classUpdates.filter((item) => item.updatedAt.getTime() - item.createdAt.getTime() > 1000).map((item) => ({ id: `class:${item.id}`, kind: "class", title: "Class schedule changed", detail: `${item.student.name ?? "Student"} · ${item.status}`, at: item.updatedAt, href: "/class-schedule" }))
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 30);

  const actions: Action[] = [];
  if (staff && pendingSignups && can("students")) actions.push({ title: `Review ${pendingSignups} new signup${pendingSignups === 1 ? "" : "s"}`, detail: "Confirm contact details, assign a tutor, and approve enrollment.", href: "/students", priority: "high" });
  if (staff && unassignedStudents && can("students")) actions.push({ title: `${unassignedStudents} student${unassignedStudents === 1 ? " needs" : "s need"} a tutor`, detail: "Assign a teacher and confirm the class schedule.", href: "/students", priority: "high" });
  if (upcomingExamCount && can("exams")) actions.push({ title: `${upcomingExamCount} exam${upcomingExamCount === 1 ? "" : "s"} in the next 7 days`, detail: "Check the schedule and prepare the next assessments.", href: "/exams", priority: "normal" });
  if (teacher && classesToday && can("class-reports")) actions.push({ title: `${classesToday} class${classesToday === 1 ? "" : "es"} today`, detail: "Review today's student schedule and record class reports.", href: "/class-schedule", priority: "normal" });
  const summary = `Today: ${classesToday} scheduled ${classesToday === 1 ? "class" : "classes"}, ${reportsToday} ${reportsToday === 1 ? "class report" : "class reports"}, and ${examsToday} ${examsToday === 1 ? "exam" : "exams"} recorded.${staff && pendingSignups ? ` ${pendingSignups} signup${pendingSignups === 1 ? " needs" : "s need"} review.` : ""}${actions[0] ? ` Next: ${actions[0].title.toLowerCase()}.` : ""}`;

  return {
    role: scope.roleCode, asOf: now, timeZone: "Asia/Dhaka", summary, actions,
    stats: manager ? [
      ...(can("students") ? [{ label: "Pending signups", value: pendingSignups, href: "/students" }, { label: "Needs tutor", value: unassignedStudents, href: "/students" }] : []),
      ...(can("class-reports") ? [{ label: "Classes today", value: classesToday, href: "/class-schedule" }, { label: "Reports today", value: reportsToday, href: "/class-reports" }] : []),
      ...(can("exams") ? [{ label: "Upcoming exams", value: upcomingExamCount, href: "/exams" }] : []),
      ...(can("students") ? [{ label: "Active students", value: activeStudents, href: "/students" }] : [])
    ] : staff ? [
      ...(can("students") ? [{ label: "Active students", value: activeStudents, href: "/students" }, { label: "Pending signups", value: pendingSignups, href: "/students" }] : []),
      ...(can("teachers") ? [{ label: "Active teachers", value: activeTeachers, href: "/teachers" }] : []),
      ...(can("class-reports") ? [{ label: "Classes today", value: classesToday, href: "/class-schedule" }] : []),
      ...(can("class-reports") ? [{ label: "Reports today", value: reportsToday, href: "/class-reports" }] : []),
      ...(can("results") ? [{ label: "Exams today", value: examsToday, href: "/results" }] : [])
    ] : [
      ...(can("students") ? [{ label: teacher ? "My active students" : "My enrollment", value: activeStudents, href: "/students" }] : []),
      ...(can("class-reports") ? [{ label: "Classes today", value: classesToday, href: "/class-schedule" }] : []),
      ...(can("class-reports") ? [{ label: "Reports today", value: reportsToday, href: "/class-reports" }] : []),
      ...(can("exams") ? [{ label: "Upcoming exams", value: upcomingExamCount, href: "/exams" }] : [])
    ],
    upcomingExams: upcomingExams.map((item) => ({ id: item.id, studentName: item.student.name ?? "Student", courseName: item.courseName, scheduledAt: item.scheduledAt, href: "/exams" })),
    activity
  };
}
