"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { withFlash } from "@/lib/flash";

// Dùng khi IT tạo hồ sơ nhân viên trước, chưa có mã nhân viên chính thức
// (thường do HR chưa cấp kịp) — để trống ô "Mã nhân viên" sẽ tự sinh mã
// tạm dạng "TEMP-<tên>" từ họ tên, có thể sửa lại thành mã thật bất kỳ lúc
// nào ở trang Sửa nhân viên. Đặt tiền tố riêng "TEMP-" (khác "PENDING-" mà
// tính năng Import Excel dùng) để 2 nguồn tạo tự động không lẫn vào nhau —
// script dọn dữ liệu import (prisma/undo-dxb-import.ts) chỉ nhận diện theo
// "PENDING-", không đụng tới nhân viên tạo tay kiểu này.
function generateTempEmployeeCode(fullName: string) {
  const slug = fullName
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `TEMP-${slug || "NV"}`;
}

type CreateEmployeeInput = {
  employeeCode: string;
  fullName: string;
  email: string;
  teamName: string;
  positionName: string;
  isActive: boolean;
};

type CreatedEmployee = {
  id: number;
  employeeCode: string;
  fullName: string;
  team: { name: string } | null;
};

type CreateEmployeeResult =
  | { ok: true; employee: CreatedEmployee }
  | { ok: false; error: string };

// Logic tạo nhân viên dùng chung cho cả 2 lối vào: trang "Thêm nhân viên"
// đầy đủ (redirect sau khi lưu) và popup "Tạo nhanh" ngay trong phiếu nhập
// kho khi chọn "Thu hồi" (không được redirect vì sẽ mất dữ liệu form đang
// nhập dở) — tách riêng để 2 action bên dưới không phải chép lại y hệt phần
// validate/chặn trùng.
async function createEmployeeRecord(
  input: CreateEmployeeInput
): Promise<CreateEmployeeResult> {
  let employeeCode = input.employeeCode.trim();
  const fullName = input.fullName.trim();
  const email = input.email.trim();
  const teamName = input.teamName.trim();
  const positionName = input.positionName.trim();

  if (!fullName) {
    return { ok: false, error: "Thiếu họ tên" };
  }

  // Chặn trùng tên ngay lúc tạo — trước đây không kiểm tra gì, để lọt trùng
  // tên vào hệ thống rồi mới phát hiện được sau, ở banner "Phát hiện trùng
  // tên" trên trang danh sách (phải merge thủ công). Giờ báo ngay tại đây,
  // đỡ phải dọn dẹp về sau. So sánh không phân biệt hoa/thường (giống cách
  // getDuplicateEmployeeGroups() ở employee.service.ts tự chuẩn hoá để gom
  // nhóm trùng) — trước đây so khớp phân biệt hoa/thường nên "Nico" và
  // "nico"/"NICO" bị coi là 2 người khác nhau, lọt qua được cảnh báo trùng.
  const existedByName = await prisma.employee.findFirst({
    where: { fullName: { equals: fullName, mode: "insensitive" } },
  });

  if (existedByName) {
    return {
      ok: false,
      error: `Nhân viên tên "${fullName}" đã tồn tại (mã: ${existedByName.employeeCode}). Nếu là người khác trùng tên, vẫn có thể tạo bằng cách thêm hậu tố phân biệt vào họ tên.`,
    };
  }

  if (!employeeCode) {
    employeeCode = generateTempEmployeeCode(fullName);

    const existedTemp = await prisma.employee.findUnique({
      where: { employeeCode },
    });

    if (existedTemp) {
      employeeCode = `${employeeCode}-${Date.now()}`;
    }
  } else {
    // So sánh không phân biệt hoa/thường — "EMP-001" và "emp-001" thực chất
    // là cùng 1 mã, DB unique constraint (employeeCode String @unique) lại
    // phân biệt hoa/thường nên nếu không check kiểu này sẽ lọt được 2 bản
    // ghi coi như trùng mã với con người thường nhìn vào.
    const existed = await prisma.employee.findFirst({
      where: { employeeCode: { equals: employeeCode, mode: "insensitive" } },
    });

    if (existed) {
      return { ok: false, error: "Mã nhân viên này đã tồn tại" };
    }
  }

  // Email không phải trường bắt buộc và không có ràng buộc unique ở DB (có
  // thể để trống) — nhưng nếu ĐÃ điền thì không nên cho trùng với người
  // khác, dễ gây nhầm lẫn khi gửi thông báo/biên bản qua email.
  if (email) {
    const existedByEmail = await prisma.employee.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
    });

    if (existedByEmail) {
      return {
        ok: false,
        error: `Email "${email}" đã được dùng bởi nhân viên "${existedByEmail.fullName}" (mã: ${existedByEmail.employeeCode}).`,
      };
    }
  }

  let teamId: number | null = null;
  let positionId: number | null = null;

  if (teamName) {
    const team = await prisma.team.upsert({
      where: { name: teamName },
      update: {},
      create: { name: teamName },
    });

    teamId = team.id;
  }

  if (positionName) {
    const position = await prisma.position.upsert({
      where: { name: positionName },
      update: {},
      create: { name: positionName },
    });

    positionId = position.id;
  }

  const employee = await prisma.employee.create({
    data: {
      employeeCode,
      fullName,
      email: email || null,
      teamId,
      positionId,
      isActive: input.isActive,
    },
    include: { team: true },
  });

  return { ok: true, employee };
}

export async function createEmployeeAction(formData: FormData) {
  await requireRole(["Admin", "IT"]);

  const result = await createEmployeeRecord({
    employeeCode: String(formData.get("employeeCode") || ""),
    fullName: String(formData.get("fullName") || ""),
    email: String(formData.get("email") || ""),
    teamName: String(formData.get("teamName") || ""),
    positionName: String(formData.get("positionName") || ""),
    isActive: formData.get("isActive") === "true",
  });

  if (!result.ok) {
    redirect(`/employees/new?error=${encodeURIComponent(result.error)}`);
  }

  redirect(withFlash(`/employees/${result.employee.id}`, "employee_created"));
}

export type QuickCreateEmployeeState = CreateEmployeeResult;

// Bản "Tạo nhanh" gọi trực tiếp từ popup trong phiếu nhập kho (mục Thu hồi)
// khi người thu hồi chưa có trong hệ thống — KHÔNG redirect (form nhập kho
// đang nhập dở, chuyển trang sẽ mất dữ liệu), trả thẳng về nhân viên vừa tạo
// (hoặc lỗi) để popup tự chọn luôn vào ô "Thu hồi từ ai". Chỉ nhận Họ tên +
// Mã nhân viên (tuỳ chọn) + Team (tuỳ chọn) — đủ dùng để chọn ngay, có thể bổ
// sung Email/Chức vụ đầy đủ sau ở trang Sửa nhân viên.
export async function quickCreateEmployeeAction(
  formData: FormData
): Promise<QuickCreateEmployeeState> {
  await requireRole(["Admin", "IT"]);

  const result = await createEmployeeRecord({
    employeeCode: String(formData.get("employeeCode") || ""),
    fullName: String(formData.get("fullName") || ""),
    email: "",
    teamName: String(formData.get("teamName") || ""),
    positionName: "",
    isActive: true,
  });

  // Nhánh này KHÔNG redirect (xem giải thích ở comment phía trên) nên khác
  // với createEmployeeAction, Next.js sẽ không tự làm mới Router Cache của
  // trang danh sách /employees — nếu không gọi revalidatePath ở đây, nhân
  // viên vừa tạo vẫn nằm đúng trong DB nhưng tab "Quản lý Nhân viên" mở sau
  // đó (nếu đã từng được cache từ trước) sẽ không thấy cho tới khi tải lại
  // trang cứng. Đây chính là bug đã gặp — thêm dòng này để đồng bộ với các
  // action khác không redirect trong codebase (VD users/actions.ts,
  // employees/merge/actions.ts) đều gọi revalidatePath tương tự.
  if (result.ok) {
    revalidatePath("/employees");
  }

  return result;
}
