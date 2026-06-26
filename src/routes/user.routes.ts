import { Router } from "express";

import * as userController from "../controllers/user.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/", asyncHandler(userController.createUser));
router.get("/", asyncHandler(userController.getUsers));

export default router;
