import { test } from "node:test";
import assert from "node:assert/strict";
import { isRateLimited } from "./rate-limit.ts";

// isRateLimited() dùng chung 1 Map trong bộ nhớ cho cả module — mỗi test
// dùng key riêng (random) để không đụng state của nhau khi chạy chung 1
// process.
function uniqueKey(label: string) {
  return `${label}:${Math.random().toString(36).slice(2)}`;
}

test("cho phép tới đúng maxAttempts lần trước khi bị chặn", () => {
  const key = uniqueKey("basic");
  const maxAttempts = 3;
  const windowMs = 60_000;

  // Lần 1, 2, 3: chưa vượt ngưỡng -> false (không bị chặn)
  assert.equal(isRateLimited(key, maxAttempts, windowMs), false);
  assert.equal(isRateLimited(key, maxAttempts, windowMs), false);
  assert.equal(isRateLimited(key, maxAttempts, windowMs), false);

  // Lần 4: vượt quá maxAttempts=3 -> true (bị chặn)
  assert.equal(isRateLimited(key, maxAttempts, windowMs), true);
});

test("mỗi key độc lập với nhau", () => {
  const keyA = uniqueKey("a");
  const keyB = uniqueKey("b");
  const maxAttempts = 1;
  const windowMs = 60_000;

  assert.equal(isRateLimited(keyA, maxAttempts, windowMs), false);
  assert.equal(isRateLimited(keyA, maxAttempts, windowMs), true);

  // keyB chưa từng gọi lần nào -> vẫn được phép, không bị ảnh hưởng bởi keyA
  assert.equal(isRateLimited(keyB, maxAttempts, windowMs), false);
});

test("reset lại sau khi hết windowMs", async () => {
  const key = uniqueKey("reset");
  const maxAttempts = 1;
  const windowMs = 20; // rất ngắn để test nhanh, không cần mock Date.now()

  assert.equal(isRateLimited(key, maxAttempts, windowMs), false);
  assert.equal(isRateLimited(key, maxAttempts, windowMs), true);

  await new Promise((resolve) => setTimeout(resolve, windowMs + 10));

  // Cửa sổ cũ đã hết hạn -> tính lại từ đầu, không còn bị chặn ngay
  assert.equal(isRateLimited(key, maxAttempts, windowMs), false);
});
