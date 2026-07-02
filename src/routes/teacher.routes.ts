import { Router } from "express";

import * as teacherController from "../controllers/teacher.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/", asyncHandler(teacherController.createTeacher));
router.get("/", asyncHandler(teacherController.getTeachers));
router.get("/options", asyncHandler(teacherController.getTeacherOptions));
router.get(
  "/:id/class-report-average",
  asyncHandler(teacherController.getTeacherClassReportAverage)
);
router.get("/:id", asyncHandler(teacherController.getTeacherById));
router.patch("/:id", asyncHandler(teacherController.updateTeacher));
router.delete("/:id", asyncHandler(teacherController.deleteTeacher));

export default router;
