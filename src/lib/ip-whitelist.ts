// Logic parse/khớp IP dùng cho trang Cài đặt > Whitelist IP (validate khi
// Admin nhập 1 entry mới). Việc CHẶN THẬT SỰ khi có request tới nằm ở
// server.js (custom server chạy ngoài Next.js, xem ghi chú ở đó) — file đó
// KHÔNG import được module TypeScript này (chạy bằng node thuần, không qua
// build của Next), nên chứa 1 bản sao thu gọn của cùng logic bên dưới. Sửa gì
// ở đây thì nhớ sửa cả bên server.js cho khớp, tránh trường hợp Admin nhập
// được 1 entry ở đây nhưng server.js lại không hiểu/không khớp được nó.
//
// Hỗ trợ: 1 IPv4 đơn ("1.2.3.4"), 1 dải CIDR IPv4 ("1.2.3.0/24"), hoặc 1 IPv6
// đơn (so khớp chính xác từng ký tự, KHÔNG hỗ trợ CIDR cho IPv6 — đủ dùng cho
// hầu hết trường hợp thực tế là whitelist theo IP tĩnh của văn phòng/nhà).

const IPV4_OCTET = "(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4_RE = new RegExp(`^${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}\\.${IPV4_OCTET}$`);

function isValidIPv4(ip: string): boolean {
  return IPV4_RE.test(ip);
}

// Kiểm tra khá lỏng cho IPv6 (đủ để chặn lỗi gõ nhầm rõ ràng) — không cần
// parse đầy đủ chuẩn RFC vì chỉ dùng để so khớp chuỗi chính xác, không tính
// toán dải.
function isValidIPv6(ip: string): boolean {
  return /^[0-9a-fA-F:]+$/.test(ip) && ip.includes(":");
}

export function isValidWhitelistEntry(raw: string): {
  valid: boolean;
  error?: string;
} {
  const value = raw.trim();

  if (!value) {
    return { valid: false, error: "Vui lòng nhập IP hoặc dải CIDR." };
  }

  if (value.includes("/")) {
    const [base, prefixRaw] = value.split("/");
    const prefix = Number(prefixRaw);

    if (!isValidIPv4(base)) {
      return {
        valid: false,
        error: `"${base}" không phải IPv4 hợp lệ (CIDR hiện chỉ hỗ trợ IPv4).`,
      };
    }

    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
      return {
        valid: false,
        error: `Prefix "/${prefixRaw}" không hợp lệ — phải từ /0 đến /32.`,
      };
    }

    return { valid: true };
  }

  if (isValidIPv4(value) || isValidIPv6(value)) {
    return { valid: true };
  }

  return {
    valid: false,
    error: `"${value}" không phải địa chỉ IP hoặc dải CIDR hợp lệ.`,
  };
}

function ipv4ToInt(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

// Dùng để hiển thị preview "IP này có match entry đang gõ không" ở UI nếu
// cần sau này — logic khớp thật khi chặn request nằm ở server.js.
export function ipMatchesEntry(ip: string, entry: string): boolean {
  const normalizedIp = ip.trim();
  const normalizedEntry = entry.trim();

  if (normalizedEntry.includes("/")) {
    if (!isValidIPv4(normalizedIp)) return false;

    const [base, prefixRaw] = normalizedEntry.split("/");
    const prefix = Number(prefixRaw);

    if (!isValidIPv4(base)) return false;

    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;

    return (ipv4ToInt(normalizedIp) & mask) === (ipv4ToInt(base) & mask);
  }

  return normalizedIp === normalizedEntry;
}
