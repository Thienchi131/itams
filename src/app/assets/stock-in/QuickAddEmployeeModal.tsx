"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { UserPlus, X, TriangleAlert, Loader2 } from "lucide-react";
import { quickCreateEmployeeAction } from "../../employees/new/actions";

type CreatedEmployee = {
  id: number;
  employeeCode: string;
  fullName: string;
  team: { name: string } | null;
};

// Popup "Tạo nhanh" — dùng khi người thu hồi thiết bị chưa có hồ sơ trong hệ
// thống. Chỉ hỏi đúng 3 trường tối thiểu (Họ tên bắt buộc, Mã NV/Team tuỳ
// chọn) để tạo xong ngay và chọn luôn, KHÔNG điều hướng sang trang "Thêm
// nhân viên" — vì phiếu nhập kho đang nhập dở, rời trang sẽ mất hết dữ liệu
// các dòng Model/Serial đã nhập. Có thể vào trang Sửa nhân viên bổ sung thêm
// Email/Chức vụ sau.
export default function QuickAddEmployeeModal({
  onCreated,
}: {
  onCreated: (employee: CreatedEmployee) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    // Gọi Server Action trực tiếp như 1 hàm async bình thường (không qua
    // <form action={...}>/useActionState) nên nếu nó throw, promise chỉ bị
    // reject ở đây — KHÔNG có error boundary nào của Next.js tự bắt được
    // (error.tsx chỉ bắt lỗi lúc RENDER, không bắt lỗi từ 1 await trong event
    // handler). Trước đây không có try/catch: gặp lỗi bất kỳ (mất kết nối DB
    // tạm thời, timeout...) là nút "Tạo & chọn" treo mãi ở "Đang tạo...",
    // KHÔNG có gì được tạo nhưng cũng không báo lỗi gì — trông như đã xong.
    try {
      const result = await quickCreateEmployeeAction(formData);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      onCreated(result.employee);
      setOpen(false);
    } catch (err) {
      console.error("[QuickAddEmployeeModal]", err);
      setError(
        "Có lỗi xảy ra khi tạo nhân viên, vui lòng thử lại. Nếu vẫn lỗi, liên hệ Admin kiểm tra log server."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:underline"
      >
        <UserPlus size={14} />
        Chưa có trong hệ thống? Tạo nhân viên mới
      </button>

      {open &&
        // Render qua Portal thẳng vào document.body — KHÔNG được render popup
        // này lồng nguyên trong cây DOM như 1 children bình thường, vì
        // QuickAddEmployeeModal luôn được đặt bên trong <form> to của cả
        // phiếu nhập kho (StockInForm.tsx). <form> lồng trong <form> là HTML
        // không hợp lệ — trình duyệt không xử lý đúng submit event của form
        // BÊN TRONG này nữa, mà coi nút "Tạo & chọn" như đang submit luôn
        // <form> NGOÀI CÙNG theo kiểu GET mặc định của trình duyệt (mang
        // theo đúng các field fullName/employeeCode/teamName của popup này
        // dính vào query string) — tải lại nguyên trang, KHÔNG hề gọi
        // handleSubmit/Server Action nào cả. Đây chính là nguyên nhân bug
        // "bấm Tạo & chọn không thấy nhân viên được tạo" — đã xác nhận qua
        // tab Network: request là 1 "document" GET tới
        // "stock-in?fullName=...", không phải request gọi Server Action.
        // Dùng Portal để <form> của popup này nằm NGOÀI <form> của
        // StockInForm trong DOM thực tế, tránh lồng form hoàn toàn.
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Tạo nhân viên nhanh</h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Tạo nhanh để chọn ngay — có thể bổ sung đầy đủ thông tin sau ở trang Nhân viên.
              </p>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-bold text-slate-700">
                    Họ tên <span className="text-red-500">*</span>
                  </label>
                  <input name="fullName" required autoFocus className="input-style" />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-bold text-slate-700">
                    Mã nhân viên
                  </label>
                  <input
                    name="employeeCode"
                    className="input-style"
                    placeholder="Để trống sẽ tự tạo mã tạm"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-bold text-slate-700">Team</label>
                  <input
                    name="teamName"
                    className="input-style"
                    placeholder="VD: IT / Finance / HR"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Hủy
                  </button>

                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pending && <Loader2 size={16} className="animate-spin" />}
                    {pending ? "Đang tạo..." : "Tạo & chọn"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
