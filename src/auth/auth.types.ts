import type { Request } from "express";

export const RESOURCES = ["dashboard", "students", "teachers", "class-reports", "exams", "results", "user-management", "settings"] as const;
export const ACTIONS = ["view", "add", "edit", "delete"] as const;
export type Resource = typeof RESOURCES[number];
export type Action = typeof ACTIONS[number];
export type PermissionMap = Record<Resource, Record<Action, boolean>>;
export type AuthUser = { id: string; sessionVersion: number };
export type AuthRequest = Request & { auth?: AuthUser };

