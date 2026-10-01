import { prisma } from "../config/prisma.js";
import { safeUser } from "../auth/permissions.js";
import { hashPassword, randomToken } from "../auth/security.js";
import { revokeSessions, validatePassword } from "../auth/auth.service.js";
import { isEmailDeliveryEnabled } from "./email.service.js";
import { createManualPasswordLink, sendPasswordLink } from "./passwordEmail.service.js";
import type { PermissionMap } from "../auth/auth.types.js";
import type { Prisma } from "../generated/prisma/client.js";
import { assertAdminAccess, getActorScope } from "../auth/accessScope.js";
type UserPayload = { name?: string; email?: string; username?: string; role?: string; status?: string; teacherId?: string | null; studentId?: string | null; permissions?: Partial<PermissionMap> };
type UserQuery = { page?: number | string; limit?: number | string; search?: string; status?: string; role?: string };
const error = (statusCode: number, message: string, code: string, errors?: unknown) => Object.assign(new Error(message), { statusCode, code, errors });
const roleCode = (value: string) => value.trim().toUpperCase().replaceAll(" ", "_");
const normalize = (value: string) => value.trim().toLowerCase();
const include = { role: true } as const;

async function role(value: string) { const item = await prisma.role.findFirst({ where: { OR: [{ code: roleCode(value) }, { name: { equals: value, mode: "insensitive" } }] } }); if (!item) throw error(404, "Role not found", "ROLE_NOT_FOUND"); return item; }
async function ensureUnique(email: string, username: string, excludeId?: string, student = false) { const duplicate = await prisma.user.findFirst({ where: { id: excludeId ? { not: excludeId } : undefined, normalizedUsername: normalize(username) } }); if (duplicate) throw error(409, "Username is already in use", "DUPLICATE_USER", { username: ["Username is already in use"] }); if (!student && await prisma.user.findFirst({ where: { id: excludeId ? { not: excludeId } : undefined, normalizedEmail: normalize(email), role: { code: { not: "STUDENT" } } } })) throw error(409, "Contact email is already used by a staff account", "DUPLICATE_USER", { email: ["Email is already used by a staff account"] }); }
const optionalId = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
async function profileLinks(payload: UserPayload, selectedRoleCode: string, existing?: { teacherId?: string | null; studentId?: string | null }) {
  const teacherId = payload.teacherId !== undefined ? optionalId(payload.teacherId) : existing?.teacherId ?? null;
  const studentId = payload.studentId !== undefined ? optionalId(payload.studentId) : existing?.studentId ?? null;
  if (teacherId && studentId) throw error(422, "A user can be linked to either a teacher or a student, not both", "VALIDATION_ERROR", { teacherId: ["Choose either teacher or student"], studentId: ["Choose either teacher or student"] });
  if (selectedRoleCode === "TEACHER" && !teacherId) throw error(422, "Teacher users must be linked to a teacher account", "VALIDATION_ERROR", { teacherId: ["Teacher account is required"] });
  if (selectedRoleCode === "STUDENT" && !studentId) throw error(422, "Student users must be linked to a student account", "VALIDATION_ERROR", { studentId: ["Student account is required"] });
  if (teacherId && !await prisma.teacher.count({ where: { id: teacherId } })) throw error(404, "Teacher account not found", "TEACHER_NOT_FOUND");
  if (studentId && !await prisma.student.count({ where: { id: studentId } })) throw error(404, "Student account not found", "STUDENT_NOT_FOUND");
  return { teacherId, studentId };
}
async function setOverrides(userId: string, permissions: Partial<PermissionMap> | undefined, roleId: string) { if (permissions === undefined) return; const rolePermissions = await prisma.rolePermission.findMany({ where: { roleId }, include: { permission: true } }); const defaults = new Set(rolePermissions.map(p => p.permission.code)); const all = await prisma.permission.findMany(); const desired = new Map<string, boolean>(); for (const [resource, actions] of Object.entries(permissions)) for (const [action, allowed] of Object.entries(actions ?? {})) desired.set(`${resource}.${action}`, Boolean(allowed)); await prisma.userPermissionOverride.deleteMany({ where: { userId } }); const rows = all.flatMap(permission => desired.has(permission.code) && desired.get(permission.code) !== defaults.has(permission.code) ? [{ userId, permissionId: permission.id, allowed: desired.get(permission.code)! }] : []); if (rows.length) await prisma.userPermissionOverride.createMany({ data: rows }); }
async function activeSuperAdmins() { return prisma.user.count({ where: { deletedAt: null, status: "ACTIVE", role: { code: "SUPER_ADMIN" } } }); }
async function protectLastSuperAdmin(target: { id: string; status: string; role: { code: string } }, next: { status?: string; roleCode?: string; deleted?: boolean }) { if (target.role.code === "SUPER_ADMIN" && (next.deleted || next.status === "INACTIVE" || next.roleCode && next.roleCode !== "SUPER_ADMIN") && await activeSuperAdmins() <= 1) throw error(403, "The last active Super Admin cannot be demoted, disabled or deleted", "LAST_SUPER_ADMIN"); }

export async function createUser(payload: UserPayload) {
  if (!payload.role) throw error(422, "Choose a role", "VALIDATION_ERROR");
  const selected = await role(payload.role);
  if (selected.code === "STUDENT") throw error(422, "Create student login credentials from Add or Edit Student", "STUDENT_CREDENTIALS_MANAGED");
  const links = await profileLinks(payload, selected.code);
  const student = links.studentId ? await prisma.student.findUnique({ where: { id: links.studentId }, select: { name: true, parentEmail: true } }) : null;
  const name = String(student?.name || payload.name || "").trim();
  const email = String(payload.email || student?.parentEmail || "").trim();
  if (!name || !validEmail(email)) throw error(422, "A name and valid contact email are required", "VALIDATION_ERROR");
  const username = `member-${randomToken().slice(0, 24)}`;
  await ensureUnique(email, username);
  if (links.studentId && await prisma.user.count({ where: { studentId: links.studentId } })) throw error(409, "This student already has a login account", "DUPLICATE_STUDENT_ACCOUNT");
  if (links.teacherId && await prisma.user.count({ where: { teacherId: links.teacherId } })) throw error(409, "This teacher already has a login account", "DUPLICATE_TEACHER_ACCOUNT");
  const user = await prisma.user.create({ data: { name, email, normalizedEmail: normalize(email), username, normalizedUsername: normalize(username), passwordHash: await hashPassword(randomToken()), status: roleCode(payload.status ?? "Active") as "ACTIVE" | "INACTIVE", roleId: selected.id, mustChangePassword: true, teacherId: links.teacherId, studentId: links.studentId }, include });
  await setOverrides(user.id, payload.permissions, selected.id);
  const invitationSent = user.status === "ACTIVE" ? await sendPasswordLink(user, "invitation").catch((cause) => { console.error("Account invitation setup failed", cause); return false; }) : false;
  const setupUrl = user.status === "ACTIVE" && !invitationSent ? await createManualPasswordLink(user) : null;
  return { ...await safeUser(user), invitationSent, setupUrl };
}
export async function resendInvitation(id: string) {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!user) throw error(404, "User not found", "NOT_FOUND");
  if (await prisma.role.findFirst({ where: { id: user.roleId, code: "STUDENT" } })) throw error(403, "Student credentials are managed in Edit Student", "FORBIDDEN");
  if (user.status !== "ACTIVE") throw error(422, "Activate the account before sending an invitation", "INACTIVE_USER");
  if (isEmailDeliveryEnabled() && await sendPasswordLink(user, "invitation")) return { message: "Password setup email sent.", setupUrl: null };
  return { message: "Share this password setup link securely. It expires in 24 hours.", setupUrl: await createManualPasswordLink(user) };
}
export async function getUsers(query: UserQuery = {}) { const page = Math.max(1, Number(query.page) || 1), limit = Math.min(100, Math.max(1, Number(query.limit) || 20)); const where: Prisma.UserWhereInput = { deletedAt: null }; if (query.search) where.OR = ["name", "email", "username"].map(field => ({ [field]: { contains: String(query.search), mode: "insensitive" } })); if (query.status) { const status = roleCode(query.status); if (status !== "ACTIVE" && status !== "INACTIVE") throw error(422, "Invalid account status", "VALIDATION_ERROR"); where.status = status; } if (query.role) where.role = { code: roleCode(query.role) }; const [users, total] = await prisma.$transaction([prisma.user.findMany({ where, include, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }), prisma.user.count({ where })]); return { data: await Promise.all(users.map(safeUser)), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } }; }
export async function getUser(id: string) { const user = await prisma.user.findFirst({ where: { id, deletedAt: null }, include }); if (!user) throw error(404, "User not found", "NOT_FOUND"); return safeUser(user); }
export async function updateUser(actorId: string, id: string, payload: UserPayload) { const target = await prisma.user.findFirst({ where: { id, deletedAt: null }, include }); if (!target) throw error(404, "User not found", "NOT_FOUND"); if (target.role.code === "STUDENT") { assertAdminAccess(await getActorScope(actorId)); if (payload.username && normalize(payload.username) !== target.normalizedUsername) throw error(403, "Change student username in Edit Student", "FORBIDDEN"); } if (actorId === id && (payload.status || payload.role || payload.permissions !== undefined || payload.teacherId !== undefined || payload.studentId !== undefined)) throw error(403, "You cannot change your own status, role, permissions, or profile link", "SELF_MODIFICATION"); if (payload.email || payload.username) await ensureUnique(payload.email ?? target.email, payload.username ?? target.username, id, target.role.code === "STUDENT"); const selected = payload.role ? await role(payload.role) : target.role; if (selected.code === "STUDENT" && target.role.code !== "STUDENT") throw error(422, "Create student logins in Add or Edit Student", "STUDENT_CREDENTIALS_MANAGED"); const links = await profileLinks(payload, selected.code, target); const nextStatus = payload.status ? roleCode(payload.status) : target.status; await protectLastSuperAdmin(target, { status: nextStatus, roleCode: selected.code }); const user = await prisma.user.update({ where: { id }, data: { name: payload.name?.trim(), email: payload.email?.trim(), normalizedEmail: payload.email ? normalize(payload.email) : undefined, username: payload.username?.trim(), normalizedUsername: payload.username ? normalize(payload.username) : undefined, status: nextStatus as "ACTIVE" | "INACTIVE", roleId: selected.id, teacherId: links.teacherId, studentId: links.studentId }, include }); await setOverrides(id, payload.permissions, selected.id); if (target.status !== nextStatus && nextStatus === "INACTIVE") await revokeSessions(id); return safeUser(user); }
export async function deleteUser(actorId: string, id: string) { if (actorId === id) throw error(403, "Users cannot delete themselves", "SELF_DELETE"); const target = await prisma.user.findFirst({ where: { id, deletedAt: null }, include }); if (!target) throw error(404, "User not found", "NOT_FOUND"); await protectLastSuperAdmin(target, { deleted: true }); await prisma.user.update({ where: { id }, data: { deletedAt: new Date(), status: "INACTIVE" } }); await revokeSessions(id); }
export async function adminResetPassword(actorId: string, id: string, password: string) { if (actorId === id) throw error(400, "Use change-password for your own account", "USE_CHANGE_PASSWORD"); validatePassword(password); const target = await prisma.user.findFirst({ where: { id, deletedAt: null }, include }); if (!target) throw error(404, "User not found", "NOT_FOUND"); if (target.role.code === "STUDENT") throw error(403, "Change student password in Edit Student", "FORBIDDEN"); await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(password), mustChangePassword: true } }); await revokeSessions(id); }
export const getRoles = () => prisma.role.findMany({ orderBy: { name: "asc" } });
export const getPermissions = () => prisma.permission.findMany({ orderBy: [{ resource: "asc" }, { action: "asc" }] });
export async function updateRolePermissions(roleId: string, permissions: Record<string, boolean>) { const roleItem = await prisma.role.findUnique({ where: { id: roleId } }); if (!roleItem) throw error(404, "Role not found", "NOT_FOUND"); if (roleItem.code === "SUPER_ADMIN") throw error(403, "Super Admin permissions cannot be reduced", "PROTECTED_ROLE"); const selected = await prisma.permission.findMany({ where: { code: { in: Object.entries(permissions).filter(([, v]) => v).map(([k]) => k) } } }); await prisma.$transaction([prisma.rolePermission.deleteMany({ where: { roleId } }), prisma.rolePermission.createMany({ data: selected.map(p => ({ roleId, permissionId: p.id })) })]); return getRoles(); }
