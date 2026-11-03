"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Save, X, TriangleAlert } from "lucide-react";
import { updateAssetAction, type UpdateAssetState } from "./actions";
import ModelPicker from "./ModelPicker";

type ModelItem = {
  id: number;
  modelCode: string | null;
  brand: string;
  modelName: string;
  category: { name: string };
  defaultCpu: string | null;
  defaultRam: string | null;
  defaultStorage: string | null;
  defaultScreen: string | null;
  defaultGpu: string | null;
};

type Asset = {
  id: number;
  modelId: number;
  assetTag: string;
  serialNumber: string;
  color: string | null;
  condition: string | null;
  actualCpu: string | null;
  actualRam: string | null;
  actualStorage: string | null;
  actualScreen: string | null;
  actualGpu: string | null;
  note: string | null;
  model: {
    defaultCpu: string | null;
    defaultRam: string | null;
    defaultStorage: string | null;
    defaultScreen: string | null;
    defaultGpu: string | null;
  };
};

export default function EditAssetForm({
  asset,
  models,
}: {
  asset: Asset;
  models: ModelItem[];
}) {
  const [state, formAction, isPending] = useActionState<UpdateAssetState, FormData>(
    updateAssetAction,
    null
  );

  // Trước đây đổi Model ở đây KHÔNG tự đổi theo Cấu hình thực tế (CPU/RAM/...)
  // — vì đây là input thường với defaultValue, luôn giữ nguyên giá trị actual*
  // GỐC của thiết bị (đã lưu từ lúc nhập kho theo Model CŨ), kể cả khi Admin
  // chọn Model khác hẳn (VD sửa nhầm model lúc nhập). Trang chi tiết hiển thị
  // asset.actualCpu ?? asset.model.defaultCpu — actualCpu vẫn còn giá trị cũ
  // nên không bao giờ rơi xuống default của Model MỚI.
  //
  // Sửa bằng cách nâng modelId + 5 field actual* lên state ở đây (controlled),
  // mỗi khi Admin CHỌN Model khác qua ModelPicker thì xoá trắng 5 field actual*
  // — khớp đúng chú thích đã ghi sẵn dưới ô chọn Model ("để trống sẽ dùng cấu
  // hình mặc định của Model"): actual* rỗng → lưu thành null → trang chi tiết
  // tự rơi xuống dùng defaultCpu/... của Model MỚI. Admin vẫn gõ tay lại nếu
  // thiết bị này thật sự có cấu hình khác biệt so với Model mới.
  const [modelId, setModelId] = useState(String(asset.modelId));
  const [cpu, setCpu] = useState(asset.actualCpu ?? "");
  const [ram, setRam] = useState(asset.actualRam ?? "");
  const [storage, setStorage] = useState(asset.actualStorage ?? "");
  const [screen, setScreen] = useState(asset.actualScreen ?? "");
  const [gpu, setGpu] = useState(asset.actualGpu ?? "");

  const selectedModel = models.find((m) => String(m.id) === modelId);

  function handleModelChange(newModelId: string) {
    setModelId(newModelId);
    setCpu("");
    setRam("");
    setStorage("");
    setScreen("");
    setGpu("");
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={asset.id} />

      {state?.error && (
        <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="space-y-6">
        <section className="rounded-xl border bg-white p-6">
          <h3 className="mb-5 text-lg font-semibold">Thông tin thiết bị</h3>

          <div className="grid grid-cols-2 gap-5">
            <div className="col-span-2">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Model thiết bị <span className="text-red-500">*</span>
              </label>

              <ModelPicker models={models} value={modelId} onChange={handleModelChange} />

              <p className="mt-2 text-xs text-slate-400">
                Đổi lại đúng Model nếu lúc nhập kho bị chọn nhầm (VD: nhập
                &quot;iPhone 16 Plus&quot; nhưng thực tế là &quot;iPhone 16 Pro&quot;).
                Chọn Model khác sẽ TỰ XOÁ 5 ô Cấu hình thực tế bên dưới để
                dùng cấu hình mặc định của Model mới — nếu thiết bị này có
                cấu hình khác biệt, gõ lại tay sau khi đổi Model.
              </p>
            </div>

            <FormInput label="Asset Tag" name="assetTag" defaultValue={asset.assetTag} required />

            <FormInput
              label="Serial Number"
              name="serialNumber"
              defaultValue={asset.serialNumber}
              required
            />

            <FormInput label="Màu sắc" name="color" defaultValue={asset.color ?? ""} />

            <FormInput
              label="Tình trạng"
              name="condition"
              defaultValue={asset.condition ?? ""}
              placeholder="VD: Good / Fair / Cần sửa..."
            />
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6">
          <h3 className="mb-5 text-lg font-semibold">
            Cấu hình thực tế
            <span className="ml-2 text-sm font-normal text-slate-400">
              (để trống sẽ dùng cấu hình mặc định của Model)
            </span>
          </h3>

          <div className="grid grid-cols-2 gap-5">
            <FormInput
              label="CPU"
              name="actualCpu"
              value={cpu}
              onChange={setCpu}
              placeholder={selectedModel?.defaultCpu ?? ""}
            />

            <FormInput
              label="RAM"
              name="actualRam"
              value={ram}
              onChange={setRam}
              placeholder={selectedModel?.defaultRam ?? ""}
            />

            <FormInput
              label="SSD / Storage"
              name="actualStorage"
              value={storage}
              onChange={setStorage}
              placeholder={selectedModel?.defaultStorage ?? ""}
            />

            <FormInput
              label="Màn hình"
              name="actualScreen"
              value={screen}
              onChange={setScreen}
              placeholder={selectedModel?.defaultScreen ?? ""}
            />

            <FormInput
              label="GPU"
              name="actualGpu"
              value={gpu}
              onChange={setGpu}
              placeholder={selectedModel?.defaultGpu ?? ""}
            />
          </div>
        </section>

        <section className="rounded-xl border bg-white p-6">
          <h3 className="mb-5 text-lg font-semibold">Ghi chú</h3>

          <textarea
            name="note"
            defaultValue={asset.note ?? ""}
            className="w-full rounded-lg border px-4 py-3"
            rows={4}
          />
        </section>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Link
          href={`/assets/${asset.id}`}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <X size={18} />
          Hủy
        </Link>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save size={18} />
          {isPending ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
}

function FormInput({
  label,
  name,
  defaultValue,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  // Hỗ trợ cả 2 kiểu: uncontrolled (defaultValue — Asset Tag/Serial/Màu
  // sắc/Tình trạng, không cần phản ứng theo Model) và controlled (value +
  // onChange — 5 field Cấu hình thực tế, cần tự xoá/đổi placeholder mỗi khi
  // đổi Model ở EditAssetForm).
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <input
        name={name}
        defaultValue={onChange ? undefined : defaultValue}
        value={onChange ? value : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border px-4 py-3"
      />
    </div>
  );
}
