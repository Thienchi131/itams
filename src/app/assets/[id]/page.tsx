import AppLayout from "../../components/AppLayout";
import Link from "next/link";
import { getAssetById } from "@/modules/asset/asset.service";
import { truncateSerial } from "@/lib/format";
import LocalDateTime from "../../components/LocalDateTime";
import {
  getAssetStatusLabel,
  getHistoryActionLabel,
  ASSIGNMENT_TYPE_LABEL,
} from "@/modules/asset/asset.helpers";
import { getEmployees } from "@/modules/employee/employee.service";
import { requireLogin } from "@/modules/auth/auth.service";
import { canEditData, ROLE_ADMIN } from "@/modules/auth/permissions";
import { notFound } from "next/navigation";
import ReturnAssetModal from "./ReturnAssetModal";
import { defaultReturnWarehouseId } from "@/modules/warehouse/return-destination";
import CompleteRepairForm from "./CompleteRepairForm";
import DeleteAssetModal from "./DeleteAssetModal";
import AssetQrCard from "./AssetQrCard";
import AssetHandoverText from "./AssetHandoverText";
import StatusBadge from "../../components/StatusBadge";
import Panel from "../../components/Panel";
import AssignAssetForm from "./AssignAssetForm";
import SendToRepairModal from "./SendToRepairModal";
import TransferWarehouseForm from "./TransferWarehouseForm";
import HandoverPhotosBlock from "./HandoverPhotosBlock";
import { getHandoverPhotoStatus } from "@/modules/asset/handover-photo.helpers";
import ConfirmTransferButton from "../transfers/ConfirmTransferButton";
import RejectTransferModal from "../transfers/RejectTransferModal";
import { prisma } from "@/lib/prisma";
import { getAssetFieldProfile } from "@/lib/asset-field-profile";
import {
  ArrowLeft,
  Laptop,
  QrCode,
  Printer,
  Pencil,
  UserRound,
  FileText,
  Download,
  ChevronRight,
  Calendar,
  Cpu,
  HardDrive,
  Monitor,
  Warehouse,
  Truck,
  ShieldCheck,
  BadgeCheck,
  Tag,
  Info,
  Keyboard,
  CheckCircle2,
  Box,
  Wrench,
  TriangleAlert,
} from "lucide-react";

// Tính năng QR Code thiết bị tạm thời chưa cần dùng — ẩn đi (không xoá code)
// để bật lại nhanh sau này chỉ bằng cách đổi lại true, không cần viết lại.
const SHOW_QR_CODE = false;

export default async function AssetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  // "returnTo" là URL đầy đủ của trang danh sách (kèm trang + filter) lúc
  // bấm "Xem" ở /assets — dùng cho nút "Quay lại" bên dưới VÀ được truyền
  // tiếp xuống mọi form thao tác (bàn giao/thu hồi/luân chuyển kho/...) để
  // các action đó redirect NGƯỢC LẠI đúng trang này (kèm returnTo) sau khi
  // xong, thay vì rơi về "/assets/{id}" trơn rồi mất luôn ngữ cảnh khi bấm
  // "Quay lại" lần tiếp theo. Chỉ chấp nhận giá trị bắt đầu bằng "/assets"
  // (chặn open-redirect nếu ai đó chỉnh tay query string thành domain khác).
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo: returnToParam } = await searchParams;
  const backHref =
    returnToParam && (returnToParam.startsWith("/assets") || returnToParam === "/scan")
      ? returnToParam
      : "/assets";

  const currentUser = await requireLogin();
  const asset = await getAssetById(Number(id));
  // Lưu ý: KHÔNG lọc employees theo warehouseId ở đây — Employee không có kho
  // riêng, filter theo kho hiện chỉ dựa vào "đang giữ asset nào ở kho đó"
  // (dùng cho trang danh sách nhân viên). Nếu áp filter đó vào đây sẽ làm
  // biến mất những nhân viên mới, chưa từng được cấp thiết bị nào — đúng lúc
  // họ cần được bàn giao thiết bị đầu tiên. Nên vẫn cho chọn từ toàn bộ
  // employees.
  const employees = await getEmployees();

  // Toàn bộ danh sách kho — dùng để chọn kho đích khi luân chuyển, và để
  // hiển thị tên kho trong Timeline (fromWarehouseId/toWarehouseId chỉ lưu
  // ID, không có relation object sẵn).
  const warehouses = await prisma.warehouse.findMany({ orderBy: { code: "asc" } });

  // Kho được phép chọn khi THU HỒI (ô "Nhập về kho" chỉ hiện nếu >= 2 kho).
  const returnWarehouseOptions = warehouses
    .filter(
      (w) => !currentUser.regionWarehouseIds || currentUser.regionWarehouseIds.includes(w.id)
    )
    .map((w) => ({ id: w.id, code: w.code, name: w.name }));

  if (!asset) notFound();

  // Tài khoản bị gán Region chỉ được xem asset thuộc 1 trong các kho của
  // Region đó — HOẶC đang có lượt luân chuyển đến 1 trong các kho đó (thiết
  // bị IN_TRANSIT vẫn giữ warehouseId = kho NGUỒN cho tới khi được xác
  // nhận, nên nếu chỉ so khớp warehouseId, IT phụ trách kho ĐÍCH sẽ không
  // bao giờ mở được trang này để bấm Xác nhận/Từ chối — phải cho phép thêm
  // theo pendingTransferToWarehouseId).
  const inScopeByCurrentWarehouse =
    asset.warehouseId !== null &&
    (!currentUser.regionWarehouseIds ||
      currentUser.regionWarehouseIds.includes(asset.warehouseId));
  const inScopeByPendingTransfer =
    asset.pendingTransferToWarehouseId !== null &&
    (!currentUser.regionWarehouseIds ||
      currentUser.regionWarehouseIds.includes(asset.pendingTransferToWarehouseId));

  if (!inScopeByCurrentWarehouse && !inScopeByPendingTransfer) {
    notFound();
  }

  const warranty = asset.warranties[0];
  const canManageAsset = canEditData(currentUser.role.name);
  // Trang "Chỉnh sửa thiết bị" (Asset Tag/Serial/Model/cấu hình...) giờ CHỈ
  // Admin được vào — IT vẫn dùng được các thao tác nhanh khác (bàn giao/thu
  // hồi/chuyển kho, xem ở canManageAsset) như trước, chỉ riêng link "Chỉnh
  // sửa" này bị ẩn khỏi IT để tránh họ bấm vào rồi bị chặn ở trang sau.
  const isAdmin = currentUser.role.name === ROLE_ADMIN;

  const deviceName = `${asset.model.brand} ${asset.model.modelName}`;
  const statusLabel = getAssetStatusLabel(asset.status);
  // Field nào hiện trong panel "Cấu hình" tuỳ theo loại thiết bị — iPhone/
  // iPad không cần RAM/GPU, YubiKey/Wacom/Router... không cần specs máy
  // tính, "Màn hình" (rời) chỉ cần đúng field Màn hình. Xem asset-field-profile.ts.
  const fieldProfile = getAssetFieldProfile(asset.model.category?.name);
  const warehouseLabel = asset.warehouse
    ? `${asset.warehouse.code} - ${asset.warehouse.name}`
    : "-";

  // Số ngày còn lại tới hạn (âm = đã quá hạn) — chỉ có ý nghĩa khi đang
  // ASSIGNED và assignmentDueAt có giá trị (LOAN/WARRANTY_HOLD). PERMANENT
  // hoặc dữ liệu cũ trước khi có tính năng này sẽ là null, không hiện badge.
  const assignmentDaysRemaining = asset.assignmentDueAt
    ? Math.ceil(
        (asset.assignmentDueAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
      )
    : null;

  const accessoryText =
    asset.accessories.length > 0
      ? asset.accessories
          .map((item) => `• ${item.name} x${item.quantity}`)
          .join("\n")
      : "• Không có";

  // Không tính giờ ở đây (server) vì user bấm Copy có thể ở múi giờ khác VPS
  // — để lại placeholder, AssetHandoverText.tsx sẽ điền đúng giờ thiết bị
  // của user vào đúng lúc bấm copy.
  const currentDate = "{{NOW}}";

  const handoverText = `📦 BÀN GIAO THIẾT BỊ

👤 Người nhận: ${asset.currentEmployee?.fullName ?? "Chưa bàn giao"}

💻 ${deviceName}
🏷 ${asset.assetTag}
🔖 ${asset.serialNumber}

🎒 Phụ kiện:
${accessoryText}

⭐ Tình trạng: ${asset.condition ?? "Good"}
📅 Ngày: ${currentDate}

Vui lòng kiểm tra thiết bị trước khi xác nhận.`;

  // "Thu hồi từ" phải lấy tên người TỪNG giữ thiết bị trước khi thu hồi, chứ
  // không phải asset.currentEmployee — vì returnAssetAction() đã xoá
  // currentEmployeeId (set null) ngay khi thu hồi xong, nên tại thời điểm
  // trang này hiển thị nút "Copy biên bản thu hồi" (status đã là IN_STOCK),
  // asset.currentEmployee luôn là null, khiến biên bản luôn hiện "-". Lấy lại
  // đúng người đó từ dòng lịch sử "Thu hồi" gần nhất (fromEmployeeId).
  const lastReturnHistory = asset.histories.find(
    (h) => h.action === "RETURN"
  );

  // Ảnh xác nhận bàn giao ở Timeline: lượt bàn giao tạo SAU khi có tính năng
  // (có photoDueAt) luôn bổ sung được. Lượt bàn giao cũ chỉ cho bổ sung nếu
  // đó là lượt bàn giao hiện hành (thiết bị vẫn đang ở đúng người nhận) —
  // tránh hiện nút "Bổ sung ảnh" trên mọi dòng bàn giao lịch sử.
  const latestTransferHistory = asset.histories.find((h) => h.action === "TRANSFER");
  const photoStatusNow = new Date();
  const lastReturnedFromEmployee = lastReturnHistory
    ? employees.find((e) => e.id === lastReturnHistory.fromEmployeeId)
    : undefined;

  const returnText = `📥 THU HỒI THIẾT BỊ

👤 Thu hồi từ: ${lastReturnedFromEmployee?.fullName ?? "-"}

💻 ${deviceName}
🏷 ${asset.assetTag}
🔖 ${asset.serialNumber}

🎒 Phụ kiện:
${accessoryText}

📦 Kho: ${warehouseLabel}
📅 Ngày: ${currentDate}

Thiết bị đã được tiếp nhận về kho.`;

  return (
    <AppLayout>
      <div className="space-y-5">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-600"
        >
          <ArrowLeft size={16} />
          Quay lại
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-100 text-blue-600">
              <Laptop size={38} />
            </div>

            <div>
              <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">
                {deviceName}
              </h2>

              <div className="mt-3 flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-4 py-1.5 text-sm font-bold text-slate-700">
                  {asset.assetTag}
                </span>

                <StatusBadge status={asset.status} />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <TopButton icon={<QrCode size={18} />} label="In QR" />
            <TopButton icon={<Printer size={18} />} label="In tem" />
            {isAdmin && (
              <Link
                href={`/assets/${asset.id}/edit?returnTo=${encodeURIComponent(backHref)}`}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-blue-600 shadow-sm hover:bg-blue-50"
              >
                <Pencil size={18} />
                Chỉnh sửa
              </Link>
            )}
          </div>
        </div>

        <section className="grid grid-cols-2 gap-4 overflow-hidden rounded-2xl sm:grid-cols-3 lg:grid-cols-6 lg:gap-0 border border-slate-200 bg-white p-5 shadow-sm">
          <TopInfo
            label="Loại thiết bị"
            value={asset.model.category.name}
            icon={<Laptop size={15} />}
            badge
          />

          <TopInfo
            label="Brand / Model"
            value={asset.model.modelName}
            strong={asset.model.brand}
          />

          <TopInfo
            label="Serial Number"
            value={truncateSerial(asset.serialNumber) ?? "-"}
            title={asset.serialNumber ?? undefined}
          />

          <TopInfo
            label="Employee"
            value={
              asset.status === "ASSIGNED" ? (
                <div>
                  <p>{asset.currentEmployee?.fullName ?? "-"}</p>

                  {asset.assignmentType && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {ASSIGNMENT_TYPE_LABEL[asset.assignmentType]}
                    </span>
                  )}

                  {assignmentDaysRemaining !== null && (
                    <span
                      className={`mt-1 ml-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                        assignmentDaysRemaining < 0
                          ? "bg-rose-100 text-rose-700"
                          : assignmentDaysRemaining <= 7
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      <TriangleAlert size={11} />
                      {assignmentDaysRemaining < 0
                        ? `Quá hạn ${Math.abs(assignmentDaysRemaining)} ngày`
                        : `Còn ${assignmentDaysRemaining} ngày`}
                    </span>
                  )}
                </div>
              ) : (
                "-"
              )
            }
          />

          <TopInfo
            label="Location"
            value={warehouseLabel}
            icon={<Warehouse size={15} />}
          />

          <TopInfo
            label="Ngày nhập kho"
            value={<LocalDateTime value={asset.createdAt} />}
            icon={<Calendar size={15} />}
          />
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-2">
            <Panel title="Thông tin thiết bị">
              <InfoRow
                icon={<BadgeCheck />}
                label="Asset Tag"
                value={asset.assetTag}
              />

              <InfoRow
                icon={<Tag />}
                label="Serial Number"
                value={truncateSerial(asset.serialNumber) ?? "-"}
                title={asset.serialNumber ?? undefined}
              />

              <InfoRow
                icon={<Laptop />}
                label="Loại thiết bị"
                value={asset.model.category.name}
              />

              <InfoRow
                icon={<Box />}
                label="Brand / Model"
                value={`${asset.model.brand} / ${asset.model.modelName}`}
              />

              <InfoRow
                icon={<Info />}
                label="Status"
                value={statusLabel}
                badge
              />

              <InfoRow
                icon={<Warehouse />}
                label="Location"
                value={warehouseLabel}
              />

              <InfoRow
                icon={<Calendar />}
                label="Ngày nhập kho"
                value={<LocalDateTime value={asset.createdAt} />}
              />

              <InfoRow
                icon={<Pencil />}
                label="Ghi chú"
                value={asset.note ?? "-"}
              />
            </Panel>

            <Panel title="Cấu hình">
              {fieldProfile.showCpu && (
                <InfoRow
                  icon={<Cpu />}
                  label={fieldProfile.cpuLabel}
                  value={asset.actualCpu ?? asset.model.defaultCpu ?? "-"}
                />
              )}

              {fieldProfile.showRam && (
                <InfoRow
                  icon={<HardDrive />}
                  label="RAM"
                  value={asset.actualRam ?? asset.model.defaultRam ?? "-"}
                />
              )}

              {fieldProfile.showStorage && (
                <InfoRow
                  icon={<HardDrive />}
                  label={fieldProfile.storageLabel}
                  value={asset.actualStorage ?? asset.model.defaultStorage ?? "-"}
                />
              )}

              {fieldProfile.showScreen && (
                <InfoRow
                  icon={<Monitor />}
                  label="Màn hình"
                  value={asset.actualScreen ?? asset.model.defaultScreen ?? "-"}
                />
              )}

              {fieldProfile.showGpu && (
                <InfoRow
                  icon={<Cpu />}
                  label="GPU"
                  value={asset.actualGpu ?? asset.model.defaultGpu ?? "-"}
                />
              )}

              {fieldProfile.showColor && (
                <InfoRow
                  icon={<Keyboard />}
                  label="Màu sắc"
                  value={asset.color ?? "-"}
                />
              )}

              <InfoRow
                icon={<Info />}
                label="Tình trạng"
                value={asset.condition ?? "-"}
              />
            </Panel>

            <Panel title="Phụ kiện đi kèm">
              {asset.accessories.length === 0 ? (
                <p className="text-sm text-slate-500">Không có phụ kiện</p>
              ) : (
                asset.accessories.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between border-b border-slate-100 py-3 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={18} className="text-emerald-500" />
                      <span className="font-medium text-slate-800">
                        {item.name}
                      </span>
                    </div>

                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                      x{item.quantity}
                    </span>
                  </div>
                ))
              )}
            </Panel>

            <Panel title="Bảo hành">
              {warranty ? (
                <>
                  <InfoRow
                    icon={<ShieldCheck />}
                    label="Nhà bảo hành"
                    value={warranty.provider ?? "-"}
                  />

                  <InfoRow
                    icon={<Calendar />}
                    label="Ngày bắt đầu"
                    value={
                      warranty.startDate ? (
                        <LocalDateTime value={warranty.startDate} />
                      ) : (
                        "-"
                      )
                    }
                  />

                  <InfoRow
                    icon={<Calendar />}
                    label="Ngày kết thúc"
                    value={
                      warranty.endDate ? (
                        <LocalDateTime value={warranty.endDate} />
                      ) : (
                        "-"
                      )
                    }
                  />

                  <InfoRow
                    icon={<Info />}
                    label="Ghi chú"
                    value={warranty.note ?? "-"}
                  />
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Chưa có thông tin bảo hành
                </p>
              )}
            </Panel>
          </div>

          <div className="space-y-5">
            {canManageAsset && (
              <Panel title="Thao tác nhanh">
                {/* Chỉ thiết bị đang TRONG KHO (chưa gán ai) mới được bàn
                    giao — thiết bị đã cấp phát rồi thì phải Thu hồi trước
                    mới bàn giao tiếp cho người khác được, tránh 1 thiết bị
                    bị gán chồng cho 2 nhân viên cùng lúc. */}
                {asset.status === "IN_STOCK" && (
                  <ActionCard
                    icon={<UserRound />}
                    title="Bàn giao thiết bị"
                    desc="Giao thiết bị cho nhân viên"
                    color="blue"
                  >
                    <AssignAssetForm
                    assetId={asset.id}
                    employees={employees}
                    accessories={asset.accessories}
                    returnTo={backHref}
                  />
                  </ActionCard>
                )}

                {/* Thiết bị đang Trong kho (chưa từng bàn giao ai) cần đưa ra
                    khỏi kho hoạt động — trước đây chỉ có đường "Gửi sửa
                    chữa" qua luồng Thu hồi (chỉ áp dụng thiết bị Đã cấp
                    phát), nên máy dạng này không có cách nào chuyển trạng
                    thái. Gộp cả 3 hướng (Gửi bảo hành/Hư hỏng -> Bảo trì,
                    Chờ thanh lý -> Thanh lý) vào 1 action card duy nhất. */}
                {asset.status === "IN_STOCK" && (
                  <ActionCard
                    icon={<Wrench />}
                    title="Gửi bảo hành / Hư hỏng / Thanh lý"
                    desc="Đưa thiết bị ra khỏi kho hoạt động"
                    color="orange"
                  >
                    <SendToRepairModal assetId={asset.id} returnTo={backHref} />
                  </ActionCard>
                )}

                {/* Chỉ thiết bị ĐANG được cấp phát cho ai đó mới thu hồi
                    được — trong kho thì không có ai để thu hồi từ. */}
                {asset.status === "ASSIGNED" && (
                  <ActionCard
                    icon={<Download />}
                    title="Thu hồi thiết bị"
                    desc="Thu hồi thiết bị từ nhân viên"
                    color="orange"
                  >
                    <div className="mt-4">
                      <ReturnAssetModal
                        assetId={asset.id}
                        returnTo={backHref}
                        warehouseOptions={returnWarehouseOptions}
                        defaultWarehouseId={defaultReturnWarehouseId(
                          returnWarehouseOptions,
                          currentUser.warehouseId,
                          asset.warehouseId
                        )}
                      />
                    </div>
                  </ActionCard>
                )}

                {/* Thiết bị đang gửi sửa chữa/bảo hành — chỉ có 1 thao tác
                    khả dụng là đánh dấu đã sửa xong để đưa về Trong kho. */}
                {asset.status === "REPAIR" && (
                  <ActionCard
                    icon={<Wrench />}
                    title="Hoàn tất sửa chữa/bảo hành"
                    desc="Đưa thiết bị về Trong kho sau khi sửa xong"
                    color="orange"
                  >
                    <CompleteRepairForm assetId={asset.id} returnTo={backHref} />
                  </ActionCard>
                )}

                {/* Thiết bị đang có lượt luân chuyển kho chờ xác nhận — hiện
                    rõ context (từ đâu, đến đâu, ai gửi, khi nào, ghi chú) và
                    nút Xác nhận/Từ chối NẾU currentUser thuộc phạm vi kho
                    ĐÍCH (inScopeByPendingTransfer đã tính sẵn ở trên, dùng
                    chung với gate xem trang). Nếu currentUser chỉ thuộc kho
                    NGUỒN (người gửi) thì chỉ xem được thông tin, không thấy
                    2 nút này — đúng người mới xác nhận được. */}
                {asset.status === "IN_TRANSIT" && (
                  <ActionCard
                    icon={<Truck />}
                    title="Đang luân chuyển kho"
                    desc="Chờ kho đích xác nhận nhập kho"
                    color="violet"
                  >
                    <div className="mt-2 space-y-1.5 text-sm text-slate-600">
                      <p>
                        Từ kho:{" "}
                        <span className="font-semibold text-slate-900">
                          {asset.warehouse
                            ? `${asset.warehouse.code} - ${asset.warehouse.name}`
                            : "-"}
                        </span>
                      </p>
                      <p>
                        Đến kho:{" "}
                        <span className="font-semibold text-slate-900">
                          {asset.pendingTransferToWarehouse
                            ? `${asset.pendingTransferToWarehouse.code} - ${asset.pendingTransferToWarehouse.name}`
                            : "-"}
                        </span>
                      </p>
                      <p>Người gửi: {asset.pendingTransferBy ?? "-"}</p>
                      {asset.pendingTransferNote && (
                        <p>Ghi chú: {asset.pendingTransferNote}</p>
                      )}
                    </div>

                    {inScopeByPendingTransfer && (
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <RejectTransferModal
                          assetId={asset.id}
                          assetTag={asset.assetTag}
                          returnTo={backHref}
                        />
                        <ConfirmTransferButton
                          assetId={asset.id}
                          assetTag={asset.assetTag}
                          toWarehouseLabel={
                            asset.pendingTransferToWarehouse
                              ? `${asset.pendingTransferToWarehouse.code} - ${asset.pendingTransferToWarehouse.name}`
                              : "kho đích"
                          }
                          returnTo={backHref}
                        />
                      </div>
                    )}
                  </ActionCard>
                )}

                {asset.status !== "IN_STOCK" &&
                  asset.status !== "ASSIGNED" &&
                  asset.status !== "REPAIR" &&
                  asset.status !== "IN_TRANSIT" && (
                    <p className="text-sm text-slate-500">
                      Thiết bị đang ở trạng thái &quot;{statusLabel}&quot;, không
                      có thao tác bàn giao/thu hồi phù hợp.
                    </p>
                  )}

                {/* Luân chuyển kho không phụ thuộc trạng thái bàn giao — cho
                    phép cả khi thiết bị đang trong kho lẫn đang cấp phát (VD:
                    nhân viên chuyển văn phòng/chi nhánh mang theo thiết bị).
                    Trừ khi đang IN_TRANSIT — đã có 1 lượt chờ xác nhận rồi,
                    không cho tạo chồng thêm lượt mới (transferWarehouseAction
                    cũng đã chặn ở server, ẩn form đi luôn cho đỡ rối). */}
                {asset.status !== "IN_TRANSIT" && (
                  <ActionCard
                    icon={<Truck />}
                    title="Luân chuyển kho"
                    desc="Chuyển thiết bị sang kho khác"
                    color="violet"
                  >
                    <TransferWarehouseForm
                      assetId={asset.id}
                      currentWarehouseId={asset.warehouseId}
                      warehouses={warehouses}
                      returnTo={backHref}
                    />
                  </ActionCard>
                )}

                <ActionCard
                  icon={<FileText />}
                  title="Copy biên bản"
                  desc={
                    asset.status === "ASSIGNED"
                      ? "Sao chép biên bản bàn giao"
                      : asset.status === "IN_STOCK"
                        ? "Sao chép biên bản thu hồi"
                        : "Không có biên bản phù hợp"
                  }
                  color="emerald"
                >
                  <div className="mt-4 grid gap-3">
                    {asset.status === "ASSIGNED" && (
                      <AssetHandoverText
                        title="📦 Copy biên bản bàn giao"
                        text={handoverText}
                      />
                    )}

                    {asset.status === "IN_STOCK" && (
                      <AssetHandoverText
                        title="📥 Copy biên bản thu hồi"
                        text={returnText}
                      />
                    )}

                    {asset.status !== "ASSIGNED" &&
                      asset.status !== "IN_STOCK" && (
                        <p className="text-sm text-slate-500">
                          Thiết bị đang ở trạng thái &quot;{statusLabel}
                          &quot;, không có biên bản để copy.
                        </p>
                      )}
                  </div>
                </ActionCard>
              </Panel>
            )}

            {SHOW_QR_CODE && (
              <AssetQrCard assetId={asset.id} assetTag={asset.assetTag} />
            )}

            {/* Chỉ Admin thấy khu vực này — xoá là hành động phá huỷ dữ
                liệu gốc không thể hoàn tác (khác các thao tác vận hành khác
                mà IT cũng làm được), dùng cho trường hợp nhập nhầm/nhập
                trùng thiết bị lúc nhập kho. */}
            {isAdmin && (
              <Panel title="Vùng nguy hiểm">
                <p className="mb-4 text-sm text-slate-500">
                  Chỉ xoá khi thiết bị được nhập nhầm/nhập trùng thông tin.
                  Thiết bị đang thực sự sử dụng thì nên chuyển kho/thu hồi
                  thay vì xoá.
                </p>

                <DeleteAssetModal
                  assetId={asset.id}
                  assetLabel={`${asset.assetTag} — ${deviceName} (SN: ${asset.serialNumber})`}
                  returnTo={backHref}
                />
              </Panel>
            )}
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-slate-900">Timeline</h3>

            <Link
              href={`/activity?assetId=${asset.id}`}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Xem tất cả
            </Link>
          </div>

          {asset.histories.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có lịch sử thao tác</p>
          ) : (
            <div className="space-y-6">
              {/* Chỉ hiện tối đa 10 dòng gần nhất ở đây — query đã lấy dư 1
                  dòng (take: 11) để biết còn nhiều hơn hay không, xem đầy đủ
                  thì bấm "Xem tất cả" ở trên. */}
              {asset.histories.slice(0, 10).map((history) => {
                const toEmployee = employees.find(
                  (employee) => employee.id === history.toEmployeeId
                );

                const fromEmployee = employees.find(
                  (employee) => employee.id === history.fromEmployeeId
                );

                // Riêng luân chuyển kho không liên quan tới nhân viên nào —
                // cột "Từ"/"Đến" hiển thị tên kho thay vì để trống.
                const toWarehouse = warehouses.find(
                  (w) => w.id === history.toWarehouseId
                );

                const fromWarehouse = warehouses.find(
                  (w) => w.id === history.fromWarehouseId
                );

                // Riêng ở Timeline dùng "Kho - tên kho" thay vì "mã kho - tên
                // kho" như mọi nơi khác — mã kho và tên kho hay trùng gần
                // giống nhau (VD "RAK 1 - Rak 1"), dễ đọc nhầm thành 1 người
                // dùng chứ không phải 1 kho khi đứng cạnh cột nhân viên.
                const fromWarehouseLabel = fromWarehouse
                  ? `Kho - ${fromWarehouse.name}`
                  : "-";
                const toWarehouseLabel = toWarehouse
                  ? `Kho - ${toWarehouse.name}`
                  : "-";
                const fromEmployeeLabel = fromEmployee?.fullName ?? "-";
                const toEmployeeLabel = toEmployee?.fullName ?? "-";

                // Mỗi loại thao tác có ý nghĩa "Từ"/"Đến" khác nhau — trước
                // đây chỉ tách 2 nhóm (luân chuyển kho vs còn lại), khiến Bàn
                // giao/Thu hồi chỉ hiện được 1 vế nhân viên, bỏ mất vế kho dù
                // dữ liệu đã lưu sẵn cả 2. Giờ hiện đúng theo nghiệp vụ:
                // - Bàn giao: Từ kho xuất -> Đến nhân viên nhận
                // - Thu hồi: Từ nhân viên trả -> Đến kho nhận lại
                // - Luân chuyển kho: Từ kho cũ -> Đến kho mới
                // - Còn lại (nhập/xuất kho, sửa chữa, thanh lý, cập nhật...):
                //   giữ nguyên hiển thị theo nhân viên như trước.
                let fromLabel = fromEmployeeLabel;
                let toLabel = toEmployeeLabel;

                if (history.action === "WAREHOUSE_TRANSFER") {
                  fromLabel = fromWarehouseLabel;
                  toLabel = toWarehouseLabel;
                } else if (history.action === "TRANSFER") {
                  fromLabel = fromWarehouseLabel;
                  toLabel = toEmployeeLabel;
                } else if (history.action === "RETURN") {
                  fromLabel = fromEmployeeLabel;
                  toLabel = toWarehouseLabel;
                }

                return (
                  <div
                    key={history.id}
                    className="relative border-l-2 border-slate-200 pl-6"
                  >
                    <div className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-emerald-500" />

                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 lg:gap-6">
                      <div>
                        <p className="font-bold text-slate-900">
                          {getHistoryActionLabel(history.action)}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          <LocalDateTime value={history.createdAt} mode="datetime" />
                        </p>
                      </div>

                      <div className="text-sm text-slate-600">
                        <p className="font-semibold text-slate-700">Từ</p>
                        <p>{fromLabel}</p>
                      </div>

                      <div className="text-sm text-slate-600">
                        <p className="font-semibold text-slate-700">Đến</p>
                        <p>{toLabel}</p>
                      </div>

                      <div className="text-sm text-slate-600">
                        <p className="font-semibold text-slate-700">
                          Thực hiện bởi
                        </p>
                        <p>{history.createdBy ?? "-"}</p>
                      </div>

                      <div className="text-sm text-slate-600">
                        <p className="font-semibold text-slate-700">Ghi chú</p>
                        <p>{history.note ?? "-"}</p>
                      </div>
                    </div>

                    {history.action === "TRANSFER" && history.toEmployeeId !== null && (
                      <HandoverPhotosBlock
                        // Đổi key khi số ảnh đổi — sau khi bổ sung/xoá ảnh
                        // thành công (redirect về lại trang này) khối được
                        // tạo mới, xoá sạch ảnh đã chọn trong form cũ.
                        key={`${history.id}-${history.photos.length}`}
                        historyId={history.id}
                        returnTo={backHref}
                        photos={history.photos.map((photo) => ({
                          id: photo.id,
                          uploadedBy: photo.uploadedBy,
                          createdAt: photo.createdAt.toISOString(),
                        }))}
                        status={getHandoverPhotoStatus(
                          history.photoDueAt,
                          history.photos.length,
                          photoStatusNow
                        )}
                        photoDueAt={history.photoDueAt?.toISOString() ?? null}
                        canUpload={
                          canManageAsset &&
                          (history.photoDueAt !== null ||
                            (history.id === latestTransferHistory?.id &&
                              asset.currentEmployeeId === history.toEmployeeId))
                        }
                        canDelete={isAdmin}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}

function TopButton({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-blue-600 shadow-sm hover:bg-blue-50"
    >
      {icon}
      {label}
    </button>
  );
}

function TopInfo({
  label,
  value,
  strong,
  icon,
  badge,
  title,
}: {
  label: string;
  value: React.ReactNode;
  strong?: string;
  icon?: React.ReactNode;
  badge?: boolean;
  title?: string;
}) {
  return (
    <div className="min-w-0 border-r border-slate-100 px-5 last:border-r-0">
      <p className="mb-2 text-xs font-bold text-slate-500">{label}</p>

      {badge ? (
        <span
          className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-600"
          title={title}
        >
          {icon}
          {value}
        </span>
      ) : (
        <div className="text-sm text-slate-700">
          {strong && <p className="font-bold text-slate-900">{strong}</p>}

          <div className="flex items-start gap-2">
            {icon && <span className="mt-0.5 text-emerald-500">{icon}</span>}
            <span className="break-all" title={title}>
              {value}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  badge,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  badge?: boolean;
  title?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="flex shrink-0 items-center gap-3 text-slate-600">
        <span className="text-slate-400">{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </div>

      {badge ? (
        <span
          className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700"
          title={title}
        >
          {value}
        </span>
      ) : (
        <span
          className="break-all text-right text-sm font-semibold text-slate-800"
          title={title}
        >
          {value}
        </span>
      )}
    </div>
  );
}

function ActionCard({
  icon,
  title,
  desc,
  color,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  color: "blue" | "orange" | "emerald" | "violet";
  children?: React.ReactNode;
}) {
  const theme = {
    blue: "bg-blue-600",
    orange: "bg-orange-500",
    emerald: "bg-emerald-600",
    violet: "bg-violet-600",
  };

  return (
    <div className="mb-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm last:mb-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl text-white ${theme[color]}`}
          >
            {icon}
          </div>

          <div>
            <p className="font-bold text-slate-900">{title}</p>
            <p className="text-sm text-slate-500">{desc}</p>
          </div>
        </div>

        <ChevronRight size={20} className="text-slate-400" />
      </div>

      {children}
    </div>
  );
}
