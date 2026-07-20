import type {Response} from "express";import type {AuthRequest} from "../auth/auth.types.js";import * as service from "../services/user.service.js";
export async function createUser(req:AuthRequest,res:Response){res.status(201).json(await service.createUser(req.body));}
export async function getUsers(req:AuthRequest,res:Response){res.json(await service.getUsers(req.query));}
export async function getUser(req:AuthRequest,res:Response){res.json(await service.getUser(String(req.params.id)));}
export async function updateUser(req:AuthRequest,res:Response){res.json(await service.updateUser(req.auth!.id,String(req.params.id),req.body));}
export async function deleteUser(req:AuthRequest,res:Response){await service.deleteUser(req.auth!.id,String(req.params.id));res.status(204).send();}
export async function resetPassword(req:AuthRequest,res:Response){await service.adminResetPassword(req.auth!.id,String(req.params.id),req.body.temporaryPassword);res.json({message:"Temporary password set; existing sessions revoked."});}
export async function getRoles(_req:AuthRequest,res:Response){res.json({data:await service.getRoles()});}export async function getPermissions(_req:AuthRequest,res:Response){res.json({data:await service.getPermissions()});}export async function updateRolePermissions(req:AuthRequest,res:Response){res.json({data:await service.updateRolePermissions(String(req.params.id),req.body.permissions??{})});}
