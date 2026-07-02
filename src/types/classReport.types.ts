export type ReportType = "student" | "teacher" | "full";

export type ClassReportFilters = {
  reportType?: ReportType;
  studentId?: string;
  teacherId?: string;
  month?: string;
};

export type StudentClassReportInput = {
  webcamOn?: boolean | null;
  webcamPosition?: string | null;
  webcamQuality?: string | null;
  noiseFree?: string | null;
  studentDevice?: string | null;
  studentDressup?: string | null;
  attentionFocus?: string | null;
  activityInClass?: string | null;
  lessonUnderstanding?: string | null;
  languageUnderstanding?: string | null;
  teacherNote?: string | null;
};

export type TeacherClassReportInput = {
  webcamOn?: boolean | null;
  webcamPosition?: string | null;
  webcamQuality?: string | null;
  recommendedHeadphone?: string | null;
  noiseFree?: string | null;
  tutorDevice?: string | null;
  tutorDressup?: string | null;
  teachingFocus?: string | null;
  teachingTone?: string | null;
  toolsAndContentUse?: string | null;
  studentInteraction?: string | null;
  correctionQuality?: string | null;
  adminNote?: string | null;
};

export type CreateClassReportInput = {
  month?: string | null;
  studentId?: string | null;
  teacherId?: string | null;
  studentName?: string | null;
  teacherName?: string | null;
  studentReport?: StudentClassReportInput;
  teacherReport?: TeacherClassReportInput;
  studentWebcamOn?: boolean | null;
  studentWebcamPosition?: string | null;
  studentWebcamQuality?: string | null;
  studentNoiseFree?: string | null;
  studentDevice?: string | null;
  studentDressup?: string | null;
  attentionFocus?: string | null;
  activityInClass?: string | null;
  lessonUnderstanding?: string | null;
  languageUnderstanding?: string | null;
  teacherNote?: string | null;
  teacherWebcamOn?: boolean | null;
  teacherWebcamPosition?: string | null;
  teacherWebcamQuality?: string | null;
  recommendedHeadphone?: string | null;
  teacherNoiseFree?: string | null;
  tutorDevice?: string | null;
  tutorDressup?: string | null;
  teachingFocus?: string | null;
  teachingTone?: string | null;
  toolsAndContentUse?: string | null;
  studentInteraction?: string | null;
  correctionQuality?: string | null;
  adminNote?: string | null;
};

export type UpdateClassReportInput = Partial<CreateClassReportInput>;
