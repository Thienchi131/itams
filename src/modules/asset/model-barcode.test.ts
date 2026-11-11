import { test } from "node:test";
import assert from "node:assert/strict";
import { expandUpcE, formatModelBarcode, normalizeModelBarcode } from "./model-barcode.ts";

test("UPC-A 12 số và EAN-13 cùng mã ra cùng 1 dạng chuẩn", () => {
  assert.deepEqual(normalizeModelBarcode("036000291452"), { ok: true, code: "0036000291452" });
  assert.deepEqual(normalizeModelBarcode("0036000291452"), { ok: true, code: "0036000291452" });
  assert.deepEqual(normalizeModelBarcode("00036000291452"), { ok: true, code: "0036000291452" });
});

test("EAN-13 giữ nguyên, bỏ khoảng trắng / nhãn", () => {
  assert.deepEqual(normalizeModelBarcode(" 4006381333931 "), { ok: true, code: "4006381333931" });
  assert.deepEqual(normalizeModelBarcode("EAN: 4006 3813 3393 1"), { ok: true, code: "4006381333931" });
});

test("chặn sai số kiểm tra, sai độ dài, có chữ", () => {
  assert.equal(normalizeModelBarcode("036000291453").ok, false);
  assert.deepEqual(normalizeModelBarcode("12345"), { ok: false, reason: "bad_length", raw: "12345" });
  assert.equal(normalizeModelBarcode("C02XK1ABCDEF").ok, false);
  assert.equal(normalizeModelBarcode("").ok, false);
});

test("UPC-E mở rộng thành UPC-A", () => {
  assert.equal(expandUpcE("04252614"), "042100005264");
  assert.deepEqual(normalizeModelBarcode("04252614", "UPC_E"), { ok: true, code: "0042100005264" });
});

test("EAN-8", () => {
  assert.deepEqual(normalizeModelBarcode("96385074", "EAN_8"), { ok: true, code: "96385074" });
});

test("GS1 (01) GTIN-14", () => {
  assert.deepEqual(normalizeModelBarcode("(01)00036000291452"), { ok: true, code: "0036000291452" });
});

test("hiển thị UPC-A 12 số", () => {
  assert.equal(formatModelBarcode("0036000291452"), "036000291452");
  assert.equal(formatModelBarcode("4006381333931"), "4006381333931");
});
