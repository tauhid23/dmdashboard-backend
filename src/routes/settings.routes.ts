import { Router } from "express";
import * as controller from "../controllers/settings.controller.js";
import { authenticate, requirePermission } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate);
router.get("/", requirePermission("settings", "view"), asyncHandler(controller.getSettings));
router.patch("/", requirePermission("settings", "edit"), asyncHandler(controller.updateSettings));
router.get("/mail-status", requirePermission("settings", "edit"), asyncHandler(controller.getMailStatus));
router.post("/mail-verify", requirePermission("settings", "edit"), asyncHandler(controller.verifyMail));

export default router;
