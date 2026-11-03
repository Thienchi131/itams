// In-memory brute-force / abuse guard, dùng chung cho login và quên mật
// khẩu. Chỉ giới hạn trong phạm vi 1 process/instance — nếu sau này chạy
// nhiều instance cùng lúc thì phải chuyển sang Redis/Upstash.
const attempts = new Map<string, { count: number; resetAt: number }>();

// Key của Map gồm cả email/IP do CHÍNH NGƯỜI GỬI REQUEST tự khai (chưa xác
// thực) — trước đây không bao giờ dọn Map này, nên kẻ tấn công có thể gửi
// hàng loạt request với email/IP khác nhau mỗi lần (rất rẻ, không cần đăng
// nhập) để Map phình to vô hạn theo thời gian, âm thầm chiếm dần RAM của
// tiến trình Node — 1 dạng DoS chậm (memory exhaustion) khai thác đúng cơ
// chế chống DoS khác (rate-limit) làm phương tiện tấn công.
//
// Sửa bằng 2 lớp: (1) quét định kỳ dọn entry đã hết hạn — window dài nhất
// đang dùng là 15 phút (forgot-password) nên quét mỗi 10 phút là đủ sát;
// (2) chặn trần cứng số entry tối đa, chủ động dọn ngay nếu vượt trần trước
// khi kịp tới lượt quét định kỳ (phòng trường hợp bị dồn tấn công dồn dập).
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 50_000;

function sweepExpired() {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (entry.resetAt < now) attempts.delete(key);
  }
}

// unref() để timer này không giữ tiến trình Node sống thêm — không ảnh
// hưởng gì tới graceful shutdown bình thường của app.
setInterval(sweepExpired, SWEEP_INTERVAL_MS).unref();

export function isRateLimited(
  key: string,
  maxAttempts: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt < now) {
    if (attempts.size >= MAX_ENTRIES) {
      sweepExpired();
    }
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count += 1;

  return entry.count > maxAttempts;
}
