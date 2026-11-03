import type { AssetModelTag } from "@prisma/client";

// Hiển thị tag gắn ở Cài đặt > Tag Model (🆗 Cấp phát được / 🅱️ Backup) —
// tag thuộc về AssetModel (dùng chung cho mọi thiết bị cùng model), không
// phải Asset, nên component này nhận thẳng "tag" (đã lấy ra từ asset.model.tag)
// thay vì cả object model, tái dùng được ở bất kỳ đâu có model.tag.
export default function ModelTagBadge({ tag }: { tag: AssetModelTag | null | undefined }) {
  if (!tag) {
    return <span className="text-slate-300">-</span>;
  }

  const config: Record<AssetModelTag, { label: string; className: string }> = {
    OK: {
      label: "🆗 OK",
      className: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    },
    BACKUP: {
      label: "🅱️ Backup",
      className: "bg-amber-100 text-amber-700 ring-amber-200",
    },
  };

  const { label, className } = config[tag];

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ring-1 ${className}`}
    >
      {label}
    </span>
  );
}
