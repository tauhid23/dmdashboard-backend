import { prisma } from "../config/prisma.js";
import { ACTIONS, RESOURCES, type PermissionMap } from "./auth.types.js";

export const emptyPermissions = (): PermissionMap => Object.fromEntries(RESOURCES.map(r => [r, Object.fromEntries(ACTIONS.map(a => [a, false]))])) as PermissionMap;

export async function effectivePermissions(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { role: { include: { permissions: { include: { permission: true } } } }, permissionOverrides: { include: { permission: true } } } });
  if (!user) return emptyPermissions();
  const result = emptyPermissions();
  if (user.role.code === "SUPER_ADMIN") for (const resource of RESOURCES) for (const action of ACTIONS) result[resource][action] = true;
  else for (const item of user.role.permissions) result[item.permission.resource as keyof PermissionMap][item.permission.action as keyof PermissionMap["dashboard"]] = true;
  for (const item of user.permissionOverrides) result[item.permission.resource as keyof PermissionMap][item.permission.action as keyof PermissionMap["dashboard"]] = item.allowed;
  for (const resource of RESOURCES) {
    if (!result[resource].view) result[resource] = { view:false, add:false, edit:false, delete:false };
    if (result[resource].add || result[resource].edit || result[resource].delete) result[resource].view = true;
  }
  return result;
}

export const safeUser = async (user: { id:string;name:string;email:string;username:string;status:"ACTIVE"|"INACTIVE";mustChangePassword:boolean;lastLoginAt:Date|null;createdAt:Date;updatedAt:Date;role:{name:string};teacherId?:string|null;studentId?:string|null }) => ({
  id:user.id,name:user.name,email:user.email,username:user.username,role:user.role.name,status:user.status === "ACTIVE" ? "Active" : "Inactive",permissions:await effectivePermissions(user.id),lastLoginAt:user.lastLoginAt,mustChangePassword:user.mustChangePassword,createdAt:user.createdAt,updatedAt:user.updatedAt,teacherId:user.teacherId??null,studentId:user.studentId??null
});
