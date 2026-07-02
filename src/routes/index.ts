import { Router } from "express";

import classReportRoutes from "./classReport.routes.js";
import healthRoutes from "./health.routes.js";
import studentRoutes from "./student.routes.js";
import teacherRoutes from "./teacher.routes.js";
import userRoutes from "./user.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/class-reports", classReportRoutes);
router.use("/students", studentRoutes);
router.use("/teachers", teacherRoutes);
router.use("/users", userRoutes);

export default router;
