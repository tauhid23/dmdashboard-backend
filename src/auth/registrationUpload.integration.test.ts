import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import app from "../app.js";

void test("optional registration image accepts multipart and rejects invalid uploads", async (context) => {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth/register`;

  const empty = new FormData();
  empty.set("registration", "{}");
  assert.equal((await fetch(url, { method: "POST", body: empty })).status, 422);

  const malformed = new FormData();
  malformed.set("registration", "{invalid json");
  assert.equal((await fetch(url, { method: "POST", body: malformed })).status, 422);

  const wrongType = new FormData();
  wrongType.set("registration", "{}");
  wrongType.set("image", new Blob(["not an image"], { type: "text/plain" }), "photo.txt");
  assert.equal((await fetch(url, { method: "POST", body: wrongType })).status, 400);

  const tooLarge = new FormData();
  tooLarge.set("registration", "{}");
  tooLarge.set("image", new Blob([new Uint8Array(5 * 1024 * 1024 + 1)], { type: "image/png" }), "photo.png");
  const response = await fetch(url, { method: "POST", body: tooLarge });
  assert.equal(response.status, 413);
  assert.equal((await response.json() as { code: string }).code, "IMAGE_TOO_LARGE");
});
