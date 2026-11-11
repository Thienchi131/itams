import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { notFound } from "next/navigation";
import { updateModelAction } from "./actions";
import SmartSelect from "./SmartSelect";
import SubmitButton from "../../components/SubmitButton";
import { TriangleAlert } from "lucide-react";
import ModelBarcodesSection from "./ModelBarcodesSection";

const ERROR_MESSAGES: Record<string, string> = {
  duplicate_model: "Model này (cùng Brand + Model Name) đã tồn tại trong danh mục.",
  duplicate_code: "Model Code này đã được dùng bởi 1 model khác trong danh mục.",
};

export default async function EditModelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  // "q" là từ khoá tìm kiếm đang lọc ở trang danh sách lúc bấm "Sửa" (gắn
  // kèm trong link từ ModelsTable.tsx) — giữ lại qua cả link Hủy lẫn action
  // Lưu, để sau khi lưu xong quay lại ĐÚNG kết quả đang tìm thay vì mất lọc.
  searchParams: Promise<{ error?: string; q?: string }>;
}) {
  await requireRole(["Admin"]);

  const { id } = await params;
  const { error, q } = await searchParams;
  const backHref = `/models${q ? `?q=${encodeURIComponent(q)}` : ""}`;

  const options = await prisma.masterOption.findMany({
    orderBy: { value: "asc" },
  });

  function getOptions(type: string) {
    return options
      .filter((item) => item.type === type)
      .map((item) => item.value);
  }

  const model = await prisma.assetModel.findUnique({
    where: { id: Number(id) },
    include: {
      category: true,
      barcodes: { select: { id: true, code: true }, orderBy: { id: "asc" } },
    },
  });

  if (!model) notFound();

  return (
    <AppLayout>
      <div className="mb-8">
        <h2 className="text-3xl font-bold">Sửa Model</h2>
        <p className="text-slate-500">
          {model.brand} {model.modelName}
        </p>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <TriangleAlert size={16} className="shrink-0" />
          {ERROR_MESSAGES[error] ?? "Có lỗi xảy ra, vui lòng thử lại."}
        </div>
      )}

      <form action={updateModelAction}>
        <input type="hidden" name="id" value={model.id} />
        <input type="hidden" name="returnQuery" value={q ?? ""} />

        <div className="space-y-6">
          <section className="rounded-xl bg-white border p-6">
            <h3 className="mb-5 text-lg font-semibold">Thông tin Model</h3>

            <div className="grid grid-cols-2 gap-5">
              <FormInput
                label="Model Code"
                name="modelCode"
                defaultValue={model.modelCode ?? ""}
                placeholder="Ví dụ: MBP14M4"
                uppercase
              />

              <SmartSelect
                label="Loại thiết bị"
                name="category"
                options={getOptions("CATEGORY")}
                defaultValue={model.category.name}
                required
              />

              <SmartSelect
                label="Brand"
                name="brand"
                options={getOptions("BRAND")}
                defaultValue={model.brand}
                required
              />

              <FormInput
                label="Model Name"
                name="modelName"
                defaultValue={model.modelName}
                required
              />
            </div>
          </section>

          <section className="rounded-xl bg-white border p-6">
            <h3 className="mb-5 text-lg font-semibold">Cấu hình mặc định</h3>

            <div className="grid grid-cols-2 gap-5">
              <SmartSelect
                label="CPU"
                name="defaultCpu"
                options={getOptions("CPU")}
                defaultValue={model.defaultCpu}
              />

              <SmartSelect
                label="RAM"
                name="defaultRam"
                options={getOptions("RAM")}
                defaultValue={model.defaultRam}
              />

              <SmartSelect
                label="SSD / Storage"
                name="defaultStorage"
                options={getOptions("STORAGE")}
                defaultValue={model.defaultStorage}
              />

              <SmartSelect
                label="Screen"
                name="defaultScreen"
                options={getOptions("SCREEN")}
                defaultValue={model.defaultScreen}
              />

              <SmartSelect
                label="GPU"
                name="defaultGpu"
                options={getOptions("GPU")}
                defaultValue={model.defaultGpu}
              />
            </div>
          </section>

          <section className="rounded-xl bg-white border p-6">
            <h3 className="mb-5 text-lg font-semibold">Ghi chú</h3>

            <textarea
              name="note"
              defaultValue={model.note ?? ""}
              className="w-full rounded-lg border px-4 py-3"
              rows={4}
              placeholder="Ghi chú thêm nếu có"
            />
          </section>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Link href={backHref} className="rounded-lg border px-5 py-3">
            Hủy
          </Link>

          <SubmitButton className="rounded-lg bg-blue-600 px-5 py-3 text-white">
            Lưu thay đổi
          </SubmitButton>
        </div>
      </form>

      {/* Ngoài <form> sửa model (không lồng form) — gắn/xoá mã lưu ngay,
          không cần bấm "Lưu thay đổi". */}
      <ModelBarcodesSection modelId={model.id} initialBarcodes={model.barcodes} />
    </AppLayout>
  );
}

function FormInput({
  label,
  name,
  defaultValue,
  placeholder,
  required,
  uppercase = false,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  // Chỉ dùng cho Model Code — hiển thị chữ hoa ngay lúc gõ (chỉ đổi CÁCH
  // HIỂN THỊ qua CSS, không đổi giá trị thật đang gõ) để khớp với giá trị
  // thật sẽ được lưu, vì updateModelAction luôn chuẩn hoá Model Code thành
  // chữ hoa trước khi ghi DB — tránh gây hiểu nhầm khi nhìn thấy 1 kiểu lúc
  // gõ nhưng lưu xong lại hiện ra kiểu khác.
  uppercase?: boolean;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className={`w-full rounded-lg border px-4 py-3 ${uppercase ? "uppercase placeholder:normal-case" : ""}`}
      />
    </div>
  );
}