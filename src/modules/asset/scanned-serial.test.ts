import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeScannedSerial } from "./scanned-serial.ts";

const opts = { maxLength: 16, stripAppleBoxPrefix: false };

test("viết hoa, bỏ khoảng trắng và nhãn S/N", () => {
  assert.deepEqual(normalizeScannedSerial("  c02xk1ab ", opts), { ok: true, serial: "C02XK1AB" });
  assert.deepEqual(normalizeScannedSerial("S/N: 5CD1234XYZ", opts), { ok: true, serial: "5CD1234XYZ" });
  assert.deepEqual(normalizeScannedSerial("Serial No. ABC 123", opts), { ok: true, serial: "ABC123" });
});

test("không cắt nhầm serial thật bắt đầu bằng SN", () => {
  assert.deepEqual(normalizeScannedSerial("SNX12345", opts), { ok: true, serial: "SNX12345" });
});

test("bỏ tiền tố S trên hộp Apple chỉ khi bật", () => {
  assert.deepEqual(normalizeScannedSerial("SC02XK1ABCDEF", { ...opts, stripAppleBoxPrefix: true }), {
    ok: true,
    serial: "C02XK1ABCDEF",
  });
  assert.deepEqual(normalizeScannedSerial("SH7QX9K2LM", { ...opts, stripAppleBoxPrefix: true }), {
    ok: true,
    serial: "SH7QX9K2LM",
  });
  assert.deepEqual(normalizeScannedSerial("SC02XK1ABCDEF", opts), { ok: true, serial: "SC02XK1ABCDEF" });
});

test("từ chối tem QR ITAMS, mã quá dài, ký tự lạ, rỗng", () => {
  assert.equal(normalizeScannedSerial("https://itam.applesmng.com/assets/123", opts).ok, false);
  const long = normalizeScannedSerial("A".repeat(17), opts);
  assert.equal(long.ok === false && long.reason, "too_long");
  const bad = normalizeScannedSerial("ABC@123", opts);
  assert.equal(bad.ok === false && bad.reason, "invalid_chars");
  const empty = normalizeScannedSerial("   ", opts);
  assert.equal(empty.ok === false && empty.reason, "empty");
});
