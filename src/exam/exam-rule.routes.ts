import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as controller from "./exam.controller.js";
const router=Router();
router.get("/",asyncHandler(controller.rules));
router.get("/:courseLevel",asyncHandler(controller.rule));
export default router;
