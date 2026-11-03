import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { setImportEnabledAction } from "./actions";
import ConfirmActionButton from "@/app/components/ConfirmActionButton";
import { ArrowLeft, Upload, UploadCloud, CircleSlash, CheckCircle2 } from "lucide-react";

const SUCCESS_MESSAGES: Record<string, string> = {
  enabled: "Đã BẬT tính năng Import Excel.",
  disabled: "Đã TẮT tính năng Import Excel.",
};

export default async function ImportSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  await requireRole(["Admin"]);

  const { success } = await searchParams;

  const config = await prisma.importSettings.findUnique({ where: { id: 1 } });
  const enabled = config?.enabled ?? true;

  return (
    <AppLayout>
      <Link
        href="/settings"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        Quay lại Cài đặt
      </Link>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Import Excel</h2>
        <p className="mt-1 text-sm text-slate-500">
          Bật/tắt tính năng import tài sản từ file Excel (Quản lý tài sản &gt;
          Import Excel).
        </p>
      </div>

      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="shrink-0" />
          {SUCCESS_MESSAGES[success] ?? "Thành công."}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
          {enabled ? (
            <UploadCloud size={16} className="text-emerald-600" />
          ) : (
            <CircleSlash size={16} className="text-slate-400" />
          )}
          Trạng thái
        </h3>

        <p className="mb-4 text-sm text-slate-600">
          Hiện đang{" "}
          <span className={enabled ? "font-bold text-emerald-600" : "font-bold text-slate-500"}>
            {enabled ? "BẬT" : "TẮT"}
          </span>
          {config?.updatedBy && (
            <span className="text-slate-400"> — cập nhật lần cuối bởi {config.updatedBy}</span>
          )}
        </p>

        {enabled ? (
          <form action={setImportEnabledAction}>
            <input type="hidden" name="enabled" value="false" />
            <ConfirmActionButton
              label="Tắt Import Excel"
              confirmTitle="Tắt tính năng Import Excel?"
              confirmMessage="Sau khi tắt, nút và trang Import Excel sẽ bị ẩn/khoá với tất cả tài khoản (kể cả Admin/IT) cho tới khi bật lại."
              confirmLabel="Tắt"
              color="rose"
              icon={<CircleSlash size={15} />}
            />
          </form>
        ) : (
          <form action={setImportEnabledAction}>
            <input type="hidden" name="enabled" value="true" />
            <ConfirmActionButton
              label="Bật Import Excel"
              confirmTitle="Bật tính năng Import Excel?"
              confirmMessage="Sau khi bật, mọi tài khoản Admin/IT sẽ dùng lại được nút Import Excel như bình thường."
              confirmLabel="Bật"
              color="blue"
              icon={<Upload size={15} />}
            />
          </form>
        )}
      </div>
    </AppLayout>
  );
}
