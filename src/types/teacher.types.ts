export type TeacherStatusInput = "ACTIVE" | "INACTIVE";

export type StudentLeftLogInput = {
  studentName?: string | null;
  leavingReason?: string | null;
};

export type CreateTeacherInput = {
  name?: string | null;
  imageUrl?: string | null;
  joiningDate?: string | null;
  status?: TeacherStatusInput | "" | null;
  strongArea?: string | null;
  totalStudentsAssignedLifetime?: number | string | null;
  currentActiveStudents?: number | string | null;
  studentLeftLifetime?: number | string | null;
  studentLeftDetails?: StudentLeftLogInput[];
  studentLeftLogs?: StudentLeftLogInput[];
};

export type UpdateTeacherInput = Partial<CreateTeacherInput>;
