"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImageIcon, Truck } from "lucide-react";

// Nhắc việc khi đăng nhập. Hiện 1 lần mỗi lần ĐĂNG NHẬP: cờ sessionStorage bị
// XOÁ mỗi khi vào trang /login (xem ClearLoginRemindersFlag), nên đăng xuất ->
// đăng nhập lại là nhắc lại; trong cùng phiên chuyển trang thì không nhắc lại.
const STORAGE_KEY = "itamsLoginRemindersShown";

export default function LoginReminders({
  handoverTotal,
  handoverOverdue,
  transferCount,
}: {
  handoverTotal: number;
  handoverOverdue: number;
  transferCount: number;
}) {
  const [open, setOpen] = useState(false);
  const hasAny = handoverTotal > 0 || transferCount > 0;

  useEffect(() => {
    if (!hasAny) return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    sessionStorage.setItem(STORAGE_KEY, "1");
    setOpen(true);
  }, [hasAny]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
        <h2 className="text-center text-2xl font-extrabold text-slate-900">
          Nhắc việc cần làm
        </h2>

        <div className="mt-6 space-y-4">
          {transferCount > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <Truck size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900">Chờ xác nhận nhập kho</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  Có <b>{transferCount}</b> thiết bị đang chuyển đến kho bạn phụ
                  trách, cần xác nhận nhập kho.
                </p>
                <Link
                  href="/assets/transfers"
                  onClick={() => setOpen(false)}
                  className="mt-2 inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Xác nhận ngay →
                </Link>
              </div>
            </div>
          )}

          {handoverTotal > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <ImageIcon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900">Bổ sung ảnh bàn giao</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  Có <b>{handoverTotal}</b> thiết bị do bạn cấp phát chưa có ảnh
                  xác nhận
                  {handoverOverdue > 0 ? (
                    <>
                      {" "}
                      (<b className="text-rose-600">{handoverOverdue} quá hạn</b>)
                    </>
                  ) : null}
                  .
                </p>
                <Link
                  href="/assets/handover-photos"
                  onClick={() => setOpen(false)}
                  className="mt-2 inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Bổ sung ngay →
                </Link>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-6 w-full rounded-2xl border border-slate-300 bg-white px-5 py-3 text-base font-bold text-slate-700 transition hover:bg-slate-100"
        >
          Để sau
        </button>
      </div>
    </div>
  );
}
