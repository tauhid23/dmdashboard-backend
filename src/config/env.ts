import "dotenv/config";

const requiredEnv = (key: string, fallback?: string) => {
  const value = process.env[key] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

const booleanEnv = (key: string, fallback: boolean) => {
  const value = process.env[key];

  if (value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;

  throw new Error(`${key} must be either "true" or "false"`);
};

const numberEnv = (key: string, fallback: number) => {
  const value = Number(process.env[key] ?? fallback);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }

  return value;
};

const emailEnabled = booleanEnv("EMAIL_ENABLED", false);

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: numberEnv("PORT", 5000),
  DATABASE_URL: requiredEnv("DATABASE_URL"),
  CLOUDINARY_CLOUD_NAME: requiredEnv("CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: requiredEnv("CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: requiredEnv("CLOUDINARY_API_SECRET"),
  AUTH_SECRET: requiredEnv("AUTH_SECRET", process.env.NODE_ENV === "production" ? undefined : "development-only-change-this-secret"),
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  SUPER_ADMIN_EMAIL: process.env.SUPER_ADMIN_EMAIL ?? "admin@admin.com",
  SUPER_ADMIN_USERNAME: process.env.SUPER_ADMIN_USERNAME ?? "admin@admin.com",
  SUPER_ADMIN_PASSWORD: requiredEnv("SUPER_ADMIN_PASSWORD", process.env.NODE_ENV === "production" ? undefined : "SuperAdmin1"),
  EMAIL_ENABLED: emailEnabled,
  SMTP_HOST: emailEnabled ? requiredEnv("SMTP_HOST") : process.env.SMTP_HOST,
  SMTP_PORT: numberEnv("SMTP_PORT", 587),
  SMTP_SECURE: booleanEnv("SMTP_SECURE", false),
  SMTP_REQUIRE_TLS: booleanEnv("SMTP_REQUIRE_TLS", true),
  SMTP_USER: emailEnabled ? requiredEnv("SMTP_USER") : process.env.SMTP_USER,
  SMTP_PASSWORD: emailEnabled ? requiredEnv("SMTP_PASSWORD") : process.env.SMTP_PASSWORD,
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME ?? "DM Dashboard",
  EMAIL_FROM_ADDRESS: emailEnabled ? requiredEnv("EMAIL_FROM_ADDRESS") : process.env.EMAIL_FROM_ADDRESS,
  ADMIN_NOTIFICATION_EMAILS: (process.env.ADMIN_NOTIFICATION_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean)
};
