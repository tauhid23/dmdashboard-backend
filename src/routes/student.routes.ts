import { Router } from "express";

import * as studentController from "../controllers/student.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/", asyncHandler(studentController.createStudent));
router.get("/", asyncHandler(studentController.getStudents));
router.get("/options", asyncHandler(studentController.getStudentOptions));
router.get("/:id", asyncHandler(studentController.getStudentById));
router.patch("/:id", asyncHandler(studentController.updateStudent));
router.delete("/:id", asyncHandler(studentController.deleteStudent));

export default router;
