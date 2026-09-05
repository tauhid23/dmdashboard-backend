import type { ErrorRequestHandler } from "express";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isMissingDatabaseColumnError = (err: unknown) => {
  if (!isRecord(err)) return false;

  const message = typeof err.message === "string" ? err.message : "";
  return (
    err.code === "P2021" ||
    err.code === "P2022" ||
    message.includes("table") && message.includes("does not exist") ||
    (message.includes("column") && message.includes("does not exist"))
  );
};

const publicError = (err: unknown) => {
  if (!isRecord(err)) {
    return {
      statusCode: 500,
      message: "Something went wrong. Please try again.",
      code: "INTERNAL_ERROR"
    };
  }

  if (isMissingDatabaseColumnError(err)) {
    return {
      statusCode: 503,
      message:
        "The database is not up to date. Please run the latest database migration, then try again.",
      code: "DATABASE_MIGRATION_REQUIRED",
      errors: undefined
    };
  }

  const rawStatus = Number(err.statusCode);
  const statusCode = Number.isInteger(rawStatus) ? rawStatus : 500;
  const code =
    typeof err.code === "string"
      ? err.code
      : statusCode >= 500
        ? "INTERNAL_ERROR"
        : "REQUEST_FAILED";
  const message =
    typeof err.message === "string" && (statusCode < 500 || code !== "INTERNAL_ERROR")
      ? err.message
      : "Something went wrong. Please try again.";

  return {
    statusCode,
    message,
    code,
    errors: err.errors
  };
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const error = publicError(err);

  if (error.statusCode >= 500) {
    console.error(err);
  }

  res.status(error.statusCode).json({
    message: error.message,
    code: error.code,
    ...(error.errors ? { errors: error.errors } : {})
  });
};
