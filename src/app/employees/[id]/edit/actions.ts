"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { redirect } from "next/navigation";
import { withFlash } from "@/lib/flash";

export async function updateEmployeeAction(formData: FormData) {
  await requireRole(["Admin", "IT"]);

  const id = Number(formData.get("id"));
  const employeeCode = String(formData.get("employeeCode") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const teamName = String(formData.get("teamName") || "").trim();
  const positionName = String(formData.get("positionName") || "").trim();
  const isActive = formData.get("isActive") === "true";

  if (!employeeCode || !fullName) {
    redirect(
      `/employees/${id}/edit?error=${encodeURIComponent(
        "Thiếu mã nhân viên hoặc họ tên"
      )}`
    );
  }

  // So sánh không phân biệt hoa/thường — tránh lọt 2 mã coi như trùng với
  // con người thường nhìn vào (VD "EMP-001" vs "emp-001").
  const existed = await prisma.employee.findFirst({
    where: {
      employeeCode: { equals: employeeCode, mode: "insensitive" },
      id: { not: id },
    },
  });

  if (existed) {
    redirect(
      `/employees/${id}/edit?error=${encodeURIComponent(
        "Mã nhân viên này đã tồn tại"
      )}`
    );
  }

  // Chặn sửa tên thành trùng với 1 nhân viên khác đã có sẵn — cùng lý do
  // với lúc tạo mới: báo ngay tại đây thay vì để lọt trùng tên rồi phải
  // phát hiện/gộp thủ công sau ở trang danh sách.
  const existedByName = await prisma.employee.findFirst({
    where: { fullName, id: { not: id } },
  });

  if (existedByName) {
    redirect(
      `/employees/${id}/edit?error=${encodeURIComponent(
        `Nhân viên tên "${fullName}" đã tồn tại (mã: ${existedByName.employeeCode}). Nếu là người khác trùng tên, vẫn có thể lưu bằng cách thêm hậu tố phân biệt vào họ tên.`
      )}`
    );
  }

  // Email không bắt buộc, không unique ở DB — nhưng nếu đã điền thì không
  // nên trùng với người khác (dễ gửi nhầm thông báo/biên bản).
  if (email) {
    const existedByEmail = await prisma.employee.findFirst({
      where: {
        email: { equals: email, mode: "insensitive" },
        id: { not: id },
      },
    });

    if (existedByEmail) {
      redirect(
        `/employees/${id}/edit?error=${encodeURIComponent(
          `Email "${email}" đã được dùng bởi nhân viên "${existedByEmail.fullName}" (mã: ${existedByEmail.employeeCode}).`
        )}`
      );
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

  await prisma.employee.update({
    where: { id },
    data: {
      employeeCode,
      fullName,
      email: email || null,
      teamId,
      positionId,
      isActive,
    },
  });

  redirect(withFlash(`/employees/${id}`, "employee_updated"));
}