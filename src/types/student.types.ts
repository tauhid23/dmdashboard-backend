export type StudentCourseInput = {
  courseInformation?: string | null;
  courseStage?: string | null;
};

export type StudentId = string;

export type StudentStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "TRIAL"
  | "NEW_SIGN_UP"
  | "Active"
  | "Inactive"
  | "Trial"
  | "New Sign-up";

export type TeacherChangeInput = {
  previousTeacherName?: string | null;
  newTeacherName?: string | null;
  changingReason?: string | null;
  changedAt?: string;
};

export type CreateStudentInput = {
  image?: string | null;
  name?: string | null;
  country?: string | null;
  studentSince?: string | null;
  weeklySchedule?: number | string | null;
  parentName?: string | null;
  parentEmail?: string | null;
  parentPhone?: string | null;
  courseName?: string | null;
  courseStage?: string | null;
  course?: StudentCourseInput;
  courses?: StudentCourseInput[];
  teacherId?: StudentId | null;
  teacherName?: string | null;
  groupClass?: boolean;
  groupSchedule?: string | null;
  groupClassSchedule?: string | null;
  groupTeacher?: string | null;
  groupSubject?: string | null;
  subject?: string | null;
  teacherChanged?: boolean;
  previousTeacherName?: string | null;
  teacherChangeReason?: string | null;
  status?: StudentStatus | "" | null;
  teacherChanges?: TeacherChangeInput[];
};

export type UpdateStudentInput = Partial<CreateStudentInput>;

export type StudentFilters = {
  teacherId?: string;
  teacherName?: string;
};
