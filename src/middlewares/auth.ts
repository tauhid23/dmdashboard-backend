import type { NextFunction, Response } from "express";
import { prisma } from "../config/prisma.js";
import { effectivePermissions } from "../auth/permissions.js";
import { readCookies, verifyAccessToken } from "../auth/security.js";
import type { Action, AuthRequest, Resource } from "../auth/auth.types.js";

const fail = (statusCode:number, message:string, code:string) => Object.assign(new Error(message), { statusCode, code });

export async function authenticate(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const token = readCookies(req.headers.cookie).access_token;
    const payload = token && verifyAccessToken(token);
    if (!payload) throw fail(401, "Authentication required", "UNAUTHENTICATED");
    const user = await prisma.user.findUnique({ where:{id:payload.sub}, select:{id:true,status:true,deletedAt:true,sessionVersion:true} });
    if (!user || user.deletedAt || user.status !== "ACTIVE" || user.sessionVersion !== payload.ver) throw fail(401, "Session is no longer valid", "SESSION_INVALID");
    req.auth = { id:user.id, sessionVersion:user.sessionVersion };
    next();
  } catch (error) { next(error); }
}

export const requirePermission = (resource:Resource, action:Action) => async (req:AuthRequest, _res:Response, next:NextFunction) => {
  try {
    if (!req.auth) throw fail(401,"Authentication required","UNAUTHENTICATED");
    const permissions=await effectivePermissions(req.auth.id);
    if (!permissions[resource][action]) throw fail(403,"Insufficient permissions","FORBIDDEN");
    next();
  } catch(error){next(error);}
};

