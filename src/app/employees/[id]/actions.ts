"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, assertWarehouseScope } from "@/modules/auth/auth.service";
import { AssetStatus, AssignmentType, HistoryAction } from "@prisma/client";
import { redirect } from "next/navigation";
import {
  ASSIGNMENT_TYPE_LABEL,
  computeAssignmentDueAt,
} from "@/modules/asset/asset.helpers";
import { withFlash } from "@/lib/flash";
import { resolveReturnWarehouse } from "@/modules/warehouse/return-destination";
import {
  extractHandoverPhotos,
  removeHandoverPhotoFiles,
  trySaveHandoverPhotoFiles,
} from "@/modules/asset/handover-photo.service";
import { computeHandoverPhotoDueAt } from "@/modules/asset/handover-photo.helpers";

export type EmployeeActionState = { error: string } | null;

// Chấp nhận đúng các giá trị của enum AssignmentType — cùng logic với
// assets/[id]/actions.ts (không tách file dùng chung vì đây là 2 Server
// Action file độc lập, hàm nhỏ nên trùng lặp không đáng kể).
function parseAssignmentType(value: FormDataEntryValue | null): AssignmentType | null {
  return value === "PERMANENT" ||
    value === "LOAN" ||
    value === "WARRANTY_HOLD" ||
    value === "EXCHANGE"
    ? value
    : null;
}

function parseAssetIds(formData: FormData) {
  return String(formData.get("assetIds") || "")
    .split(",")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
}

/**
 * Thu hồi hàng loạt — chọn 1 hoặc nhiều thiết bị đang giữ bởi 1 nhân viên,
 * trả hết về kho (IN_STOCK) trong 1 lần thao tác. Mỗi thiết bị có tick riêng
 * Adapter/Cáp sạc (gửi kèm theo dạng accessories_<assetId>_adapter/cable)
 * để ghi đúng phụ kiện thực tế trả kèm — không dùng chung 1 cặp tick cho cả
 * batch vì mỗi thiết bị có thể thiếu phụ kiện khác nhau.
 */
export async function bulkReturnAssetsAction(
  _prevState: EmployeeActionState,
  formData: FormData
): Promise<EmployeeActionState> {
  const currentUser = await requireRole(["Admin", "IT"]);

  const employeeId = Number(formData.get("employeeId"));
  const assetIds = parseAssetIds(formData);
  const reason = String(formData.get("returnReason") || "").trim();
  const noteInput = String(formData.get("returnNote") || "").trim();
  // Áp dụng chung cho cả batch — xem ghi chú ở returnAssetAction
  // (assets/[id]/actions.ts) về lý do dùng REPAIR thay vì IN_STOCK.
  const sendToRepair = formData.get("sendToRepair") === "on";

  if (assetIds.length === 0) {
    return { error: "Vui lòng chọn ít nhất 1 thiết bị để thu hồi." };
  }

  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
  });

  // Danh sách thiết bị hiển thị ở panel này lấy TOÀN BỘ thiết bị nhân viên
  // đang giữ, không lọc theo kho của người xem — 1 IT bị gán kho X vốn đã có
  // thể tick chọn thiết bị của kho Y nếu nhân viên đó tình cờ giữ cả 2. CỐ
  // TÌNH KHÔNG gọi assertWarehouseScope() ở đây (khác các action khác trong
  // file này) — Thu hồi hàng loạt được PHÉP thực hiện dù thiết bị đang thuộc
  // kho khác kho của IT đang thao tác, xem giải thích đầy đủ ở
  // returnAssetAction (assets/[id]/actions.ts). Sau khi thu hồi, mỗi thiết
  // bị tự động "nhập kho" vào đúng kho của IT đang thực hiện.
  const destination = await resolveReturnWarehouse(
    currentUser,
    formData.get("returnWarehouseId"),
    null
  );

  if ("error" in destination) {
    return { error: destination.error };
  }

  const destinationWarehouseId = destination.id;

  let processedCount = 0;

  for (const asset of assets) {
    // Chỉ thu hồi thiết bị đang thực sự ASSIGNED cho đúng nhân viên này —
    // phòng trường hợp dữ liệu đã đổi giữa lúc mở trang và lúc submit.
    if (asset.status !== AssetStatus.ASSIGNED || asset.currentEmployeeId !== employeeId) {
      continue;
    }

    processedCount++;

    const hasAdapter = formData.get(`hasAdapter_${asset.id}`) === "on";
    const hasCable = formData.get(`hasCable_${asset.id}`) === "on";

    const missingAccessories = [
      !hasAdapter && "Adapter",
      !hasCable && "Dây sạc",
    ].filter(Boolean) as string[];

    // Nếu IT không bị gán đúng 1 kho cụ thể (Admin, hoặc phụ trách cả Region
    // nhiều kho) thì không có "kho của tôi" rõ ràng để suy ra — giữ nguyên
    // kho cũ của từng thiết bị như hành vi trước đây.
    const assetDestinationWarehouseId = destinationWarehouseId ?? asset.warehouseId;

    const warehouseChangeNote =
      assetDestinationWarehouseId !== asset.warehouseId && destination.name
        ? `Nhập kho ${destination.name}`
        : null;

    const note = [
      reason || (sendToRepair ? "Gửi sửa chữa/bảo hành" : "Thu hồi thiết bị"),
      missingAccessories.length > 0
        ? `Thiếu: ${missingAccessories.join(", ")}`
        : null,
      warehouseChangeNote,
      noteInput || null,
    ]
      .filter(Boolean)
      .join(" | ");

    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        status: sendToRepair ? AssetStatus.REPAIR : AssetStatus.IN_STOCK,
        currentEmployeeId: null,
        warehouseId: assetDestinationWarehouseId,
        // Cùng lý do như returnAssetAction (assets/[id]/actions.ts) — xoá
        // loại cấp phát/hạn cảnh báo khi thiết bị không còn ai giữ.
        assignmentType: null,
        assignmentDueAt: null,
      },
    });

    // Bỏ tick "Có Adapter/Có dây sạc" nghĩa là phụ kiện đó KHÔNG có trong
    // lần trả này — trước đây chỉ ghi chú "Thiếu: ..." vào lịch sử nhưng
    // không xoá record AssetAccessory, nên panel "Phụ kiện đi kèm" vẫn báo
    // còn đủ dù thực tế thiếu. Xoá luôn record tương ứng để phản ánh đúng
    // tình trạng trong kho.
    const accessoryKeywordsToRemove: string[] = [];
    if (!hasAdapter) accessoryKeywordsToRemove.push("adapter");
    if (!hasCable) accessoryKeywordsToRemove.push("cáp", "cap", "cable");

    if (accessoryKeywordsToRemove.length > 0) {
      await prisma.assetAccessory.deleteMany({
        where: {
          assetId: asset.id,
          OR: accessoryKeywordsToRemove.map((keyword) => ({
            name: { contains: keyword, mode: "insensitive" as const },
          })),
        },
      });
    }

    await prisma.assetHistory.create({
      data: {
        assetId: asset.id,
        action: sendToRepair ? HistoryAction.REPAIR : HistoryAction.RETURN,
        fromEmployeeId: employeeId,
        toEmployeeId: null,
        fromWarehouseId: asset.warehouseId,
        toWarehouseId: assetDestinationWarehouseId,
        note,
        createdBy: currentUser?.fullName ?? "System",
      },
    });
  }

  // Toàn bộ thiết bị chọn đều đã bị thu hồi/chuyển đi bởi thao tác khác
  // trong lúc user đang mở trang — không âm thầm redirect như thể đã thành
  // công, phải báo rõ để họ tải lại danh sách.
  if (processedCount === 0) {
    return {
      error:
        "Không có thiết bị nào được thu hồi — dữ liệu đã thay đổi, vui lòng tải lại trang.",
    };
  }

  redirect(withFlash(`/employees/${employeeId}`, "employee_bulk_returned"));
}

/**
 * Chuyển hàng loạt — chuyển thẳng 1 hoặc nhiều thiết bị từ nhân viên này
 * sang 1 nhân viên khác (giữ nguyên trạng thái ASSIGNED, không phải qua
 * bước Thu hồi về kho rồi Cấp lại).
 */
export async function bulkTransferAssetsAction(
  _prevState: EmployeeActionState,
  formData: FormData
): Promise<EmployeeActionState> {
  const currentUser = await requireRole(["Admin", "IT"]);

  const employeeId = Number(formData.get("employeeId"));
  const toEmployeeId = Number(formData.get("toEmployeeId"));
  const assetIds = parseAssetIds(formData);
  const note = String(formData.get("transferNote") || "").trim();

  if (assetIds.length === 0) {
    return { error: "Vui lòng chọn ít nhất 1 thiết bị để chuyển." };
  }

  if (!toEmployeeId) {
    return { error: "Vui lòng chọn nhân viên nhận thiết bị." };
  }

  if (toEmployeeId === employeeId) {
    return { error: "Nhân viên nhận phải khác nhân viên đang giữ thiết bị." };
  }

  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
  });

  for (const asset of assets) {
    assertWarehouseScope(currentUser, asset.warehouseId);
  }

  let processedCount = 0;

  for (const asset of assets) {
    if (asset.status !== AssetStatus.ASSIGNED || asset.currentEmployeeId !== employeeId) {
      continue;
    }

    processedCount++;

    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        currentEmployeeId: toEmployeeId,
      },
    });

    await prisma.assetHistory.create({
      data: {
        assetId: asset.id,
        action: HistoryAction.TRANSFER,
        fromEmployeeId: employeeId,
        toEmployeeId,
        fromWarehouseId: asset.warehouseId,
        toWarehouseId: asset.warehouseId,
        note: note || "Chuyển thiết bị giữa nhân viên",
        createdBy: currentUser?.fullName ?? "System",
        // Chuyển sang nhân viên khác cũng là 1 lượt bàn giao cho người nhận
        // mới — áp dụng hạn bổ sung ảnh 7 ngày như bàn giao thường (bổ sung
        // ở Timeline thiết bị). Nếu không, lượt này thành "lượt bàn giao mới
        // nhất" không có hạn, xoá luôn nhắc nhở thiếu ảnh của lượt trước.
        photoDueAt: computeHandoverPhotoDueAt(),
      },
    });
  }

  if (processedCount === 0) {
    return {
      error:
        "Không có thiết bị nào được chuyển — dữ liệu đã thay đổi, vui lòng tải lại trang.",
    };
  }

  redirect(withFlash(`/employees/${employeeId}`, "employee_bulk_transferred"));
}

/**
 * Cấp thêm HÀNG LOẠT thiết bị (đang Trong kho) cho nhân viên này trong 1 lần
 * — cùng 1 Loại cấp phát áp dụng chung cho cả lô (vì UI chỉ có 1 ô chọn duy
 * nhất, không có nhu cầu mỗi máy 1 loại khác nhau trong cùng 1 lượt cấp).
 * Cùng pattern kiểm tra/xử lý với bulkReturnAssetsAction/bulkTransferAssetsAction
 * ở trên — kiểm tra warehouse scope cho TOÀN BỘ thiết bị trước khi ghi bất kỳ
 * gì, rồi bỏ qua (không lỗi cả batch) thiết bị nào đã đổi trạng thái từ lúc mở
 * modal đến lúc submit.
 */
export async function assignAdditionalAssetAction(
  _prevState: EmployeeActionState,
  formData: FormData
): Promise<EmployeeActionState> {
  const currentUser = await requireRole(["Admin", "IT"]);

  const employeeId = Number(formData.get("employeeId"));
  const assetIds = parseAssetIds(formData);
  const assignmentType = parseAssignmentType(formData.get("assignmentType"));
  const noteInput = String(formData.get("assignNote") || "").trim();

  if (assetIds.length === 0) {
    return { error: "Vui lòng chọn ít nhất 1 thiết bị để cấp phát." };
  }

  if (!assignmentType) {
    return { error: "Vui lòng chọn loại cấp phát." };
  }

  // Cấp đổi thiết bị (EXCHANGE) là đổi 1-đổi-1 (đổi lấy ĐÚNG 1 thiết bị cũ) —
  // không cho chọn nhiều thiết bị mới cùng lúc ở modal này, tránh mập mờ máy
  // mới nào tương ứng với máy cũ nào.
  if (assignmentType === "EXCHANGE" && assetIds.length > 1) {
    return {
      error:
        "Cấp đổi thiết bị chỉ áp dụng cho 1 thiết bị mới mỗi lần — vui lòng chỉ chọn 1 thiết bị.",
    };
  }

  const exchangeAssetIdRaw = Number(formData.get("exchangeAssetId"));
  const exchangeAssetId =
    assignmentType === "EXCHANGE" &&
    Number.isInteger(exchangeAssetIdRaw) &&
    exchangeAssetIdRaw > 0
      ? exchangeAssetIdRaw
      : null;

  if (assignmentType === "EXCHANGE" && !exchangeAssetId) {
    return { error: "Vui lòng chọn thiết bị cần thu hồi để đổi." };
  }

  // Ảnh xác nhận bàn giao (không bắt buộc) — cấp hàng loạt thì cùng bộ ảnh
  // áp dụng chung cho cả lô (thường là 1 biên bản/1 tấm chụp cả lô máy).
  const photos = await extractHandoverPhotos(formData);
  if (!photos.ok) {
    return { error: photos.error };
  }

  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
  });

  for (const asset of assets) {
    assertWarehouseScope(currentUser, asset.warehouseId);
  }

  // Xác thực lại thiết bị chọn để đổi — phải đang thực sự được cấp cho ĐÚNG
  // nhân viên này, phòng dữ liệu đã đổi giữa lúc mở modal và lúc submit.
  let exchangeAsset: Awaited<ReturnType<typeof prisma.asset.findUnique>> = null;
  if (exchangeAssetId) {
    exchangeAsset = await prisma.asset.findUnique({ where: { id: exchangeAssetId } });

    if (
      !exchangeAsset ||
      exchangeAsset.status !== AssetStatus.ASSIGNED ||
      exchangeAsset.currentEmployeeId !== employeeId
    ) {
      return {
        error:
          "Thiết bị chọn để đổi không còn hợp lệ (có thể đã bị thu hồi ở nơi khác) — vui lòng tải lại trang.",
      };
    }
  }

  // Kho đích của thiết bị cũ bị thu hồi lúc đổi máy — cùng quy tắc với
  // bulkReturnAssetsAction: về đúng kho của IT đang thao tác (nếu có), giữ
  // nguyên kho cũ nếu không xác định được (VD Admin không gán riêng 1 kho).
  const exchangeDestinationWarehouseId = exchangeAsset
    ? currentUser.warehouse?.id ?? exchangeAsset.warehouseId
    : null;

  const assignmentDueAt = computeAssignmentDueAt(assignmentType);
  let processedCount = 0;

  // Ghi file ảnh 1 lần cho cả lô — mỗi thiết bị 1 dòng AssetHistoryPhoto trỏ
  // chung vào cùng file (xem chú thích model AssetHistoryPhoto). Chỉ xoá file
  // khi lỗi mà CHƯA có dòng DB nào trỏ tới (transaction từng thiết bị đã
  // commit trước đó vẫn giữ nguyên, file của chúng phải được giữ lại).
  const savedResult = await trySaveHandoverPhotoFiles(photos.buffers);
  if (!savedResult.ok) {
    return { error: savedResult.error };
  }
  const savedPhotos = savedResult.saved;
  let photoRowsCommitted = false;

  try {
    for (const asset of assets) {
      // Chỉ cấp thiết bị đang thực sự Trong kho — phòng trường hợp thiết bị đã
      // bị cấp cho người khác (VD 2 tab cùng mở modal này) giữa lúc mở modal và
      // lúc submit.
      if (asset.status !== AssetStatus.IN_STOCK) {
        continue;
      }

      processedCount++;

      const exchangeNote = exchangeAsset
        ? ` | Đổi lấy máy cũ: ${exchangeAsset.assetTag}`
        : "";

      // Cả 2 thiết bị (máy mới cấp + máy cũ bị thu hồi khi Cấp đổi) phải cùng
      // thành công hoặc cùng rollback trong 1 transaction — tránh lỗi giữa
      // chừng khiến nhân viên bị gán CẢ 2 máy cùng lúc.
      await prisma.$transaction(async (tx) => {
        await tx.asset.update({
          where: { id: asset.id },
          data: {
            status: AssetStatus.ASSIGNED,
            currentEmployeeId: employeeId,
            assignmentType,
            assignmentDueAt,
          },
        });

        await tx.assetHistory.create({
          data: {
            assetId: asset.id,
            action: HistoryAction.TRANSFER,
            fromEmployeeId: asset.currentEmployeeId,
            toEmployeeId: employeeId,
            fromWarehouseId: asset.warehouseId,
            toWarehouseId: asset.warehouseId,
            // Snapshot đúng loại cấp phát của LƯỢT cấp này — dùng cho thống kê
            // "SL theo loại phiếu" ở trang Báo cáo (report.service.ts).
            assignmentType,
            note: `Cấp thiết bị (${ASSIGNMENT_TYPE_LABEL[assignmentType]})${
              assets.length > 1 ? ` — cấp cùng lô ${assets.length} thiết bị` : ""
            }${exchangeNote}${noteInput ? ` | ${noteInput}` : ""}`,
            createdBy: currentUser?.fullName ?? "System",
            // Hạn bổ sung ảnh xác nhận bàn giao (7 ngày) — xem assignAssetAction.
            photoDueAt: computeHandoverPhotoDueAt(),
            photos: {
              create: savedPhotos.map((photo) => ({
                fileName: photo.fileName,
                sizeBytes: photo.sizeBytes,
                uploadedBy: currentUser?.fullName ?? "System",
              })),
            },
          },
        });

        if (exchangeAsset && exchangeDestinationWarehouseId !== null) {
          await tx.asset.update({
            where: { id: exchangeAsset.id },
            data: {
              status: AssetStatus.IN_STOCK,
              currentEmployeeId: null,
              warehouseId: exchangeDestinationWarehouseId,
              assignmentType: null,
              assignmentDueAt: null,
            },
          });

          await tx.assetHistory.create({
            data: {
              assetId: exchangeAsset.id,
              action: HistoryAction.RETURN,
              fromEmployeeId: employeeId,
              toEmployeeId: null,
              fromWarehouseId: exchangeAsset.warehouseId,
              toWarehouseId: exchangeDestinationWarehouseId,
              note: `Thu hồi do Cấp đổi thiết bị — đổi sang máy mới: ${asset.assetTag}`,
              createdBy: currentUser?.fullName ?? "System",
            },
          });
        }
      });

      if (savedPhotos.length > 0) photoRowsCommitted = true;
    }
  } catch (error) {
    if (!photoRowsCommitted) {
      await removeHandoverPhotoFiles(savedPhotos.map((photo) => photo.fileName));
    }
    throw error;
  }

  if (processedCount === 0) {
    // Không thiết bị nào được cấp — không có dòng ảnh nào trỏ tới file vừa ghi.
    await removeHandoverPhotoFiles(savedPhotos.map((photo) => photo.fileName));
    return {
      error:
        "Không có thiết bị nào được cấp phát — dữ liệu đã thay đổi (có thể đã được cấp cho người khác), vui lòng tải lại trang.",
    };
  }

  redirect(withFlash(`/employees/${employeeId}`, "employee_asset_assigned"));
}
