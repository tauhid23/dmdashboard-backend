export type ClassScheduleStatus = "CONFIRMED" | "CANCELLED";

export type ClassAttendanceStatus =
  | "UNRECORDED"
  | "PRESENT"
  | "ABSENT_NO_MAKEUP_CREDIT"
  | "ABSENT_ISSUE_MAKEUP_CREDIT"
  | "ABSENT_NOTICE_GIVEN"
  | "TUTOR_CANCELLED_ISSUE_MAKEUP_CREDIT";

export type CreateClassScheduleEventInput = {
  teacherId?: string | null;
  attendeeIds?: string[] | null;
  studentId?: string | null;
  category?: string | null;
  date?: string | null;
  start?: string | null;
  duration?: number | string | null;
  makeupCredit?: boolean | string | null;
  recurring?: boolean | string | null;
  repeatDays?: number[] | string | null;
  repeatIndefinitely?: boolean | string | null;
  endDate?: string | null;
  note?: string | null;
  ignoreConflicts?: boolean | string | null;
};

export type UpdateClassScheduleEventInput = Partial<{
  teacherId: string | null;
  studentId: string | null;
  category: string | null;
  date: string | null;
  start: string | null;
  duration: number | string | null;
  status: ClassScheduleStatus | string | null;
  attendanceStatus: ClassAttendanceStatus | string | null;
  makeupCredit: boolean | string | null;
  note: string | null;
}>;

export type ClassScheduleFilters = {
  teacherId?: string;
  studentId?: string;
  studentIds?: string | string[];
  startDate?: string;
  endDate?: string;
  status?: string;
};
