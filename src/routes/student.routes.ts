import { Router } from "express";

import * as studentController from "../controllers/student.controller.js";
import { imageFieldsUpload } from "../middlewares/imageUpload.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as examController from "../exam/exam.controller.js";
import * as examScheduleController from "../exam/exam-schedule.controller.js";
import { authenticate, requirePermission } from "../middlewares/auth.js";

const router = Router();
router.use(authenticate, requirePermission("students","view"));

router.post("/", requirePermission("students","add"), imageFieldsUpload, asyncHandler(studentController.createStudent));
router.get("/", asyncHandler(studentController.getStudents));
router.get("/options", asyncHandler(studentController.getStudentOptions));
router.get("/:studentId/course-exam-results", asyncHandler(examController.studentCourseResults));
router.get("/:studentId/exam-schedules", asyncHandler(examScheduleController.listForStudent));
router.get("/:studentId/exam-attempts/latest", asyncHandler(examController.studentLatest));
router.get("/:studentId/exam-attempts", asyncHandler(examController.studentHistory));
router.get("/:id", asyncHandler(studentController.getStudentById));
router.patch("/:id", requirePermission("students","edit"), imageFieldsUpload, asyncHandler(studentController.updateStudent));
router.delete("/:id", requirePermission("students","delete"), asyncHandler(studentController.deleteStudent));

export default router;
