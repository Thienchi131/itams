import { test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { encryptPasswordHash, hashPassword, isEncryptedPasswordHash, verifyPassword } from "./password-hash.ts";

const KEY = "a".repeat(64);
const OTHER_KEY = "b".repeat(64);

test("có khoá: lưu dạng mã hoá, đăng nhập đúng/sai", async () => {
  process.env.PASSWORD_ENCRYPTION_KEY = KEY;
  const stored = await hashPassword("Matkhau@123");
  assert.ok(isEncryptedPasswordHash(stored));
  assert.ok(!stored.includes("$2"));
  assert.deepEqual(await verifyPassword("Matkhau@123", stored), { valid: true, needsUpgrade: false });
  assert.equal((await verifyPassword("sai", stored)).valid, false);
});

test("bcrypt cũ chưa mã hoá vẫn đăng nhập được và được đánh dấu cần nâng cấp", async () => {
  process.env.PASSWORD_ENCRYPTION_KEY = KEY;
  const legacy = await bcrypt.hash("cu", 4);
  assert.deepEqual(await verifyPassword("cu", legacy), { valid: true, needsUpgrade: true });
});

test("sai khoá hoặc thiếu khoá: không đăng nhập được", async () => {
  process.env.PASSWORD_ENCRYPTION_KEY = KEY;
  const stored = encryptPasswordHash(await bcrypt.hash("x", 4));
  process.env.PASSWORD_ENCRYPTION_KEY = OTHER_KEY;
  assert.equal((await verifyPassword("x", stored)).valid, false);
  delete process.env.PASSWORD_ENCRYPTION_KEY;
  assert.equal((await verifyPassword("x", stored)).valid, false);
});

test("chưa cấu hình khoá: lưu bcrypt thường như trước", async () => {
  delete process.env.PASSWORD_ENCRYPTION_KEY;
  const stored = encryptPasswordHash("$2b$12$abc");
  assert.equal(stored, "$2b$12$abc");
});

test("mỗi lần mã hoá ra chuỗi khác nhau (IV ngẫu nhiên)", () => {
  process.env.PASSWORD_ENCRYPTION_KEY = KEY;
  assert.notEqual(encryptPasswordHash("$2b$12$abc"), encryptPasswordHash("$2b$12$abc"));
});
