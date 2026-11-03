import { prisma } from "@/lib/prisma";
import { AssetStatus, AssetModelTag, HistoryAction } from "@prisma/client";
import { OVERDUE_DAYS_THRESHOLD, REJECTED_TRANSFER_NOTE_PREFIX } from "./asset.helpers";

export async function getAssets(
  search?: string,
  page: number = 1,
  warehouseIds?: number[] | null,
  status?: AssetStatus,
  teamId?: number,
  categoryId?: number,
  // Lọc theo phụ kiện đi kèm — true = "Có", false = "Không", undefined =
  // không lọc theo cột này. Tên phụ kiện trong DB (AssetAccessory.name) luôn
  // là đúng 2 chuỗi cố định "Adapter"/"Cáp sạc" (xem setAssetAccessories() ở
  // import, stock-in, trang chi tiết thiết bị — không nơi nào tạo tên khác),
  // nên so khớp chính xác (equals) là đủ, không cần contains.
  hasAdapter?: boolean,
  hasCable?: boolean,
  brand?: string,
  // Lọc theo tag gắn ở Cài đặt > Tag Model (OK/BACKUP) — nằm trên
  // AssetModel.tag, gộp chung vào "model" where bên dưới như categoryId/
  // brand, KHÔNG tách field "model" riêng (xem giải thích ngay tại đó).
  modelTag?: AssetModelTag
) {
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  // Tách theo khoảng trắng, mỗi từ phải khớp ĐÂU ĐÓ (AND giữa các từ, OR
  // giữa các field cho từng từ) — trước đây so cả cụm "search" như 1 chuỗi
  // duy nhất nên gõ nhiều từ (VD "macbook air 13") gần như không bao giờ
  // khớp, vì tên model là "Apple MacBook Air M4 13inch..." không chứa liền
  // cụm "macbook air 13". Cách này còn cần thiết cho các thẻ thống kê ở
  // Dashboard (bấm vào để lọc theo nhiều từ khoá cùng lúc).
  const searchWords = search
    ? search.trim().split(/\s+/).filter(Boolean)
    : [];

  // Gom hết các điều kiện cần AND lại vào 1 mảng DUY NHẤT (thay vì spread
  // nhiều object rời rạc có thể cùng dùng key "AND" và ghi đè lẫn nhau) —
  // quan trọng vì bộ lọc Adapter/Cáp sạc bên dưới cũng cần query trên cùng
  // quan hệ "accessories" 2 lần (1 lần cho Adapter, 1 lần cho Cáp sạc), nên
  // bắt buộc phải nằm trong AND, không thể là 2 key "accessories" riêng
  // (JS object không cho phép trùng key).
  const andClauses: object[] = [];

  if (searchWords.length > 0) {
    andClauses.push(
      ...searchWords.map((word) => ({
        OR: [
          { assetTag: { contains: word, mode: "insensitive" as const } },
          { serialNumber: { contains: word, mode: "insensitive" as const } },
          {
            model: {
              modelName: { contains: word, mode: "insensitive" as const },
            },
          },
          {
            currentEmployee: {
              fullName: { contains: word, mode: "insensitive" as const },
            },
          },
        ],
      }))
    );
  }

  if (hasAdapter === true) {
    andClauses.push({ accessories: { some: { name: "Adapter" } } });
  } else if (hasAdapter === false) {
    andClauses.push({ accessories: { none: { name: "Adapter" } } });
  }

  if (hasCable === true) {
    andClauses.push({ accessories: { some: { name: "Cáp sạc" } } });
  } else if (hasCable === false) {
    andClauses.push({ accessories: { none: { name: "Cáp sạc" } } });
  }

  const where = {
    ...(andClauses.length > 0 ? { AND: andClauses } : {}),
    ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
    ...(status ? { status } : {}),
    // Lọc theo Team của nhân viên đang giữ thiết bị — chỉ khớp thiết bị đang
    // ASSIGNED (currentEmployee tồn tại và thuộc đúng team). Thiết bị Trong
    // kho/Bảo trì/Thanh lý sẽ không khớp filter này vì không có employee nào.
    ...(teamId ? { currentEmployee: { teamId } } : {}),
    // Lọc theo Loại thiết bị (categoryId) và/hoặc Hãng (brand) — CẢ HAI đều
    // nằm trên AssetModel (qua quan hệ "model"), không phải trực tiếp trên
    // Asset. Gộp chung vào 1 object "modelWhere" duy nhất (thay vì 2 key
    // "model" riêng) — object literal chỉ giữ được key trùng tên 1 lần, nếu
    // viết 2 field "model" tách rời thì field sau sẽ ghi đè mất field trước,
    // lọc đồng thời cả 2 (VD "Loại: Laptop" + "Hãng: Apple") sẽ chỉ còn lại
    // đúng 1 điều kiện. modelTag (Cài đặt > Tag Model) cũng nằm trên
    // AssetModel nên gộp chung vào đây luôn, cùng lý do như trên.
    ...((categoryId || brand || modelTag) && {
      model: {
        ...(categoryId ? { categoryId } : {}),
        ...(brand ? { brand } : {}),
        ...(modelTag ? { tag: modelTag } : {}),
      },
    }),
  };

  const assets = await prisma.asset.findMany({
    where,
    skip,
    take: pageSize,
    include: {

      model: true,
      currentEmployee: true,
      warehouse: true,
      warranties: true,
      accessories: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const total = await prisma.asset.count({ where });
  const totalPages = Math.ceil(total / pageSize);

  return {
    assets,
    total,
    totalPages,
    page,
  };
}

/**
 * Danh sách thiết bị đang Trong kho (chưa gán ai) — dùng cho ô "Cấp thiết
 * bị" ở trang chi tiết nhân viên, không phân trang vì đây là combobox tìm
 * kiếm chọn 1 thiết bị, không phải bảng danh sách.
 */
export async function getAvailableAssetsForAssignment(
  warehouseIds?: number[] | null
) {
  return prisma.asset.findMany({
    where: {
      status: AssetStatus.IN_STOCK,
      ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
    },
    include: {
      model: true,
      warehouse: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Danh sách thiết bị đang thu hồi để sửa chữa/bảo hành (status REPAIR) — hiển
 * thị ở trang /assets/warranty (đổi công năng từ cảnh báo hết hạn bảo hành
 * sang theo dõi máy đang gửi sửa chữa, theo yêu cầu thực tế: cần biết máy nào
 * đang "ở kho bảo hành" để dễ theo dõi/nhắc thu hồi lại).
 *
 * Kèm theo thông tin của lần gửi sửa chữa GẦN NHẤT (ai gửi, khi nào, lý do) —
 * lấy từ AssetHistory action=REPAIR, vì Asset không tự lưu các trường này.
 */
export async function getAssetsInRepair(warehouseIds?: number[] | null) {
  const assets = await prisma.asset.findMany({
    where: {
      status: AssetStatus.REPAIR,
      ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
    },
    include: {
      model: true,
      warehouse: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (assets.length === 0) {
    return [];
  }

  // Lấy TOÀN BỘ lịch sử action=REPAIR của các thiết bị này rồi tự lọc ra bản
  // ghi mới nhất mỗi thiết bị ở phía JS — Prisma không hỗ trợ "lấy 1 dòng mới
  // nhất mỗi nhóm" trực tiếp trong findMany() thường (cần raw SQL/distinct on,
  // không cần thiết cho số lượng máy đang sửa chữa thường không lớn).
  const repairHistories = await prisma.assetHistory.findMany({
    where: {
      assetId: { in: assets.map((a) => a.id) },
      action: HistoryAction.REPAIR,
    },
    orderBy: { createdAt: "desc" },
  });

  const latestByAsset = new Map<number, (typeof repairHistories)[number]>();
  for (const history of repairHistories) {
    if (!latestByAsset.has(history.assetId)) {
      latestByAsset.set(history.assetId, history);
    }
  }

  // "Hướng xử lý" IT đã điền gần nhất cho từng thiết bị (xem model
  // RepairFollowUp) — dùng để quyết định thiết bị nào vẫn còn "cần điền" (xem
  // needsFollowUp bên dưới): chưa từng điền, hoặc lần điền gần nhất đã quá
  // OVERDUE_DAYS_THRESHOLD ngày (hết hiệu lực, phải cập nhật lại).
  const followUps = await prisma.repairFollowUp.findMany({
    where: { assetId: { in: assets.map((a) => a.id) } },
    orderBy: { createdAt: "desc" },
  });

  const latestFollowUpByAsset = new Map<number, (typeof followUps)[number]>();
  for (const followUp of followUps) {
    if (!latestFollowUpByAsset.has(followUp.assetId)) {
      latestFollowUpByAsset.set(followUp.assetId, followUp);
    }
  }

  return assets.map((asset) => {
    const latest = latestByAsset.get(asset.id);
    // Fallback về asset.updatedAt nếu vì lý do gì đó không tìm thấy dòng
    // AssetHistory action=REPAIR tương ứng (dữ liệu cũ/import thẳng) — vẫn
    // tính được số ngày đang sửa chữa gần đúng thay vì để trống hẳn.
    const sentAt = latest?.createdAt ?? asset.updatedAt;
    const daysInRepair = Math.floor(
      (Date.now() - sentAt.getTime()) / (24 * 60 * 60 * 1000)
    );

    const latestFollowUp = latestFollowUpByAsset.get(asset.id) ?? null;
    const daysSinceFollowUp = latestFollowUp
      ? Math.floor(
          (Date.now() - latestFollowUp.createdAt.getTime()) /
            (24 * 60 * 60 * 1000)
        )
      : null;

    // Quá hạn (>14 ngày) VÀ (chưa từng điền hướng xử lý HOẶC lần điền gần
    // nhất đã quá 14 ngày) — mốc dùng lại đúng OVERDUE_DAYS_THRESHOLD để chỉ
    // 1 chỗ cấu hình duy nhất (đổi 14 -> số khác là đổi luôn cả 2 ý nghĩa).
    const needsFollowUp =
      daysInRepair > OVERDUE_DAYS_THRESHOLD &&
      (daysSinceFollowUp === null || daysSinceFollowUp > OVERDUE_DAYS_THRESHOLD);

    return {
      ...asset,
      repairSentAt: latest?.createdAt ?? null,
      repairNote: latest?.note ?? null,
      repairSentBy: latest?.createdBy ?? null,
      daysInRepair,
      latestFollowUp,
      needsFollowUp,
    };
  });
}

/**
 * Danh sách thiết bị đang Chờ thanh lý (status RETIRED) — hiển thị ở trang
 * /assets/liquidation ("Kho thanh lý"). Cùng cấu trúc với getAssetsInRepair
 * ở trên nhưng đọc AssetHistory action=RETIRE thay vì REPAIR.
 */
export async function getAssetsRetired(warehouseIds?: number[] | null) {
  const assets = await prisma.asset.findMany({
    where: {
      status: AssetStatus.RETIRED,
      ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
    },
    include: {
      model: true,
      warehouse: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (assets.length === 0) {
    return [];
  }

  const retireHistories = await prisma.assetHistory.findMany({
    where: {
      assetId: { in: assets.map((a) => a.id) },
      action: HistoryAction.RETIRE,
    },
    orderBy: { createdAt: "desc" },
  });

  const latestByAsset = new Map<number, (typeof retireHistories)[number]>();
  for (const history of retireHistories) {
    if (!latestByAsset.has(history.assetId)) {
      latestByAsset.set(history.assetId, history);
    }
  }

  return assets.map((asset) => {
    const latest = latestByAsset.get(asset.id);

    return {
      ...asset,
      retiredAt: latest?.createdAt ?? asset.updatedAt,
      retireNote: latest?.note ?? null,
      retiredBy: latest?.createdBy ?? null,
    };
  });
}

/**
 * Danh sách thiết bị đang Cấp mượn/Cấp tạm chờ bảo hành (có assignmentDueAt)
 * — hiển thị ở trang /assets/loans, sắp theo hạn gần nhất trước để Admin/IT
 * dễ thấy cái nào cần nhắc thu hồi gấp nhất. Chỉ những thiết bị ĐANG ASSIGNED
 * mới còn assignmentDueAt (xem returnAssetAction/bulkReturnAssetsAction — tự
 * xoá về null ngay khi thu hồi), nên không cần lọc thêm status ở đây.
 */
export async function getAssetsWithAssignmentDue(warehouseIds?: number[] | null) {
  const assets = await prisma.asset.findMany({
    where: {
      assignmentDueAt: { not: null },
      ...(warehouseIds ? { warehouseId: { in: warehouseIds } } : {}),
    },
    include: {
      model: true,
      warehouse: true,
      currentEmployee: true,
    },
    orderBy: { assignmentDueAt: "asc" },
  });

  return assets.map((asset) => {
    const daysRemaining = asset.assignmentDueAt
      ? Math.ceil(
          (asset.assignmentDueAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        )
      : 0;

    return { ...asset, daysRemaining };
  });
}

export async function getAssetById(id: number) {
  return prisma.asset.findUnique({
    where: { id },
    include: {
      model: {
        include: {
          category: true,
        },
      },
      currentEmployee: {
        include: {
          team: true,
          position: true,
        },
      },
      warehouse: true,
      pendingTransferToWarehouse: true,
      warranties: true,
      accessories: true,
      histories: {
        orderBy: {
          createdAt: "desc",
        },
        // Chỉ lấy dư 1 dòng so với số hiển thị (10) để biết còn nhiều hơn
        // hay không (hasMore), không cần load hết lịch sử của thiết bị cũ có
        // thể lên tới hàng trăm dòng.
        take: 11,
      },
    },
  });
}

/**
 * Thiết bị đang có lượt luân chuyển kho CHỜ XÁC NHẬN, mà kho đích nằm trong
 * phạm vi warehouseIds truyền vào — dùng cho banner bắt buộc trong
 * AppLayout.tsx (đếm số lượng) và trang /assets/transfers (danh sách đầy đủ
 * để bấm Xác nhận/Từ chối). warehouseIds=null nghĩa là không giới hạn (tài
 * khoản không bị gán kho/khu vực cụ thể) — trả về TẤT CẢ lượt đang chờ, giữ
 * đúng quy ước "null = không giới hạn" dùng xuyên suốt hệ thống.
 */
export async function getPendingIncomingTransfers(
  warehouseIds?: number[] | null
) {
  return prisma.asset.findMany({
    where: {
      status: AssetStatus.IN_TRANSIT,
      ...(warehouseIds
        ? { pendingTransferToWarehouseId: { in: warehouseIds } }
        : { pendingTransferToWarehouseId: { not: null } }),
    },
    include: {
      model: true,
      warehouse: true,
      pendingTransferToWarehouse: true,
    },
    orderBy: { pendingTransferAt: "asc" },
  });
}

/**
 * Các lượt luân chuyển kho bị kho ĐÍCH từ chối gần đây (thiết bị đã được trả
 * về đúng kho nguồn) — dùng cho banner "to" nhắc IT kho nguồn trong
 * AppLayout.tsx, y hệt tinh thần banner "Xác nhận ngay" của kho đích
 * (getPendingIncomingTransfers ở trên), thay vì chỉ nằm im trong chuông
 * thông báo (dễ bị bỏ sót — xem phản hồi thực tế của user).
 *
 * Khác getPendingIncomingTransfers ở chỗ đây không phải 1 trạng thái ĐANG
 * CHỜ (không có field kiểu status=... để lọc) mà là 1 SỰ KIỆN đã xảy ra
 * rồi — nên "còn hiện banner hay không" dựa vào đã đọc thông báo hay chưa
 * (lastReadAt, CÙNG mốc với chuông thông báo NotificationBell) thay vì 1
 * trạng thái tồn tại trên Asset: user mở chuông xem chi tiết (hoặc bấm "Đã
 * xem" trên banner, cùng gọi 1 API đánh dấu đã đọc) là banner tự ẩn, không
 * cần thêm field/migration riêng để lưu "đã xem chưa".
 *
 * Nhận diện đúng loại lịch sử "bị từ chối" bằng note.startsWith(...) — xem
 * REJECTED_TRANSFER_NOTE_PREFIX (asset.helpers.ts) để action ghi và hàm này
 * đọc luôn khớp nhau. Lọc theo toWarehouseId của CHÍNH DÒNG LỊCH SỬ đó
 * (kho nguồn nhận lại thiết bị) — chính xác hơn lọc theo asset.warehouseId
 * hiện tại (asset có thể đã bị luân chuyển tiếp sau đó).
 */
export async function getRecentlyRejectedTransfers(
  warehouseIds: number[] | null,
  lastReadAt: Date | null | undefined
) {
  const histories = await prisma.assetHistory.findMany({
    where: {
      action: HistoryAction.WAREHOUSE_TRANSFER,
      note: { startsWith: REJECTED_TRANSFER_NOTE_PREFIX },
      ...(warehouseIds ? { toWarehouseId: { in: warehouseIds } } : {}),
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { asset: { include: { model: true } } },
  });

  // fromWarehouseId/toWarehouseId trên AssetHistory là field snapshot thuần
  // (không có relation sẵn — xem comment trong schema.prisma), nên phải tự
  // tra tên kho đã từ chối (fromWarehouseId) bằng 1 query gộp riêng thay vì
  // include thẳng.
  const rejectingWarehouseIds = [
    ...new Set(
      histories
        .map((history) => history.fromWarehouseId)
        .filter((id): id is number => id !== null)
    ),
  ];
  const rejectingWarehouses = rejectingWarehouseIds.length
    ? await prisma.warehouse.findMany({ where: { id: { in: rejectingWarehouseIds } } })
    : [];
  const rejectingWarehouseById = new Map(
    rejectingWarehouses.map((warehouse) => [warehouse.id, warehouse])
  );

  return histories.map((history) => ({
    id: history.id,
    assetId: history.assetId,
    assetTag: history.asset.assetTag,
    modelLabel: `${history.asset.model.brand} ${history.asset.model.modelName}`,
    rejectingWarehouse: history.fromWarehouseId
      ? (rejectingWarehouseById.get(history.fromWarehouseId) ?? null)
      : null,
    note: history.note,
    createdAt: history.createdAt,
  }));
}