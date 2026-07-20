import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const statusCode = err.statusCode ?? 500;

  res.status(statusCode).json({
    message: err.message ?? "Internal server error",
    code: err.code ?? "INTERNAL_ERROR",
    ...(err.errors ? { errors: err.errors } : {})
  });
};
