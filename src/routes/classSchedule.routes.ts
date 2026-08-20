import { Router } from "express";
import * as controller from "../controllers/classSchedule.controller.js";
import { authenticate, requirePermission } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(authenticate, requirePermission("class-reports", "view"));
router.get("/", asyncHandler(controller.listEvents));
router.post("/", requirePermission("class-reports", "add"), asyncHandler(controller.createEvents));
router.patch("/:id", requirePermission("class-reports", "edit"), asyncHandler(controller.updateEvent));
router.delete("/:id", requirePermission("class-reports", "delete"), asyncHandler(controller.deleteEvent));

export default router;
