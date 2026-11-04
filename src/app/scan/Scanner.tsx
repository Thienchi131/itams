"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, CameraOff, Search, TriangleAlert } from "lucide-react";
import { lookupScannedCodeAction, type ScanMatch } from "./actions";

type Controls = { stop: () => void };

// Quét QR / mã vạch bằng camera sau của điện thoại (thư viện ZXing, chạy
// hoàn toàn trong trình duyệt — không gửi hình ảnh đi đâu). Đọc được QR do
// ITAMS in và mã vạch serial (Code 128 / Code 39...) hãng in sẵn trên máy.
// Camera chỉ hoạt động trên HTTPS (hoặc localhost).
export default function Scanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<Controls | null>(null);
  const busyRef = useRef(false);

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<ScanMatch[] | null>(null);
  const [lastCode, setLastCode] = useState<string>("");
  const [manual, setManual] = useState("");
  const [isPending, startTransition] = useTransition();

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }

  useEffect(() => () => controlsRef.current?.stop(), []);

  function lookup(code: string) {
    const value = code.trim();
    if (!value) return;
    setLastCode(value);
    setError(null);
    setMatches(null);

    startTransition(async () => {
      const result = await lookupScannedCodeAction(value);
      busyRef.current = false;

      if ("assetId" in result) {
        stopCamera();
        router.push(`/assets/${result.assetId}?returnTo=${encodeURIComponent("/scan")}`);
        return;
      }

      if ("matches" in result) {
        stopCamera();
        setMatches(result.matches);
        return;
      }

      setError(result.error);
    });
  }

  async function startCamera() {
    setError(null);
    setMatches(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Trình duyệt không hỗ trợ camera. Hãy mở bằng Safari/Chrome qua đường dẫn https.");
      return;
    }

    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();

      setScanning(true);
      controlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        videoRef.current!,
        (result) => {
          // Camera bắn kết quả liên tục — chỉ xử lý mã đầu tiên tới khi tra xong.
          if (!result || busyRef.current) return;
          busyRef.current = true;
          if (navigator.vibrate) navigator.vibrate(80);
          lookup(result.getText());
        }
      );
    } catch (err) {
      setScanning(false);
      const name = err instanceof Error ? err.name : "";
      setError(
        name === "NotAllowedError"
          ? "Bạn đã chặn quyền camera. Vào Cài đặt > Safari > Camera (hoặc biểu tượng aA trên thanh địa chỉ) để cho phép, rồi thử lại."
          : "Không mở được camera. Hãy thử lại, hoặc nhập mã bằng tay bên dưới."
      );
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-sm">
        <div className="relative aspect-[3/4] w-full sm:aspect-video">
          <video
            ref={videoRef}
            className={`h-full w-full object-cover ${scanning ? "" : "hidden"}`}
            muted
            playsInline
          />
          {scanning ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-1/2 w-4/5 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-slate-300">
              <Camera size={40} />
              <p className="text-sm">
                Quét tem QR của ITAMS hoặc mã vạch serial trên thiết bị / hộp máy.
              </p>
            </div>
          )}
        </div>
      </div>

      {scanning ? (
        <button
          type="button"
          onClick={stopCamera}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-base font-bold text-slate-800"
        >
          <CameraOff size={18} />
          Tắt camera
        </button>
      ) : (
        <button
          type="button"
          onClick={startCamera}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3.5 text-base font-bold text-white shadow-sm hover:bg-blue-700"
        >
          <Camera size={18} />
          Bật camera để quét
        </button>
      )}

      {isPending && (
        <p className="text-center text-sm font-medium text-slate-500">Đang tra mã “{lastCode}”…</p>
      )}

      {error && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {matches && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <p className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
            {matches.length} thiết bị khớp với “{lastCode}” — chọn đúng máy:
          </p>
          <ul className="divide-y divide-slate-100">
            {matches.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/assets/${m.id}?returnTo=${encodeURIComponent("/scan")}`}
                  className="block px-4 py-3 hover:bg-slate-50"
                >
                  <p className="font-bold text-slate-900">{m.assetTag}</p>
                  <p className="text-sm text-slate-600">{m.label}</p>
                  <p className="text-xs text-slate-400">
                    Serial: {m.serialNumber ?? "-"}
                    {m.warehouse ? ` · ${m.warehouse}` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          lookup(manual);
        }}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <label htmlFor="manual-code" className="text-sm font-semibold text-slate-700">
          Hoặc nhập / quét chữ Asset Tag, Serial
        </label>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Serial chỉ in chữ, không có mã vạch? Trên iPhone: chạm vào ô bên dưới, chọn{" "}
          <b>Quét văn bản</b> (biểu tượng khung chữ trên bàn phím hoặc trong menu khi chạm
          giữ), hướng camera vào dòng S/N rồi bấm <b>Chèn</b>.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            id="manual-code"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            autoCapitalize="characters"
            enterKeyHint="search"
            inputMode="text"
            autoCorrect="off"
            spellCheck={false}
            placeholder="VD: IT-031126-8543000 hoặc C02XJ0L7JG5J"
            className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-base"
          />
          <button
            type="submit"
            disabled={isPending || !manual.trim()}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            <Search size={16} />
            Tra
          </button>
        </div>
      </form>
    </div>
  );
}
