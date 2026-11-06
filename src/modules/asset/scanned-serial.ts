// Chuẩn hoá nội dung quét được (mã vạch/QR) thành Serial Number để điền vào
// phiếu nhập kho. Hàm thuần — dùng ở client (SerialScannerModal) + unit test.

export type NormalizedSerial =
  | { ok: true; serial: string }
  | { ok: false; reason: "empty" | "itams_qr" | "too_long" | "invalid_chars"; raw: string };

export function normalizeScannedSerial(
  raw: string,
  {
    maxLength,
    stripAppleBoxPrefix,
  }: {
    maxLength: number;
    // Mã vạch serial trên hộp Apple in dạng "S" + serial (VD "SC02XK1ABCDEF").
    // Chỉ bật khi đang nhập model Apple — hãng khác serial có thể bắt đầu
    // bằng chữ S thật.
    stripAppleBoxPrefix: boolean;
  }
): NormalizedSerial {
  let text = String(raw || "")
    .replace(/[​-‍﻿]/g, "")
    .trim()
    .toUpperCase();

  if (!text) return { ok: false, reason: "empty", raw };

  // Tem QR của chính ITAMS (link tới trang thiết bị) — không phải serial.
  if (/\/ASSETS\/\d+/.test(text)) return { ok: false, reason: "itams_qr", raw };

  // Bỏ nhãn "S/N:", "Serial No.", "SN " ... nếu mã có kèm nhãn.
  text = text.replace(/^(?:SERIAL\s*(?:NO\.?|NUMBER|#)?|S\/N|SN)(?:\s*[:#.\-]\s*|\s+)/, "");
  text = text.replace(/\s+/g, "");

  if (stripAppleBoxPrefix && /^S[A-Z0-9]{10,12}$/.test(text)) {
    text = text.slice(1);
  }

  if (!text) return { ok: false, reason: "empty", raw };
  if (text.length > maxLength) return { ok: false, reason: "too_long", raw };
  if (!/^[A-Z0-9][A-Z0-9\-_./]*$/.test(text)) return { ok: false, reason: "invalid_chars", raw };

  return { ok: true, serial: text };
}

export const SCANNED_SERIAL_REJECT_LABEL: Record<
  Exclude<NormalizedSerial, { ok: true }>["reason"],
  string
> = {
  empty: "Mã trống",
  itams_qr: "Đây là tem QR tài sản ITAMS, không phải Serial",
  too_long: "Mã quá dài, không phải Serial (có thể là QR/mã khác)",
  invalid_chars: "Mã chứa ký tự lạ, không phải Serial",
};
