import { test } from "node:test";
import assert from "node:assert/strict";
import { generateRandomPassword } from "./password.ts";

const ALLOWED_CHARS = /^[ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%]+$/;

test("generateRandomPassword mặc định dài 12 ký tự", () => {
  const password = generateRandomPassword();
  assert.equal(password.length, 12);
});

test("generateRandomPassword tôn trọng độ dài truyền vào", () => {
  assert.equal(generateRandomPassword(20).length, 20);
  assert.equal(generateRandomPassword(1).length, 1);
});

test("generateRandomPassword chỉ dùng ký tự trong bảng chữ cho phép", () => {
  const password = generateRandomPassword(200);
  assert.match(password, ALLOWED_CHARS);
});

test("generateRandomPassword không lặp lại y hệt giữa 2 lần gọi", () => {
  const a = generateRandomPassword(16);
  const b = generateRandomPassword(16);
  assert.notEqual(a, b);
});
