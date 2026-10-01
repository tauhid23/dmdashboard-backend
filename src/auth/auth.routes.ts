import {Router} from "express";
import * as controller from "./auth.controller.js";
import {authenticate} from "../middlewares/auth.js";
import {asyncHandler} from "../utils/asyncHandler.js";
import { rateLimit } from "express-rate-limit";
import * as registration from "./registration.controller.js";
import { requirePermission } from "../middlewares/auth.js";
import { registrationImageUpload } from "../middlewares/imageUpload.js";
const router=Router();
router.use("/login", rateLimit({ windowMs: 15 * 60_000, limit: 30, skipSuccessfulRequests: true,
  standardHeaders: "draft-8", legacyHeaders: false, message: { message: "Too many sign-in attempts. Please try again later." } }));
const signupLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false,
  message: { message: "Too many registration attempts. Please try again in an hour." } });
router.get("/registration-options", registration.options);
router.post("/registration-schedule", rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-8", legacyHeaders: false }), registration.schedulePreview);
router.post("/register", signupLimiter, registrationImageUpload, asyncHandler(registration.register));
router.get("/enrollment", authenticate, asyncHandler(registration.enrollment));
router.get("/registrations", authenticate, requirePermission("students", "view"), asyncHandler(registration.registrations));
router.post("/login",asyncHandler(controller.login));router.post("/logout",asyncHandler(controller.logout));router.post("/refresh",asyncHandler(controller.refresh));router.get("/me",authenticate,asyncHandler(controller.me));router.patch("/me",authenticate,asyncHandler(controller.updateProfile));router.post("/change-password",authenticate,asyncHandler(controller.changePassword));router.post("/forgot-password",rateLimit({windowMs:15*60_000,limit:5,standardHeaders:"draft-8",legacyHeaders:false,message:{message:"Too many reset requests. Please try again later."}}),asyncHandler(controller.forgotPassword));router.post("/reset-password",asyncHandler(controller.resetPassword));
export default router;
