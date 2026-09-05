import { prisma } from "../config/prisma.js";
import type { AppSettings } from "../types/settings.types.js";

const SETTINGS_KEY = "workspace";

const error = (statusCode: number, message: string, code: string, errors?: unknown) =>
  Object.assign(new Error(message), { statusCode, code, errors });

export const defaultSettings: AppSettings = {
  workspace: {
    madrasaName: "Deeni Madrasa",
    legalName: "Deeni Madrasa",
    primaryEmail: "admin@admin.com",
    supportEmail: "support@admin.com",
    phone: "",
    website: "",
    address: "",
    timezone: "Asia/Dhaka",
    academicYearStartMonth: 1,
  },
  operations: {
    currency: "BDT",
    defaultClassDurationMinutes: 60,
    defaultPayrollRateBdt: 300,
    attendanceGraceMinutes: 10,
    autoMarkScheduleCompleted: false,
    showInactivePeopleByDefault: false,
  },
  security: {
    minimumPasswordLength: 6,
    requireStrongPasswords: true,
    requirePasswordChangeForNewUsers: true,
    sessionTimeoutMinutes: 15,
    allowPasswordReset: true,
  },
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getSettingsDelegate = () => (prisma as any).appSetting;

const isMissingSettingsStore = (cause: unknown) => {
  if (!isObject(cause)) return false;
  const message = typeof cause.message === "string" ? cause.message : "";
  return (
    cause.code === "P2021" ||
    cause.code === "P2022" ||
    message.includes("appSetting") ||
    message.includes("AppSetting") ||
    message.includes("does not exist")
  );
};

const text = (value: unknown, fallback: string, maxLength = 160) => {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength);
};

const integer = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const bool = (value: unknown, fallback: boolean) =>
  typeof value === "boolean" ? value : fallback;

const email = (value: unknown, fallback: string) => {
  const next = text(value, fallback, 254);
  if (!next) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
    throw error(422, "Validation failed", "VALIDATION_ERROR", {
      email: ["Enter a valid email address"],
    });
  }
  return next;
};

const url = (value: unknown, fallback: string) => {
  const next = text(value, fallback, 220);
  if (!next) return "";
  try {
    const parsed = new URL(next);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid protocol");
    return parsed.toString();
  } catch {
    throw error(422, "Validation failed", "VALIDATION_ERROR", {
      website: ["Enter a valid website URL"],
    });
  }
};

export const normalizeSettings = (value: unknown): AppSettings => {
  const input = isObject(value) ? value : {};
  const workspace = isObject(input.workspace) ? input.workspace : {};
  const operations = isObject(input.operations) ? input.operations : {};
  const security = isObject(input.security) ? input.security : {};

  return {
    workspace: {
      madrasaName: text(workspace.madrasaName, defaultSettings.workspace.madrasaName, 120),
      legalName: text(workspace.legalName, defaultSettings.workspace.legalName, 160),
      primaryEmail: email(workspace.primaryEmail, defaultSettings.workspace.primaryEmail),
      supportEmail: email(workspace.supportEmail, defaultSettings.workspace.supportEmail),
      phone: text(workspace.phone, defaultSettings.workspace.phone, 40),
      website: url(workspace.website, defaultSettings.workspace.website),
      address: text(workspace.address, defaultSettings.workspace.address, 300),
      timezone: text(workspace.timezone, defaultSettings.workspace.timezone, 80),
      academicYearStartMonth: integer(
        workspace.academicYearStartMonth,
        defaultSettings.workspace.academicYearStartMonth,
        1,
        12
      ),
    },
    operations: {
      currency: text(operations.currency, defaultSettings.operations.currency, 3).toUpperCase(),
      defaultClassDurationMinutes: integer(
        operations.defaultClassDurationMinutes,
        defaultSettings.operations.defaultClassDurationMinutes,
        15,
        240
      ),
      defaultPayrollRateBdt: integer(
        operations.defaultPayrollRateBdt,
        defaultSettings.operations.defaultPayrollRateBdt,
        0,
        100000
      ),
      attendanceGraceMinutes: integer(
        operations.attendanceGraceMinutes,
        defaultSettings.operations.attendanceGraceMinutes,
        0,
        60
      ),
      autoMarkScheduleCompleted: bool(
        operations.autoMarkScheduleCompleted,
        defaultSettings.operations.autoMarkScheduleCompleted
      ),
      showInactivePeopleByDefault: bool(
        operations.showInactivePeopleByDefault,
        defaultSettings.operations.showInactivePeopleByDefault
      ),
    },
    security: {
      minimumPasswordLength: integer(
        security.minimumPasswordLength,
        defaultSettings.security.minimumPasswordLength,
        6,
        32
      ),
      requireStrongPasswords: bool(
        security.requireStrongPasswords,
        defaultSettings.security.requireStrongPasswords
      ),
      requirePasswordChangeForNewUsers: bool(
        security.requirePasswordChangeForNewUsers,
        defaultSettings.security.requirePasswordChangeForNewUsers
      ),
      sessionTimeoutMinutes: integer(
        security.sessionTimeoutMinutes,
        defaultSettings.security.sessionTimeoutMinutes,
        5,
        240
      ),
      allowPasswordReset: bool(security.allowPasswordReset, defaultSettings.security.allowPasswordReset),
    },
  };
};

export async function getSettings() {
  const delegate = getSettingsDelegate();
  if (!delegate) return defaultSettings;

  try {
    const row = await delegate.findUnique({ where: { key: SETTINGS_KEY } });
    return normalizeSettings(row?.value ?? defaultSettings);
  } catch (cause) {
    if (isMissingSettingsStore(cause)) return defaultSettings;
    throw cause;
  }
}

export async function updateSettings(actorId: string, payload: unknown) {
  const delegate = getSettingsDelegate();
  if (!delegate) {
    throw error(
      503,
      "The database is not up to date. Please run the latest database migration, then try again.",
      "DATABASE_MIGRATION_REQUIRED"
    );
  }

  const current = await getSettings();
  const merged = normalizeSettings({
    workspace: { ...current.workspace, ...(isObject(payload) && isObject(payload.workspace) ? payload.workspace : {}) },
    operations: { ...current.operations, ...(isObject(payload) && isObject(payload.operations) ? payload.operations : {}) },
    security: { ...current.security, ...(isObject(payload) && isObject(payload.security) ? payload.security : {}) },
  });

  try {
    await delegate.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, value: merged, updatedBy: actorId },
      update: { value: merged, updatedBy: actorId },
    });
  } catch (cause) {
    if (isMissingSettingsStore(cause)) {
      throw error(
        503,
        "The database is not up to date. Please run the latest database migration, then try again.",
        "DATABASE_MIGRATION_REQUIRED"
      );
    }
    throw cause;
  }

  return merged;
}
