import type { Request, Response } from "express";
import type { AuthRequest } from "./auth.types.js";
import { prisma } from "../config/prisma.js";
import { uploadImageBuffer } from "../config/cloudinary.js";
import { assertPrivilegedAccess, getRequestScope } from "./accessScope.js";
import { registrationOptions, registerStudent, validateRegistration } from "./registration.service.js";
import { convertRegistrationSchedule } from "./registrationSchedule.js";
export const schedulePreview = (req: Request, res: Response) => res.json(convertRegistrationSchedule(req.body));

export const options = (_req: Request, res: Response) => res.json(registrationOptions);
export const register = async (req: Request, res: Response) => {
  let input: unknown = req.body;
  if (req.is("multipart/form-data")) {
    try {
      if (typeof req.body.registration !== "string" || req.body.registration.length > 16_000) throw new Error("Invalid registration payload");
      input = JSON.parse(req.body.registration);
    } catch {
      throw Object.assign(new Error("Enter valid registration details."), { statusCode: 422, code: "VALIDATION_ERROR" });
    }
  }
  const validated = validateRegistration(input);
  if (req.file && await prisma.user.findUnique({ where: { normalizedUsername: validated.username }, select: { id: true } })) {
    throw Object.assign(new Error("Username is already in use. Choose another username."), { statusCode: 409, code: "DUPLICATE_USER" });
  }
  const imageUrl = req.file ? (await uploadImageBuffer(req.file, "dmdashboard/students")).secure_url : undefined;
  const result = await registerStudent(input, imageUrl);
  res.status(201).json({ ...result, message: "Registration received. Sign in to check your approval status." });
};
export const enrollment = async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.id }, select: { student: { select: {
    id: true, name: true, status: true, country: true, classDurationMinutes: true, classStartTime: true,
    classDays: true, billingCycle: true, billingAmountBdt: true, packageCode: true, scheduleConfirmed: true,
    preferredTimeZone: true, preferredLocalTime: true, preferredLocalDays: true, preferredStartDate: true,
    teacher: { select: { name: true } },
  } } } });
  res.json({ student: user?.student ?? null });
};
export const registrations = async (req: AuthRequest, res: Response) => {
  assertPrivilegedAccess(await getRequestScope(req.auth?.id));
  const where = { status: "NEW_SIGN_UP" as const };
  const [count, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({ where, select: { id: true, name: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  res.json({ count, students });
};
