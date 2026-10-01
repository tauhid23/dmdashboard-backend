import { prisma } from "../config/prisma.js";
import { effectivePermissions, safeUser } from "./permissions.js";
import { hashPassword, hashToken, randomToken, verifyPassword } from "./security.js";
import { getSettings } from "../services/settings.service.js";
import { env } from "../config/env.js";
import { isEmailDeliveryEnabled } from "../services/email.service.js";
import { sendPasswordLink } from "../services/passwordEmail.service.js";

const error=(statusCode:number,message:string,code:string,errors?:unknown)=>Object.assign(new Error(message),{statusCode,code,errors});
const includeRole={role:true} as const;
export const revokeSessions = async (userId:string) => prisma.$transaction([prisma.refreshSession.updateMany({where:{userId,revokedAt:null},data:{revokedAt:new Date()}}),prisma.user.update({where:{id:userId},data:{sessionVersion:{increment:1}}})]);

export async function login(identifier:string,password:string,metadata:{ip?:string;userAgent?:string}) {
  const normalized=identifier.trim().toLowerCase();
  let user=await prisma.user.findFirst({where:{deletedAt:null,normalizedUsername:normalized},include:includeRole});
  if(!user && normalized.includes("@")) {
    const matches=await prisma.user.findMany({where:{deletedAt:null,normalizedEmail:normalized,role:{code:{not:"STUDENT"}}},include:includeRole,take:2});
    if(matches.length===1) user=matches[0];
    if(matches.length===0) {
      const legacy=await prisma.user.findMany({where:{deletedAt:null,normalizedEmail:normalized,role:{code:"STUDENT"},OR:[{normalizedUsername:{startsWith:"student-"}},{normalizedUsername:{startsWith:"member-"}}]},include:includeRole,take:2});
      if(legacy.length===1) user=legacy[0];
    }
  }
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
export async function changePassword(userId:string,currentPassword:string,newPassword:string){const user=await prisma.user.findUnique({where:{id:userId},include:includeRole});if(user?.role.code==="STUDENT")throw error(403,"Student credentials are managed by an administrator","FORBIDDEN");if(!user||!await verifyPassword(currentPassword,user.passwordHash))throw error(401,"Current password is incorrect","INVALID_PASSWORD");validatePassword(newPassword);await prisma.user.update({where:{id:userId},data:{passwordHash:await hashPassword(newPassword),mustChangePassword:false}});await revokeSessions(userId);}
export async function updateProfile(userId:string,payload:{name?:unknown;email?:unknown}){const name=typeof payload.name==="string"?payload.name.trim():"";const email=typeof payload.email==="string"?payload.email.trim():"";if(!name||!email)throw error(422,"Validation failed","VALIDATION_ERROR",{name:["Name is required"],email:["Email is required"]});if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw error(422,"Validation failed","VALIDATION_ERROR",{email:["Enter a valid email address"]});const current=await prisma.user.findUnique({where:{id:userId},include:includeRole});if(!current)throw error(404,"User not found","NOT_FOUND");if(current.role.code!=="STUDENT" && await prisma.user.findFirst({where:{id:{not:userId},deletedAt:null,normalizedEmail:email.toLowerCase(),role:{code:{not:"STUDENT"}}}}))throw error(409,"Email is already used by a staff account","DUPLICATE_USER",{email:["Email is already used by a staff account"]});const user=await prisma.user.update({where:{id:userId},data:{name,email,normalizedEmail:email.toLowerCase()},include:includeRole});return safeUser(user);}
export async function forgotPassword(identifier:string){
  const settings=await getSettings();
  if(!settings.security.allowPasswordReset)return null;
  const emailEnabled=isEmailDeliveryEnabled();
  const normalized=identifier.trim().toLowerCase();
  let user=await prisma.user.findFirst({where:{deletedAt:null,status:"ACTIVE",normalizedUsername:normalized},include:includeRole});
  if(!user && normalized.includes("@")) {
    const matches=await prisma.user.findMany({where:{deletedAt:null,status:"ACTIVE",normalizedEmail:normalized,role:{code:{not:"STUDENT"}}},include:includeRole,take:2});
    if(matches.length===1) user=matches[0];
  }
  if(!user || user.role.code==="STUDENT")return null;
  if(!emailEnabled && env.NODE_ENV==="production")throw error(503,"Password reset email is not configured","EMAIL_DISABLED");
  if(emailEnabled){
    await sendPasswordLink(user,"reset");
    return null;
  }
  const token=randomToken();
  await prisma.passwordResetToken.create({data:{userId:user.id,tokenHash:hashToken(token),expiresAt:new Date(Date.now()+3600000)}});
  return token;
}
export async function resetPassword(token:string,password:string){validatePassword(password);const item=await prisma.passwordResetToken.findUnique({where:{tokenHash:hashToken(token)},include:{user:{include:includeRole}}});if(!item||item.usedAt||item.expiresAt<=new Date()||item.user.role.code==="STUDENT")throw error(422,"Reset token is invalid or expired","INVALID_RESET_TOKEN");await prisma.$transaction([prisma.passwordResetToken.update({where:{id:item.id},data:{usedAt:new Date()}}),prisma.user.update({where:{id:item.userId},data:{passwordHash:await hashPassword(password),mustChangePassword:false}})]);await revokeSessions(item.userId);}
export const passwordPolicy = {
  minLength: 6,
  description: "Password must be at least 6 characters and include one uppercase letter and one number."
} as const;

export function getPasswordPolicyErrors(value: string) {
  const errors: string[] = [];

  if (value.length < passwordPolicy.minLength) {
    errors.push(`Password must be at least ${passwordPolicy.minLength} characters`);
  }
  if (!/[A-Z]/.test(value)) {
    errors.push("Password must include at least one uppercase letter");
  }
  if (!/\d/.test(value)) {
    errors.push("Password must include at least one number");
  }

  return errors;
}

export function validatePassword(value:string){
  const errors = getPasswordPolicyErrors(value);
  if(errors.length)throw error(422,"Validation failed","VALIDATION_ERROR",{password:errors});
}
export { effectivePermissions };
