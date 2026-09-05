import assert from "node:assert/strict";
import test from "node:test";

import { getPasswordPolicyErrors, validatePassword } from "./auth.service.js";

void test("password policy requires minimum length, uppercase letter, and number", () => {
  assert.deepEqual(getPasswordPolicyErrors("short"), [
    "Password must be at least 6 characters",
    "Password must include at least one uppercase letter",
    "Password must include at least one number"
  ]);

  assert.deepEqual(getPasswordPolicyErrors("longenough"), [
    "Password must include at least one uppercase letter",
    "Password must include at least one number"
  ]);

  assert.deepEqual(getPasswordPolicyErrors("Longenough"), [
    "Password must include at least one number"
  ]);

  assert.deepEqual(getPasswordPolicyErrors("Passw0rd"), []);
});

void test("validatePassword throws field errors for weak passwords", () => {
  assert.throws(
    () => validatePassword("teacher"),
    (cause: unknown) => {
      const error = cause as { statusCode?: number; code?: string; errors?: { password?: string[] } };
      assert.equal(error.statusCode, 422);
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.deepEqual(error.errors?.password, [
        "Password must include at least one uppercase letter",
        "Password must include at least one number"
      ]);
      return true;
    }
  );
});
