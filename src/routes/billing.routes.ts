import { Router } from "express";
import * as controller from "../controllers/billing.controller.js";
import { authenticate, requirePermission } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.use(authenticate, requirePermission("students", "view"));
router.get("/families", asyncHandler(controller.listFamilies));
router.get("/families/:familyId", asyncHandler(controller.getFamily));
router.post("/families/:familyId/transactions", requirePermission("students", "edit"), asyncHandler(controller.createTransaction));
router.patch("/families/:familyId/transactions/:transactionId", requirePermission("students", "edit"), asyncHandler(controller.updateTransaction));
router.post("/families/:familyId/invoices", requirePermission("students", "edit"), asyncHandler(controller.createInvoice));
export default router;
