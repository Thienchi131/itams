"use server";

import { prisma } from "@/lib/prisma";
import { requireRole, assertWarehouseScope } from "@/modules/auth/auth.service";
import { AssetStatus, AssignmentType, HistoryAction } from "@prisma/client";
import { redirect } from "next/navigation";
import { createAuditLog } from "@/modules/audit/audit-log.service";
import { withFlash } from "@/lib/flash";
import {
  ASSIGNMENT_TYPE_LABEL,
  computeAssignmentDueAt,
  REJECTED_TRANSFER_NOTE_PREFIX,
} from "@/modules/asset/asset.helpers";
import { resolveReturnWarehouse } from "@/modules/warehouse/return-destination";

// Chấp nhận đúng các giá trị của enum AssignmentType — validate ở server
// (không chỉ tin theo UI) phòng request bị gọi thẳng với giá trị lạ.
function parseAssignmentType(value: FormDataEntryValue | null): AssignmentType | null {
  return value === "PERMANENT" ||
    value === "LOAN" ||
    value === "WARRANTY_HOLD" ||
    value === "EXCHANGE"
    ? value
    : null;
}

export type AssetActionState = { error: string } | null;

// "returnTo" là URL trang danh sách (kèm trang + filter) mà user đang xem
// lúc bấm vào chi tiết thiết bị — mọi form thao tác trên trang chi tiết đều
// gửi kèm field ẩn này lên, và MỌI redirect quay lại trang chi tiết bên dưới
// đều phải giữ nguyên lại trong URL (?returnTo=...) để nút "Quay lại" ở lần
// hiển thị tiếp theo vẫn biết đường về đúng chỗ — trước đây các action này
// redirect cứng về "/assets/{id}" (mất returnTo), nên chỉ cần làm 1 thao tác
// (VD: chuyển kho) rồi bấm "Quay lại" là bị rơi về trang 1 danh sách, mất
// hết trang/filter đang xem trước đó.
function detailUrl(assetId: number, returnTo: FormDataEntryValue | null) {
  const value = typeof returnTo === "string" ? returnTo.trim() : "";
  const qs = value ? `?returnTo=${encodeURIComponent(value)}` : "";
  return `/assets/${assetId}${qs}`;
}

// Dùng cho action rời hẳn khỏi trang chi tiết (xoá thiết bị) — quay thẳng về
// đúng trang danh sách đã lưu trong returnTo (giữ nguyên trang/filter), thay
// vì luôn về "/assets" trang 1. Chỉ chấp nhận giá trị bắt đầu bằng "/assets"
// để chặn open-redirect nếu returnTo bị chỉnh tay thành domain khác.
function listUrl(returnTo: FormDataEntryValue | null, extraParams: Record<string, string>) {
  const value = typeof returnTo === "string" ? returnTo.trim() : "";
  const base = value && value.startsWith("/assets") ? value : "/assets";
  const [path, query = ""] = base.split("?");
  const params = new URLSearchParams(query);
  for (const [key, val] of Object.entries(extraParams)) params.set(key, val);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export async function assignAssetAction(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  const currentUser = await requireRole(["Admin", "IT"]);

  const assetId = Number(formData.get("assetId"));
  const employeeId = Number(formData.get("employeeId"));
  const returnTo = formData.get("returnTo");

  // Tick ở modal xác nhận khi kho đang thiếu Adapter/dây sạc — IT chọn bổ
  // sung kèm theo ngay lúc bàn giao thay vì phải sửa thiết bị riêng sau đó.
  const addAdapter = formData.get("addAdapter") === "on";
  const addCable = formData.get("addCable") === "on";

  // Ghi chú tự do ở modal xác nhận (VD: giao kèm túi đựng, nhân viên yêu cầu
  // giao gấp...) — tuỳ chọn, ghép thêm vào note tự sinh của Timeline chứ
  // không thay thế hẳn (vẫn cần giữ nhãn Loại cấp phát + phụ kiện bổ sung).
  const noteInput = String(formData.get("note") || "").trim();

  // Loại cấp phát — Cấp nhân viên mới (không hạn) / Cấp mượn (60 ngày) / Cấp
  // tạm chờ bảo hành (30 ngày). Bắt buộc chọn, không có mặc định ngầm — tránh
  // lỡ chọn nhầm "cấp mới" cho 1 máy mượn tạm rồi quên mất không có ai nhắc
  // thu hồi lại.
  const assignmentType = parseAssignmentType(formData.get("assignmentType"));

  // Chặn ở server phòng trường hợp submit form mà chưa chọn nhân viên (VD:
  // gõ 1 cái tên không có trong danh sách gợi ý rồi bấm Bàn giao) — trước
  // đây employeeId lọt xuống thành 0/NaN, update Prisma với FK không tồn
  // tại sẽ crash và hiện trang lỗi trắng thay vì thông báo rõ ràng.
  if (!employeeId || Number.isNaN(employeeId)) {
    return { error: "Vui lòng chọn nhân viên trước khi bàn giao." };
  }

  if (!assignmentType) {
    return { error: "Vui lòng chọn loại cấp phát." };
  }

  // Cấp đổi thiết bị (EXCHANGE) — bàn giao máy mới này để đổi lấy đúng 1
  // thiết bị nhân viên đang giữ, thu hồi luôn máy cũ trong cùng 1 thao tác.
  // Bắt buộc chọn máy đổi ngay ở đây (fail fast trước khi đụng DB) — không
  // cho phép EXCHANGE mà thiếu exchangeAssetId lọt xuống dưới.
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

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { accessories: true },
  });

  if (!asset) {
    redirect("/assets");
  }

  // Phòng trường hợp gọi thẳng server action với assetId thuộc kho ngoài
  // phạm vi được gán (trang chi tiết chỉ ẩn/hiện ở UI, không tự chặn được
  // request thủ công) — xem chú thích đầy đủ ở assertWarehouseScope().
  assertWarehouseScope(currentUser, asset.warehouseId);

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  });

  if (!employee) {
    return { error: "Nhân viên không tồn tại, vui lòng chọn lại từ danh sách gợi ý." };
  }

  // Chỉ thiết bị đang TRONG KHO mới được bàn giao — chặn ở server phòng
  // trường hợp submit form trực tiếp bỏ qua UI (VD: thiết bị đã cấp phát
  // rồi mà vẫn cố bàn giao tiếp cho người khác, gây gán chồng 2 nhân viên).
  if (asset.status !== AssetStatus.IN_STOCK) {
    return { error: "Chỉ có thể bàn giao thiết bị đang ở trạng thái Trong kho." };
  }

  // Xác thực lại thiết bị chọn để đổi (không chỉ tin theo UI) — phải đang
  // thực sự được cấp cho ĐÚNG nhân viên này, phòng trường hợp dữ liệu đã đổi
  // giữa lúc mở modal và lúc submit (VD thiết bị đó vừa bị thu hồi ở tab
  // khác), hoặc request bị gọi thẳng với exchangeAssetId tuỳ ý.
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

  const assignmentDueAt = computeAssignmentDueAt(assignmentType);

  // Kho đích của thiết bị cũ bị thu hồi lúc đổi máy — cùng quy tắc với
  // returnAssetAction: về đúng kho của IT đang thao tác (nếu IT có đúng 1
  // kho được gán), giữ nguyên kho cũ nếu không xác định được (VD Admin).
  const exchangeDestinationWarehouseId = exchangeAsset
    ? currentUser.warehouse?.id ?? exchangeAsset.warehouseId
    : null;

  // Kho đang thiếu Adapter/dây sạc và IT tick "bổ sung" ở modal xác nhận —
  // tạo thêm accessory ngay lúc bàn giao. Kiểm tra lại tồn tại thật (không
  // chỉ tin theo UI) để tránh tạo trùng nếu request được gọi thẳng.
  const hasAdapterAlready = asset.accessories.some((a) =>
    a.name.toLowerCase().includes("adapter")
  );
  const hasCableAlready = asset.accessories.some(
    (a) =>
      a.name.toLowerCase().includes("cáp") ||
      a.name.toLowerCase().includes("cap") ||
      a.name.toLowerCase().includes("cable")
  );

  const accessoriesToAdd = [
    addAdapter && !hasAdapterAlready ? { assetId, name: "Adapter", quantity: 1 } : null,
    addCable && !hasCableAlready ? { assetId, name: "Cáp sạc", quantity: 1 } : null,
  ].filter((item): item is { assetId: number; name: string; quantity: number } => item !== null);

  const addedNote =
    accessoriesToAdd.length > 0
      ? ` | Bổ sung: ${accessoriesToAdd.map((a) => a.name).join(", ")}`
      : "";

  const exchangeNoteForNewAsset = exchangeAsset
    ? ` | Đổi lấy máy cũ: ${exchangeAsset.assetTag}`
    : "";

  // Cả 2 thiết bị (máy mới bàn giao + máy cũ bị thu hồi) phải cùng thành
  // công hoặc cùng rollback — tránh trường hợp lỗi giữa chừng khiến nhân
  // viên bị gán CẢ 2 máy cùng lúc (mất tích máy cũ khỏi Timeline thu hồi).
  await prisma.$transaction(async (tx) => {
    await tx.asset.update({
      where: { id: assetId },
      data: {
        status: AssetStatus.ASSIGNED,
        currentEmployeeId: employeeId,
        assignmentType,
        assignmentDueAt,
      },
    });

    if (accessoriesToAdd.length > 0) {
      await tx.assetAccessory.createMany({ data: accessoriesToAdd });
    }

    await tx.assetHistory.create({
      data: {
        assetId,
        action: HistoryAction.TRANSFER,
        fromEmployeeId: asset.currentEmployeeId,
        toEmployeeId: employeeId,
        fromWarehouseId: asset.warehouseId,
        toWarehouseId: asset.warehouseId,
        // Snapshot đúng loại cấp phát của LƯỢT bàn giao này — dùng cho thống
        // kê "SL theo loại phiếu" ở trang Báo cáo (report.service.ts).
        assignmentType,
        note: `Bàn giao thiết bị (${ASSIGNMENT_TYPE_LABEL[assignmentType]})${addedNote}${exchangeNoteForNewAsset}${
          noteInput ? ` | ${noteInput}` : ""
        }`,
        createdBy: currentUser.fullName,
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
          createdBy: currentUser.fullName,
        },
      });
    }
  });

  redirect(withFlash(detailUrl(assetId, returnTo), "asset_assigned"));
}

// Nhãn hiển thị cho 3 hướng xử lý — dùng chung giữa modal (client) và note
// lưu vào AssetHistory (server), để Timeline đọc dễ hiểu thay vì chỉ có mỗi
// "REPAIR"/"RETIRE".
const SEND_OUT_CATEGORY_LABEL: Record<string, string> = {
  WARRANTY: "Gửi bảo hành",
  DAMAGED: "Hư hỏng",
  RETIRE: "Chờ thanh lý",
};

// Đưa 1 thiết bị đang TRONG KHO (chưa bàn giao ai) ra khỏi kho hoạt động —
// trước đây chỉ có đường "Gửi sửa chữa" thông qua luồng Thu hồi
// (returnAssetAction), vốn CHỈ áp dụng được cho thiết bị đang Đã cấp phát.
// Máy phát hiện hư hỏng/cần thanh lý trong lúc còn nằm kho (chưa từng giao
// ai) không có cách nào chuyển trạng thái — action này bù khoảng trống đó,
// gộp cả 3 hướng xử lý (Gửi bảo hành/Hư hỏng đều tạm thời, đưa về Bảo trì;
// Chờ thanh lý là vĩnh viễn, đưa sang Thanh lý) vì cùng chung 1 điểm bắt đầu
// (thiết bị đang Trong kho, không liên quan nhân viên nào).
export async function sendToRepairAction(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  const currentUser = await requireRole(["Admin", "IT"]);

  const assetId = Number(formData.get("assetId"));
  const returnTo = formData.get("returnTo");
  const reason = String(formData.get("reason") || "").trim();
  const categoryRaw = String(formData.get("category") || "DAMAGED");
  const category = categoryRaw in SEND_OUT_CATEGORY_LABEL ? categoryRaw : "DAMAGED";
  const categoryLabel = SEND_OUT_CATEGORY_LABEL[category];
  const isRetire = category === "RETIRE";

  if (!reason) {
    return { error: "Vui lòng nhập lý do." };
  }

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });

  if (!asset) {
    redirect("/assets");
  }

  assertWarehouseScope(currentUser, asset.warehouseId);

  // Chỉ thiết bị đang TRONG KHO mới dùng action này — máy đã cấp phát thì
  // phải qua luồng Thu hồi (tick "Gửi sửa chữa ngay") vì còn phải xử lý gỡ
  // nhân viên đang giữ.
  if (asset.status !== AssetStatus.IN_STOCK) {
    return { error: "Chỉ có thể xử lý thiết bị đang ở trạng thái Trong kho." };
  }

  // Transaction + điều kiện trạng thái: 2 người thao tác cùng lúc / bấm
  // đúp thì lần sau không ghi trùng lịch sử, báo lỗi rõ ràng.
  const changed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.asset.updateMany({
      where: { id: assetId, status: AssetStatus.IN_STOCK },
      data: {
        status: isRetire ? AssetStatus.RETIRED : AssetStatus.REPAIR,
        condition: `${categoryLabel}: ${reason}`,
      },
    });
    if (count === 0) return false;

    await tx.assetHistory.create({
      data: {
        assetId,
        action: isRetire ? HistoryAction.RETIRE : HistoryAction.REPAIR,
        fromWarehouseId: asset.warehouseId,
        toWarehouseId: asset.warehouseId,
        note: `${categoryLabel} — ${reason}`,
        createdBy: currentUser.fullName,
      },
    });
    return true;
  });

  if (!changed) {
    return { error: "Trạng thái thiết bị vừa được người khác thay đổi. Vui lòng tải lại trang rồi thử lại." };
  }

  redirect(withFlash(detailUrl(assetId, returnTo), isRetire ? "asset_retired" : "asset_sent_repair"));
}

// Khởi tạo 1 lượt luân chuyển kho — KHÔNG còn đổi warehouseId ngay như
// trước đây. Thiết bị chuyển sang status IN_TRANSIT (không tính vào tồn kho
// của kho nguồn lẫn kho đích ở bất kỳ báo cáo/Dashboard nào đang lọc theo
// IN_STOCK/ASSIGNED, không cần sửa lại các query đó) và chờ IT phụ trách
// kho ĐÍCH bấm "Xác nhận nhập kho" (confirmWarehouseTransferAction) hoặc
// "Từ chối" (rejectWarehouseTransferAction) — xem RepairFollowUpBanner-style
// banner cho lượt này trong AppLayout.tsx. warehouseId giữ nguyên = kho
// nguồn suốt thời gian chờ, để IT kho nguồn vẫn còn quyền quản lý/huỷ nếu
// cần, và assertWarehouseScope ở trên vẫn hoạt động đúng như trước.
export async function transferWarehouseAction(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  const currentUser = await requireRole(["Admin", "IT"]);

  const assetId = Number(formData.get("assetId"));
  const returnTo = formData.get("returnTo");
  const toWarehouseId = Number(formData.get("toWarehouseId"));
  const note = String(formData.get("note") || "").trim();

  if (!toWarehouseId || Number.isNaN(toWarehouseId)) {
    return { error: "Vui lòng chọn kho muốn chuyển đến." };
  }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
  });

  if (!asset) {
    redirect("/assets");
  }

  // Tài khoản IT bị gán 1 kho chỉ được luân chuyển thiết bị ĐANG thuộc kho
  // của mình đi nơi khác — không được đụng vào thiết bị của kho khác dù kho
  // đích là gì.
  assertWarehouseScope(currentUser, asset.warehouseId);

  if (asset.status === AssetStatus.IN_TRANSIT) {
    return {
      error:
        "Thiết bị đang có 1 lượt luân chuyển khác chờ xác nhận, không thể tạo thêm lượt mới.",
    };
  }

  if (asset.warehouseId === toWarehouseId) {
    return { error: "Thiết bị đang ở đúng kho này rồi, vui lòng chọn kho khác." };
  }

  const toWarehouse = await prisma.warehouse.findUnique({
    where: { id: toWarehouseId },
  });

  if (!toWarehouse) {
    return { error: "Kho đích không tồn tại, vui lòng chọn lại." };
  }

  // Transaction + điều kiện trạng thái: 2 người thao tác cùng lúc / bấm
  // đúp thì lần sau không ghi trùng lịch sử, báo lỗi rõ ràng.
  const changed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.asset.updateMany({
      where: { id: assetId, status: asset.status },
      data: {
        status: AssetStatus.IN_TRANSIT,
        pendingTransferPreviousStatus: asset.status,
        pendingTransferToWarehouseId: toWarehouseId,
        pendingTransferAt: new Date(),
        pendingTransferBy: currentUser.fullName,
        pendingTransferNote: note || null,
      },
    });
    if (count === 0) return false;

    await tx.assetHistory.create({
      data: {
        assetId,
        action: HistoryAction.WAREHOUSE_TRANSFER,
        fromWarehouseId: asset.warehouseId,
        toWarehouseId,
        note: `Đang chuyển đến kho, chờ xác nhận nhập kho${note ? ` — ${note}` : ""}`,
        createdBy: currentUser.fullName,
      },
    });
    return true;
  });

  if (!changed) {
    return { error: "Trạng thái thiết bị vừa được người khác thay đổi. Vui lòng tải lại trang rồi thử lại." };
  }

  redirect(withFlash(detailUrl(assetId, returnTo), "asset_transfer_requested"));
}

// IT phụ trách kho ĐÍCH bấm "Xác nhận nhập kho" — chốt lại lượt luân chuyển:
// đổi hẳn warehouseId sang kho đích, khôi phục đúng status trước khi chuyển
// (IN_STOCK hay ASSIGNED — luân chuyển áp dụng cho mọi trạng thái nên không
// mặc định cứng), xoá sạch các field pendingTransfer*, ghi thêm 1 dòng
// lịch sử xác nhận. assertWarehouseScope kiểm tra theo
// pendingTransferToWarehouseId (kho ĐÍCH) — KHÁC với mọi action khác trong
// file này (luôn kiểm tra theo asset.warehouseId hiện tại), vì người xác
// nhận thuộc kho đích chứ không phải kho đang giữ warehouseId lúc này.
export async function confirmWarehouseTransferAction(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  const currentUser = await requireRole(["Admin", "IT"]);

  const assetId = Number(formData.get("assetId"));
  const returnTo = formData.get("returnTo");

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });

  if (!asset) {
    redirect("/assets");
  }

  if (
    asset.status !== AssetStatus.IN_TRANSIT ||
    !asset.pendingTransferToWarehouseId
  ) {
    return { error: "Thiết bị này không có lượt luân chuyển nào đang chờ xác nhận." };
  }

  assertWarehouseScope(currentUser, asset.pendingTransferToWarehouseId);

  // Transaction + điều kiện trạng thái: 2 người thao tác cùng lúc / bấm
  // đúp thì lần sau không ghi trùng lịch sử, báo lỗi rõ ràng.
  const changed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.asset.updateMany({
      where: { id: assetId, status: AssetStatus.IN_TRANSIT },
      data: {
        status: asset.pendingTransferPreviousStatus ?? AssetStatus.IN_STOCK,
        warehouseId: asset.pendingTransferToWarehouseId,
        pendingTransferToWarehouseId: null,
        pendingTransferPreviousStatus: null,
        pendingTransferAt: null,
        pendingTransferBy: null,
        pendingTransferNote: null,
      },
    });
    if (count === 0) return false;

    await tx.assetHistory.create({
      data: {
        assetId,
        action: HistoryAction.WAREHOUSE_TRANSFER,
        fromWarehouseId: asset.warehouseId,
        toWarehouseId: asset.pendingTransferToWarehouseId,
        note: "Đã xác nhận nhập kho",
        createdBy: currentUser.fullName,
      },
    });
    return true;
  });

  if (!changed) {
    return { error: "Trạng thái thiết bị vừa được người khác thay đổi. Vui lòng tải lại trang rồi thử lại." };
  }

  redirect(withFlash(detailUrl(assetId, returnTo), "asset_transfer_confirmed"));
}

// IT phụ trách kho ĐÍCH từ chối nhận (VD kho nguồn chọn nhầm kho đích, hàng
// thực tế chưa gửi đi, không đúng thiết bị cần...) — bắt buộc nêu lý do.
// Thiết bị trả về đúng trạng thái/kho nguồn như trước khi luân chuyển, không
// đổi warehouseId. Ghi 1 dòng AssetHistory gắn fromWarehouseId = kho đích bị
// từ chối/toWarehouseId = kho nguồn — nhờ vậy NotificationBell (lọc theo
// asset.warehouseId, đang là kho nguồn) tự động báo ngược lại cho IT kho
// nguồn mà không cần xây thêm cơ chế thông báo riêng.
export async function rejectWarehouseTransferAction(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  const currentUser = await requireRole(["Admin", "IT"]);

  const assetId = Number(formData.get("assetId"));
  const returnTo = formData.get("returnTo");
  const reason = String(formData.get("reason") || "").trim();

  if (!reason) {
    return { error: "Vui lòng nhập lý do từ chối." };
  }

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });

  if (!asset) {
    redirect("/assets");
  }

  if (
    asset.status !== AssetStatus.IN_TRANSIT ||
    !asset.pendingTransferToWarehouseId
  ) {
    return { error: "Thiết bị này không có lượt luân chuyển nào đang chờ xác nhận." };
  }

  assertWarehouseScope(currentUser, asset.pendingTransferToWarehouseId);

  const rejectedToWarehouseId = asset.pendingTransferToWarehouseId;

  // Transaction + điều kiện trạng thái: 2 người thao tác cùng lúc / bấm
  // đúp thì lần sau không ghi trùng lịch sử, báo lỗi rõ ràng.
  const changed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.asset.updateMany({
      where: { id: assetId, status: AssetStatus.IN_TRANSIT },
      data: {
        status: asset.pendingTransferPreviousStatus ?? AssetStatus.IN_STOCK,
        pendingTransferToWarehouseId: null,
        pendingTransferPreviousStatus: null,
        pendingTransferAt: null,
        pendingTransferBy: null,
        pendingTransferNote: null,
      },
    });
    if (count === 0) return false;

    await tx.assetHistory.create({
      data: {
        assetId,
        action: HistoryAction.WAREHOUSE_TRANSFER,
        fromWarehouseId: rejectedToWarehouseId,
        toWarehouseId: asset.warehouseId,
        note: `${REJECTED_TRANSFER_NOTE_PREFIX}, trả lại kho nguồn — Lý do: ${reason}`,
        createdBy: currentUser.fullName,
      },
    });
    return true;
  });

  if (!changed) {
    return { error: "Trạng thái thiết bị vừa được người khác thay đổi. Vui lòng tải lại trang rồi thử lại." };
  }

  // Trước đây redirect(detailUrl(...)) như các action khác — về lại đúng
  // trang chi tiết thiết bị. Nhưng SAU KHI TỪ CHỐI, thiết bị đã trả về kho
  // nguồn (asset.warehouseId) và không còn pendingTransferToWarehouseId
  // nữa, nên với đúng IT kho ĐÍCH vừa bấm từ chối, thiết bị này giờ nằm
  // NGOÀI phạm vi kho họ quản lý (kho nguồn không phải kho họ phụ trách) —
  // trang chi tiết sẽ notFound() -> lỗi "Không tìm thấy trang này" thay vì
  // 1 thông báo thành công, đúng như bug user chụp màn hình báo lại. Chuyển
  // sang quay về trang danh sách (returnTo, mặc định /assets/transfers) kèm
  // banner xác nhận thành công — giống pattern success=asset_deleted đã
  // dùng ở trang Quản lý tài sản.
  redirect(listUrl(returnTo, { success: "transfer_rejected" }));
}

export async function returnAssetAction(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  const currentUser = await requireRole(["Admin", "IT"]);

  const assetId = Number(formData.get("assetId"));
  const returnTo = formData.get("returnTo");
  const reason = String(formData.get("returnReason") || "").trim();
  const noteInput = String(formData.get("returnNote") || "").trim();
  // Tick ở modal khi máy thu hồi về cần gửi sửa chữa/bảo hành ngay — thay vì
  // luôn đưa về Trong kho như thu hồi bình thường, đưa thẳng sang trạng thái
  // Bảo trì để IT theo dõi riêng ở trang /assets/warranty (đã đổi công năng
  // từ cảnh báo hết hạn bảo hành sang theo dõi máy đang sửa chữa).
  const sendToRepair = formData.get("sendToRepair") === "on";

  const hasAdapter = formData.get("hasAdapter") === "on";
  const hasCable = formData.get("hasCable") === "on";

  const missingAccessories = [
    !hasAdapter && "Adapter",
    !hasCable && "Dây sạc",
  ].filter(Boolean) as string[];

  const note = [
    reason || (sendToRepair ? "Gửi sửa chữa/bảo hành" : "Thu hồi thiết bị"),
    missingAccessories.length > 0
      ? `Thiếu: ${missingAccessories.join(", ")}`
      : null,
    noteInput || null,
  ]
    .filter(Boolean)
    .join(" | ");

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
  });

  if (!asset) {
    redirect("/assets");
  }

  // Thu hồi được PHÉP thực hiện dù thiết bị đang thuộc kho khác với kho của
  // IT đang thao tác — cố tình BỎ assertWarehouseScope() ở đây: NV nhận máy
  // từ kho A, sau này chuyển nội bộ/nghỉ việc ở nơi khác, IT không nhất
  // thiết phải thuộc đúng kho A mới thu hồi được. Sau khi thu hồi, thiết bị
  // tự động "nhập kho" vào ĐÚNG kho của IT đang thực hiện (currentUser.
  // warehouse) thay vì quay lại kho cũ — phản ánh đúng thực tế máy đang nằm
  // vật lý ở đâu. Nếu IT không bị gán đúng 1 kho cụ thể (VD Admin, hoặc IT
  // phụ trách cả Region nhiều kho) thì không có "kho của tôi" rõ ràng để suy
  // ra, giữ nguyên kho cũ như hành vi trước đây — dùng "Chuyển kho"
  // (transferWarehouseAction) riêng nếu cần dời đi nơi khác.
  //
  // Các hành động KHÁC trên thiết bị (sửa, gán thêm, xoá, Chuyển kho...) vẫn
  // giữ nguyên assertWarehouseScope như cũ — nới lỏng này CHỈ áp dụng cho
  // đúng thao tác Thu hồi.
  const destination = await resolveReturnWarehouse(
    currentUser,
    formData.get("returnWarehouseId"),
    asset.warehouseId
  );

  if ("error" in destination) {
    return { error: destination.error };
  }

  const destinationWarehouseId = destination.id;

  // Chỉ thiết bị ĐANG được cấp phát mới thu hồi được — trong kho thì không
  // có ai để thu hồi từ. Chặn ở server phòng submit form trực tiếp.
  if (asset.status !== AssetStatus.ASSIGNED) {
    return { error: "Chỉ có thể thu hồi thiết bị đang ở trạng thái Đã cấp phát." };
  }

  // Transaction + điều kiện trạng thái: 2 người thao tác cùng lúc / bấm
  // đúp thì lần sau không ghi trùng lịch sử, báo lỗi rõ ràng.
  const changed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.asset.updateMany({
      where: { id: assetId, status: AssetStatus.ASSIGNED },
      data: {
        status: sendToRepair ? AssetStatus.REPAIR : AssetStatus.IN_STOCK,
        currentEmployeeId: null,
        warehouseId: destinationWarehouseId,
        // Thiết bị không còn ai giữ nữa — xoá luôn loại cấp phát/hạn cảnh báo
        // của lần bàn giao vừa kết thúc, tránh còn sót lại "Cấp mượn — quá hạn"
        // trên 1 thiết bị đã về kho từ lâu (trang /assets/loans chỉ nên liệt kê
        // thiết bị THỰC SỰ đang có người giữ quá hạn).
        assignmentType: null,
        assignmentDueAt: null,
      },
    });
    if (count === 0) return false;

    // Bỏ tick "Có Adapter/Có dây sạc" nghĩa là phụ kiện đó KHÔNG có trong lần
    // trả này — trước đây chỉ ghi chú "Thiếu: ..." vào lịch sử nhưng không xoá
    // record AssetAccessory, nên panel "Phụ kiện đi kèm" vẫn báo còn đủ dù
    // thực tế thiếu. Xoá luôn record tương ứng để phản ánh đúng tình trạng
    // trong kho.
    const accessoryKeywordsToRemove: string[] = [];
    if (!hasAdapter) accessoryKeywordsToRemove.push("adapter");
    if (!hasCable) accessoryKeywordsToRemove.push("cáp", "cap", "cable");

    if (accessoryKeywordsToRemove.length > 0) {
      await tx.assetAccessory.deleteMany({
        where: {
          assetId,
          OR: accessoryKeywordsToRemove.map((keyword) => ({
            name: { contains: keyword, mode: "insensitive" as const },
          })),
        },
      });
    }

    // Ghi rõ trong lịch sử khi thiết bị "đổi kho" luôn trong lúc thu hồi (khác
    // fromWarehouseId/toWarehouseId trước đây luôn bằng nhau) để Timeline vẫn
    // đọc hiểu được vì sao thiết bị đang ở kho khác kho ban đầu.
    const warehouseChangeNote =
      destinationWarehouseId !== asset.warehouseId && destination.name
        ? `Nhập kho ${destination.name}`
        : null;

    await tx.assetHistory.create({
      data: {
        assetId,
        action: sendToRepair ? HistoryAction.REPAIR : HistoryAction.RETURN,
        fromEmployeeId: asset.currentEmployeeId,
        toEmployeeId: null,
        fromWarehouseId: asset.warehouseId,
        toWarehouseId: destinationWarehouseId,
        note: [note, warehouseChangeNote].filter(Boolean).join(" | "),
        createdBy: currentUser.fullName,
      },
    });
    return true;
  });

  if (!changed) {
    return { error: "Trạng thái thiết bị vừa được người khác thay đổi. Vui lòng tải lại trang rồi thử lại." };
  }

  redirect(withFlash(detailUrl(assetId, returnTo), sendToRepair ? "asset_sent_repair" : "asset_returned"));
}

// Đánh dấu 1 thiết bị đang Bảo trì (REPAIR) đã xử lý xong — 2 hướng kết quả:
//   - FIXED (mặc định): sửa xong, đưa về Trong kho để cấp phát lại bình
//     thường. Không dùng chung HistoryAction.RETURN (dành cho thu hồi TỪ
//     NHÂN VIÊN) vì bước này không có nhân viên nào liên quan — dùng UPDATE
//     kèm ghi chú rõ ràng cho dễ đọc ở Timeline.
//   - UNFIXABLE: gửi sửa nhưng không sửa được (hỏng nặng/hết linh kiện...) —
//     trước đây phải hoàn tất về Trong kho rồi mới gửi thanh lý tiếp được
//     (2 bước, thiết bị "ghé" qua Trong kho 1 nhịp không cần thiết). Giờ cho
//     chuyển THẲNG sang Chờ thanh lý (RETIRED) trong đúng 1 bước — dùng
//     HistoryAction.RETIRE + format condition giống hệt sendToRepairAction ở
//     trên để nhất quán, đảm bảo getAssetsRetired() (trang Kho thanh lý) đọc
//     đúng lý do/thời điểm.
export async function completeRepairAction(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  const currentUser = await requireRole(["Admin", "IT"]);

  const assetId = Number(formData.get("assetId"));
  const returnTo = formData.get("returnTo");
  const noteInput = String(formData.get("note") || "").trim();
  const outcome = formData.get("outcome") === "UNFIXABLE" ? "UNFIXABLE" : "FIXED";

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });

  if (!asset) {
    redirect("/assets");
  }

  assertWarehouseScope(currentUser, asset.warehouseId);

  if (asset.status !== AssetStatus.REPAIR) {
    return { error: "Chỉ có thể hoàn tất sửa chữa cho thiết bị đang ở trạng thái Bảo trì." };
  }

  if (outcome === "UNFIXABLE") {
    if (!noteInput) {
      return { error: "Vui lòng nhập lý do không sửa được." };
    }

    // Transaction + điều kiện trạng thái: 2 người thao tác cùng lúc / bấm
    // đúp thì lần sau không ghi trùng lịch sử, báo lỗi rõ ràng.
    const changed = await prisma.$transaction(async (tx) => {
      const { count } = await tx.asset.updateMany({
        where: { id: assetId, status: AssetStatus.REPAIR },
        data: {
          status: AssetStatus.RETIRED,
          condition: `Chờ thanh lý: ${noteInput}`,
        },
      });
      if (count === 0) return false;

      await tx.assetHistory.create({
        data: {
          assetId,
          action: HistoryAction.RETIRE,
          fromWarehouseId: asset.warehouseId,
          toWarehouseId: asset.warehouseId,
          note: `Không sửa được, chuyển thẳng từ Bảo trì sang Chờ thanh lý — ${noteInput}`,
          createdBy: currentUser.fullName,
        },
      });
      return true;
    });

    if (!changed) {
      return { error: "Trạng thái thiết bị vừa được người khác thay đổi. Vui lòng tải lại trang rồi thử lại." };
    }

    redirect(withFlash(detailUrl(assetId, returnTo), "asset_retired"));
  }

  // Transaction + điều kiện trạng thái: 2 người thao tác cùng lúc / bấm
  // đúp thì lần sau không ghi trùng lịch sử, báo lỗi rõ ràng.
  const changed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.asset.updateMany({
      where: { id: assetId, status: AssetStatus.REPAIR },
      data: { status: AssetStatus.IN_STOCK },
    });
    if (count === 0) return false;

    await tx.assetHistory.create({
      data: {
        assetId,
        action: HistoryAction.UPDATE,
        note: ["Hoàn tất sửa chữa/bảo hành — chuyển về Trong kho", noteInput || null]
          .filter(Boolean)
          .join(" | "),
        createdBy: currentUser.fullName,
      },
    });
    return true;
  });

  if (!changed) {
    return { error: "Trạng thái thiết bị vừa được người khác thay đổi. Vui lòng tải lại trang rồi thử lại." };
  }

  redirect(withFlash(detailUrl(assetId, returnTo), "asset_repair_completed"));
}

// "Hướng xử lý" IT điền cho 1 thiết bị đang sửa chữa/bảo hành ĐÃ QUÁ HẠN mà
// chưa xử lý dứt điểm được ngay (không phải Sửa xong/Không sửa được — 2
// trường hợp đó vẫn đi qua completeRepairAction như cũ, đóng hẳn thiết bị
// khỏi trạng thái REPAIR). Chỉ tạo 1 dòng RepairFollowUp ghi lại lý do/kế
// hoạch xử lý — thiết bị vẫn ở nguyên trạng thái REPAIR, nhưng
// getAssetsInRepair() sẽ coi là "đã điền, còn hiệu lực" trong
// OVERDUE_DAYS_THRESHOLD ngày tới (banner/nhắc nhở tạm ẩn cho tới khi hết
// hiệu lực). Dùng chung AssetActionState với các action khác trong file này
// để RepairFollowUpModal tái dùng được y hệt pattern useActionState.
export async function submitRepairFollowUpAction(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  const currentUser = await requireRole(["Admin", "IT"]);

  const assetId = Number(formData.get("assetId"));
  const returnTo = formData.get("returnTo");
  const note = String(formData.get("note") || "").trim();

  if (!note) {
    return { error: "Vui lòng nhập hướng xử lý." };
  }

  const asset = await prisma.asset.findUnique({ where: { id: assetId } });

  if (!asset) {
    redirect("/assets");
  }

  assertWarehouseScope(currentUser, asset.warehouseId);

  if (asset.status !== AssetStatus.REPAIR) {
    return {
      error: "Thiết bị không còn ở trạng thái Bảo trì, không cần điền hướng xử lý nữa.",
    };
  }

  await prisma.repairFollowUp.create({
    data: {
      assetId,
      note,
      createdBy: currentUser.fullName,
    },
  });

  redirect(listUrl(returnTo, { flash: "asset_repair_followup" }));
}

// Xoá vĩnh viễn 1 thiết bị — dùng cho trường hợp nhập nhầm/nhập trùng lúc
// nhập kho (VD: user nhập sai Asset Tag/Serial rồi lưu nhầm, hoặc nhập trùng
// 1 thiết bị 2 lần), cần dọn hẳn khỏi hệ thống thay vì chỉ đổi trạng thái.
// CHỈ Admin được làm — khác các thao tác vận hành khác (bàn giao/thu hồi/
// luân chuyển) mà cả IT cũng làm được, xoá dữ liệu gốc là hành động phá huỷ
// không thể hoàn tác nên siết chặt hơn, giống gate của trang Chỉnh sửa.
// Bắt buộc nhập lý do — không cho xoá "chay" không giải trình, tránh xoá
// nhầm/xoá vì mục đích không rõ ràng.
export async function deleteAssetAction(
  _prevState: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  const currentUser = await requireRole(["Admin"]);

  const assetId = Number(formData.get("assetId"));
  const returnTo = formData.get("returnTo");
  const reason = String(formData.get("reason") || "").trim();

  if (!reason) {
    return { error: "Vui lòng nhập lý do xoá thiết bị." };
  }

  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    include: { model: true },
  });

  if (!asset) {
    return { error: "Thiết bị không tồn tại hoặc đã bị xoá trước đó." };
  }

  assertWarehouseScope(currentUser, asset.warehouseId);

  const assetLabel = `${asset.assetTag} — ${asset.model.brand} ${asset.model.modelName} (SN: ${asset.serialNumber})`;

  // Asset không có onDelete: Cascade ở các bảng con (cố tình, để tránh mất
  // dữ liệu ngoài ý muốn ở những chỗ khác) — phải tự xoá hết bản ghi liên
  // quan trong 1 transaction trước khi xoá Asset, nếu không Prisma sẽ báo
  // lỗi ràng buộc khoá ngoại (P2003) và không xoá được gì.
  await prisma.$transaction([
    prisma.assetAccessory.deleteMany({ where: { assetId } }),
    prisma.assetHistory.deleteMany({ where: { assetId } }),
    prisma.assetAssignment.deleteMany({ where: { assetId } }),
    prisma.assetWarranty.deleteMany({ where: { assetId } }),
    prisma.stockInItem.deleteMany({ where: { assetId } }),
    prisma.stockOutItem.deleteMany({ where: { assetId } }),
    prisma.asset.delete({ where: { id: assetId } }),
  ]);

  // Ghi vào AuditLog thay vì AssetHistory — AssetHistory của chính thiết bị
  // này vừa bị xoá sạch cùng lúc, ghi vào đó thì mất luôn bằng chứng, không
  // còn ai tra cứu lại được đã xoá lúc nào/ai xoá/vì sao.
  await createAuditLog({
    actorName: currentUser.fullName,
    action: "Xoá tài sản",
    targetType: "Asset",
    targetId: assetId,
    detail: `${assetLabel}. Lý do: ${reason}`,
  });

  redirect(listUrl(returnTo, { success: "asset_deleted" }));
}