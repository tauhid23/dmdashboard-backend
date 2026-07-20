import type { Request,Response } from "express";
import type { AuthRequest } from "./auth.types.js";
import * as service from "./auth.service.js";
import { readCookies, signAccessToken } from "./security.js";
import { env } from "../config/env.js";

const cookieBase={httpOnly:true,secure:env.NODE_ENV==="production",sameSite:(env.NODE_ENV==="production"?"none":"lax") as "none"|"lax",path:"/"};
const setCookies=(res:Response,userId:string,version:number,refreshToken:string)=>{res.cookie("access_token",signAccessToken({sub:userId,ver:version}),{...cookieBase,maxAge:15*60*1000});res.cookie("refresh_token",refreshToken,{...cookieBase,maxAge:30*86400000});};
export async function login(req:Request,res:Response){const {identifier,password}=req.body;if(typeof identifier!=="string"||typeof password!=="string")throw Object.assign(new Error("Validation failed"),{statusCode:422,code:"VALIDATION_ERROR"});const result=await service.login(identifier,password,{ip:req.ip,userAgent:req.get("user-agent")});setCookies(res,result.user.id,result.version,result.refreshToken);res.json({user:result.user});}
export async function refresh(req:Request,res:Response){const token=readCookies(req.headers.cookie).refresh_token;if(!token)throw Object.assign(new Error("Refresh token required"),{statusCode:401,code:"UNAUTHENTICATED"});const result=await service.refresh(token);setCookies(res,result.user.id,result.version,result.refreshToken);res.json({user:result.user});}
export async function logout(req:Request,res:Response){await service.logout(readCookies(req.headers.cookie).refresh_token);res.clearCookie("access_token",cookieBase);res.clearCookie("refresh_token",cookieBase);res.status(204).send();}
export async function me(req:AuthRequest,res:Response){res.json({user:await service.me(req.auth!.id)});}
export async function changePassword(req:AuthRequest,res:Response){await service.changePassword(req.auth!.id,req.body.currentPassword,req.body.newPassword);res.clearCookie("access_token",cookieBase);res.clearCookie("refresh_token",cookieBase);res.json({message:"Password changed. Please log in again."});}
export async function forgotPassword(req:Request,res:Response){const resetToken=await service.forgotPassword(String(req.body.identifier??""));res.json({message:"If the account exists, reset instructions have been issued.",...(resetToken?{resetToken}: {})});}
export async function resetPassword(req:Request,res:Response){await service.resetPassword(String(req.body.token??""),String(req.body.password??""));res.json({message:"Password reset successful. Please log in."});}

