import { test } from "node:test";
import assert from "node:assert/strict";
import { truncateSerial, SERIAL_MAX_LENGTH } from "./format.ts";

test("truncateSerial trả về null khi input null/undefined", () => {
  assert.equal(truncateSerial(null), null);
  assert.equal(truncateSerial(undefined), null);
});

test("truncateSerial viết hoa serial", () => {
  assert.equal(truncateSerial("abc123"), "ABC123");
});

test("truncateSerial giữ nguyên serial ngắn hơn hoặc bằng giới hạn", () => {
  const exact = "A".repeat(SERIAL_MAX_LENGTH);
  assert.equal(truncateSerial(exact), exact);
  assert.equal(truncateSerial(exact)?.length, SERIAL_MAX_LENGTH);
});

test("truncateSerial cắt bớt + thêm ... khi serial dài hơn giới hạn", () => {
  const long = "A".repeat(SERIAL_MAX_LENGTH + 5);
  const result = truncateSerial(long);

  assert.equal(result, "A".repeat(SERIAL_MAX_LENGTH) + "...");
});

test("truncateSerial trả nguyên chuỗi rỗng (chỉ null/undefined mới trả null)", () => {
  // !serial đúng với "" nhưng "" ?? null vẫn là "" (nullish coalescing chỉ
  // thay null/undefined) — không phải lỗi, chỉ ghi lại đúng hành vi hiện tại.
  assert.equal(truncateSerial(""), "");
});
