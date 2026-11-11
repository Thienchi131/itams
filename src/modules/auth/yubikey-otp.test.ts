import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { extractPublicId, isValidYubikeyOtp, modhexFromKeyCode, normalizeOtpInput } from "./yubikey-otp.ts";
import { buildSignedQuery, parseYubicoResponse, verifyResponseSignature } from "./yubicloud-protocol.ts";

const OTP = "cccccckdvvulgjvtkjdhtlrbjjctggdihuevikehtlil";
const SECRET = Buffer.from("0123456789abcdefghij").toString("base64");

test("nhận dạng mã OTP 44 ký tự modhex + Public ID", () => {
  assert.equal(OTP.length, 44);
  assert.ok(isValidYubikeyOtp(OTP));
  assert.equal(extractPublicId(OTP), "cccccckdvvul");
  assert.ok(!isValidYubikeyOtp(OTP.slice(1)));
  assert.ok(!isValidYubikeyOtp(OTP.slice(1) + "a"));
});

test("đọc phím vật lý, bỏ qua phím không thuộc modhex", () => {
  assert.equal(modhexFromKeyCode("KeyC"), "c");
  assert.equal(modhexFromKeyCode("KeyV"), "v");
  assert.equal(modhexFromKeyCode("KeyA"), null);
  assert.equal(modhexFromKeyCode("Enter"), null);
  assert.equal(modhexFromKeyCode("Digit1"), null);
});

test("chuẩn hoá chuỗi dán vào", () => {
  assert.equal(normalizeOtpInput(" CCCC ccKD\t"), "cccccckd");
});

test("ký request theo thứ tự tên tham số", () => {
  const q = buildSignedQuery({ otp: OTP, id: "1", nonce: "abcdefghijklmnop" }, SECRET);
  const expected = createHmac("sha1", Buffer.from(SECRET, "base64"))
    .update(`id=1&nonce=abcdefghijklmnop&otp=${OTP}`)
    .digest("base64");
  assert.ok(q.includes(`h=${encodeURIComponent(expected)}`));
});

test("đọc và kiểm tra chữ ký phản hồi YubiCloud", () => {
  const fields = { t: "2026-11-11T05:00:00Z0001", otp: OTP, nonce: "abcdefghijklmnop", status: "OK" };
  const msg = Object.keys(fields).sort().map((k) => `${k}=${fields[k as keyof typeof fields]}`).join("&");
  const h = createHmac("sha1", Buffer.from(SECRET, "base64")).update(msg).digest("base64");
  const text = `h=${h}\r\nt=${fields.t}\r\notp=${OTP}\r\nnonce=${fields.nonce}\r\nstatus=OK\r\n\r\n`;
  const parsed = parseYubicoResponse(text);
  assert.equal(parsed.status, "OK");
  assert.equal(parsed.h, h);
  assert.ok(verifyResponseSignature(parsed, SECRET));
  assert.ok(!verifyResponseSignature({ ...parsed, status: "REPLAYED_OTP" }, SECRET));
});
