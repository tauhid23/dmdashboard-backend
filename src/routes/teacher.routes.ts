import { Router } from "express";

import * as teacherController from "../controllers/teacher.controller.js";
import { imageFieldsUpload } from "../middlewares/imageUpload.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticate, requirePermission } from "../middlewares/auth.js";

const router = Router();
router.use(authenticate, requirePermission("teachers","view"));

router.post("/", requirePermission("teachers","add"), imageFieldsUpload, asyncHandler(teacherController.createTeacher));
router.get("/", asyncHandler(teacherController.getTeachers));
router.get("/options", asyncHandler(teacherController.getTeacherOptions));
router.get(
  "/:id/class-report-average",
  asyncHandler(teacherController.getTeacherClassReportAverage)
);
router.get("/:id", asyncHandler(teacherController.getTeacherById));
router.patch("/:id", requirePermission("teachers","edit"), imageFieldsUpload, asyncHandler(teacherController.updateTeacher));
router.delete("/:id", requirePermission("teachers","delete"), asyncHandler(teacherController.deleteTeacher));

export default router;
