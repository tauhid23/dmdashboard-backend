import { Router } from "express";
import { authenticate, requirePermission } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as controller from "./exam-schedule.controller.js";

const router = Router();

router.use(authenticate, requirePermission("exams", "view"));
router.get("/", asyncHandler(controller.list));
router.post("/", requirePermission("exams", "add"), asyncHandler(controller.create));

export default router;
