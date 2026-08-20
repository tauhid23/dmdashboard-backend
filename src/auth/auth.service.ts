import { prisma } from "../config/prisma.js";
import { effectivePermissions, safeUser } from "./permissions.js";
import { hashPassword, hashToken, randomToken, verifyPassword } from "./security.js";

const error=(statusCode:number,message:string,code:string,errors?:unknown)=>Object.assign(new Error(message),{statusCode,code,errors});
const includeRole={role:true} as const;
const userInclude = includeRole as unknown as { role: true; teacherId: true; studentId: true };
export const revokeSessions = async (userId:string) => prisma.$transaction([prisma.refreshSession.updateMany({where:{userId,revokedAt:null},data:{revokedAt:new Date()}}),prisma.user.update({where:{id:userId},data:{sessionVersion:{increment:1}}})]);

export async function login(identifier:string,password:string,metadata:{ip?:string;userAgent?:string}) {
  const normalized=identifier.trim().toLowerCase();
  const user=await prisma.user.findFirst({where:{deletedAt:null,OR:[{normalizedEmail:normalized},{normalizedUsername:normalized}]},include:includeRole});
  if(!user || user.status!=="ACTIVE" || !await verifyPassword(password,user.passwordHash)) throw error(401,"Invalid credentials","INVALID_CREDENTIALS");
  const refreshToken=randomToken();
  await prisma.$transaction([prisma.refreshSession.create({data:{userId:user.id,tokenHash:hashToken(refreshToken),expiresAt:new Date(Date.now()+30*86400000),ipAddress:metadata.ip,userAgent:metadata.userAgent}}),prisma.user.update({where:{id:user.id},data:{lastLoginAt:new Date()}})]);
  return {user:await safeUser(user),refreshToken,version:user.sessionVersion};
}

export async function refresh(token:string) {
  const session=await prisma.refreshSession.findUnique({where:{tokenHash:hashToken(token)},include:{user:{include:includeRole}}});
  if(!session||session.revokedAt||session.expiresAt<=new Date()||session.user.deletedAt||session.user.status!=="ACTIVE") throw error(401,"Invalid refresh session","INVALID_REFRESH_TOKEN");
  const replacement=randomToken();
  await prisma.$transaction([prisma.refreshSession.update({where:{id:session.id},data:{revokedAt:new Date(),lastUsedAt:new Date()}}),prisma.refreshSession.create({data:{userId:session.userId,tokenHash:hashToken(replacement),expiresAt:new Date(Date.now()+30*86400000),ipAddress:session.ipAddress,userAgent:session.userAgent}})]);
  return {user:await safeUser(session.user),refreshToken:replacement,version:session.user.sessionVersion};
}

export async function me(userId:string){const user=await prisma.user.findUnique({where:{id:userId},include:includeRole});if(!user)throw error(404,"User not found","NOT_FOUND");return safeUser(user);}
export async function logout(token?:string){if(token)await prisma.refreshSession.updateMany({where:{tokenHash:hashToken(token),revokedAt:null},data:{revokedAt:new Date()}});}
export async function changePassword(userId:string,currentPassword:string,newPassword:string){const user=await prisma.user.findUnique({where:{id:userId}});if(!user||!await verifyPassword(currentPassword,user.passwordHash))throw error(401,"Current password is incorrect","INVALID_PASSWORD");validatePassword(newPassword);await prisma.user.update({where:{id:userId},data:{passwordHash:await hashPassword(newPassword),mustChangePassword:false}});await revokeSessions(userId);}
export async function forgotPassword(identifier:string){const normalized=identifier.trim().toLowerCase();const user=await prisma.user.findFirst({where:{deletedAt:null,OR:[{normalizedEmail:normalized},{normalizedUsername:normalized}]}});if(!user)return null;const token=randomToken();await prisma.passwordResetToken.create({data:{userId:user.id,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+3600000)}});return process.env.NODE_ENV==="production"?null:token;}
export async function resetPassword(token:string,password:string){validatePassword(password);const item=await prisma.passwordResetToken.findUnique({where:{tokenHash:hashToken(token)}});if(!item||item.usedAt||item.expiresAt<=new Date())throw error(422,"Reset token is invalid or expired","INVALID_RESET_TOKEN");await prisma.$transaction([prisma.passwordResetToken.update({where:{id:item.id},data:{usedAt:new Date()}}),prisma.user.update({where:{id:item.userId},data:{passwordHash:await hashPassword(password),mustChangePassword:false}})]);await revokeSessions(item.userId);}
export function validatePassword(value:string){if(value.length<12)throw error(422,"Validation failed","VALIDATION_ERROR",{password:["Password must be at least 12 characters"]});}
export { effectivePermissions };
