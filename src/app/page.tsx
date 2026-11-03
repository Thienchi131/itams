import AppLayout from "./components/AppLayout";
import NotificationBell from "./components/NotificationBell";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/modules/auth/auth.service";
import { ROLE_ADMIN, ROLE_IT, ROLE_USER } from "@/modules/auth/permissions";
import WarehouseFilterSelect from "./components/WarehouseFilterSelect";
import { truncateSerial } from "@/lib/format";
import LocalDateTime from "./components/LocalDateTime";
import {
  Monitor,
  Laptop,
  Smartphone,
  KeyRound,
  Tv,
  UserRound,
  Wrench,
  PackageSearch,
  Calendar,
  Users,
  Trash2,
  Plug,
  Cable,
} from "lucide-react";

// Đếm "còn bao nhiêu trong kho" theo từ khoá xuất hiện trong tên model, vì
// tên model luôn kèm theo cấu hình (VD: "Apple MacBook Air M4 13inch
// 24GB/512GB") nên không thể so khớp theo tên chính xác.
const STOCK_GROUPS = [
  {
    key: "macbook-air-13",
    label: 'MacBook Air 13"',
    icon: <Laptop size={20} />,
    color: "sky",
    keywordGroups: [["macbook", "air", "13"]],
  },
  {
    key: "macbook-pro-14",
    label: 'MacBook Pro 14"',
    icon: <Laptop size={20} />,
    color: "indigo",
    keywordGroups: [["macbook", "pro", "14"]],
  },
  {
    key: "macbook-16",
    label: 'MacBook 16"',
    icon: <Laptop size={20} />,
    color: "violet",
    keywordGroups: [["macbook", "16"]],
  },
  {
    key: "iphone",
    label: "iPhone",
    icon: <Smartphone size={20} />,
    color: "emerald",
    keywordGroups: [["iphone"]],
  },
  {
    key: "yubikey",
    label: "YubiKey",
    icon: <KeyRound size={20} />,
    color: "amber",
    keywordGroups: [["yubikey"]],
  },
  {
    key: "monitor",
    label: "Màn hình",
    icon: <Tv size={20} />,
    color: "rose",
    keywordGroups: [["display"], ["monitor"], ["màn hình"]],
  },
];

function buildStockWhere(
  keywordGroups: string[][],
  warehouseFilter: { warehouseId?: number | { in: number[] } }
) {
  return {
    ...warehouseFilter,
    status: "IN_STOCK" as const,
    OR: keywordGroups.map((group) => ({
      AND: group.map((keyword) => ({
        model: { modelName: { contains: keyword, mode: "insensitive" as const } },
      })),
    })),
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ warehouseId?: string; regionId?: string }>;
}) {
  const currentUser = await requireRole([ROLE_ADMIN, ROLE_IT, ROLE_USER]);
  const { warehouseId: warehouseIdParam, regionId: regionIdParam } = await searchParams;

  // User bị gán Region chỉ được xem các kho thuộc Region đó — nhưng 1 Region
  // có thể gồm nhiều kho (VD: Dubai 1, Dubai 2, RAK 1-3), nên vẫn cho chọn
  // qua dropdown, chỉ giới hạn danh sách lựa chọn trong Region. Tài khoản
  // không bị gán Region (Admin) chọn được bất kỳ kho/khu vực nào.
  const regionWarehouseIds = currentUser.regionWarehouseIds;
  const isScoped = Boolean(regionWarehouseIds);

  // Dropdown lọc theo kho phân cấp Khu vực > Kho — load trước để vừa hiển
  // thị vừa validate lựa chọn gửi lên (tránh chọn khu vực/kho ngoài phạm vi
  // được phân quyền qua URL query trực tiếp). Luôn chỉ lấy khu vực CÒN ít
  // nhất 1 kho — khu vực rỗng (VD do migration tự tạo trước đây, giờ đã dồn
  // hết kho sang khu vực khác) không có gì để gộp, hiện ra chỉ gây rối mắt.
  const allRegions = await prisma.region.findMany({
    where: regionWarehouseIds
      ? { warehouses: { some: { id: { in: regionWarehouseIds } } } }
      : { warehouses: { some: {} } },
    include: {
      // Lọc luôn danh sách kho TRONG mỗi khu vực theo đúng phạm vi được
      // phép — nếu không, 1 tài khoản chỉ được gán 1 kho lẻ (warehouseId,
      // không phải cả Region) vẫn sẽ thấy MỌI kho khác cùng khu vực với kho
      // đó trong dropdown (rò rỉ ngoài phạm vi được cấp).
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

  // Chọn "Toàn bộ khu vực X" chỉ có ý nghĩa khi KHÔNG chọn 1 kho cụ thể —
  // warehouseId (nếu có) luôn ưu tiên hơn regionId trên URL.
  const requestedRegionId = regionIdParam ? Number(regionIdParam) : null;
  const selectedRegion =
    !selectedWarehouseId && requestedRegionId
      ? allRegions.find((region) => region.id === requestedRegionId) ?? null
      : null;

  // Danh sách warehouseId dùng để lọc số liệu: ưu tiên khu vực vừa chọn tay
  // trên dropdown, nếu không thì rơi về phạm vi Region tài khoản đang bị gán
  // (null = không giới hạn, chỉ Admin).
  const effectiveWarehouseIds = selectedRegion
    ? selectedRegion.warehouses.map((w) => w.id)
    : regionWarehouseIds;

  const warehouseFilter = selectedWarehouseId
    ? { warehouseId: selectedWarehouseId }
    : effectiveWarehouseIds
      ? { warehouseId: { in: effectiveWarehouseIds } }
      : {};

  const [
    totalAssets,
    assignedAssets,
    inStockAssets,
    repairAssets,
    employeeCount,
    latestAssets,
    warehouses,
    stockCounts,
    pendingLiquidationCount,
    doneLiquidationCount,
    adapterInStock,
    cableInStock,
    phoneInStockCount,
    laptopInStockCount,
    categoryLookup,
  ] = await Promise.all([
    prisma.asset.count({ where: warehouseFilter }),
    prisma.asset.count({ where: { ...warehouseFilter, status: "ASSIGNED" } }),
    prisma.asset.count({ where: { ...warehouseFilter, status: "IN_STOCK" } }),
    prisma.asset.count({ where: { ...warehouseFilter, status: "REPAIR" } }),
    // Số nhân viên đang giữ ít nhất 1 thiết bị trong phạm vi được xem — Employee
    // không có warehouseId riêng nên phải lọc qua quan hệ asset đang cấp phát
    // (currentEmployeeId) để ra đúng phạm vi kho/khu vực đang chọn.
    prisma.employee.count({
      where: { assets: { some: { ...warehouseFilter, status: "ASSIGNED" } } },
    }),
    prisma.asset.findMany({
      where: warehouseFilter,
      // Trước đây "take: 5" cố định — khi khung "Phân bổ theo kho" bên phải
      // cao lên (nhiều kho hơn), khung này thấp hơn hẳn, để lại khoảng trống
      // trắng xấu bên dưới. Tăng lên 7 dòng dữ liệu THẬT (không phải đệm
      // trống) để 2 khung cân đối hơn; nếu vẫn còn lệch chút vì số kho tăng
      // tiếp, phần overflow-y-auto bên dưới tự cuộn riêng, không phá layout.
      take: 7,
      orderBy: { createdAt: "desc" },
      include: {
        model: true,
        currentEmployee: true,
        warehouse: true,
      },
    }),
    prisma.warehouse.findMany({
      where: selectedWarehouseId
        ? { id: selectedWarehouseId }
        : effectiveWarehouseIds
          ? { id: { in: effectiveWarehouseIds } }
          : {},
      include: {
        _count: {
          select: { assets: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    Promise.all(
      STOCK_GROUPS.map((group) =>
        prisma.asset.count({
          where: buildStockWhere(group.keywordGroups, warehouseFilter),
        })
      )
    ),
    // Chờ thanh lý = status RETIRED nhưng chưa xác nhận xử lý xong
    // (liquidatedAt còn trống). Đã thanh lý = đã xác nhận (liquidatedAt có
    // giá trị). Xem thêm /assets/liquidation.
    prisma.asset.count({
      where: { ...warehouseFilter, status: "RETIRED", liquidatedAt: null },
    }),
    prisma.asset.count({
      where: { ...warehouseFilter, status: "RETIRED", liquidatedAt: { not: null } },
    }),
    // Số Adapter/Cáp sạc CÒN TỒN TRONG KHO — đếm qua AssetAccessory (phụ
    // kiện gắn theo từng thiết bị), chỉ tính phụ kiện của thiết bị đang
    // IN_STOCK (chưa cấp phát cho ai). Lọc kho/khu vực qua quan hệ "asset"
    // (AssetAccessory không có warehouseId riêng). Cộng dồn "quantity" thay
    // vì đếm số dòng — dù thực tế hiện tại luôn tạo quantity=1/dòng (xem
    // setAssetAccessories), sum vẫn đúng nếu sau này có dòng quantity > 1.
    prisma.assetAccessory.aggregate({
      _sum: { quantity: true },
      where: { name: "Adapter", asset: { status: "IN_STOCK", ...warehouseFilter } },
    }),
    prisma.assetAccessory.aggregate({
      _sum: { quantity: true },
      where: { name: "Cáp sạc", asset: { status: "IN_STOCK", ...warehouseFilter } },
    }),
    // Thẻ "Điện thoại"/"Laptop" đếm theo Loại thiết bị (AssetCategory gán
    // trên Model) — khác với thẻ "iPhone"/"MacBook..." bên trên vốn chỉ khớp
    // theo TỪ KHOÁ trong tên model (chỉ ra đúng hàng Apple). 2 thẻ mới này
    // cần gộp MỌI hãng (Samsung, Xiaomi, Dell, HP, Lenovo...) nên phải đếm
    // qua quan hệ category thay vì so khớp tên.
    prisma.asset.count({
      where: {
        ...warehouseFilter,
        status: "IN_STOCK",
        model: { category: { name: "Điện thoại" } },
      },
    }),
    prisma.asset.count({
      where: {
        ...warehouseFilter,
        status: "IN_STOCK",
        model: { category: { name: "Laptop" } },
      },
    }),
    prisma.assetCategory.findMany({
      where: { name: { in: ["Điện thoại", "Laptop"] } },
      select: { id: true, name: true },
    }),
  ]);

  const adapterInStockCount = adapterInStock._sum.quantity ?? 0;
  const cableInStockCount = cableInStock._sum.quantity ?? 0;
  const phoneCategoryId =
    categoryLookup.find((category) => category.name === "Điện thoại")?.id ?? null;
  const laptopCategoryId =
    categoryLookup.find((category) => category.name === "Laptop")?.id ?? null;

  const selectedWarehouse = selectedWarehouseId
    ? (allRegions.flatMap((r) => r.warehouses).find((w) => w.id === selectedWarehouseId) ??
      unassignedWarehouses.find((w) => w.id === selectedWarehouseId))
    : null;

  // Chuỗi hiển thị phụ đề Dashboard: ưu tiên kho cụ thể > khu vực vừa chọn
  // tay > khu vực mặc định của tài khoản bị giới hạn (chưa chọn gì).
  const scopeLabel = selectedWarehouse
    ? `${selectedWarehouse.code} - ${selectedWarehouse.name}`
    : selectedRegion
      ? `Khu vực ${selectedRegion.name}`
      : isScoped && currentUser.warehouse
        ? `${currentUser.warehouse.code} - ${currentUser.warehouse.name}`
        : isScoped && currentUser.region
          ? `Khu vực ${currentUser.region.name}`
          : "";

  // Trước đây liệt kê TẤT CẢ các kho (17+ kho hiện tại), mỗi kho 1 màu sinh
  // tự động — với nhiều kho như vậy, nhiều kho vô tình ra màu rất giống
  // nhau (VD nhiều kho cùng ra sắc xanh lá, nhiều kho cùng ra sắc tím) nên
  // biểu đồ tròn/chú thích không phân biệt nổi kho nào với kho nào, dù số
  // liệu vẫn đúng — đây chính là lỗi màu user báo. Mắt người chỉ phân biệt
  // tốt tối đa khoảng 7-8 màu cạnh nhau; nhiều hơn thì bắt buộc phải gộp
  // bớt, không phải sinh thêm màu. Nên chỉ hiển thị riêng 7 kho có số
  // lượng tài sản lớn nhất (đủ để nhìn ra bức tranh chính), các kho còn lại
  // (thường chiếm % rất nhỏ — xem ảnh user gửi: nhiều kho chỉ 0-1%) gộp
  // chung vào 1 mục "Khác" màu xám trung tính — vừa dễ phân biệt, vừa
  // không làm loãng thông tin bằng hàng chục dòng gần như 0%.
  const WAREHOUSE_CHART_TOP_N = 7;
  const sortedWarehouseCounts = warehouses
    .filter((warehouse) => warehouse._count.assets > 0)
    .map((warehouse) => ({
      name: `${warehouse.code} - ${warehouse.name}`,
      count: warehouse._count.assets,
    }))
    .sort((a, b) => b.count - a.count);
  const topWarehouseCounts = sortedWarehouseCounts.slice(0, WAREHOUSE_CHART_TOP_N);
  const otherWarehouseCount = sortedWarehouseCounts
    .slice(WAREHOUSE_CHART_TOP_N)
    .reduce((sum, warehouse) => sum + warehouse.count, 0);
  const warehouseData =
    otherWarehouseCount > 0
      ? [...topWarehouseCounts, { name: "Khác", count: otherWarehouseCount, isOther: true }]
      : topWarehouseCounts;

  const stockPercent = totalAssets ? Math.round((inStockAssets / totalAssets) * 100) : 0;
  const repairPercent = totalAssets ? Math.round((repairAssets / totalAssets) * 100) : 0;

  // Giữ nguyên phạm vi kho/khu vực đang xem trên Dashboard khi bấm vào các
  // thẻ thống kê để nhảy sang trang Tài sản — không thì bấm vào từ Dashboard
  // đang lọc theo 1 kho cụ thể lại ra danh sách KHÔNG lọc kho, gây hiểu nhầm
  // số liệu không khớp nhau.
  const scopeQuery = selectedWarehouseId
    ? `warehouseId=${selectedWarehouseId}`
    : selectedRegion
      ? `regionId=${selectedRegion.id}`
      : "";

  function assetsLink(params: {
    status?: string;
    q?: string;
    adapter?: string;
    cable?: string;
    categoryId?: number | null;
  }) {
    const parts = [
      params.status ? `status=${params.status}` : "",
      params.q ? `q=${encodeURIComponent(params.q)}` : "",
      params.adapter ? `adapter=${params.adapter}` : "",
      params.cable ? `cable=${params.cable}` : "",
      params.categoryId ? `categoryId=${params.categoryId}` : "",
      scopeQuery,
    ].filter(Boolean);

    return `/assets${parts.length > 0 ? `?${parts.join("&")}` : ""}`;
  }

  return (
    <AppLayout hideTopbar>
      {/* Hero */}
      <div className="mb-5 flex items-center gap-5 rounded-3xl bg-gradient-to-br from-[#dceafd] via-[#eaf3ff] to-[#f7fbff] p-8">
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh
            trong public/, không cần qua pipeline tối ưu ảnh của Next (đỡ
            phụ thuộc "sharp" lúc chạy trong Docker image). */}
        <img
          src="/mascot-chicken-lg.png"
          alt="ITAMS mascot"
          width={150}
          height={150}
          className="hidden shrink-0 object-contain sm:block"
        />

        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold text-slate-900">
            Xin chào, {currentUser.fullName}! 👋
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Tổng quan hệ thống IT Asset Management
            {scopeLabel ? ` — ${scopeLabel}` : ""}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {(!isScoped || allRegions.some((r) => r.warehouses.length > 1)) && (
            <WarehouseFilterSelect
              regions={allRegions}
              unassignedWarehouses={unassignedWarehouses}
              selectedWarehouseId={selectedWarehouseId}
              selectedRegionId={selectedRegion?.id ?? null}
            />
          )}

          <NotificationBell />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-6 gap-4">
        <DashboardCard
          icon={<Monitor size={20} />}
          label="Tổng tài sản tồn kho"
          value={inStockAssets}
          color="blue"
          href={assetsLink({ status: "IN_STOCK" })}
        />

        {STOCK_GROUPS.map((group, index) => (
          <DashboardCard
            key={group.key}
            icon={group.icon}
            label={group.label}
            value={stockCounts[index]}
            color={group.color}
            href={assetsLink({
              status: "IN_STOCK",
              q: group.keywordGroups[0].join(" "),
            })}
          />
        ))}

        <DashboardCard
          icon={<UserRound size={20} />}
          label="Đã cấp phát"
          value={assignedAssets}
          color="teal"
          href={assetsLink({ status: "ASSIGNED" })}
        />

        <DashboardCard
          icon={<Plug size={20} />}
          label="Adapter"
          value={adapterInStockCount}
          color="orange"
          href={assetsLink({ status: "IN_STOCK", adapter: "yes" })}
        />

        <DashboardCard
          icon={<Cable size={20} />}
          label="Cáp sạc"
          value={cableInStockCount}
          color="orange"
          href={assetsLink({ status: "IN_STOCK", cable: "yes" })}
        />

        <DashboardCard
          icon={<Smartphone size={20} />}
          label="Điện thoại"
          value={phoneInStockCount}
          color="cyan"
          href={assetsLink({ status: "IN_STOCK", categoryId: phoneCategoryId })}
        />

        <DashboardCard
          icon={<Laptop size={20} />}
          label="Laptop"
          value={laptopInStockCount}
          color="fuchsia"
          href={assetsLink({ status: "IN_STOCK", categoryId: laptopCategoryId })}
        />
      </div>

      {/* items-stretch (thay vì items-start trước đây) — 2 khung luôn cao
          bằng nhau, khớp với khung nào đang cao hơn (thường là "Phân bổ
          theo kho" bên phải khi có nhiều kho). Khung trái dùng flex-col +
          bảng nằm trong 1 vùng flex-1 overflow-y-auto riêng, để phần thừa
          chiều cao được LẤP ĐẦY bởi chính khung border/nền trắng thay vì để
          trống, và nếu dữ liệu bên trái (10 dòng) vẫn dài hơn khung phải thì
          tự cuộn riêng bên trong, không đẩy khung phải cao theo. */}
      <div className="mb-5 grid grid-cols-3 items-stretch gap-4">
        <div className="col-span-2 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Calendar size={16} />
              </div>
              <h3 className="text-sm font-bold">Thiết bị mới nhập gần đây</h3>
            </div>

            <Link
              href="/assets"
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Xem tất cả
            </Link>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="p-3 text-left">Asset Tag</th>
                <th className="p-3 text-left">Serial</th>
                <th className="p-3 text-left">Thiết bị</th>
                <th className="p-3 text-left">Người dùng</th>
                <th className="p-3 text-left">Kho</th>
                <th className="p-3 text-left">Ngày nhập</th>
              </tr>
            </thead>

            <tbody>
              {latestAssets.map((asset) => (
                <tr key={asset.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-semibold">{asset.assetTag}</td>
                  <td
                    className="p-3 text-slate-600"
                    title={asset.serialNumber ?? undefined}
                  >
                    {truncateSerial(asset.serialNumber)}
                  </td>
                  <td className="p-3">{asset.model.brand} {asset.model.modelName}</td>
                  <td className="p-3">
                    {asset.status === "ASSIGNED" ? (asset.currentEmployee?.fullName ?? "-") : "-"}
                  </td>
                  <td className="p-3">
                    <span className="inline-flex whitespace-nowrap rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
                      {asset.warehouse
                        ? `${asset.warehouse.code} - ${asset.warehouse.name}`
                        : "-"}
                    </span>
                  </td>
                  <td className="p-3 text-slate-500">
                    <LocalDateTime value={asset.createdAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <WarehouseChart total={totalAssets} data={warehouseData} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <AlertProgressCard
          href="/employees"
          icon={<Users size={18} />}
          label="Số lượng nhân viên"
          value={employeeCount}
          unit="nhân viên"
          color="indigo"
        />

        {/* Trỏ sang /assets/warranty (trang theo dõi sửa chữa/bảo hành riêng,
            có thêm lý do gửi + người gửi + ngày gửi) thay vì danh sách lọc
            chung — cùng 1 con số (đếm theo status REPAIR) nên không cần giữ
            thêm thẻ liệt kê riêng nữa. */}
        <AlertProgressCard
          href="/assets/warranty"
          icon={<Wrench size={18} />}
          label="Đang sửa chữa/bảo hành"
          value={repairAssets}
          percent={repairPercent}
          color="amber"
        />

        <AlertProgressCard
          href={assetsLink({ status: "IN_STOCK" })}
          icon={<PackageSearch size={18} />}
          label="Chưa được cấp phát"
          value={inStockAssets}
          percent={stockPercent}
          color="blue"
        />

        {/* Gộp chung 1 khung cho cả 2 trạng thái thanh lý (Chờ/Đã) — trỏ
            sang /assets/liquidation (trang Kho thanh lý, có 2 tab riêng)
            thay vì tách 2 thẻ AlertProgressCard cho gọn không gian. */}
        <LiquidationCard
          href={`/assets/liquidation${scopeQuery ? `?${scopeQuery}` : ""}`}
          pendingCount={pendingLiquidationCount}
          doneCount={doneLiquidationCount}
        />
      </div>
    </AppLayout>
  );
}

function DashboardCard({ icon, label, value, color, href }: any) {
  const theme: any = {
    blue: "bg-blue-50 text-blue-600",
    sky: "bg-sky-50 text-sky-600",
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    violet: "bg-violet-50 text-violet-600",
    amber: "bg-amber-50 text-amber-600",
    orange: "bg-orange-50 text-orange-600",
    rose: "bg-rose-50 text-rose-600",
    teal: "bg-teal-50 text-teal-600",
    cyan: "bg-cyan-50 text-cyan-600",
    fuchsia: "bg-fuchsia-50 text-fuchsia-600",
  };

  const content = (
    <>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${theme[color]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold text-slate-900">{value}</div>
        <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">{label}</p>
      </div>
    </>
  );

  const className =
    "flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

function SectionHeader({ icon, title }: any) {
  return (
    <div className="flex items-center gap-2.5 border-b border-slate-100 p-4">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        {icon}
      </div>
      <h3 className="text-sm font-bold">{title}</h3>
    </div>
  );
}

// Trước đây sinh màu theo "golden angle" (137.508°) để tránh trùng màu như
// mảng cố định 5 màu cũ — nhưng với 11+ kho, khoảng cách hue theo công thức
// này vẫn khiến nhiều kho rơi vào CÙNG một "vùng màu" mà mắt người gọi tên
// giống nhau (VD hue 137.5°, 105°, 157.5°, 125° đều đọc là "xanh lá" dù số
// hue khác nhau) — vẫn là lỗi trùng màu, chỉ tinh vi hơn, đúng như bug user
// chụp màn hình báo lại. Mắt người phân biệt tốt tối đa khoảng 7-8 màu cạnh
// nhau (không phải sinh vô hạn màu); nên chuyển sang 1 bảng màu CỐ ĐỊNH, đã
// được kiểm chứng để nhìn tách bạch kể cả với người mù màu (CVD) — mỗi kho
// trong top 7 nhận đúng 1 màu theo thứ tự cố định, và "Khác" (các kho nhỏ
// gộp lại — xem warehouseData ở trên) luôn là màu xám trung tính, không
// trùng với màu của bất kỳ kho thật nào.
const WAREHOUSE_CHART_COLORS = [
  "#2a78d6", // 1 xanh dương
  "#eb6834", // 2 cam
  "#1baf7a", // 3 xanh ngọc
  "#eda100", // 4 vàng
  "#e87ba4", // 5 hồng cánh sen
  "#008300", // 6 xanh lá
  "#4a3aa7", // 7 tím
];
const WAREHOUSE_CHART_OTHER_COLOR = "#898781"; // xám trung tính, dành riêng cho "Khác"

function colorForIndex(index: number, isOther?: boolean): string {
  if (isOther) return WAREHOUSE_CHART_OTHER_COLOR;
  return WAREHOUSE_CHART_COLORS[index % WAREHOUSE_CHART_COLORS.length];
}

function WarehouseChart({ total, data }: any) {
  let start = 0;

  const gradient = data.length
    ? data
        .map((item: any, index: number) => {
          const percent = total ? (item.count / total) * 100 : 0;
          const part = `${colorForIndex(index, item.isOther)} ${start}% ${start + percent}%`;
          start += percent;
          return part;
        })
        .join(", ")
    : "#e5e7eb 0% 100%";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-sm font-bold">Phân bổ theo kho</h3>

      <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white shadow-inner">
          <div className="text-lg font-extrabold">{total}</div>
          <div className="text-[10px] text-slate-500">Tài sản</div>
        </div>
      </div>

      {/* Trước đây giới hạn max-h-[260px] + overflow-y-auto để khung này
          không cao hơn khung "Thiết bị mới nhập gần đây" bên trái — nhưng
          user muốn xem đủ toàn bộ danh sách kho cùng lúc, không phải cuộn.
          Bỏ giới hạn chiều cao: hiện đủ hết các dòng. Khung trái đã tự
          items-stretch theo khung phải (xem grid cha) nên 2 khung vẫn luôn
          cao bằng nhau — chỉ là giờ "bằng nhau" theo chiều cao thật của
          danh sách kho, không còn cắt bớt kho nào. */}
      <div className="mt-4 space-y-2">
        {data.map((item: any, index: number) => {
          const percent = total ? Math.round((item.count / total) * 100) : 0;

          return (
            <div
              key={`${item.name}-${index}`}
              className="flex items-center justify-between gap-2 text-xs"
            >
              {/* min-w-0 BẮT BUỘC ở đây — mặc định flex item không tự co nhỏ
                  hơn nội dung của nó (min-width: auto), nên tên kho dài (VD
                  "SUBIC - Phil - Subic", "BK - Thai - Bangkok") sẽ đẩy tràn
                  ngang ra khỏi khung thay vì rút gọn lại, dù khung có
                  overflow-y-auto (chỉ xử lý tràn dọc, không xử lý tràn
                  ngang). truncate + title để vẫn xem được tên đầy đủ khi
                  hover, không phụ thuộc sau này có thêm bao nhiêu kho hoặc
                  tên kho dài cỡ nào. */}
              <div
                className="flex min-w-0 items-center gap-2 text-slate-600"
                title={item.name}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorForIndex(index, item.isOther) }} />
                <span className="truncate">{item.name}</span>
              </div>
              <div className="shrink-0 font-bold text-slate-700">
                {item.count} <span className="font-normal text-slate-400">({percent}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AlertProgressCard({
  href,
  icon,
  label,
  value,
  percent,
  color,
  unit = "thiết bị",
}: any) {
  const theme: any = {
    rose: { bg: "bg-rose-50", text: "text-rose-600", bar: "bg-rose-500" },
    amber: { bg: "bg-amber-50", text: "text-amber-600", bar: "bg-amber-500" },
    blue: { bg: "bg-blue-50", text: "text-blue-600", bar: "bg-blue-500" },
    red: { bg: "bg-red-50", text: "text-red-600", bar: "bg-red-500" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600", bar: "bg-indigo-500" },
  };

  const t = theme[color];

  return (
    <Link
      href={href}
      className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${t.bg} ${t.text}`}>
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className="text-lg font-bold text-slate-900">
            {value} <span className="text-xs font-medium text-slate-400">{unit}</span>
          </p>
        </div>
      </div>

      {percent !== undefined && (
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-slate-100">
            <div
              className={`h-1.5 rounded-full ${t.bar}`}
              style={{ width: `${Math.min(percent, 100)}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-400">{percent}%</span>
        </div>
      )}
    </Link>
  );
}

// Gộp chung 2 con số (Chờ/Đã thanh lý) vào 1 khung — khác AlertProgressCard
// (chỉ hiện được đúng 1 giá trị + thanh %) vì thẻ này cần hiện song song 2
// trạng thái thuộc cùng 1 nhóm (xem thêm ghi chú ở page.tsx: liquidatedAt
// tách "Chờ" vs "Đã" trong cùng status RETIRED).
function LiquidationCard({
  href,
  pendingCount,
  doneCount,
}: {
  href: string;
  pendingCount: number;
  doneCount: number;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Trash2 size={18} />
        </div>

        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-500">Kho thanh lý</p>
          <p className="text-lg font-bold text-slate-900">
            {pendingCount} <span className="text-xs font-medium text-slate-400">chờ</span>
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
        <span className="font-semibold text-amber-600">{pendingCount} chờ thanh lý</span>
        <span className="font-semibold text-slate-500">{doneCount} đã thanh lý</span>
      </div>
    </Link>
  );
}