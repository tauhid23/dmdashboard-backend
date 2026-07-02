import { Router } from "express";

import * as classReportController from "../controllers/classReport.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/", asyncHandler(classReportController.createClassReport));
router.get("/", asyncHandler(classReportController.getClassReports));
router.get("/student", asyncHandler(classReportController.getStudentClassReports));
router.get("/teacher", asyncHandler(classReportController.getTeacherClassReports));
router.get("/full", asyncHandler(classReportController.getFullClassReports));
router.get(
  "/teacher/:teacherId/average",
  asyncHandler(classReportController.getTeacherClassReportAverage)
);
router.get("/:id", asyncHandler(classReportController.getClassReportById));
router.patch("/:id", asyncHandler(classReportController.updateClassReport));
router.delete("/:id", asyncHandler(classReportController.deleteClassReport));

export default router;
