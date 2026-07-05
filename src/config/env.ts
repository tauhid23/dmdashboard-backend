import "dotenv/config";

const requiredEnv = (key: string, fallback?: string) => {
  const value = process.env[key] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 5000),
  DATABASE_URL: requiredEnv("DATABASE_URL"),
  CLOUDINARY_CLOUD_NAME: requiredEnv("CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: requiredEnv("CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: requiredEnv("CLOUDINARY_API_SECRET")
};
