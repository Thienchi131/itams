// Chuẩn hoá mã vạch sản phẩm (UPC/EAN/GTIN) in trên hộp máy để gắn vào
// Model (bảng AssetModelBarcode). Hàm thuần — dùng ở cả client (quét camera,
// gõ tay) lẫn server action + unit test.
//
// Dạng lưu chuẩn (canonical):
// - UPC-A 12 số  -> thêm "0" đầu thành 13 số (= dạng EAN-13 của cùng mã),
//   để quét ra "194253..." (UPC-A) hay "0194253..." (EAN-13) đều khớp nhau.
// - EAN-13 13 số -> giữ nguyên.
// - GTIN-14 14 số bắt đầu bằng "0" -> bỏ "0" đầu (về 13 số). GTIN-14 khác
//   (mã thùng nhiều hộp) giữ nguyên 14 số.
// - UPC-E 8 số -> mở rộng thành UPC-A rồi về 13 số như trên.
// - EAN-8 8 số -> giữ nguyên.
// Luôn kiểm tra số kiểm tra (check digit) GS1 để chặn gõ nhầm / đọc sai.

export type NormalizedBarcode =
  | { ok: true; code: string }
  | { ok: false; reason: "empty" | "not_digits" | "bad_length" | "bad_check_digit"; raw: string };

export type BarcodeFormatHint = "UPC_A" | "UPC_E" | "EAN_13" | "EAN_8" | null | undefined;

function gs1CheckDigitOk(digits: string): boolean {
  // Tính từ phải sang trái, bỏ số cuối (check digit): vị trí lẻ x3, chẵn x1.
  const body = digits.slice(0, -1);
  let sum = 0;
  for (let i = 0; i < body.length; i += 1) {
    const d = Number(body[body.length - 1 - i]);
    sum += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

// UPC-E (8 số: hệ số 0/1 + 6 số + check digit) -> UPC-A 12 số.
export function expandUpcE(upcE: string): string | null {
  if (!/^[01]\d{7}$/.test(upcE)) return null;
  const ns = upcE[0];
  const d = upcE.slice(1, 7);
  const check = upcE[7];
  const last = Number(d[5]);
  let body: string;
  if (last <= 2) body = `${d[0]}${d[1]}${d[5]}0000${d[2]}${d[3]}${d[4]}`;
  else if (last === 3) body = `${d[0]}${d[1]}${d[2]}00000${d[3]}${d[4]}`;
  else if (last === 4) body = `${d[0]}${d[1]}${d[2]}${d[3]}00000${d[4]}`;
  else body = `${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}0000${d[5]}`;
  return `${ns}${body}${check}`;
}

export function normalizeModelBarcode(raw: string, format?: BarcodeFormatHint): NormalizedBarcode {
  let text = String(raw || "")
    .replace(/[​-‍﻿]/g, "")
    .trim();

  if (!text) return { ok: false, reason: "empty", raw };

  // Bỏ nhãn "UPC", "EAN", "GTIN" nếu gõ/dán kèm, và khoảng trắng / gạch nối.
  text = text.replace(/^(?:UPC|EAN|GTIN)[-\s:#]*/i, "");
  text = text.replace(/[\s\-]/g, "");

  // GS1 Application Identifier (01) = GTIN-14, VD "(01)00194253012345" hoặc
  // "0100194253012345" (mã GS1-128 / DataMatrix trên một số hộp).
  const ai = /^\(?01\)?(\d{14})(?:\D.*|\d*)?$/.exec(text);
  if (ai && text.length >= 16) text = ai[1];

  if (!/^\d+$/.test(text)) return { ok: false, reason: "not_digits", raw };

  if (text.length === 8) {
    // UPC-E và EAN-8 đều 8 số. Biết định dạng từ máy quét thì theo đó; gõ tay
    // thì thử UPC-E trước (hộp hàng Mỹ), không hợp lệ thì coi là EAN-8.
    if (format !== "EAN_8") {
      const upcA = expandUpcE(text);
      if (upcA && gs1CheckDigitOk(upcA)) return { ok: true, code: `0${upcA}` };
      if (format === "UPC_E") return { ok: false, reason: "bad_check_digit", raw };
    }
    return gs1CheckDigitOk(text) ? { ok: true, code: text } : { ok: false, reason: "bad_check_digit", raw };
  }

  if (text.length === 12 || text.length === 13 || text.length === 14) {
    if (!gs1CheckDigitOk(text)) return { ok: false, reason: "bad_check_digit", raw };
    if (text.length === 12) return { ok: true, code: `0${text}` };
    if (text.length === 14 && text.startsWith("0")) return { ok: true, code: text.slice(1) };
    return { ok: true, code: text };
  }

  return { ok: false, reason: "bad_length", raw };
}

// Hiển thị: mã 13 số bắt đầu bằng 0 là UPC-A -> hiện 12 số như in trên hộp.
export function formatModelBarcode(code: string): string {
  return code.length === 13 && code.startsWith("0") ? code.slice(1) : code;
}

export const MODEL_BARCODE_REJECT_LABEL: Record<
  Exclude<NormalizedBarcode, { ok: true }>["reason"],
  string
> = {
  empty: "Mã trống",
  not_digits: "Không phải mã UPC/EAN (mã sản phẩm chỉ gồm chữ số)",
  bad_length: "Độ dài không đúng UPC/EAN (8, 12, 13 hoặc 14 số)",
  bad_check_digit: "Sai số kiểm tra — có thể gõ nhầm hoặc quét sai",
};
