import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as controller from "./exam.controller.js";
import { authenticate, requirePermission } from "../middlewares/auth.js";
const router=Router();
router.use(authenticate,requirePermission("exams","view"));
router.get("/",asyncHandler(controller.rules));
router.get("/:courseLevel",asyncHandler(controller.rule));
export default router;
