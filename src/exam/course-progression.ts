import { CourseLevel } from "../generated/prisma/enums.js";

export const COURSE_ORDER: CourseLevel[] = [
  CourseLevel.MAKTAB_STAGE_1,
  CourseLevel.MAKTAB_STAGE_2,
  CourseLevel.MAKTAB_STAGE_3,
  CourseLevel.NAZIRAH_STAGE_1,
  CourseLevel.NAZIRAH_STAGE_2,
  CourseLevel.NAZIRAH_STAGE_3,
  CourseLevel.NAZIRAH_STAGE_4,
  CourseLevel.HIFZ_STAGE_1,
  CourseLevel.HIFZ_STAGE_2,
  CourseLevel.HIFZ_STAGE_3,
  CourseLevel.HIFZ_STAGE_4
];

export const FIRST_COURSE_LEVEL = CourseLevel.MAKTAB_STAGE_1;
export const nextCourseLevel = (level: CourseLevel) => COURSE_ORDER[COURSE_ORDER.indexOf(level) + 1] ?? null;
export const courseDisplay = (level: CourseLevel) => {
  const [course, , stage] = level.split("_");
  const courseName = course === "NAZIRAH" ? "Nazirah" : course[0] + course.slice(1).toLowerCase();
  return { courseName, courseStage: `Stage ${stage}`, courseDisplayName: `${courseName} Stage ${stage}` };
};

const normalizeCoursePart = (value?: string | null) =>
  value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";

const COURSE_FAMILY_BY_NAME: Record<string, "MAKTAB" | "NAZIRAH" | "HIFZ"> = {
  afterschoolmaktab: "MAKTAB",
  afterschoolmakhtab: "MAKTAB",
  maktab: "MAKTAB",
  makhtab: "MAKTAB",
  nazirah: "NAZIRAH",
  nazira: "NAZIRAH",
  hifz: "HIFZ"
};

export const courseLevelFromDisplay = (
  courseName?: string | null,
  courseStage?: string | null
) => {
  const family = COURSE_FAMILY_BY_NAME[normalizeCoursePart(courseName)];
  const stage = courseStage?.match(/\d+/)?.[0];
  if (!family || !stage) return null;

  const level = `${family}_STAGE_${stage}` as CourseLevel;
  return COURSE_ORDER.includes(level) ? level : null;
};
