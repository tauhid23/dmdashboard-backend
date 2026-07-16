import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as controller from "./exam.controller.js";
const router=Router();
router.post("/",asyncHandler(controller.submit));
router.get("/",asyncHandler(controller.list));
router.get("/:id",asyncHandler(controller.get));
export default router;
