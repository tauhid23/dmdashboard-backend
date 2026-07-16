import { CourseLevel } from "../generated/prisma/enums.js";

export const COURSE_ORDER = Object.values(CourseLevel);
export const nextCourseLevel = (level: CourseLevel) => COURSE_ORDER[COURSE_ORDER.indexOf(level) + 1] ?? null;
export const courseDisplay = (level: CourseLevel) => {
  const [course, , stage] = level.split("_");
  const courseName = course === "NAZIRAH" ? "Nazirah" : course[0] + course.slice(1).toLowerCase();
  return { courseName, courseStage: `Stage ${stage}`, courseDisplayName: `${courseName} Stage ${stage}` };
};
