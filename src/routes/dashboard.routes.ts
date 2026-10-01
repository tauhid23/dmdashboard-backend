import { Router } from "express";
import { authenticate, requirePermission } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthRequest } from "../auth/auth.types.js";
import { getDashboard } from "../services/dashboard.service.js";

const router = Router();
router.get("/", authenticate, requirePermission("dashboard", "view"), asyncHandler(async (req, res) => {
  res.json(await getDashboard((req as AuthRequest).auth!.id));
}));
export default router;
