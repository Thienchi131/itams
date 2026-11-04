import AppLayout from "../components/AppLayout";
import { getAssets } from "@/modules/asset/asset.service";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import AssetSearchBox from "@/modules/asset/components/AssetSearchBox";
import ExportAssetsModal from "./ExportAssetsModal";
import WarehouseFilterSelect from "../components/WarehouseFilterSelect";
import StatusFilterSelect from "./StatusFilterSelect";
import TeamFilterSelect from "./TeamFilterSelect";
import CategoryFilterSelect from "./CategoryFilterSelect";
import BrandFilterSelect from "./BrandFilterSelect";
import AccessoryFilterSelect from "./AccessoryFilterSelect";
import ModelTagFilterSelect from "./ModelTagFilterSelect";
import StatusBadge from "../components/StatusBadge";
import ModelTagBadge from "../components/ModelTagBadge";
import Pagination from "../components/Pagination";
import { Check, X, Eye, X as XClose, CheckCircle2, Plug, Cable } from "lucide-react";
import { requireLogin } from "@/modules/auth/auth.service";
import { canEditData, ROLE_ADMIN } from "@/modules/auth/permissions";
import { AssetStatus, AssetModelTag } from "@prisma/client";
import { SERIAL_MAX_LENGTH, truncateSerial } from "@/lib/format";

const STATUS_LABEL: Record<AssetStatus, string> = {
  IN_STOCK: "Chưa được gán người dùng (trong kho)",
  ASSIGNED: "Đã cấp phát",
  REPAIR: "Đang bảo trì / hư hỏng",
  RETIRED: "Chờ thanh lý",
  LOST: "Bị mất",
  IN_TRANSIT: "Đang luân chuyển kho",
};

// Nhãn ngắn gọn hơn dùng riêng cho dropdown lọc (STATUS_LABEL ở trên dùng
// cho chip "Đang lọc:" nên giữ nguyên câu đầy đủ, không đổi để khỏi ảnh
// hưởng chỗ khác đang dùng).
const STATUS_FILTER_OPTIONS: { value: AssetStatus; label: string }[] = [
  { value: "IN_STOCK", label: "Còn tồn trong kho" },
  { value: "ASSIGNED", label: "Đã cấp phát" },
  { value: "REPAIR", label: "Hư hỏng / đang bảo trì" },
  { value: "RETIRED", label: "Chờ thanh lý" },
  { value: "LOST", label: "Bị mất" },
  { value: "IN_TRANSIT", label: "Đang luân chuyển kho" },
];

// Nhãn cho chip "Đang lọc: Tag Model" — tag gắn ở Cài đặt > Tag Model.
const MODEL_TAG_LABEL: Record<AssetModelTag, string> = {
  OK: "🆗 Cấp phát được",
  BACKUP: "🅱️ Backup",
};

const SUCCESS_MESSAGES: Record<string, string> = {
  asset_deleted: "Đã xoá tài sản.",
};

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    status?: string;
    warehouseId?: string;
    regionId?: string;
    teamId?: string;
    categoryId?: string;
    brand?: string;
    adapter?: string;
    cable?: string;
    modelTag?: string;
    success?: string;
  }>;
}) {
  const currentUser = await requireLogin();
  const canEdit = canEditData(currentUser.role.name);
  const isAdmin = currentUser.role.name === ROLE_ADMIN;

  // Import Excel có thể bị Admin tắt tạm thời qua Cài đặt > Import Excel —
  // ẩn nút với IT khi đang tắt, nhưng Admin (người quản lý công tắc này)
  // luôn thấy và dùng được, kể cả lúc đang tắt.
  const importSettings = await prisma.importSettings.findUnique({ where: { id: 1 } });
  const importEnabled = importSettings?.enabled ?? true;
  const showImportButton = canEdit && (importEnabled || isAdmin);

  const {
    q,
    page,
    status: statusParam,
    warehouseId: warehouseIdParam,
    regionId: regionIdParam,
    teamId: teamIdParam,
    categoryId: categoryIdParam,
    brand: brandParam,
    adapter: adapterParam,
    cable: cableParam,
    modelTag: modelTagParam,
    success,
  } = await searchParams;
  const currentPage = Number(page ?? "1");
  const status =
    statusParam && statusParam in STATUS_LABEL
      ? (statusParam as AssetStatus)
      : undefined;
  const selectedTeamId = teamIdParam ? Number(teamIdParam) : null;
  const selectedCategoryId = categoryIdParam ? Number(categoryIdParam) : null;
  const selectedBrand = brandParam ? brandParam.trim() : null;

  // Lọc theo Adapter/Cáp sạc — chỉ nhận đúng "yes"/"no", giá trị lạ khác coi
  // như không lọc (an toàn nếu ai đó tự gõ URL query bậy).
  const adapterFilter: "yes" | "no" | null =
    adapterParam === "yes" || adapterParam === "no" ? adapterParam : null;
  const cableFilter: "yes" | "no" | null =
    cableParam === "yes" || cableParam === "no" ? cableParam : null;

  // Lọc theo tag Model (Cài đặt > Tag Model) — chỉ nhận đúng 2 giá trị của
  // enum AssetModelTag, giá trị lạ khác coi như không lọc.
  const selectedModelTag: AssetModelTag | null =
    modelTagParam === "OK" || modelTagParam === "BACKUP"
      ? (modelTagParam as AssetModelTag)
      : null;

  const regionWarehouseIds = currentUser.regionWarehouseIds;

  // Dropdown lọc theo kho phân cấp Khu vực > Kho — giống Dashboard, cho phép
  // xem gộp cả 1 khu vực (nhiều kho) hoặc drill xuống đúng 1 kho. Luôn chỉ
  // lấy khu vực còn ít nhất 1 kho — khu vực rỗng hiện ra chỉ gây rối mắt.
  const allRegions = await prisma.region.findMany({
    where: regionWarehouseIds
      ? { warehouses: { some: { id: { in: regionWarehouseIds } } } }
      : { warehouses: { some: {} } },
    include: {
      // Lọc luôn kho TRONG mỗi khu vực theo đúng phạm vi được phép — tránh
      // rò rỉ các kho khác cùng khu vực cho tài khoản chỉ được gán 1 kho lẻ
      // (warehouseId, không phải cả Region).
      warehouses: {
        where: regionWarehouseIds ? { id: { in: regionWarehouseIds } } : undefined,
        orderBy: { code: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const unassignedWarehouses = regionWarehouseIds
    ? []
    : await prisma.warehouse.findMany({
        where: { regionId: null },
        orderBy: { code: "asc" },
      });

  const requestedWarehouseId = warehouseIdParam ? Number(warehouseIdParam) : null;
  const selectedWarehouseId =
    requestedWarehouseId &&
    (!regionWarehouseIds || regionWarehouseIds.includes(requestedWarehouseId))
      ? requestedWarehouseId
      : null;

  const requestedRegionId = regionIdParam ? Number(regionIdParam) : null;
  const selectedRegion =
    !selectedWarehouseId && requestedRegionId
      ? allRegions.find((region) => region.id === requestedRegionId) ?? null
      : null;

  // warehouseIds thực tế đưa vào query: ưu tiên lựa chọn tay trên dropdown,
  // rơi về phạm vi Region của tài khoản nếu chưa chọn gì.
  const effectiveWarehouseIds = selectedWarehouseId
    ? [selectedWarehouseId]
    : selectedRegion
      ? selectedRegion.warehouses.map((w) => w.id)
      : regionWarehouseIds;

  const [{ assets, total, totalPages }, allWarehouses, teams, categories, brandRows] =
    await Promise.all([
      getAssets(
        q,
        currentPage,
        effectiveWarehouseIds,
        status,
        selectedTeamId ?? undefined,
        selectedCategoryId ?? undefined,
        adapterFilter === null ? undefined : adapterFilter === "yes",
        cableFilter === null ? undefined : cableFilter === "yes",
        selectedBrand ?? undefined,
        selectedModelTag ?? undefined
      ),
      prisma.warehouse.findMany({ orderBy: { code: "asc" } }),
      prisma.team.findMany({ orderBy: { name: "asc" } }),
      prisma.assetCategory.findMany({ orderBy: { name: "asc" } }),
      // Danh sách hãng cho dropdown lọc — lấy DISTINCT trực tiếp trên
      // AssetModel.brand (không phải trên Asset) vì đây là field cấp Model,
      // dùng chung cho mọi thiết bị cùng model.
      prisma.assetModel.findMany({
        distinct: ["brand"],
        select: { brand: true },
        orderBy: { brand: "asc" },
      }),
    ]);

  const brands = brandRows.map((row) => row.brand).filter(Boolean);

  // Tài khoản bị gán Region thì trong popup export cũng chỉ được chọn kho
  // thuộc Region đó (khoá lại, không cho export lẫn kho khác qua URL param).
  // Cố tình dùng regionWarehouseIds (toàn phạm vi tài khoản) chứ không phải
  // effectiveWarehouseIds (đang lọc hẹp trên bảng) — export vẫn cho chọn bất
  // kỳ kho nào trong quyền, không bị khoá theo bộ lọc hiển thị tạm thời.
  const warehouses = regionWarehouseIds
    ? allWarehouses.filter((w) => regionWarehouseIds.includes(w.id))
    : allWarehouses;

  // Query string nền dùng chung cho mọi link trong trang (phân trang, xoá
  // filter status...) — giữ nguyên lựa chọn kho/khu vực đang xem.
  const baseQuery: Record<string, string> = {};
  if (q) baseQuery.q = q;
  if (selectedWarehouseId) baseQuery.warehouseId = String(selectedWarehouseId);
  else if (selectedRegion) baseQuery.regionId = String(selectedRegion.id);
  if (status) baseQuery.status = status;
  if (selectedTeamId) baseQuery.teamId = String(selectedTeamId);
  if (selectedCategoryId) baseQuery.categoryId = String(selectedCategoryId);
  if (selectedBrand) baseQuery.brand = selectedBrand;
  if (adapterFilter) baseQuery.adapter = adapterFilter;
  if (cableFilter) baseQuery.cable = cableFilter;
  if (selectedModelTag) baseQuery.modelTag = selectedModelTag;

  // Query khi xoá riêng 1 chip filter (status/team/category/brand/adapter/
  // cable/modelTag) — giữ nguyên mọi filter khác đang áp dụng, chỉ bỏ đúng 1
  // key.
  const queryWithoutStatus: Record<string, string> = { ...baseQuery };
  delete queryWithoutStatus.status;
  const queryWithoutTeam: Record<string, string> = { ...baseQuery };
  delete queryWithoutTeam.teamId;
  const queryWithoutCategory: Record<string, string> = { ...baseQuery };
  delete queryWithoutCategory.categoryId;
  const queryWithoutBrand: Record<string, string> = { ...baseQuery };
  delete queryWithoutBrand.brand;
  const queryWithoutAdapter: Record<string, string> = { ...baseQuery };
  delete queryWithoutAdapter.adapter;
  const queryWithoutCable: Record<string, string> = { ...baseQuery };
  delete queryWithoutCable.cable;
  const queryWithoutModelTag: Record<string, string> = { ...baseQuery };
  delete queryWithoutModelTag.modelTag;

  // URL đầy đủ của trang danh sách ĐANG XEM (kèm số trang + mọi filter) —
  // gắn vào link "Xem" để trang chi tiết biết đường quay lại ĐÚNG chỗ này
  // (thay vì luôn về trang 1 không filter). Trước đây link "Xem" không mang
  // theo gì, nên "Quay lại" ở trang chi tiết chỉ có thể trỏ cứng về
  // "/assets" — mất hết trang/filter đang xem.
  const listQueryString = new URLSearchParams({
    ...baseQuery,
    page: String(currentPage),
  }).toString();
  const returnTo = `/assets${listQueryString ? `?${listQueryString}` : ""}`;

  const selectedTeam = selectedTeamId
    ? teams.find((t) => t.id === selectedTeamId) ?? null
    : null;
  const selectedCategory = selectedCategoryId
    ? categories.find((c) => c.id === selectedCategoryId) ?? null
    : null;

  return (
    <AppLayout>
      {success && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="shrink-0" />
          {SUCCESS_MESSAGES[success] ?? "Thành công."}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Quản lý tài sản</h2>
          <p className="mt-1 text-slate-500">
            Tổng cộng <span className="font-bold text-slate-900">{total}</span> thiết bị
          </p>

          {(status || selectedTeam || selectedCategory || selectedBrand || adapterFilter || cableFilter || selectedModelTag) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {status && (
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                  Trạng thái: {STATUS_LABEL[status]}
                  <Link
                    href={{ pathname: "/assets", query: queryWithoutStatus }}
                    className="text-blue-400 hover:text-blue-600"
                  >
                    <XClose size={14} />
                  </Link>
                </div>
              )}

              {selectedTeam && (
                <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700">
                  Team: {selectedTeam.name}
                  <Link
                    href={{ pathname: "/assets", query: queryWithoutTeam }}
                    className="text-violet-400 hover:text-violet-600"
                  >
                    <XClose size={14} />
                  </Link>
                </div>
              )}

              {selectedCategory && (
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                  Loại thiết bị: {selectedCategory.name}
                  <Link
                    href={{ pathname: "/assets", query: queryWithoutCategory }}
                    className="text-emerald-400 hover:text-emerald-600"
                  >
                    <XClose size={14} />
                  </Link>
                </div>
              )}

              {selectedBrand && (
                <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-sm font-medium text-cyan-700">
                  Hãng: {selectedBrand}
                  <Link
                    href={{ pathname: "/assets", query: queryWithoutBrand }}
                    className="text-cyan-400 hover:text-cyan-600"
                  >
                    <XClose size={14} />
                  </Link>
                </div>
              )}

              {adapterFilter && (
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
                  Adapter: {adapterFilter === "yes" ? "Có" : "Không có"}
                  <Link
                    href={{ pathname: "/assets", query: queryWithoutAdapter }}
                    className="text-amber-400 hover:text-amber-600"
                  >
                    <XClose size={14} />
                  </Link>
                </div>
              )}

              {cableFilter && (
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
                  Cáp sạc: {cableFilter === "yes" ? "Có" : "Không có"}
                  <Link
                    href={{ pathname: "/assets", query: queryWithoutCable }}
                    className="text-amber-400 hover:text-amber-600"
                  >
                    <XClose size={14} />
                  </Link>
                </div>
              )}

              {selectedModelTag && (
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
                  Tag Model: {MODEL_TAG_LABEL[selectedModelTag]}
                  <Link
                    href={{ pathname: "/assets", query: queryWithoutModelTag }}
                    className="text-indigo-400 hover:text-indigo-600"
                  >
                    <XClose size={14} />
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chỉ còn các nút HÀNH ĐỘNG/ĐIỀU HƯỚNG ở đây (không phải bộ lọc) —
            3 dropdown lọc (Kho/Trạng thái/Team) đã chuyển xuống thành 1
            hàng riêng trong khung bảng, cạnh ô tìm kiếm, để không bị chen
            chúc/xuống dòng xấu chung với các nút này nữa. */}
        <div className="flex flex-wrap items-center gap-3">
  <Link
    href="/assets/warranty"
    className="rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
  >
    Theo dõi sửa chữa
  </Link>

  <Link
    href="/assets/loans"
    className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
  >
    Cấp mượn / Chờ bảo hành
  </Link>

  <Link
    href="/assets/liquidation"
    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
  >
    Kho thanh lý
  </Link>

  {showImportButton && (
    <Link
      href="/assets/import"
      className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
    >
      Import Excel
    </Link>
  )}

  {/* Export chỉ đọc dữ liệu (không ghi/sửa gì) — trước đây bị khoá chung với
      canEdit (Admin/IT) nên User (viewer) không xuất được danh sách đang
      xem, dù họ vẫn xem được đầy đủ. Mở riêng cho mọi role đã đăng nhập. */}
  <ExportAssetsModal
    warehouses={warehouses.map((w) => ({ id: w.id, label: `${w.code} - ${w.name}` }))}
    teams={teams.map((t) => ({ id: t.id, label: t.name }))}
    categories={categories.map((c) => ({ id: c.id, label: c.name }))}
  />

  {canEdit && (
    <Link
      href="/assets/stock-in"
      className="rounded-lg bg-blue-600 px-4 py-2 text-white text-sm"
    >
      + Thêm tài sản
    </Link>
  )}
</div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-4 border-b border-slate-100 p-5">
          <div className="flex flex-wrap items-center gap-2.5">
            {(!regionWarehouseIds ||
              allRegions.some((r) => r.warehouses.length > 1)) && (
              <WarehouseFilterSelect
                regions={allRegions}
                unassignedWarehouses={unassignedWarehouses}
                selectedWarehouseId={selectedWarehouseId}
                selectedRegionId={selectedRegion?.id ?? null}
              />
            )}

            <StatusFilterSelect
              statusOptions={STATUS_FILTER_OPTIONS}
              selectedStatus={status ?? null}
            />

            <TeamFilterSelect teams={teams} selectedTeamId={selectedTeamId} />

            <CategoryFilterSelect
              categories={categories}
              selectedCategoryId={selectedCategoryId}
            />

            <BrandFilterSelect brands={brands} selectedBrand={selectedBrand} />

            <ModelTagFilterSelect selectedModelTag={selectedModelTag} />

            <div className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-2.5 pl-3.5 pr-3.5 shadow-sm">
              <AccessoryFilterSelect
                paramName="adapter"
                label="Adapter"
                icon={<Plug size={15} />}
                selectedValue={adapterFilter}
              />

              <span className="h-4 w-px bg-slate-200" />

              <AccessoryFilterSelect
                paramName="cable"
                label="Cáp sạc"
                icon={<Cable size={15} />}
                selectedValue={cableFilter}
              />
            </div>
          </div>

          <AssetSearchBox />
        </div>

        <table className="w-full table-fixed text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="w-[11%] p-4 text-left">Asset Tag</th>
              <th className="w-[10%] p-4 text-left">Serial</th>
              <th className="w-[17%] p-4 text-left">Thiết bị</th>
              <th className="w-[5%] whitespace-nowrap px-1 py-4 text-center text-xs">Adapter</th>
              <th className="w-[5%] whitespace-nowrap px-1 py-4 text-center text-xs">Cáp</th>
              <th className="w-[9%] p-4 text-left">Người dùng</th>
              <th className="w-[13%] p-4 text-left">Kho</th>
              <th className="w-[8%] p-4 text-left">Tag</th>
              <th className="w-[14%] p-4 text-left">Trạng thái</th>
              <th className="w-[8%] py-4 pl-4 pr-6 text-right">Thao tác</th>
            </tr>
          </thead>

          <tbody>
            {assets.map((asset) => {
              const hasAdapter = hasAccessory(asset.accessories, "adapter");
              const hasCable =
                hasAccessory(asset.accessories, "cáp") ||
                hasAccessory(asset.accessories, "cap") ||
                hasAccessory(asset.accessories, "cable");

              return (
                <tr
                  key={asset.id}
                  className="border-t border-slate-100 transition hover:bg-blue-50/40"
                >
                  <td className="break-words p-4 align-top font-bold text-slate-900">
                    {asset.assetTag}
                  </td>
                  <td
                    className="break-all p-4 align-top text-slate-600"
                    title={
                      asset.serialNumber &&
                      asset.serialNumber.length > SERIAL_MAX_LENGTH
                        ? asset.serialNumber
                        : undefined
                    }
                  >
                    {truncateSerial(asset.serialNumber)}
                  </td>
                  <td className="break-words p-4 align-top font-medium">
                    {asset.model.brand} {asset.model.modelName}
                  </td>

                  <td className="px-1 py-4 text-center align-top">
                    <AccessoryCheck checked={hasAdapter} />
                  </td>

                  <td className="px-1 py-4 text-center align-top">
                    <AccessoryCheck checked={hasCable} />
                  </td>

                  <td className="p-4 align-top">
                    {/* Chỉ hiện tên người dùng khi status THỰC SỰ là Đã cấp
                        phát — 1 số thiết bị cũ trong DB có currentEmployeeId
                        còn sót lại dù status đã về Trong kho/khác (dữ liệu
                        rác từ trước, xem prisma/fix-stale-current-employee.ts).
                        Không dựa hoàn toàn vào currentEmployee khác null để
                        tránh hiện nhầm người dùng cho thiết bị không còn ai
                        giữ nữa. */}
                    {asset.status === "ASSIGNED" && asset.currentEmployee?.fullName ? (
                      <span
                        className="inline-flex max-w-full truncate whitespace-nowrap rounded-full bg-violet-100 px-3 py-1 text-violet-700"
                        title={asset.currentEmployee.fullName}
                      >
                        {asset.currentEmployee.fullName}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  <td className="p-4 align-top">
                    {/* max-w-full + truncate: tên kho dài (VD "SUBIC - Phil -
                        Subic") trước đây tràn ra khỏi ô, đè lên cột Trạng
                        thái bên cạnh — giờ cắt gọn kèm "..." + hiện đủ khi
                        rê chuột (title), không tràn nữa dù kho tên dài. */}
                    <span
                      className="inline-flex max-w-full items-center truncate whitespace-nowrap rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700"
                      title={
                        asset.warehouse
                          ? `${asset.warehouse.code} - ${asset.warehouse.name}`
                          : undefined
                      }
                    >
                      {asset.warehouse
                        ? `${asset.warehouse.code} - ${asset.warehouse.name}`
                        : "-"}
                    </span>
                  </td>

                  <td className="p-4 align-top">
                    <ModelTagBadge tag={asset.model.tag} />
                  </td>

                  <td className="p-4 align-top">
                    <StatusBadge status={asset.status} size="xs" />
                  </td>

                  <td className="py-4 pl-4 pr-6 text-right align-top">
                    <Link
                      href={`/assets/${asset.id}?returnTo=${encodeURIComponent(returnTo)}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 font-semibold text-blue-600 hover:bg-blue-50"
                    >
                      <Eye size={16} />
                      Xem
                    </Link>
                  </td>
                </tr>
              );
            })}

            {assets.length === 0 && (
              <tr>
                <td colSpan={10} className="p-8 text-center text-slate-500">
                  Không tìm thấy tài sản phù hợp
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages || 1}
          basePath="/assets"
          query={baseQuery}
        />
      </div>
    </AppLayout>
  );
}

function hasAccessory(accessories: { name: string }[], keyword: string) {
  return accessories.some((item) =>
    item.name.toLowerCase().includes(keyword.toLowerCase())
  );
}

function AccessoryCheck({ checked }: { checked: boolean }) {
  return checked ? (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
      <Check size={18} strokeWidth={3} />
    </span>
  ) : (
    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-rose-600">
      <X size={18} strokeWidth={3} />
    </span>
  );
} 