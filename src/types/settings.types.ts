export type WorkspaceSettings = {
  madrasaName: string;
  legalName: string;
  primaryEmail: string;
  supportEmail: string;
  phone: string;
  website: string;
  address: string;
  timezone: string;
  academicYearStartMonth: number;
};

export type OperationsSettings = {
  currency: string;
  defaultClassDurationMinutes: number;
  defaultPayrollRateBdt: number;
  attendanceGraceMinutes: number;
  autoMarkScheduleCompleted: boolean;
  showInactivePeopleByDefault: boolean;
};

export type SecuritySettings = {
  minimumPasswordLength: number;
  requireStrongPasswords: boolean;
  requirePasswordChangeForNewUsers: boolean;
  sessionTimeoutMinutes: number;
  allowPasswordReset: boolean;
};

export type AppSettings = {
  workspace: WorkspaceSettings;
  operations: OperationsSettings;
  security: SecuritySettings;
};
