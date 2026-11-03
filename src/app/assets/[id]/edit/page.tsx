import AppLayout from "../../../components/AppLayout";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireLogin } from "@/modules/auth/auth.service";
import { ROLE_ADMIN } from "@/modules/auth/permissions";
import EditAssetForm from "./EditAssetForm";
import { ArrowLeft } from "lucide-react";

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const currentUser = await requireLogin();
  const { id } = await params;

  const asset = await prisma.asset.findUnique({
    where: { id: Number(id) },
    include: { model: true },
  });

  if (!asset) notFound();

  // Danh sách Model cho ô chọn — cho phép sửa lại Model của thiết bị khi bị
  // gán nhầm lúc nhập kho (VD: nhập "iPhone 16 Plus" nhưng thực tế là "iPhone
  // 16 Pro"). Dùng chung component ModelSearchSelect với form Nhập kho để
  // đồng nhất trải nghiệm tìm/chọn Model.
  const models = await prisma.assetModel.findMany({
    include: { category: true },
    orderBy: [{ brand: "asc" }, { modelName: "asc" }],
  });

  // Tài khoản bị gán Region chỉ được sửa asset thuộc 1 trong các kho của
  // Region đó — giống hệt gate ở trang chi tiết.
  if (
    currentUser.regionWarehouseIds &&
    (asset.warehouseId === null ||
      !currentUser.regionWarehouseIds.includes(asset.warehouseId))
  ) {
    notFound();
  }

  // Chỉ Admin được vào trang chỉnh sửa thông tin thiết bị (kể cả IT cũng
  // không được) — trang này cho sửa cả Model, ảnh hưởng dữ liệu gốc của
  // thiết bị nên siết chặt hơn các thao tác vận hành khác (bàn giao/thu
  // hồi/chuyển kho IT vẫn làm được bình thường ở trang chi tiết).
  if (currentUser.role.name !== ROLE_ADMIN) {
    notFound();
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <Link
          href={`/assets/${asset.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Quay lại
        </Link>

        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">
            Chỉnh sửa thiết bị
          </h1>
          <p className="mt-1 text-slate-500">
            {asset.model.brand} {asset.model.modelName}
          </p>
        </div>

        <EditAssetForm asset={asset} models={models} />
      </div>
    </AppLayout>
  );
}
