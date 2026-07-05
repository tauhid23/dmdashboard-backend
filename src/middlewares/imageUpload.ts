import multer from "multer";
import type { Request } from "express";

const createHttpError = (statusCode: number, message: string) => {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
};

const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedImageTypes.has(file.mimetype)) {
      callback(createHttpError(400, "Image must be JPEG, PNG, WEBP, or GIF"));
      return;
    }

    callback(null, true);
  }
});

export const imageFieldsUpload = imageUpload.fields([
  { name: "image", maxCount: 1 },
  { name: "imageUrl", maxCount: 1 }
]);

export const getUploadedImageFile = (req: Request) => {
  if (!req.files || Array.isArray(req.files)) {
    return undefined;
  }

  return req.files.image?.[0] ?? req.files.imageUrl?.[0];
};
