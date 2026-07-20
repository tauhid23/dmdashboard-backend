import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { env } from "../config/env.js";

const scrypt = promisify(scryptCallback);
const b64url = (value: Buffer | string) => Buffer.from(value).toString("base64url");

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, saltValue, keyValue] = stored.split("$");
  if (algorithm !== "scrypt" || !saltValue || !keyValue) return false;
  const expected = Buffer.from(keyValue, "base64url");
  const actual = await scrypt(password, Buffer.from(saltValue, "base64url"), expected.length) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const randomToken = () => randomBytes(48).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function signAccessToken(payload: { sub: string; ver: number }, ttlSeconds = 900) {
  const body = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const signature = createHmac("sha256", env.AUTH_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyAccessToken(token: string) {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", env.AUTH_SECRET).update(body).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as { sub: string; ver: number; exp: number };
  return payload.exp > Date.now() / 1000 ? payload : null;
}

export const readCookies = (header?: string) => Object.fromEntries((header ?? "").split(";").map(v => v.trim()).filter(Boolean).map(v => { const i=v.indexOf("="); return [decodeURIComponent(v.slice(0,i)),decodeURIComponent(v.slice(i+1))]; }));

