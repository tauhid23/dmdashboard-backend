export type StudentCourseInput = {
  courseInformation?: string | null;
  courseStage?: string | null;
};

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
  weeklySchedule?: string | null;
  parentName?: string | null;
  parentEmail?: string | null;
  parentPhone?: string | null;
  course?: StudentCourseInput;
  courses?: StudentCourseInput[];
  groupClassSchedule?: string | null;
  groupTeacher?: string | null;
  subject?: string | null;
  teacherChanges?: TeacherChangeInput[];
};

export type UpdateStudentInput = Partial<CreateStudentInput>;
