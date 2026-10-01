import { studentPackages } from "../billing/packageCatalog.js";
import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from "libphonenumber-js/max";
import { prisma } from "../config/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";
import { hashPassword } from "./security.js";
import { validatePassword } from "./auth.service.js";
import { allTimeZones, countryTimeZones, convertRegistrationSchedule } from "./registrationSchedule.js";

const names = new Intl.DisplayNames(["en"], { type: "region" });
export const registrationOptions = {
  packages: studentPackages,
  countries: getCountries().map((code) => ({ code, name: names.of(code) ?? code, callingCode: `+${getCountryCallingCode(code)}`, timeZones: countryTimeZones(code) })).sort((a, b) => a.name.localeCompare(b.name)),
  timeZones: allTimeZones,
  timeZone: "Asia/Dhaka",
};
const invalid = (message: string) => Object.assign(new Error(message), { statusCode: 422, code: "VALIDATION_ERROR" });

export const validateRegistration = (raw: unknown) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw invalid("Enter registration details.");
  const body = raw as Record<string, unknown>;
  const text = (key: string, label: string, max = 120) => {
    const value = body[key];
    if (typeof value !== "string" || !value.trim() || value.trim().length > max || [...value].some((character) => character.charCodeAt(0) < 32)) throw invalid(`Enter a valid ${label}.`);
    return value.trim();
  };
  const name = text("studentName", "student name");
  const studentType = body.studentType;
  if (studentType !== "CHILD" && studentType !== "ADULT") throw invalid("Choose child or adult.");
  const age = body.age;
  if (typeof age !== "number" || !Number.isInteger(age) || age < (studentType === "ADULT" ? 18 : 1) || age > (studentType === "CHILD" ? 17 : 120)) throw invalid("Enter an age that matches child or adult.");
  const gender = body.gender;
  if (gender !== "MALE" && gender !== "FEMALE" && gender !== "OTHER" && gender !== "PREFER_NOT_TO_SAY") throw invalid("Choose a gender.");
  const parentName = studentType === "CHILD" ? text("parentName", "parent name") : null;
  const email = text("email", "email address", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw invalid("Enter a valid email address.");
  const username = text("username", "username", 32).toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw invalid("Username must be 3–32 letters, numbers, dots, underscores or hyphens.");
  const password = body.password;
  if (typeof password !== "string" || password.length > 128) throw invalid("Password must be at most 128 characters.");
  validatePassword(password);
  const country = registrationOptions.countries.find((item) => item.code === body.country);
  if (!country) throw invalid("Choose a country.");
  const phoneText = text("whatsapp", "WhatsApp number", 40);
  const phone = parsePhoneNumberFromString(phoneText, { defaultCountry: country.code, extract: false });
  if (!phone?.isValid() || phone.ext || !phone.number.startsWith(country.callingCode)) throw invalid("Enter a valid WhatsApp number for the selected country.");
  const duration = body.classDurationMinutes;
  if (typeof duration !== "number" || ![30, 45, 60].includes(duration)) throw invalid("Choose a class duration of 30, 45 or 60 minutes.");
  if (!Array.isArray(body.classDays) || !body.classDays.length || body.classDays.length > 7
    || body.classDays.some((day) => typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6)) throw invalid("Choose valid class weekdays.");
  const schedule = convertRegistrationSchedule(body);
  return { name, studentType, age, gender, parentName, email, username, password, country: country.name, parentPhone: phone.number,
    classDurationMinutes: duration, ...schedule };
};

export const createRegistration = async (tx: Prisma.TransactionClient, input: ReturnType<typeof validateRegistration>, passwordHash: string, imageUrl?: string) => {
  const role = await tx.role.findUnique({ where: { code: "STUDENT" } });
  if (!role) throw Object.assign(new Error("Student registration is temporarily unavailable."), { statusCode: 503 });
  const { email } = input;
  const student = await tx.student.create({ data: { name: input.name, image: imageUrl, studentType: input.studentType, age: input.age, gender: input.gender, parentName: input.parentName,
    country: input.country, parentPhone: input.parentPhone, classDurationMinutes: input.classDurationMinutes,
    classDays: input.classDays, classStartTime: input.classStartTime, parentEmail: email,
    classStartDate: input.classStartDate, preferredTimeZone: input.preferredTimeZone,
    preferredLocalTime: input.preferredLocalTime, preferredLocalDays: input.preferredLocalDays, preferredStartDate: input.preferredStartDate,
    status: "NEW_SIGN_UP", scheduleConfirmed: false, groupClass: false } });
  const username = input.username;
  const user = await tx.user.create({ data: { name: input.name, email, normalizedEmail: email,
    username, normalizedUsername: username, passwordHash, roleId: role.id, studentId: student.id } });
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  await tx.emailNotification.create({ data: {
    eventKey: `student-registration:${student.id}`, recipients: [],
    subject: "New student registration awaiting approval",
    body: `A new student registration requires review.\n\nStudent: ${input.name}\nType: ${input.studentType}\nAge: ${input.age}\nGender: ${input.gender.replaceAll("_", " ")}\n${input.parentName ? `Parent: ${input.parentName}\n` : ""}Email: ${email}\nWhatsApp: ${input.parentPhone}\nCountry: ${input.country}\nClass: ${input.classDurationMinutes} minutes, ${input.classDays.map((day) => weekdays[day]).join(", ")} at ${input.classStartTime} (Asia/Dhaka)\n\nStatus: New Sign-up. Open Students in the dashboard, review the registration, activate the student and configure billing when assigning a tutor.\nRegistration ID: ${student.id}`,
  } });
  await tx.auditLog.create({ data: { actorId: user.id, targetUserId: user.id, action: "STUDENT_REGISTERED", after: { studentId: student.id, status: "NEW_SIGN_UP", studentType: input.studentType, age: input.age, gender: input.gender, timeZone: input.preferredTimeZone, localTime: input.preferredLocalTime, localDays: input.preferredLocalDays, startDate: input.preferredStartDate.toISOString() } } });
  return { studentId: student.id, status: student.status };
};

export const registerStudent = async (raw: unknown, imageUrl?: string) => {
  const input = validateRegistration(raw);
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.$transaction((tx) => createRegistration(tx, input, passwordHash, imageUrl));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw Object.assign(new Error("Username is already in use. Choose another username."), { statusCode: 409, code: "DUPLICATE_USER" });
    }
    throw error;
  }
};
