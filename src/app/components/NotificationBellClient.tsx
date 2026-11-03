"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import type { AppNotification } from "@/modules/notification/notification.service";

const PANEL_MARGIN = 16;
const PANEL_WIDTH = 340;

type ClientNotification = Omit<AppNotification, "createdAt"> & {
  createdAt: string | Date;
};

// Tách riêng khỏi AppTopbar để có thể đặt chuông thông báo ở bất kỳ đâu
// trong layout (VD: trong banner Dashboard) mà vẫn dùng chung logic mở/đóng
// panel, đánh dấu đã đọc, và tính lại vị trí panel theo đúng vị trí nút bấm.
export default function NotificationBellClient({
  notifications: initialNotifications,
  unreadCount: initialUnreadCount,
}: {
  notifications: AppNotification[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, right: PANEL_MARGIN, width: PANEL_WIDTH });
  const [notifications, setNotifications] = useState<ClientNotification[]>(
    initialNotifications
  );
  const [unread, setUnread] = useState(initialUnreadCount);
  const pathname = usePathname();
  // Đánh số thứ tự mỗi lần gọi refresh() — nếu 2 request chồng nhau (VD:
  // request lúc mới mount trang còn đang bay thì user đã bấm chuông đọc
  // xong, gọi refresh() lần 2) mà request CŨ lại trả lời VỀ SAU request MỚI
  // (mạng chậm/không theo thứ tự), nó sẽ đè state đúng (unread=0) bằng dữ
  // liệu cũ (unread=9) — đúng hiện tượng "tắt 1 giây rồi hiện lại". Chỉ áp
  // dụng response nếu nó đến từ request MỚI NHẤT đã gửi.
  const latestRequestId = useRef(0);

  // LƯU Ý QUAN TRỌNG: trước đây badge dựa hoàn toàn vào props do server
  // render sẵn (NotificationBell.tsx) — nhưng Next.js prefetch RSC payload
  // của các link (sidebar...) NGAY khi trang vừa mở, TRƯỚC khi user bấm
  // chuông đánh dấu đã đọc. Payload đó bị "đóng băng" số unread CŨ, nên mỗi
  // lần chuyển sang trang đã được prefetch từ trước, badge lại hiện lại dù
  // đã đọc rồi — router.refresh() chỉ làm mới đúng route hiện tại, không
  // xoá các bản prefetch KHÁC nên không giải quyết triệt để.
  //
  // Fix thật: gọi fetch() THẬT (không qua cơ chế cache/prefetch của Next)
  // tới Route Handler riêng mỗi khi đổi trang (usePathname đổi) — luôn lấy
  // đúng số liệu mới nhất từ DB, không phụ thuộc lịch sử điều hướng/prefetch.
  const refresh = useCallback(async (label: string) => {
    const requestId = ++latestRequestId.current;
    const startedAt = new Date().toISOString();

    try {
      const res = await fetch("/api/notifications/summary", { cache: "no-store" });
      if (!res.ok) {
        console.warn(`[bell:${label}] req#${requestId} HTTP ${res.status}`, { startedAt });
        return;
      }

      const data = await res.json();

      // Có request MỚI HƠN đã được gửi sau request này rồi (VD: user bấm
      // chuông ngay khi trang vừa mount) — bỏ qua kết quả cũ, không ghi đè.
      if (requestId !== latestRequestId.current) {
        console.warn(
          `[bell:${label}] req#${requestId} DISCARDED (stale) — server said unreadCount=${data.unreadCount}, but request#${latestRequestId.current} is newer`,
          { startedAt, finishedAt: new Date().toISOString() }
        );
        return;
      }

      console.log(
        `[bell:${label}] req#${requestId} APPLIED unreadCount=${data.unreadCount}`,
        { startedAt, finishedAt: new Date().toISOString() }
      );

      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnread(typeof data.unreadCount === "number" ? data.unreadCount : 0);
    } catch (error) {
      console.error("FETCH_NOTIFICATIONS_ERROR:", error);
    }
  }, []);

  // Bỏ qua lần chạy ĐẦU TIÊN (lúc mới mount) — props ban đầu (initialNotifications/
  // initialUnreadCount) đã được server render mới nhất ngay tại thời điểm
  // request trang này rồi, gọi fetch() thêm lần nữa ngay lúc mount là THỪA
  // và chính là nguồn gây race: nếu user bấm chuông đọc ngay lập tức, request
  // "thừa" này có thể trả lời TRỄ hơn request đánh dấu-đã-đọc, đè số cũ lên
  // state vừa về 0 → hiện tượng "tắt rồi hiện lại". Chỉ thực sự cần gọi lại
  // khi ĐỔI TRANG THẬT (pathname đổi sau lần mount đầu).
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    refresh("pathname-change");
    // Chỉ cần chạy lại khi pathname đổi (chuyển trang) — refresh() bản thân
    // nó ổn định (useCallback rỗng deps), không cần liệt kê thêm.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function handleToggle() {
    const next = !open;
    setOpen(next);

    if (next && unread > 0) {
      // "Vô hiệu hoá" NGAY mọi request refresh() còn đang bay (VD: request
      // lúc trang vừa mount, gửi trước khi user kịp bấm chuông) — nếu không,
      // request cũ đó có thể trả lời VỀ SAU, mang theo số unread CŨ và đè
      // lên state vừa set về 0, gây hiện tượng badge tắt rồi hiện lại.
      latestRequestId.current += 1;
      setUnread(0);
      console.log("[bell:mark-read] clicked, sending POST...", {
        at: new Date().toISOString(),
      });
      try {
        // Dùng fetch() POST thường tới Route Handler thay vì Next.js Server
        // Action — Server Action có cơ chế ngầm tự re-render/merge lại cây
        // Server Component của trang hiện tại kèm theo response, khó kiểm
        // soát chặt và là nghi phạm chính gây badge "tắt rồi hiện lại" dù đã
        // có request-ID guard. fetch() thường thì CHỈ làm đúng 1 việc: ghi
        // DB rồi trả JSON, không kèm theo bất kỳ hành vi tự động nào khác.
        const markRes = await fetch("/api/notifications/mark-read", { method: "POST" });
        const markData = await markRes.json().catch(() => null);
        console.log("[bell:mark-read] POST done", {
          status: markRes.status,
          body: markData,
          at: new Date().toISOString(),
        });
        // Lấy lại đúng số liệu thật từ DB sau khi ghi xong, phòng trường
        // hợp phát sinh thông báo mới ngay trong lúc user đang mở panel.
        refresh("after-mark-read");
      } catch (error) {
        console.error("MARK_NOTIFICATIONS_READ_ERROR:", error);
      }
    }
  }

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;

      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!open || !buttonRef.current) return;

    function updatePosition() {
      if (!buttonRef.current) return;

      const rect = buttonRef.current.getBoundingClientRect();
      const width = Math.min(PANEL_WIDTH, window.innerWidth - PANEL_MARGIN * 2);
      const right = Math.max(PANEL_MARGIN, window.innerWidth - rect.right);

      setPanelPos({ top: rect.bottom + 8, right, width });
    }

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm hover:bg-slate-50"
      >
        <Bell size={19} />

        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: panelPos.top,
            right: panelPos.right,
            width: panelPos.width,
          }}
          className="z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
        >
          <div className="border-b border-slate-100 p-4">
            <p className="font-bold text-slate-900">Thay đổi thiết bị</p>
          </div>

          <div style={{ maxHeight: 420, overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">
                Chưa có thay đổi nào gần đây
              </p>
            ) : (
              notifications.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block border-b border-slate-50 p-4 transition last:border-0 hover:bg-slate-50"
                >
                  <p className="text-sm font-bold text-slate-900">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {item.description}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(item.createdAt).toLocaleString("vi-VN")}
                  </p>
                </Link>
              ))
            )}
          </div>

          <Link
            href="/activity"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 p-3 text-center text-sm font-semibold text-blue-600 hover:bg-blue-50"
          >
            Xem thêm
          </Link>
        </div>
      )}
    </>
  );
}
