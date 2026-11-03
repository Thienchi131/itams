"use client";

import ModelSearchSelect from "../../stock-in/ModelSearchSelect";

type ModelItem = {
  id: number;
  modelCode: string | null;
  brand: string;
  modelName: string;
  category: { name: string };
};

// Wrapper "use client" mỏng quanh ModelSearchSelect (combobox có state riêng
// đóng/mở + ô tìm kiếm). ĐIỀU KHIỂN (controlled) từ EditAssetForm thay vì tự
// giữ state riêng như trước — EditAssetForm cần biết modelId đang chọn để
// đồng bộ lại Cấu hình thực tế (CPU/RAM/...) mỗi khi đổi Model, xem chú
// thích ở EditAssetForm.tsx.
export default function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: ModelItem[];
  value: string;
  onChange: (id: string) => void;
}) {
  return <ModelSearchSelect models={models} value={value} onChange={onChange} />;
}
