import { Router } from "express";
import * as controller from "../controllers/settings.controller.js";
import { authenticate, requirePermission } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);
router.get("/", requirePermission("settings", "view"), asyncHandler(controller.getSettings));
router.patch("/", requirePermission("settings", "edit"), asyncHandler(controller.updateSettings));

export default router;
