export type TeacherStatusInput = "ACTIVE" | "INACTIVE";

export type StudentLeftLogInput = {
  studentName?: string | null;
  reason?: string | null;
  leavingReason?: string | null;
};

export type CreateTeacherInput = {
  name?: string | null;
  imageUrl?: string | null;
  joiningDate?: string | null;
  status?: TeacherStatusInput | "" | null;
  strongArea?: string | null;
  lifetimeStudents?: number | string | null;
  totalStudentsAssigned?: number | string | null;
  totalStudentsAssignedLifetime?: number | string | null;
  activeStudents?: number | string | null;
  currentActiveStudents?: number | string | null;
  studentsLeft?: number | string | null;
  studentLeftLifetime?: number | string | null;
  leaveRecords?: StudentLeftLogInput[];
  studentLeftDetails?: StudentLeftLogInput[];
  studentLeftLogs?: StudentLeftLogInput[];
};

export type UpdateTeacherInput = Partial<CreateTeacherInput>;

export type CreateTeacherPayrollPaymentInput = {
  months: string[];
  amountBdt: number | string;
  paymentDate: string;
  method: string;
  reference?: string | null;
  note?: string | null;
};
