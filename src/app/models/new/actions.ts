"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { redirect } from "next/navigation";
import { withFlash } from "@/lib/flash";

function getSmartValue(formData: FormData, name: string) {
  const selected = String(formData.get(`${name}Select`) || "").trim();

  if (selected === "__OTHER__") {
    return String(formData.get(`${name}Other`) || "").trim();
  }

  return selected;
}

async function saveMasterOption(type: string, value?: string | null) {
  if (!value) return;

  await prisma.masterOption.upsert({
    where: {
      type_value: {
        type,
        value,
      },
    },
    update: {},
    create: {
      type,
      value,
    },
  });
}

// AssetCategory.name @unique so khớp PHÂN BIỆT hoa/thường ở tầng DB — dùng
// thẳng prisma.assetCategory.upsert({ where: { name } }) trước đây khiến gõ
// lệch case (VD "MacBook" vs "Macbook") tự tạo ra 2 category trùng nghĩa
// khác nhau (xem prisma/merge-duplicate-categories.ts, đã dùng để gộp lại 1
// lần). Tìm trước theo kiểu KHÔNG phân biệt hoa/thường, chỉ tạo mới nếu thật
// sự chưa có, để không tái diễn.
async function findOrCreateCategory(name: string) {
  const existing = await prisma.assetCategory.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) return existing;

  return prisma.assetCategory.create({ data: { name } });
}

export async function createModelAction(formData: FormData) {
  await requireRole(["Admin"]);

  // Model Code luôn chuẩn hoá thành CHỮ HOA trước khi lưu (giống Warehouse
  // Code) — vừa nhất quán hiển thị, vừa tránh 2 mã chỉ khác hoa/thường bị
  // coi là khác nhau (VD "ip16pl128" vs "IP16PL128").
  const modelCode = String(formData.get("modelCode") || "").trim().toUpperCase();
  const categoryName = getSmartValue(formData, "category");
  const brand = getSmartValue(formData, "brand");
  const modelName = String(formData.get("modelName") || "").trim();

  const cpu = getSmartValue(formData, "defaultCpu");
  const ram = getSmartValue(formData, "defaultRam");
  const storage = getSmartValue(formData, "defaultStorage");
  const screen = getSmartValue(formData, "defaultScreen");
  const gpu = getSmartValue(formData, "defaultGpu");
  const note = String(formData.get("note") || "").trim();

  const category = await findOrCreateCategory(categoryName);

  await saveMasterOption("CATEGORY", categoryName);
  await saveMasterOption("BRAND", brand);
  await saveMasterOption("CPU", cpu);
  await saveMasterOption("RAM", ram);
  await saveMasterOption("STORAGE", storage);
  await saveMasterOption("SCREEN", screen);
  await saveMasterOption("GPU", gpu);

  // AssetModel có ràng buộc unique (brand, modelName) — check trước và
  // redirect kèm ?error=... thay vì để lỗi P2002 rơi thẳng xuống, làm crash
  // trang (error boundary) thay vì thông báo gọn cho Admin.
  // Check trùng brand+modelName KHÔNG phân biệt hoa/thường — trước đây so
  // khớp chính xác từng ký tự (equals mặc định của Prisma), nên "MacBook
  // Pro" và "macbook pro" bị coi là 2 model khác nhau, lọt qua check này rồi
  // vẫn tạo được model trùng nghĩa (giống lỗi đã gặp và sửa ở AssetCategory).
  const existed = await prisma.assetModel.findFirst({
    where: {
      brand: { equals: brand, mode: "insensitive" },
      modelName: { equals: modelName, mode: "insensitive" },
    },
  });

  if (existed) {
    redirect("/models/new?error=duplicate_model");
  }

  // modelCode CŨNG unique riêng ở DB (khác ràng buộc (brand, modelName) ở
  // trên) — 2 model khác brand/tên hoàn toàn vẫn có thể lỡ gõ trùng Model
  // Code. Trước đây không check riêng cái này, để lọt xuống prisma.create()
  // ném lỗi P2002 không được bắt, Admin thấy trang lỗi trắng chung chung
  // thay vì thông báo rõ ràng. Vẫn dùng mode "insensitive" (dù giờ luôn lưu
  // hoa) để bắt được cả các mã CŨ trong DB từ trước khi có chuẩn hoá này.
  if (modelCode) {
    const existedCode = await prisma.assetModel.findFirst({
      where: { modelCode: { equals: modelCode, mode: "insensitive" } },
    });

    if (existedCode) {
      redirect("/models/new?error=duplicate_code");
    }
  }

  await prisma.assetModel.create({
    data: {
      modelCode: modelCode || null,
      categoryId: category.id,
      brand,
      modelName,
      defaultCpu: cpu || null,
      defaultRam: ram || null,
      defaultStorage: storage || null,
      defaultScreen: screen || null,
      defaultGpu: gpu || null,
      note: note || null,
    },
  });

  redirect(withFlash("/models", "model_created"));
}