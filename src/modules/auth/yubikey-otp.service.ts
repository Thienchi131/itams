import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { extractPublicId, isValidYubikeyOtp, normalizeOtpInput } from "./yubikey-otp";
import { buildSignedQuery, parseYubicoResponse, verifyResponseSignature } from "./yubicloud-protocol";

// 2FA bằng YubiKey chế độ Yubico OTP, xác minh qua YubiCloud (api.yubico.com).
// Cần YUBICO_CLIENT_ID + YUBICO_SECRET_KEY trong .env (lấy miễn phí tại
// https://upgrade.yubico.com/getapikey/). YubiCloud tự chống dùng lại mã cũ
// (REPLAYED_OTP); ở đây kiểm thêm chữ ký phản hồi, otp + nonce khớp, và key
// (Public ID) phải thuộc đúng tài khoản đang đăng nhập.

const YUBICLOUD_URL = "https://api.yubico.com/wsapi/2.0/verify";
const TIMEOUT_MS = 10_000;

type Result = { ok: true } | { ok: false; error: string };

const STATUS_MESSAGES: Record<string, string> = {
  BAD_OTP: "Mã YubiKey không hợp lệ — chạm key lại.",
  REPLAYED_OTP: "Mã này đã được dùng rồi — chạm key lại để lấy mã mới.",
  BAD_SIGNATURE: "Cấu hình YubiCloud sai (YUBICO_SECRET_KEY) — báo Admin.",
  NO_SUCH_CLIENT: "Cấu hình YubiCloud sai (YUBICO_CLIENT_ID) — báo Admin.",
  MISSING_PARAMETER: "Yêu cầu gửi YubiCloud thiếu tham số — báo Admin.",
  OPERATION_NOT_ALLOWED: "YubiCloud từ chối yêu cầu — báo Admin.",
  BACKEND_ERROR: "YubiCloud đang gặp sự cố — thử lại sau ít phút.",
  NOT_ENOUGH_ANSWERS: "YubiCloud đang gặp sự cố — thử lại sau ít phút.",
  REPLAYED_REQUEST: "YubiCloud báo trùng yêu cầu — thử lại.",
};

function getConfig(): { clientId: string; secret: string } | null {
  const clientId = process.env.YUBICO_CLIENT_ID?.trim();
  const secret = process.env.YUBICO_SECRET_KEY?.trim();
  if (!clientId || !secret) return null;
  return { clientId, secret };
}

export async function verifyOtpWithYubiCloud(otp: string): Promise<Result> {
  const config = getConfig();
  if (!config) {
    return { ok: false, error: "Chưa cấu hình YubiCloud (YUBICO_CLIENT_ID / YUBICO_SECRET_KEY) — báo Admin." };
  }

  const nonce = randomBytes(16).toString("hex");
  const query = buildSignedQuery({ id: config.clientId, otp, nonce }, config.secret);

  let text: string;
  try {
    const res = await fetch(`${YUBICLOUD_URL}?${query}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    text = await res.text();
  } catch (err) {
    console.error("YubiCloud request failed", err);
    return { ok: false, error: "Không kết nối được YubiCloud — kiểm tra mạng rồi thử lại." };
  }

  const fields = parseYubicoResponse(text);

  // Kiểm chữ ký TRƯỚC khi tin bất kỳ trường nào (chống giả mạo phản hồi).
  if (!verifyResponseSignature(fields, config.secret)) {
    if (fields.status && STATUS_MESSAGES[fields.status] && fields.status !== "OK") {
      return { ok: false, error: STATUS_MESSAGES[fields.status] };
    }
    console.error("YubiCloud response signature invalid", fields.status);
    return { ok: false, error: "Phản hồi YubiCloud không hợp lệ — thử lại." };
  }
  if (fields.otp !== otp || fields.nonce !== nonce) {
    return { ok: false, error: "Phản hồi YubiCloud không khớp yêu cầu — thử lại." };
  }
  if (fields.status !== "OK") {
    return { ok: false, error: STATUS_MESSAGES[fields.status] ?? `YubiCloud từ chối (${fields.status}).` };
  }
  return { ok: true };
}

export async function countUserYubikeys(userId: number) {
  return prisma.yubikeyOtpDevice.count({ where: { userId } });
}

export async function registerYubikeyForUser(
  userId: number,
  rawOtp: string
): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const otp = normalizeOtpInput(rawOtp);
  if (!isValidYubikeyOtp(otp)) {
    return { ok: false, error: "Chưa nhận đủ 44 ký tự từ YubiKey — chạm key lại." };
  }
  const publicId = extractPublicId(otp);

  if (await prisma.yubikeyOtpDevice.findUnique({ where: { userId } })) {
    return { ok: false, error: "Tài khoản đã có YubiKey. Muốn đổi key, báo Admin xoá key cũ." };
  }

  const existing = await prisma.yubikeyOtpDevice.findUnique({ where: { publicId } });
  if (existing) {
    return {
      ok: false,
      error:
        existing.userId === userId
          ? "Key này đã được đăng ký cho tài khoản của bạn rồi."
          : "Key này đã được đăng ký cho tài khoản khác.",
    };
  }

  const verified = await verifyOtpWithYubiCloud(otp);
  if (!verified.ok) return verified;

  try {
    const created = await prisma.yubikeyOtpDevice.create({
      data: { userId, publicId, name: "YubiKey", lastUsedAt: new Date() },
    });
    return { ok: true, name: created.name };
  } catch {
    return { ok: false, error: "Key này (hoặc tài khoản này) vừa được đăng ký YubiKey ở nơi khác — tải lại trang." };
  }
}

export async function verifyYubikeyLogin(
  userId: number,
  rawOtp: string
): Promise<{ ok: true; keyName: string } | { ok: false; error: string }> {
  const otp = normalizeOtpInput(rawOtp);
  if (!isValidYubikeyOtp(otp)) {
    return { ok: false, error: "Chưa nhận đủ 44 ký tự từ YubiKey — chạm key lại." };
  }

  const device = await prisma.yubikeyOtpDevice.findFirst({
    where: { userId, publicId: extractPublicId(otp) },
  });
  if (!device) return { ok: false, error: "Key này chưa được đăng ký cho tài khoản của bạn." };

  const verified = await verifyOtpWithYubiCloud(otp);
  if (!verified.ok) return verified;

  await prisma.yubikeyOtpDevice.update({ where: { id: device.id }, data: { lastUsedAt: new Date() } });
  return { ok: true, keyName: device.name };
}
