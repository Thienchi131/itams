// Giao thức xác minh YubiCloud 2.0 (HMAC-SHA1) — chỉ dùng ở server.
// https://developers.yubico.com/OTP/Specifications/OTP_validation_protocol.html

import { createHmac, timingSafeEqual } from "node:crypto";

function signParams(params: Record<string, string>, secretBase64: string): string {
  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHmac("sha1", Buffer.from(secretBase64, "base64")).update(message).digest("base64");
}

export function buildSignedQuery(params: Record<string, string>, secretBase64: string): string {
  const h = signParams(params, secretBase64);
  const all: Record<string, string> = { ...params, h };
  return Object.keys(all)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(all[k])}`)
    .join("&");
}

export function parseYubicoResponse(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}

export function verifyResponseSignature(fields: Record<string, string>, secretBase64: string): boolean {
  const { h, ...rest } = fields;
  if (!h) return false;
  const expected = Buffer.from(signParams(rest, secretBase64));
  const actual = Buffer.from(h);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
