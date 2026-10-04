import { prisma } from "../config/prisma.js";
import type { AppSettings } from "../types/settings.types.js";

const SETTINGS_KEY = "workspace";

const error = (statusCode: number, message: string, code: string, errors?: unknown) =>
  Object.assign(new Error(message), { statusCode, code, errors });

export const defaultSettings: AppSettings = {
  loginAppearance: { imageOpacity: 65 },
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
  invoicing: {
    pdfTemplate: "CLASSIC",
    pdfAccentColor: "#5c4938",
    pdfNotes: "Please contact Deeni Madrasa if you have any questions about this invoice.",
    emailSubject: "Invoice {{invoiceNumber}} from Deeni Madrasa",
    emailBody: "Assalamu alaikum {{familyName}},\n\nPlease find invoice {{invoiceNumber}} attached as a PDF.\n\nKindly review the attached invoice. If you have any questions, please reply to this email.\n\nJazakumullahu khairan,\nDeeni Madrasa",
  },
  notifications: { managerEmails: [] },
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getSettingsDelegate = () => prisma.appSetting;

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

const pdfTemplate = (value: unknown, fallback: AppSettings["invoicing"]["pdfTemplate"]) => {
  const next = String(value ?? "").toUpperCase();
  return (["CLASSIC", "MODERN", "MINIMAL"] as const).find((template) => template === next) ?? fallback;
};

const hexColor = (value: unknown, fallback: string) => {
  const next = typeof value === "string" ? value.trim() : "";
  return /^#[0-9a-f]{6}$/i.test(next) ? next.toLowerCase() : fallback;
};

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

const emailList = (value: unknown, fallback: string[]) => {
  if (!Array.isArray(value)) return fallback;
  const entries = [...new Set(value.map((item) => String(item).trim().toLowerCase()).filter(Boolean))];
  if (entries.length > 20 || entries.some((item) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item))) {
    throw error(422, "Validation failed", "VALIDATION_ERROR", {
      managerEmails: ["Enter up to 20 valid manager email addresses"],
    });
  }
  return entries;
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
  const invoicing = isObject(input.invoicing) ? input.invoicing : {};
  const notifications = isObject(input.notifications) ? input.notifications : {};
  const loginAppearance = isObject(input.loginAppearance) ? input.loginAppearance : {};

  return {
    loginAppearance: {
      imageOpacity: integer(loginAppearance.imageOpacity, defaultSettings.loginAppearance.imageOpacity, 0, 100),
    },
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
    invoicing: {
      pdfTemplate: pdfTemplate(invoicing.pdfTemplate, defaultSettings.invoicing.pdfTemplate),
      pdfAccentColor: hexColor(invoicing.pdfAccentColor, defaultSettings.invoicing.pdfAccentColor),
      pdfNotes: text(invoicing.pdfNotes, defaultSettings.invoicing.pdfNotes, 1000),
      emailSubject: text(invoicing.emailSubject, defaultSettings.invoicing.emailSubject, 250) || defaultSettings.invoicing.emailSubject,
      emailBody: text(invoicing.emailBody, defaultSettings.invoicing.emailBody, 10000) || defaultSettings.invoicing.emailBody,
    },
    notifications: {
      managerEmails: emailList(notifications.managerEmails, defaultSettings.notifications.managerEmails),
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
    loginAppearance: { ...current.loginAppearance, ...(isObject(payload) && isObject(payload.loginAppearance) ? payload.loginAppearance : {}) },
    workspace: { ...current.workspace, ...(isObject(payload) && isObject(payload.workspace) ? payload.workspace : {}) },
    operations: { ...current.operations, ...(isObject(payload) && isObject(payload.operations) ? payload.operations : {}) },
    security: { ...current.security, ...(isObject(payload) && isObject(payload.security) ? payload.security : {}) },
    invoicing: { ...current.invoicing, ...(isObject(payload) && isObject(payload.invoicing) ? payload.invoicing : {}) },
    notifications: { ...current.notifications, ...(isObject(payload) && isObject(payload.notifications) ? payload.notifications : {}) },
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
