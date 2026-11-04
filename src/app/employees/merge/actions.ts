"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { revalidatePath } from "next/cache";

/**
 * Gộp các nhân viên bị trùng tên (do lỗi nhập liệu, ví dụ import Excel tạo
 * ra 2 employeeCode khác nhau cho cùng 1 người) về 1 bản ghi duy nhất.
 *
 * - Toàn bộ thiết bị đang giữ (Asset.currentEmployeeId) và lịch sử thiết bị
 *   (AssetHistory.fromEmployeeId / toEmployeeId, AssetAssignment) của các
 *   bản trùng được dồn về bản được chọn giữ lại.
 * - Nếu bản giữ lại đang thiếu email/team/chức vụ thì lấy bù từ bản trùng
 *   trước khi xoá, tránh mất dữ liệu.
 * - Các bản trùng bị xoá sau khi đã dồn hết dữ liệu.
 */
export type MergeEmployeesState = { error?: string; success?: string } | null;

export async function mergeEmployeesAction(
  _prevState: MergeEmployeesState,
  formData: FormData
): Promise<MergeEmployeesState> {
  await requireRole(["Admin", "IT"]);

  const groupIds = String(formData.get("groupIds") || "")
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));

  const primaryId = Number(formData.get("primaryId"));

  if (!primaryId || groupIds.length < 2 || !groupIds.includes(primaryId)) {
    return { error: "Dữ liệu gộp nhân viên không hợp lệ." };
  }

  const duplicateIds = groupIds.filter((id) => id !== primaryId);

  await prisma.$transaction(async (tx) => {
    // Dồn thiết bị đang giữ về nhân viên được chọn giữ lại.
    await tx.asset.updateMany({
      where: { currentEmployeeId: { in: duplicateIds } },
      data: { currentEmployeeId: primaryId },
    });

    // Dồn lịch sử thiết bị để timeline không bị mất khi xoá bản trùng.
    await tx.assetHistory.updateMany({
      where: { fromEmployeeId: { in: duplicateIds } },
      data: { fromEmployeeId: primaryId },
    });

    await tx.assetHistory.updateMany({
      where: { toEmployeeId: { in: duplicateIds } },
      data: { toEmployeeId: primaryId },
    });

    await tx.assetAssignment.updateMany({
      where: { employeeId: { in: duplicateIds } },
      data: { employeeId: primaryId },
    });

    // Bù thông tin còn thiếu ở bản giữ lại từ các bản trùng, trước khi xoá.
    const primary = await tx.employee.findUnique({ where: { id: primaryId } });
    const duplicates = await tx.employee.findMany({
      where: { id: { in: duplicateIds } },
    });

    if (primary) {
      const fallbackEmail = duplicates.find((d) => d.email)?.email ?? null;
      const fallbackTeamId = duplicates.find((d) => d.teamId)?.teamId ?? null;
      const fallbackPositionId =
        duplicates.find((d) => d.positionId)?.positionId ?? null;

      await tx.employee.update({
        where: { id: primaryId },
        data: {
          email: primary.email ?? fallbackEmail,
          teamId: primary.teamId ?? fallbackTeamId,
          positionId: primary.positionId ?? fallbackPositionId,
        },
      });
    }

    await tx.employee.deleteMany({ where: { id: { in: duplicateIds } } });
  });

  revalidatePath("/employees");
  return { success: "Đã gộp nhân viên." };
}
