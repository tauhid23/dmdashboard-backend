import assert from "node:assert/strict";
import test from "node:test";
import { registrationOptions, validateRegistration } from "./registration.service.js";

const valid = { studentName: " Test Student ", studentType: "CHILD", age: 12, gender: "FEMALE", parentName: "Test Parent", email: "PARENT@EXAMPLE.COM", username: "Test.Student", password: "Password123",
  country: "BD", timeZone: "Asia/Dhaka", startDate: "2026-10-05", whatsapp: "+8801712345678", classDurationMinutes: 45, classStartTime: "17:30", classDays: [0, 2, 4] };

void test("registration normalizes identity without creating a billing plan", () => {
  const data = validateRegistration({ ...valid, status: "ACTIVE", roleId: "admin", teacherId: "tutor", billingAmountBdt: 1 });
  assert.equal(data.name, "Test Student");
  assert.equal(data.email, "parent@example.com");
  assert.equal(data.username, "test.student");
  assert.equal(data.country, "Bangladesh");
  assert.equal(data.studentType, "CHILD");
  assert.equal(data.age, 12);
  assert.equal(data.gender, "FEMALE");
  assert.equal("plan" in data, false);
  assert.equal("billingAmountBdt" in data, false);
  assert.ok(registrationOptions.packages.some((item) => item.code === "G" && item.monthlyPriceBdt === 6000));
  assert.equal("status" in data, false);
  assert.equal("roleId" in data, false);
  assert.equal("teacherId" in data, false);
});
void test("registration ignores client-supplied billing preferences and preserves weekdays", () => {
  assert.equal("billingCycle" in validateRegistration({ ...valid, billingCycle: "QUARTERLY", packageCode: "G" }), false);
  assert.deepEqual(validateRegistration({ ...valid, classDays: [4, 0, 4, 2] }).classDays, [0, 2, 4]);
});
void test("adult registration has no parent and accepts a national WhatsApp number", () => {
  const data = validateRegistration({ ...valid, studentType: "ADULT", age: 25, parentName: "Should be ignored", whatsapp: "01712345678" });
  assert.equal(data.parentName, null);
  assert.equal(data.parentPhone, "+8801712345678");
});
void test("registration rejects malformed contact and class information", () => {
  for (const change of [{ email: "invalid" }, { username: "bad@email" }, { username: "ab" }, { country: "XX" }, { whatsapp: "abc" }, { whatsapp: "+880123" },
    { classDays: [] }, { classDays: [7] }, { classDays: ["1"] }, { classDurationMinutes: 25 },
    { classStartTime: "25:00" }, { classStartTime: "23:50" }, { password: "weak" },
    { parentName: "Injected\nHeader" }, { studentType: "TEEN" }, { age: 18 }, { age: 1.5 }, { gender: "unknown" },
    { whatsapp: "+447911123456" }]) assert.throws(() => validateRegistration({ ...valid, ...change }));
  assert.throws(() => validateRegistration({ ...valid, studentType: "CHILD", parentName: "" }));
  assert.throws(() => validateRegistration({ ...valid, studentType: "ADULT", age: 17 }));
});
