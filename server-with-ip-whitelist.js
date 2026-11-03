// Custom server thay cho ".next/standalone/server.js" (bản Next.js tự sinh
// lúc build) — lý do cần viết tay:
//
// 1) VPS chạy Nginx (ngoài Docker, quản lý bởi systemd — KHÔNG nằm trong
//    docker-compose.yml của repo này) làm reverse proxy trước container,
//    terminate SSL (Let's Encrypt) cho domain rồi proxy_pass vào
//    "http://127.0.0.1:3000". Nginx đã set đúng "X-Forwarded-For"/"X-Real-IP"
//    = IP client thật.
//
//    NHƯNG vì Nginx (chạy trên chính VPS, ngoài Docker) gọi vào PORT ĐÃ
//    PUBLISH của container (docker-compose `ports: ["3000:3000"]`), cơ chế
//    NAT của Docker khi host tự gọi vào cổng publish của chính nó ("hairpin
//    NAT") khiến container LUÔN thấy IP kết nối TCP là địa chỉ gateway nội
//    bộ của mạng Docker (VD 172.18.0.1), KHÔNG BAO GIỜ là IP thật — dù
//    Nginx đã set header đúng. Bug thực tế gặp phải: version cũ của file
//    này GHI ĐÈ mù quáng "x-forwarded-for" bằng IP socket thô trong MỌI
//    trường hợp, vô tình xoá mất giá trị đúng Nginx đã gửi, khiến toàn bộ
//    hệ thống nhìn ai cũng ra "172.18.0.1" — bật whitelist IP là tự khoá
//    hết tất cả (kể cả Admin) ra ngoài.
//
//    Cách sửa: chỉ tin tưởng header "x-forwarded-for" do phía trước gửi lên
//    KHI địa chỉ socket thô là 1 địa chỉ private/loopback (127.0.0.1,
//    10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) — về mặt kỹ thuật, KHÔNG ai
//    từ Internet giả mạo được để socket thô hiện ra là 1 địa chỉ private
//    (TCP handshake cần route ngược về đúng client thật, không spoof được),
//    nên hễ socket thô là private thì chắc chắn kết nối đến từ Nginx trên
//    cùng máy chủ — an toàn để tin header. Ngược lại (ai đó gõ thẳng
//    IP:3000 bỏ qua Nginx/SSL) thì xử lý y hệt bản cũ: bỏ qua hoàn toàn
//    header client tự gửi, chỉ tin socket thô (lúc này chính là IP thật của
//    họ vì không qua NAT nội bộ nào nữa).
//
// 2) Chặn IP không nằm trong whitelist (khi tính năng được bật ở Cài đặt >
//    Whitelist IP) phải chặn TOÀN BỘ hệ thống, kể cả trang đăng nhập —
//    middleware.ts của Next.js chạy Edge runtime, không gọi được Prisma, nên
//    không đủ để làm việc này. Chặn ở đây (tầng HTTP server thô, trước khi
//    Next.js nhận request) mới bao được toàn bộ, kể cả static asset.
//
// Danh sách IP đọc từ 2 bảng IpWhitelistEntry/IpWhitelistConfig, cache trong
// bộ nhớ và refresh mỗi 30s — KHÔNG query DB trên từng request để tránh tăng
// độ trễ/tải DB không cần thiết.
//
// AN TOÀN / TRÁNH TỰ KHOÁ MÌNH: nếu DB lỗi hoặc chưa load được lần nào, mặc
// định KHÔNG chặn (fail-open) — 1 sự cố DB tạm thời không nên biến thành sự
// cố "không ai vào được hệ thống". Ngoài ra có biến môi trường
// IP_WHITELIST_BYPASS=true để tắt hẳn việc kiểm tra này bất kể cấu hình
// trong DB là gì — dùng khi lỡ tự khoá mình ra ngoài, sửa .env trên VPS rồi
// deploy lại là vào được ngay, không cần đụng tới DB.

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { PrismaClient } = require("@prisma/client");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

const BYPASS = process.env.IP_WHITELIST_BYPASS === "true";
const CACHE_TTL_MS = 30_000;

// enabled=false lúc khởi động (trước khi load lần đầu thành công) là lựa
// chọn CÓ CHỦ ĐÍCH — xem ghi chú "fail-open" ở trên.
let cache = { enabled: false, entries: [], loadedAt: 0 };
let refreshInFlight = null;

async function refreshWhitelist() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const [config, entries] = await Promise.all([
        prisma.ipWhitelistConfig.findUnique({ where: { id: 1 } }),
        prisma.ipWhitelistEntry.findMany({ select: { cidr: true } }),
      ]);

      cache = {
        enabled: Boolean(config && config.enabled),
        entries: entries.map((e) => e.cidr),
        loadedAt: Date.now(),
      };
    } catch (err) {
      console.error(
        "[ip-whitelist] Không load được cấu hình từ DB, giữ nguyên cache cũ:",
        err
      );
      // Vẫn cập nhật loadedAt để không spam thử lại liên tục trên mỗi request
      // trong lúc DB đang gặp sự cố — lần refresh định kỳ tiếp theo sẽ thử lại.
      cache.loadedAt = Date.now();
    }
  })();

  await refreshInFlight;
  refreshInFlight = null;
}

function normalizeIp(raw) {
  if (!raw) return "";
  // Socket IPv4-mapped IPv6 (dual-stack) trả về dạng "::ffff:1.2.3.4" — bỏ
  // tiền tố để so khớp được với entry IPv4 thường.
  return raw.replace(/^::ffff:/, "");
}

function isLoopback(ip) {
  return ip === "127.0.0.1" || ip === "::1";
}

// Địa chỉ private/loopback theo RFC 1918 + localhost — xem giải thích đầy đủ
// ở đầu file (mục 1) về lý do dùng dải này để quyết định có tin header
// "x-forwarded-for" từ phía trước hay không.
const PRIVATE_IP_REGEX =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

function isPrivateOrLoopback(ip) {
  return ip === "::1" || PRIVATE_IP_REGEX.test(ip);
}

// Quyết định IP client THẬT cho request hiện tại — xem giải thích đầy đủ ở
// đầu file (mục 1).
function resolveClientIp(req) {
  const rawIp = normalizeIp((req.socket && req.socket.remoteAddress) || "");

  if (isPrivateOrLoopback(rawIp)) {
    const forwardedHeader = req.headers["x-forwarded-for"];
    const forwardedIp = forwardedHeader
      ? normalizeIp(String(forwardedHeader).split(",")[0].trim())
      : "";

    if (forwardedIp) return forwardedIp;
  }

  return rawIp;
}

function ipv4ToInt(ip) {
  const parts = ip.split(".").map(Number);

  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return null;
  }

  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

// Bản sao rút gọn của ipMatchesEntry() trong src/lib/ip-whitelist.ts — file
// đó là TypeScript, được build bởi Next.js, KHÔNG import được từ đây (file
// này chạy bằng `node` thuần, trước cả khi Next.js khởi động). Sửa logic
// khớp IP thì nhớ sửa cả 2 nơi cho khớp nhau.
function ipMatchesEntry(ip, entry) {
  if (entry.includes("/")) {
    const [base, prefixRaw] = entry.split("/");
    const prefix = Number(prefixRaw);
    const ipInt = ipv4ToInt(ip);
    const baseInt = ipv4ToInt(base);

    if (ipInt === null || baseInt === null || Number.isNaN(prefix)) {
      return false;
    }

    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;

    return (ipInt & mask) === (baseInt & mask);
  }

  return ip === entry;
}

function isIpAllowed(ip) {
  if (!cache.enabled) return true;
  if (isLoopback(ip)) return true;

  return cache.entries.some((entry) => ipMatchesEntry(ip, entry));
}

function sendBlockedResponse(res, ip) {
  res.statusCode = 403;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(`<!DOCTYPE html>
<html lang="vi">
<head><meta charset="utf-8"><title>Truy cập bị chặn</title></head>
<body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #0f172a;">
  <div style="text-align: center; max-width: 420px; padding: 24px;">
    <h1 style="font-size: 22px; margin-bottom: 12px;">Truy cập bị chặn</h1>
    <p style="color: #475569; line-height: 1.6;">
      Địa chỉ IP <strong>${ip}</strong> của bạn không nằm trong danh sách được
      phép truy cập hệ thống này. Vui lòng liên hệ Admin để được thêm vào
      whitelist.
    </p>
  </div>
</body>
</html>`);
}

app
  .prepare()
  .then(() => refreshWhitelist())
  .then(() => {
    createServer(async (req, res) => {
      try {
        // Ghi đè (không phải append) header client gửi lên — đảm bảo mọi
        // code phía sau (rate-limit đăng nhập, log...) đọc header này đều
        // nhận đúng 1 giá trị đã được xác thực bởi resolveClientIp(), không
        // phải giá trị client tự ý gắn vào request của họ. Xem giải thích
        // đầy đủ ở đầu file (mục 1) về lý do không thể dùng thẳng socket IP
        // như trước (Nginx đứng trước gây hairpin NAT).
        const ip = resolveClientIp(req);
        req.headers["x-forwarded-for"] = ip;

        if (!BYPASS) {
          if (Date.now() - cache.loadedAt > CACHE_TTL_MS) {
            // Không await — dùng cache hiện có cho request này, refresh chạy
            // nền cho các request sau, tránh cộng thêm độ trễ DB vào mỗi request.
            refreshWhitelist();
          }

          if (!isIpAllowed(ip)) {
            sendBlockedResponse(res, ip);
            return;
          }
        }

        const parsedUrl = parse(req.url, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error("Error occurred handling", req.url, err);
        res.statusCode = 500;
        res.end("internal server error");
      }
    })
      .once("error", (err) => {
        console.error(err);
        process.exit(1);
      })
      .listen(port, () => {
        console.log(
          `> Ready on http://${hostname}:${port}${
            BYPASS ? " (IP_WHITELIST_BYPASS=true — đang TẮT kiểm tra whitelist IP)" : ""
          }`
        );
      });
  });
