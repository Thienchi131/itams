"use client";

import { useState } from "react";
import { Download, X, CheckCircle2, TriangleAlert } from "lucide-react";

type Option = {
  id: number;
  label: string;
};

type ExportStatus = "idle" | "loading" | "success" | "error";

export default function ExportAssetsModal({
  warehouses,
  teams,
  categories,
}: {
  warehouses: Option[];
  teams: Option[];
  categories: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Trước đây form submit thẳng (GET tới /assets/export) — trình duyệt tự
  // tải file xuống nhưng không có cách nào biết lúc nào xong để đóng popup.
  // Giờ tự fetch lấy file dạng blob rồi tự kích hoạt tải xuống — biết chính
  // xác lúc nào xong để báo "Đã export xong" và tự đóng popup.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg(null);

    const formData = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    formData.forEach((value, key) => {
      if (typeof value === "string" && value) params.set(key, value);
    });

    try {
      const res = await fetch(`/assets/export?${params.toString()}`);

      if (!res.ok) {
        throw new Error("Export thất bại, vui lòng thử lại.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "itams-assets-export.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setStatus("success");

      // Hiện thông báo trong chốc lát cho thấy rõ đã tải xong, rồi tự đóng
      // popup — không cần Admin/IT phải tự bấm Hủy sau khi export xong.
      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 1200);
    } catch (error) {
      setStatus("error");
      setErrorMsg(
        error instanceof Error ? error.message : "Có lỗi xảy ra, vui lòng thử lại."
      );
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setStatus("idle");
          setErrorMsg(null);
          setOpen(true);
        }}
        className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
      >
        Export CSV
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Export danh sách tài sản</h3>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <p className="mt-2 text-sm text-slate-500">
              Chọn điều kiện lọc, để trống mục nào thì export tất cả theo mục đó.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              <div>
                <label className="text-sm font-medium">Kho</label>
                <select
                  name="warehouseId"
                  defaultValue=""
                  className="mt-2 w-full rounded-lg border px-4 py-3 text-sm"
                >
                  <option value="">Tất cả các kho</option>

                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Team</label>
                <select
                  name="teamId"
                  defaultValue=""
                  className="mt-2 w-full rounded-lg border px-4 py-3 text-sm"
                >
                  <option value="">Tất cả các team</option>

                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">Loại thiết bị</label>
                <select
                  name="categoryId"
                  defaultValue=""
                  className="mt-2 w-full rounded-lg border px-4 py-3 text-sm"
                >
                  <option value="">Tất cả loại thiết bị</option>

                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>

              {status === "success" && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
                  <CheckCircle2 size={16} className="shrink-0" />
                  Đã export xong!
                </div>
              )}

              {status === "error" && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  <TriangleAlert size={16} className="shrink-0" />
                  {errorMsg}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-8">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  Hủy
                </button>

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Download size={16} />
                  {status === "loading" ? "Đang export..." : "Export"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
