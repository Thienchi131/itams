"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleCheck, TriangleAlert, X } from "lucide-react";
import { FLASH_MESSAGES } from "@/lib/flash";

type Toast = { id: number; message: string; tone: "success" | "error" };

let nextId = 1;

export default function FlashToast() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);

  function push(message: string, tone: Toast["tone"]) {
    const id = nextId++;
    setToasts((list) => [...list, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, 5000);
  }

  // Mã flash trên URL (sau redirect của server action): hiện toast rồi xoá
  // tham số để F5 / Back không hiện lại.
  const flash = searchParams.get("flash");
  useEffect(() => {
    if (!flash) return;
    const message = FLASH_MESSAGES[flash];
    if (message) queueMicrotask(() => push(message, flash.startsWith("err_") ? "error" : "success"));

    const params = new URLSearchParams(searchParams.toString());
    params.delete("flash");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash]);

  // Toast bắn trực tiếp từ client (showToast trong src/lib/flash.ts).
  useEffect(() => {
    function onToast(event: Event) {
      const detail = (event as CustomEvent<{ message: string; tone?: Toast["tone"] }>).detail;
      if (detail?.message) push(detail.message, detail.tone ?? "success");
    }
    window.addEventListener("itams:toast", onToast);
    return () => window.removeEventListener("itams:toast", onToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-4 z-[10000] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex items-start gap-2.5 rounded-2xl border p-4 text-sm font-medium shadow-lg ${
            toast.tone === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {toast.tone === "error" ? (
            <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          ) : (
            <CircleCheck size={18} className="mt-0.5 shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            aria-label="Đóng thông báo"
            onClick={() => setToasts((list) => list.filter((t) => t.id !== toast.id))}
            className="shrink-0 opacity-60 hover:opacity-100"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
