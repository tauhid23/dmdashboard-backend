import { Router } from "express";
import * as controller from "../controllers/settings.controller.js";
import { authenticate, requirePermission } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { registrationImageUpload } from "../middlewares/imageUpload.js";

const router = Router();

router.get("/login-appearance", asyncHandler(controller.getPublicLoginAppearance));
router.get("/login-background", asyncHandler(controller.getLoginBackgroundImage));
router.use(authenticate);
router.post("/login-background", requirePermission("settings", "edit"), registrationImageUpload, asyncHandler(controller.uploadLoginBackgroundImage));
router.delete("/login-background", requirePermission("settings", "edit"), asyncHandler(controller.resetLoginBackgroundImage));
router.get("/", requirePermission("settings", "view"), asyncHandler(controller.getSettings));
router.patch("/", requirePermission("settings", "edit"), asyncHandler(controller.updateSettings));
router.get("/mail-status", requirePermission("settings", "edit"), asyncHandler(controller.getMailStatus));
router.post("/mail-verify", requirePermission("settings", "edit"), asyncHandler(controller.verifyMail));

export default router;
