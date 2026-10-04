import { prisma } from "../config/prisma.js";
import { getSettings } from "./settings.service.js";

const IMAGE_KEY = "login-background-image";
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function detectedType(buffer: Buffer): string | null {
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6))) return "image/gif";
  return null;
}

export async function getLoginAppearance() {
  const [settings, image] = await Promise.all([
    getSettings(),
    prisma.appSetting.findUnique({ where: { key: IMAGE_KEY }, select: { updatedAt: true } }),
  ]);
  return {
    imageOpacity: settings.loginAppearance.imageOpacity,
    imageVersion: image?.updatedAt.getTime() ?? null,
  };
}

export async function getLoginImage() {
  const row = await prisma.appSetting.findUnique({ where: { key: IMAGE_KEY } });
  const value = row?.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (typeof value.mimeType !== "string" || typeof value.base64 !== "string") return null;
  if (!allowedTypes.has(value.mimeType)) return null;
  return { mimeType: value.mimeType, buffer: Buffer.from(value.base64, "base64") };
}

export async function saveLoginImage(actorId: string, file: Express.Multer.File) {
  const mimeType = detectedType(file.buffer);
  if (!mimeType || mimeType !== file.mimetype) {
    throw Object.assign(new Error("Upload a valid JPEG, PNG, WebP, or GIF image."), { statusCode: 400 });
  }
  const value = { mimeType, base64: file.buffer.toString("base64") };
  await prisma.appSetting.upsert({
    where: { key: IMAGE_KEY },
    create: { key: IMAGE_KEY, value, updatedBy: actorId },
    update: { value, updatedBy: actorId },
  });
  return getLoginAppearance();
}

export async function removeLoginImage() {
  await prisma.appSetting.deleteMany({ where: { key: IMAGE_KEY } });
  return getLoginAppearance();
}
