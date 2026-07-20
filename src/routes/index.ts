import { Router } from "express";

import classReportRoutes from "./classReport.routes.js";
import healthRoutes from "./health.routes.js";
import studentRoutes from "./student.routes.js";
import teacherRoutes from "./teacher.routes.js";
import userRoutes from "./user.routes.js";
import examRoutes from "../exam/exam.routes.js";
import examRuleRoutes from "../exam/exam-rule.routes.js";
import authRoutes from "../auth/auth.routes.js";
import { permissionRoutes, roleRoutes } from "./rbac.routes.js";

const router = Router();
router.use("/auth", authRoutes);
router.use("/roles", roleRoutes);
router.use("/permissions", permissionRoutes);

router.use("/health", healthRoutes);
router.use("/class-reports", classReportRoutes);
router.use("/students", studentRoutes);
router.use("/teachers", teacherRoutes);
router.use("/users", userRoutes);
router.use("/exam-attempts", examRoutes);
router.use("/exam-rules", examRuleRoutes);

export default router;
