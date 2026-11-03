import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { createModelAction } from "./actions";
import SmartSelect from "../[id]/SmartSelect";
import ModelCodeCategoryFields from "./ModelCodeCategoryFields";
import { TriangleAlert } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  duplicate_model: "Model này (cùng Brand + Model Name) đã tồn tại trong danh mục.",
  duplicate_code: "Model Code này đã được dùng bởi 1 model khác trong danh mục.",
};

export default async function NewModelPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRole(["Admin"]);

  const { error } = await searchParams;

  const options = await prisma.masterOption.findMany({
    orderBy: { value: "asc" },
  });

  function getOptions(type: string) {
    return options.filter((item) => item.type === type).map((item) => item.value);
  }

  return (
    <AppLayout>
      <div className="mb-8">
        <h2 className="text-3xl font-bold">Thêm Model</h2>
        <p className="text-slate-500">
          Tạo danh mục model thiết bị dùng cho nhập kho
        </p>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <TriangleAlert size={16} className="shrink-0" />
          {ERROR_MESSAGES[error] ?? "Có lỗi xảy ra, vui lòng thử lại."}
        </div>
      )}

      <form action={createModelAction}>
        <div className="space-y-6">
          <section className="rounded-xl bg-white border p-6">
            <h3 className="mb-5 text-lg font-semibold">Thông tin Model</h3>

            <div className="grid grid-cols-2 gap-5">
              <ModelCodeCategoryFields categoryOptions={getOptions("CATEGORY")} />

              <SmartSelect
                label="Brand"
                name="brand"
                options={getOptions("BRAND")}
                required
              />

              <FormInput
                label="Model Name"
                name="modelName"
                required
              />
            </div>
          </section>

          <section className="rounded-xl bg-white border p-6">
            <h3 className="mb-5 text-lg font-semibold">Cấu hình mặc định</h3>

            <div className="grid grid-cols-2 gap-5">
              <SmartSelect label="CPU" name="defaultCpu" options={getOptions("CPU")} />
              <SmartSelect label="RAM" name="defaultRam" options={getOptions("RAM")} />
              <SmartSelect label="SSD / Storage" name="defaultStorage" options={getOptions("STORAGE")} />
              <SmartSelect label="Screen" name="defaultScreen" options={getOptions("SCREEN")} />
              <SmartSelect label="GPU" name="defaultGpu" options={getOptions("GPU")} />
            </div>
          </section>

          <section className="rounded-xl bg-white border p-6">
            <h3 className="mb-5 text-lg font-semibold">Ghi chú</h3>

            <textarea
              name="note"
              className="w-full rounded-lg border px-4 py-3"
              rows={4}
              placeholder="Ghi chú thêm nếu có"
            />
          </section>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Link href="/models" className="rounded-lg border px-5 py-3">
            Hủy
          </Link>

          <button className="rounded-lg bg-blue-600 px-5 py-3 text-white">
            Lưu Model
          </button>
        </div>
      </form>
    </AppLayout>
  );
}

function FormInput({
  label,
  name,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <input
        name={name}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border px-4 py-3"
      />
    </div>
  );
}