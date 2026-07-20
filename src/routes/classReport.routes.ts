import { Router } from "express";

import * as classReportController from "../controllers/classReport.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authenticate, requirePermission } from "../middlewares/auth.js";

const router = Router();
router.use(authenticate, requirePermission("class-reports","view"));

router.post("/", requirePermission("class-reports","add"), asyncHandler(classReportController.createClassReport));
router.get("/", asyncHandler(classReportController.getClassReports));
router.get("/student", asyncHandler(classReportController.getStudentClassReports));
router.get("/teacher", asyncHandler(classReportController.getTeacherClassReports));
router.get("/full", asyncHandler(classReportController.getFullClassReports));
router.get(
  "/teacher/:teacherId/average",
  asyncHandler(classReportController.getTeacherClassReportAverage)
);
router.get("/:id", asyncHandler(classReportController.getClassReportById));
router.patch("/:id", requirePermission("class-reports","edit"), asyncHandler(classReportController.updateClassReport));
router.delete("/:id", requirePermission("class-reports","delete"), asyncHandler(classReportController.deleteClassReport));

export default router;
