import { v2 as cloudinary } from "cloudinary";
import type { UploadApiResponse } from "cloudinary";

import { env } from "./env.js";

let isConfigured = false;

const configureCloudinary = () => {
  if (isConfigured) {
    return;
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true
  });

  isConfigured = true;
};

export const uploadImageBuffer = (
  file: Express.Multer.File,
  folder: string
) => {
  configureCloudinary();

  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image"
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Cloudinary upload failed"));
          return;
        }

        resolve(result);
      }
    );

    stream.end(file.buffer);
  });
};
