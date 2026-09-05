import {Router} from "express";
import * as controller from "./auth.controller.js";
import {authenticate} from "../middlewares/auth.js";
import {asyncHandler} from "../utils/asyncHandler.js";
const router=Router();
router.post("/login",asyncHandler(controller.login));router.post("/logout",asyncHandler(controller.logout));router.post("/refresh",asyncHandler(controller.refresh));router.get("/me",authenticate,asyncHandler(controller.me));router.patch("/me",authenticate,asyncHandler(controller.updateProfile));router.post("/change-password",authenticate,asyncHandler(controller.changePassword));router.post("/forgot-password",asyncHandler(controller.forgotPassword));router.post("/reset-password",asyncHandler(controller.resetPassword));
export default router;
