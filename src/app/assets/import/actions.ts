"use server";

import { prisma } from "@/lib/prisma";
import { generateUniqueAssetTag } from "@/modules/asset/asset-tag";
import { requireRole } from "@/modules/auth/auth.service";
import { createAuditLog } from "@/modules/audit/audit-log.service";
import { AssetStatus, HistoryAction, StockInType } from "@prisma/client";
import { redirect } from "next/navigation";
import ExcelJS from "exceljs";

// Trước đây dùng package "xlsx" (SheetJS) — bản trên npm (0.18.5) dính 2 lỗ
// hổng đã công bố (Prototype Pollution GHSA-4r6h-8v6p-xvw6, ReDoS
// GHSA-5pgg-2g8v-p4x9) mà SheetJS chỉ vá trên CDN riêng của họ, không publish
// bản vá lên npm. Đổi sang "exceljs" — được bảo trì tích cực trên npm, không
// dính các lỗ hổng trên.

// Cell value của exceljs có thể là string/number/Date/null, hoặc object cho
// rich text / hyperlink / kết quả công thức — cần bóc ra giá trị thật trước
// khi dùng, khác với xlsx trả thẳng giá trị nguyên thuỷ.
function unwrapCell(value: ExcelJS.CellValue): unknown {
  if (value && typeof value === "object") {
    if ("richText" in value) {
      return (value.richText as { text: string }[])
        .map((part) => part.text)
        .join("");
    }

    if ("result" in value) {
      return (value as { result: unknown }).result;
    }

    if ("text" in value) {
      return (value as { text: unknown }).text;
    }
  }

  return value;
}

function cellAt(row: ExcelJS.Row, colLetter: string) {
  return unwrapCell(row.getCell(colLetter).value);
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

// So khớp tiêu đề cột không phân biệt hoa/thường, dấu tiếng Việt — người
// nhập file mẫu có thể gõ "Mã Thiết Bị" hoặc "MÃ THIẾT BỊ"/"Ma thiet bi",
// chỉ cần chứa đúng từ khoá gốc là coi như khớp, không cần trùng tuyệt đối.
function normalizeHeaderText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Kiểm tra file Excel có đúng cấu trúc mẫu chuẩn (DXB template) không —
// TRƯỚC ĐÂY hoàn toàn không có bước này: code đọc cứng theo VỊ TRÍ cột (B,
// C, D, J, M, W, Z, AB, AG...), không xác minh tiêu đề thực tế của file có
// khớp không. Nếu ai đó lỡ upload nhầm 1 file khác cấu trúc (VD: cột bị dịch
// chuyển do sửa file gốc, hoặc hoàn toàn không phải file này) mà tình cờ vẫn
// có dữ liệu ở đúng những vị trí cột đó, hệ thống sẽ ÂM THẦM đọc sai dữ liệu
// vào sai trường (VD: đọc nhầm cột Serial thành Asset Tag) mà không báo lỗi
// gì — vì với logic cũ, dữ liệu vẫn "đủ", không bị coi là thiếu. Giờ chặn
// sớm ngay từ đầu nếu tiêu đề cột không khớp mẫu, thay vì để lọt xuống tạo
// dữ liệu rác không ai biết.
const EXPECTED_HEADERS: { col: string; keyword: string; label: string }[] = [
  { col: "B", keyword: "ma thiet bi", label: "Danh mục thiết bị — Mã Thiết Bị (cột B)" },
  { col: "C", keyword: "ten thiet bi", label: "Danh mục thiết bị — Tên Thiết Bị (cột C)" },
  { col: "D", keyword: "thong so", label: "Danh mục thiết bị — Thông Số Thiết Bị (cột D)" },
  { col: "J", keyword: "ma thiet bi", label: "Nhập kho — Mã Thiết Bị (cột J)" },
  { col: "M", keyword: "serial", label: "Nhập kho — Serial Number (cột M)" },
  { col: "W", keyword: "kho", label: "Nhập kho — Kho (cột W)" },
  { col: "Z", keyword: "ma thiet bi", label: "Xuất kho — Mã Thiết Bị (cột Z)" },
  { col: "AB", keyword: "serial", label: "Xuất kho — Serial Number (cột AB)" },
  { col: "AG", keyword: "nhan vien", label: "Xuất kho — Nhân Viên (cột AG)" },
];

function validateTemplateHeaders(worksheet: ExcelJS.Worksheet): string[] {
  // Header nằm ở row 2 theo file mẫu chuẩn (sub-header Adapter/Cáp sạc ở
  // row 3, data từ row 4) — xem ghi chú đầy đủ ở runImport().
  const headerRow = worksheet.getRow(2);
  const mismatches: string[] = [];

  for (const check of EXPECTED_HEADERS) {
    const actual = normalizeHeaderText(cellAt(headerRow, check.col));

    if (!actual.includes(check.keyword)) {
      mismatches.push(
        `${check.label}: cần chứa "${check.keyword}", nhưng đọc được "${actual || "(trống)"}"`
      );
    }
  }

  return mismatches;
}

// Chặn ngày phi lý lọt vào DB — từng gặp thực tế: vài dòng trong file Excel
// nhập kho ("Fill Kho Lào.xlsx") có cột ngày bị đọc/nhập sai, ra ngày nằm ở
// TƯƠNG LAI (VD: 07/11/2026 dù hôm import là 19/07/2026). Ngày tương lai này
// từng bị ghi thẳng vào AssetHistory.createdAt — hậu quả là chuông thông báo
// KHÔNG BAO GIỜ đánh dấu đọc hết được (badge tính theo createdAt > lần đọc
// cuối, mà ngày tương lai thì luôn lớn hơn "lần đọc cuối" dù đọc lúc nào đi
// nữa). Coi bất kỳ ngày nào SAU HÔM NAY (quá 1 ngày, chừa biên cho lệch múi
// giờ nhẹ) là không hợp lệ — trả null để nơi gọi tự fallback về new Date().
const MAX_FUTURE_SLACK_MS = 24 * 60 * 60 * 1000;

function excelDate(value: unknown) {
  if (!value) return null;

  let parsed: Date | null = null;

  if (value instanceof Date) {
    parsed = value;
  } else if (typeof value === "number") {
    const utcDays = Math.floor(value - 25569);
    const utcValue = utcDays * 86400;
    parsed = new Date(utcValue * 1000);
  } else {
    const d = new Date(value as string);
    parsed = isNaN(d.getTime()) ? null : d;
  }

  if (!parsed || isNaN(parsed.getTime())) return null;

  if (parsed.getTime() > Date.now() + MAX_FUTURE_SLACK_MS) {
    console.warn("EXCEL_DATE_REJECTED_FUTURE:", { raw: value, parsed });
    return null;
  }

  return parsed;
}

function inferBrand(category: string, modelName: string) {
  const value = `${category} ${modelName}`.toLowerCase();

  if (value.includes("iphone")) return "Apple";
  if (value.includes("ipad")) return "Apple";
  if (value.includes("macbook")) return "Apple";
  if (value.includes("display")) return "Apple";
  if (value.includes("yubikey")) return "Yubico";

  return category || "Unknown";
}

// Cột "Tên Thiết Bị" trong file gốc chỉ là nhóm thô (Iphone/Mac Air/Mac
// Pro/Display/Yubikey...), không khớp tên chuẩn category đang dùng trong hệ
// thống (MasterOption: "iPhone", "MacBook", "Màn hình", "YubiKey"...). Chuẩn
// hoá lại để không sinh ra category trùng lặp/lệch chính tả.
function normalizeCategory(raw: string) {
  const value = raw.trim().toLowerCase();

  if (value === "iphone") return "iPhone";
  if (value === "mac air" || value === "mac pro") return "Laptop";
  if (value === "display") return "Màn hình";
  if (value === "yubikey") return "YubiKey";

  return raw || "Unknown";
}

// Best-effort tách CPU/RAM/Storage/Screen từ chuỗi tên đầy đủ, ví dụ:
// "MacBook Pro M4 Max 16inch 36GB/1TB" -> cpu "Apple M4 Max", screen
// "16 inch", ram "36GB", storage "1TB". Thiết bị không có specs kiểu này
// (Yubikey, Display...) sẽ trả về object rỗng — không sao, các field default
// trên AssetModel vốn optional.
function parseSpecs(modelName: string) {
  const specs: {
    cpu?: string;
    ram?: string;
    storage?: string;
    screen?: string;
  } = {};

  const appleChip = modelName.match(/\bM(\d)\s*(Pro|Max|Ultra)?\b/i);

  if (appleChip) {
    specs.cpu = `Apple M${appleChip[1]}${appleChip[2] ? ` ${appleChip[2]}` : ""}`;
  } else {
    const intelChip = modelName.match(/Intel\s+i(\d)/i);

    if (intelChip) {
      specs.cpu = `Intel Core i${intelChip[1]}`;
    }
  }

  const screen = modelName.match(/(\d+(?:\.\d+)?)\s*inch/i);

  if (screen) {
    specs.screen = `${screen[1]} inch`;
  }

  const ramStorageCombo = modelName.match(/(\d+GB)\/(\d+(?:GB|TB))/i);

  if (ramStorageCombo) {
    specs.ram = ramStorageCombo[1];
    specs.storage = ramStorageCombo[2];
  } else {
    const storageOnly = modelName.match(/(\d+(?:GB|TB))\s*$/i);

    if (storageOnly) {
      specs.storage = storageOnly[1];
    }
  }

  return specs;
}

function toBool(value: unknown) {
  if (typeof value === "boolean") return value;

  const normalized = String(value ?? "").trim().toLowerCase();

  return normalized === "true" || normalized === "1" || normalized === "x";
}

// Ghi đè lại đúng bộ Adapter/Cáp sạc hiện có của 1 asset — dùng delete rồi
// tạo lại thay vì upsert vì AssetAccessory không có unique key theo
// (assetId, name), tránh sinh trùng khi chạy import nhiều lần.
async function setAssetAccessories(
  assetId: number,
  accessories: { hasAdapter: boolean; hasCable: boolean }
) {
  await prisma.assetAccessory.deleteMany({
    where: { assetId, name: { in: ["Adapter", "Cáp sạc"] } },
  });

  const toCreate: { assetId: number; name: string; quantity: number }[] = [];

  if (accessories.hasAdapter) {
    toCreate.push({ assetId, name: "Adapter", quantity: 1 });
  }

  if (accessories.hasCable) {
    toCreate.push({ assetId, name: "Cáp sạc", quantity: 1 });
  }

  if (toCreate.length > 0) {
    await prisma.assetAccessory.createMany({ data: toCreate });
  }
}

function mapStatus(status: string) {
  const value = status.toLowerCase();

  if (value.includes("giao")) return AssetStatus.ASSIGNED;
  if (value.includes("kho")) return AssetStatus.IN_STOCK;
  if (value.includes("hỏng") || value.includes("hong")) return AssetStatus.REPAIR;
  if (value.includes("mất") || value.includes("mat")) return AssetStatus.LOST;

  return AssetStatus.IN_STOCK;
}

function makePendingEmployeeCode(fullName: string) {
  return (
    "PENDING-" +
    fullName
      .toUpperCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}

async function upsertEmployee(name: string, teamName?: string | null) {
  const fullName = text(name);
  if (!fullName) return null;

  const existedByName = await prisma.employee.findFirst({
    where: { fullName },
  });

  if (existedByName) {
    return existedByName;
  }

  let teamId: number | undefined;

  if (teamName) {
    const team = await prisma.team.upsert({
      where: { name: teamName },
      update: {},
      create: { name: teamName },
    });

    teamId = team.id;
  }

  let employeeCode = makePendingEmployeeCode(fullName);

  const existedCode = await prisma.employee.findUnique({
    where: { employeeCode },
  });

  if (existedCode) {
    employeeCode = `${employeeCode}-${Date.now()}`;
  }

  return prisma.employee.create({
    data: {
      employeeCode,
      fullName,
      teamId,
      isActive: true,
    },
  });
}

// Diễn giải lỗi Prisma (mã P20xx) sang tiếng Việt dễ hiểu — mặc định Prisma
// chỉ ném ra thông báo kỹ thuật (VD "Unique constraint failed on the fields:
// (`serialNumber`)") không nói rõ nghĩa là trùng gì, dòng nào trong file.
function translateDbError(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    const code = (error as { code: string }).code;
    const meta = (error as { meta?: { target?: unknown } }).meta;
    const target = Array.isArray(meta?.target) ? meta!.target!.join(", ") : "";

    if (code === "P2002") {
      return `Dữ liệu bị trùng${target ? ` (cột: ${target})` : ""} với 1 bản ghi đã có sẵn trong hệ thống — kiểm tra lại Serial Number/Mã Model/Mã kho ở dòng này có bị trùng với dòng khác trong file hoặc với dữ liệu đã có không.`;
    }

    if (code === "P2003") {
      return `Dữ liệu tham chiếu tới 1 mục không tồn tại${target ? ` (${target})` : ""} — kiểm tra lại Model Code/Mã kho ở dòng này.`;
    }

    if (code === "P2025") {
      return "Không tìm thấy bản ghi liên quan để cập nhật — có thể dữ liệu đã bị xoá ở nơi khác trong lúc import.";
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Lỗi không xác định.";
}

export async function importAssetsAction(formData: FormData) {
  const currentUser = await requireRole(["Admin", "IT"]);

  // Phòng vệ thêm 1 lớp — trang đã chặn hiển thị form khi tính năng bị tắt,
  // nhưng action gọi thẳng (VD form cũ vẫn mở sẵn trong tab khác từ trước
  // lúc Admin tắt) vẫn phải bị chặn ở đây, không chỉ dựa vào UI. Admin luôn
  // dùng được kể cả lúc tắt (chỉ chặn IT) — giống điều kiện ở page.tsx.
  if (currentUser.role.name !== "Admin") {
    const importSettings = await prisma.importSettings.findUnique({ where: { id: 1 } });

    if (importSettings && !importSettings.enabled) {
      redirect(
        `/assets/import?error=${encodeURIComponent("Tính năng Import Excel đang bị Admin tắt.")}`
      );
    }
  }

  const file = formData.get("file") as File;

  if (!file) {
    redirect(
      `/assets/import?error=${encodeURIComponent("Vui lòng chọn file Excel")}`
    );
  }

  // Chặn file quá lớn TRƯỚC KHI đọc vào bộ nhớ (buffer + parse ExcelJS) —
  // trước đây không giới hạn gì, 1 tài khoản Admin/IT (hoặc tài khoản bị lộ
  // mật khẩu) có thể vô tình/cố ý upload file khổng lồ khiến RAM của
  // container tăng vọt lúc parse, ảnh hưởng tới toàn bộ người dùng khác đang
  // dùng chung server. 20MB đã rộng rãi hơn nhiều lần so với file nhập kho
  // thực tế (vài nghìn dòng dữ liệu thô, không phải file đính kèm hình ảnh).
  const MAX_IMPORT_FILE_BYTES = 20 * 1024 * 1024;

  if (file.size > MAX_IMPORT_FILE_BYTES) {
    redirect(
      `/assets/import?error=${encodeURIComponent(
        `File quá lớn (${(file.size / (1024 * 1024)).toFixed(1)}MB) — giới hạn tối đa 20MB. Kiểm tra lại file, có thể bị lỗi khi lưu/export.`
      )}`
    );
  }

  // Theo dõi đang xử lý tới đâu (bước nào, dòng Excel số mấy) — để nếu có
  // lỗi giữa chừng thì báo được chính xác vị trí cần sửa trong file, thay vì
  // chỉ hiện trang lỗi trắng chung chung không biết sửa gì.
  let currentStep = "đọc file Excel";
  let currentRowNum: number | null = null;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      throw new Error("File Excel không có sheet nào.");
    }

    const headerMismatches = validateTemplateHeaders(worksheet);

    if (headerMismatches.length > 0) {
      throw new Error(
        `File không đúng cấu trúc mẫu chuẩn (tiêu đề cột không khớp) — kiểm tra lại đã dùng đúng file mẫu Import Excel chưa:\n${headerMismatches.join("\n")}`
      );
    }

    const { skipped, createdCount, updatedCount } = await runImport(
      worksheet,
      currentUser.fullName,
      {
        // IT chỉ được import vào kho thuộc phạm vi của mình, và không được tự
        // tạo kho mới (tạo kho là quyền Admin ở Cài đặt > Kho).
        regionWarehouseIds: currentUser.regionWarehouseIds,
        canCreateWarehouse: currentUser.role.name === "Admin",
      },
      (step, rowNum) => {
        currentStep = step;
        currentRowNum = rowNum;
      }
    );

    // Tóm tắt kết quả — kế toán/FC/Admin xem lại được NGAY sau khi import
    // (không cần hỏi IT "vừa import có gì thay đổi không") thay vì trước đây
    // import thành công thì lặng lẽ redirect thẳng về /assets, không hiện gì.
    // Chi tiết từng thiết bị (asset nào, trường nào đổi, đổi lúc nào, ai làm)
    // xem ở trang "Lịch sử thay đổi" (/activity) — mọi role đăng nhập đều xem
    // được, không riêng Admin.
    const summary = `Đã tạo mới ${createdCount} thiết bị, cập nhật ${updatedCount} thiết bị đã có trong hệ thống.`;

    if (skipped.length > 0) {
      // Giới hạn số dòng VÀ tổng độ dài hiển thị trong URL (query string có
      // trần độ dài) — trước đây chỉ giới hạn 20 dòng, nhưng câu tiếng Việt
      // có dấu khi encodeURIComponent() phình to gấp 2-3 lần (mỗi ký tự có
      // dấu = 2-3 byte UTF-8, mỗi byte thành 1 chuỗi "%XX" 3 ký tự) — 20 dòng
      // lý do dài (VD thiếu nhiều cột 1 lúc) từng vượt quá header buffer mặc
      // định của Nginx, khiến redirect bị lỗi "upstream sent too big header"
      // (mất hẳn kết quả import, KHÔNG chỉ là chậm). Giờ giới hạn chặt hơn ở
      // CẢ số dòng lẫn tổng ký tự để chắc chắn nằm dưới ngưỡng an toàn.
      const MAX_SHOWN = 8;
      const MAX_WARNING_CHARS = 600;

      const lines = skipped
        .slice(0, MAX_SHOWN)
        .map((s) => `Dòng ${s.rowNum}: ${s.reason}`);

      if (skipped.length > MAX_SHOWN) {
        lines.push(`... và ${skipped.length - MAX_SHOWN} dòng khác bị bỏ qua.`);
      }

      let warning = `${summary}\n\n${lines.join("\n")}`;

      if (warning.length > MAX_WARNING_CHARS) {
        warning = `${warning.slice(0, MAX_WARNING_CHARS)}... (đã rút gọn — tổng cộng ${skipped.length} dòng bị bỏ qua)`;
      }

      redirect(`/assets/import?warning=${encodeURIComponent(warning)}`);
    }

    redirect(`/assets/import?success=${encodeURIComponent(summary)}`);
  } catch (error) {
    // redirect() của Next.js tự ném 1 lỗi nội bộ (NEXT_REDIRECT) để thực hiện
    // điều hướng — nếu vô tình lọt vào đây (khi hàm bên trong đã tự gọi
    // redirect ở nơi khác) thì phải ném lại nguyên vẹn, không được nuốt mất.
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string" &&
      (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }

    console.error("IMPORT_EXCEL_ERROR:", error);

    const location = currentRowNum
      ? `Dòng ${currentRowNum} trong file (phần ${currentStep})`
      : `Phần ${currentStep}`;

    const message = `${location}: ${translateDbError(error)}`;

    redirect(`/assets/import?error=${encodeURIComponent(message)}`);
  }
}

async function runImport(
  worksheet: ExcelJS.Worksheet,
  importedByName: string,
  scope: { regionWarehouseIds: number[] | null; canCreateWarehouse: boolean },
  onProgress: (step: string, rowNum: number | null) => void
) {
  // Trước đây các dòng thiếu cột bắt buộc bị "continue" (bỏ qua) hoàn toàn
  // âm thầm — import vẫn báo thành công dù có dòng bị bỏ sót, không ai biết
  // để sửa lại file. Giờ ghi lại từng dòng bị bỏ qua kèm lý do, trả về cho
  // importAssetsAction() hiển thị thành cảnh báo rõ ràng sau khi import xong.
  const skipped: { rowNum: number; reason: string }[] = [];
  // Asset Tag đã cấp trong lần import này (tránh trùng trong cùng lô).
  const usedTags = new Set<string>();

  // Đếm để tóm tắt kết quả cho người import xem ngay (và ghi vào AuditLog) —
  // "updatedAssetIds" dùng Set vì 1 asset có thể bị chạm tới ở CẢ 2 khối
  // (Nhập kho lẫn Xuất kho) trong cùng 1 lần chạy, chỉ tính 1 lần.
  let createdCount = 0;
  const updatedAssetIds = new Set<number>();
  // Cache tên model CŨ theo id — chỉ query khi thực sự cần (model bị đổi),
  // tránh query thêm cho từng dòng không đổi gì.
  const modelNameById = new Map<number, string>();
  async function getOldModelName(modelId: number) {
    const cached = modelNameById.get(modelId);
    if (cached) return cached;

    const found = await prisma.assetModel.findUnique({
      where: { id: modelId },
      select: { modelName: true },
    });

    const name = found?.modelName ?? `#${modelId}`;
    modelNameById.set(modelId, name);
    return name;
  }

  // Cache tên nhân viên theo id — dùng để hiện tên NGƯỜI ĐANG GIỮ HIỆN TẠI
  // trong cảnh báo "gán nhầm người" ở khối Xuất kho bên dưới.
  const employeeNameById = new Map<number, string>();
  async function getEmployeeName(employeeId: number) {
    const cached = employeeNameById.get(employeeId);
    if (cached) return cached;

    const found = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { fullName: true },
    });

    const name = found?.fullName ?? `#${employeeId}`;
    employeeNameById.set(employeeId, name);
    return name;
  }
  // exceljs đánh số dòng từ 1 (giống Excel thật), không cần mảng rows như
  // xlsx nữa — truy cập trực tiếp qua worksheet.getRow(rowNumber) và đọc
  // ô theo đúng chữ cái cột (vd "B", "AB") thay vì index số 0-based.

  /**
   * File chuẩn mới nhất (bản "final" xuất từ Numbers — đã bỏ cột "Người
   * Giao" ở khối Nhập kho và cột "Người Nhận" ở khối Xuất kho so với bản
   * .xlsx trước đó, các cột sau dịch trái theo). 3 khối cạnh nhau trong 1
   * sheet, header ở row 2 (sub-header Adapter/Cáp sạc ở row 3), data từ row 4:
   *
   * DANH MỤC THIẾT BỊ: B Mã Thiết Bị | C Tên Thiết Bị (nhóm thô) | D Thông Số
   * Thiết Bị (tên model đầy đủ, dùng làm modelName thật)
   *
   * NHẬP KHO: J Mã Thiết Bị | K Tên Thiết bị | M Serial Number | N Adapter
   * (bool) | O Cáp sạc (bool) | P Trạng Thái | Q Tình Trạng | R Ngày Nhập | S
   * Người Nhập (nhân viên IT xử lý) | T Nhân Viên (người BỊ THU HỒI thiết bị
   * — nguồn cũ, KHÔNG phải người đang giữ hiện tại) | U Nguồn (Thu Hồi/Mua
   * Mới) | V Team | W Kho
   *
   * XUẤT KHO: Z Mã Thiết Bị | AA Tổng Xuất | AB Serial Number | AC Adapter
   * (bool) | AD Cáp sạc (bool) | AE Tình Trạng | AF Người Cấp (nhân viên IT
   * xử lý) | AG Nhân Viên (= người đang giữ hiện tại, nguồn sự thật cho
   * currentEmployeeId — chỉ còn 1 cột duy nhất, không còn "Người Nhận" riêng)
   * | AH Team | AI Ngày xuất | AJ Xác Nhận | AK Note
   *
   * Adapter/Cáp sạc ở khối NHẬP luôn là true/true (thiết bị về kho nguyên
   * bộ) — đại diện cho phụ kiện đang nằm trong kho. Khi thiết bị được XUẤT
   * cho nhân viên, Adapter/Cáp sạc ở khối XUẤT mới là sự thật tại thời điểm
   * bàn giao (có thể thiếu 1 trong 2, hoặc cả 2) — nên bước 3 phải GHI ĐÈ lại
   * accessory theo khối XUẤT cho những asset có match, không giữ nguyên giá
   * trị lúc nhập.
   */

  const modelMap = new Map<
    string,
    {
      categoryName: string;
      modelName: string;
      brand: string;
    }
  >();

  // 1. Import Model Library từ phần DANH MỤC THIẾT BỊ (data từ row 4)
  for (let rowNum = 4; rowNum <= worksheet.rowCount; rowNum++) {
    onProgress("Danh mục thiết bị (cột B-D)", rowNum);

    const row = worksheet.getRow(rowNum);

    const modelCode = text(cellAt(row, "B"));
    const rawCategory = text(cellAt(row, "C"));
    const modelName = text(cellAt(row, "D"));

    // Dòng trống hoàn toàn (hết data thật, chỉ còn ô rỗng tới cuối sheet) —
    // không tính là "thiếu dữ liệu", bỏ qua êm, không cần cảnh báo.
    if (!modelCode && !rawCategory && !modelName) continue;

    if (!modelCode || !modelName) {
      const missing = [
        !modelCode && "Mã Thiết Bị (cột B)",
        !modelName && "Thông Số Thiết Bị (cột D)",
      ]
        .filter(Boolean)
        .join(", ");
      skipped.push({
        rowNum,
        reason: `Danh mục thiết bị — thiếu ${missing}`,
      });
      continue;
    }

    const categoryName = normalizeCategory(rawCategory);
    const brand = inferBrand(categoryName, modelName);
    const specs = parseSpecs(modelName);

    modelMap.set(modelCode, {
      categoryName,
      modelName,
      brand,
    });

    const category = await prisma.assetCategory.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    });

    await prisma.assetModel.upsert({
      where: { modelCode },
      update: {
        categoryId: category.id,
        brand,
        modelName,
        defaultCpu: specs.cpu,
        defaultRam: specs.ram,
        defaultStorage: specs.storage,
        defaultScreen: specs.screen,
      },
      create: {
        modelCode,
        categoryId: category.id,
        brand,
        modelName,
        defaultCpu: specs.cpu,
        defaultRam: specs.ram,
        defaultStorage: specs.storage,
        defaultScreen: specs.screen,
      },
    });
  }

  // Trước đây warehouse bị hardcode cứng theo code "DXB" (Dubai) cho MỌI
  // dòng, bỏ qua hẳn cột W "Kho" trong file — nên file có ghi "DXB 2" vẫn bị
  // nhập vào kho "DXB - Dubai". Giờ đọc đúng cột W cho từng dòng, match theo
  // code/tên đã chuẩn hoá (bỏ khoảng trắng, hoa/thường) với các Warehouse có
  // sẵn; nếu không khớp cái nào thì tự tạo kho mới đúng theo tên trong file
  // thay vì âm thầm gộp vào 1 kho mặc định.
  function normalizeWarehouseKey(value: string) {
    return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  const existingWarehouses = await prisma.warehouse.findMany();
  const warehouseByKey = new Map<string, (typeof existingWarehouses)[number]>();
  // Tra cứu tên kho CŨ khi ghi log thay đổi (xem bước 2 bên dưới) — không cần
  // query lại DB, chỉ đọc từ danh sách đã load sẵn ở trên.
  const warehouseById = new Map<number, (typeof existingWarehouses)[number]>(
    existingWarehouses.map((wh) => [wh.id, wh])
  );

  for (const wh of existingWarehouses) {
    warehouseByKey.set(normalizeWarehouseKey(wh.code), wh);
    warehouseByKey.set(normalizeWarehouseKey(wh.name), wh);
  }

  const defaultWarehouse = await prisma.warehouse.upsert({
    where: { code: "DXB" },
    update: {},
    create: {
      code: "DXB",
      name: "Dubai",
    },
  });
  warehouseByKey.set(normalizeWarehouseKey(defaultWarehouse.code), defaultWarehouse);
  warehouseByKey.set(normalizeWarehouseKey(defaultWarehouse.name), defaultWarehouse);

  async function resolveWarehouse(rawText: string) {
    const value = rawText.trim();
    if (!value) return defaultWarehouse;

    const key = normalizeWarehouseKey(value);
    const cached = warehouseByKey.get(key);
    if (cached) return cached;

    // Không phải Admin thì KHÔNG tự tạo kho mới từ file Excel (gõ sai tên kho
    // trước đây âm thầm sinh ra kho rác) — dòng đó bị bỏ qua kèm lý do.
    if (!scope.canCreateWarehouse) return null;

    const created = await prisma.warehouse.upsert({
      where: { code: key },
      update: {},
      create: { code: key, name: value },
    });

    warehouseByKey.set(key, created);
    warehouseByKey.set(normalizeWarehouseKey(created.name), created);
    warehouseById.set(created.id, created);

    return created;
  }

  // File có cả thiết bị "Mua Mới" lẫn "Thu Hồi" trong cùng 1 lần nhập — tách
  // thành 2 phiếu nhập kho riêng thay vì gộp chung 1 loại NEW_PURCHASE như
  // bản cũ (sai với thực tế với các dòng "Thu Hồi"). CỐ TÌNH không gán
  // warehouseId cho 2 phiếu này — 1 file Excel có thể chứa NHIỀU kho khác
  // nhau (mỗi dòng có thể ghi kho riêng ở cột "Kho"), nên gán cứng 1 kho ở
  // cấp phiếu sẽ luôn sai với ít nhất vài dòng. Kho THẬT của từng thiết bị
  // nằm ở Asset.warehouseId, được set riêng theo từng dòng bên dưới — trang
  // "Phiếu nhập kho" tự tổng hợp lại danh sách kho thật từ các asset này khi
  // hiển thị, không đọc warehouseId của phiếu.
  const newPurchaseSlip = await prisma.stockInSlip.create({
    data: {
      slipNo: `IMPORT-NEW-${Date.now()}`,
      stockInDate: new Date(),
      stockInType: StockInType.NEW_PURCHASE,
      vendorName: "Excel Import",
      note: "Imported from original DXB2 Excel file — Mua Mới",
      createdBy: importedByName,
    },
  });

  const returnedSlip = await prisma.stockInSlip.create({
    data: {
      slipNo: `IMPORT-RETURNED-${Date.now()}`,
      stockInDate: new Date(),
      stockInType: StockInType.RETURNED,
      vendorName: "Excel Import",
      note: "Imported from original DXB2 Excel file — Thu Hồi",
      createdBy: importedByName,
    },
  });

  // Dùng để giãn cách createdAt của các dòng NHẬP KHO — file gốc không có
  // "Ngày Nhập" cho bất kỳ dòng nào, nếu để tất cả trùng đúng 1 mili-giây thì
  // thứ tự hiển thị trong Activity log sẽ không phản ánh đúng thứ tự trong
  // file (STT). Giãn theo index để giữ đúng thứ tự tương đối.
  const importBaseTime = new Date();

  // 2. Import tài sản từ phần NHẬP KHO (data từ row 4)
  for (let rowNum = 4; rowNum <= worksheet.rowCount; rowNum++) {
    onProgress("Nhập kho (cột J-W)", rowNum);

    const row = worksheet.getRow(rowNum);
    const i = rowNum; // giữ 1 số tăng dần riêng cho từng dòng (asset tag / mốc thời gian), không cần trùng ý nghĩa index cũ

    const modelCode = text(cellAt(row, "J"));
    const modelNameFromFile = text(cellAt(row, "K"));
    const serialNumber = text(cellAt(row, "M"));
    const hasAdapter = toBool(cellAt(row, "N"));
    const hasCable = toBool(cellAt(row, "O"));

    const statusText = text(cellAt(row, "P"));
    const condition = text(cellAt(row, "Q"));
    const importDate = excelDate(cellAt(row, "R"));
    const processedByName = text(cellAt(row, "S")); // Người Nhập (nhân viên IT xử lý)
    const recoveredFromName = text(cellAt(row, "T")); // Nhân Viên (nguồn thu hồi cũ)
    const source = text(cellAt(row, "U")); // Nguồn
    const teamName = text(cellAt(row, "V"));
    const warehouseText = text(cellAt(row, "W")); // Kho — trước đây bị bỏ qua, luôn gán cứng vào "DXB"

    // Dòng trống hoàn toàn — bỏ qua êm, không cảnh báo.
    if (!modelCode && !serialNumber) continue;

    if (!modelCode || !serialNumber) {
      const missing = [
        !modelCode && "Mã Thiết Bị (cột J)",
        !serialNumber && "Serial Number (cột M)",
      ]
        .filter(Boolean)
        .join(", ");
      skipped.push({ rowNum, reason: `Nhập kho — thiếu ${missing}` });
      continue;
    }

    const rowWarehouse = await resolveWarehouse(warehouseText);

    if (!rowWarehouse) {
      skipped.push({
        rowNum,
        reason: `Nhập kho — kho "${warehouseText}" chưa có trong hệ thống. Kiểm tra lại tên kho hoặc nhờ Admin tạo ở Cài đặt > Kho.`,
      });
      continue;
    }

    if (scope.regionWarehouseIds && !scope.regionWarehouseIds.includes(rowWarehouse.id)) {
      skipped.push({
        rowNum,
        reason: `Nhập kho — kho "${rowWarehouse.name}" nằm ngoài khu vực bạn được phân quyền.`,
      });
      continue;
    }

    let model = await prisma.assetModel.findUnique({
      where: { modelCode },
    });

    if (!model) {
      const reference = modelMap.get(modelCode);

      const categoryName = reference?.categoryName ?? "Unknown";
      const category = await prisma.assetCategory.upsert({
        where: { name: categoryName },
        update: {},
        create: { name: categoryName },
      });

      model = await prisma.assetModel.create({
        data: {
          modelCode,
          categoryId: category.id,
          brand: reference?.brand ?? inferBrand(categoryName, modelNameFromFile),
          modelName: reference?.modelName ?? modelNameFromFile ?? modelCode,
        },
      });
    }

    // Người này là nguồn thu hồi (chủ cũ), KHÔNG phải người đang giữ hiện
    // tại — không gán vào currentEmployeeId của Asset. currentEmployeeId chỉ
    // được set đúng ở bước 3 (XUẤT KHO), dựa theo "Người Nhận" thật sự.
    const recoveredFromEmployee = await upsertEmployee(
      recoveredFromName,
      teamName || null
    );

    const status = mapStatus(statusText);

    const existed = await prisma.asset.findUnique({
      where: { serialNumber },
    });

    // Thiết bị ĐANG Đã cấp phát (có người giữ thật) mà serial lại xuất hiện
    // lần nữa ở khối NHẬP KHO của 1 lần import khác — rất có thể do trùng
    // lặp dữ liệu nguồn (VD: cùng 1 serial bị liệt kê nhầm ở cả sheet kho A
    // lẫn kho B), KHÔNG phải ý định thật là "thiết bị này vừa về kho". Trước
    // đây update() vô điều kiện, âm thầm ghi đè status/warehouseId của thiết
    // bị đang có người giữ — hậu quả: "huỷ" mất 1 lượt bàn giao hợp lệ mà
    // không ai để ý (chỉ lộ ra khi thiết bị hiện sai kho và người dùng phải
    // bàn giao lại lần 2 mới thấy đúng). Bỏ qua an toàn — nếu Admin thực sự
    // muốn thu hồi thiết bị này về kho, dùng nút Thu hồi ở trang chi tiết
    // thay vì import lại.
    // Máy đang luân chuyển chờ xác nhận / đã thanh lý xong: ghi đè sẽ làm treo
    // lượt luân chuyển (pendingTransfer*) hoặc "hồi sinh" máy đã thanh lý.
    if (
      existed &&
      (existed.status === AssetStatus.IN_TRANSIT ||
        (existed.status === AssetStatus.RETIRED && existed.liquidatedAt))
    ) {
      skipped.push({
        rowNum,
        reason: `Nhập kho — Serial "${serialNumber}" đang ${
          existed.status === AssetStatus.IN_TRANSIT ? "luân chuyển kho chờ xác nhận" : "ở trạng thái Đã thanh lý"
        }, bỏ qua để tránh ghi đè.`,
      });
      continue;
    }

    if (existed && existed.status === AssetStatus.ASSIGNED) {
      skipped.push({
        rowNum,
        reason: `Nhập kho — Serial "${serialNumber}" đang ở trạng thái Đã cấp phát (có người giữ), bỏ qua để tránh ghi đè nhầm. Dùng chức năng Thu hồi nếu thực sự cần đưa thiết bị này về kho.`,
      });
      continue;
    }

    // Thiết bị này đã có sẵn trong hệ thống hay lần đầu xuất hiện — quyết
    // định có ghi thêm lịch sử "Nhập kho" hay không (xem giải thích ở dưới).
    const isNewAsset = !existed;

    // So sánh giá trị TRƯỚC/SAU khi ghi đè 1 thiết bị đã có sẵn — để ghi lại
    // đúng những gì thực sự đổi vào AssetHistory (xem ngay dưới), cho kế
    // toán/FC/bất kỳ ai đăng nhập xem được ở trang "Lịch sử thay đổi"
    // (/activity) THAY VÌ import ghi đè âm thầm không để lại dấu vết như
    // trước đây.
    const fieldChanges: string[] = [];

    if (existed) {
      const newCondition = condition || existed.condition;
      const newPurchaseDate = importDate ?? existed.purchaseDate;

      if (model.id !== existed.modelId) {
        const oldModelName = await getOldModelName(existed.modelId);
        fieldChanges.push(`Model: "${oldModelName}" → "${model.modelName}"`);
      }

      if ((newCondition ?? null) !== (existed.condition ?? null)) {
        fieldChanges.push(
          `Tình trạng: "${existed.condition ?? "-"}" → "${newCondition ?? "-"}"`
        );
      }

      if (status !== existed.status) {
        fieldChanges.push(`Trạng thái: "${existed.status}" → "${status}"`);
      }

      if (rowWarehouse.id !== existed.warehouseId) {
        const oldWarehouseName =
          (existed.warehouseId && warehouseById.get(existed.warehouseId)?.name) ||
          "(chưa có kho)";
        fieldChanges.push(`Kho: "${oldWarehouseName}" → "${rowWarehouse.name}"`);
      }

      if ((newPurchaseDate?.getTime() ?? null) !== (existed.purchaseDate?.getTime() ?? null)) {
        fieldChanges.push("Ngày mua thay đổi");
      }
    }

    const asset = existed
      ? await prisma.asset.update({
          where: { serialNumber },
          data: {
            modelId: model.id,
            condition: condition || existed.condition,
            status,
            warehouseId: rowWarehouse.id,
            purchaseDate: importDate ?? existed.purchaseDate,
            note: source ? `Nguồn: ${source}` : existed.note,
          },
        })
      : await prisma.asset.create({
          data: {
            assetTag: await generateUniqueAssetTag(prisma, usedTags),
            serialNumber,
            modelId: model.id,
            actualCpu: model.defaultCpu,
            actualRam: model.defaultRam,
            actualStorage: model.defaultStorage,
            actualScreen: model.defaultScreen,
            actualGpu: model.defaultGpu,
            condition: condition || "Good",
            status,
            warehouseId: rowWarehouse.id,
            purchaseDate: importDate ?? new Date(),
            note: source ? `Nguồn: ${source}` : null,
          },
        });

    // Phụ kiện lúc nhập kho — nếu thiết bị này còn "CÒN TRONG KHO" (không có
    // dòng XUẤT KHO tương ứng), đây sẽ là trạng thái phụ kiện cuối cùng của
    // asset. Nếu sau đó có dòng XUẤT KHO khớp serial, bước 3 sẽ ghi đè lại.
    // Luôn chạy bất kể mới/cũ — idempotent (xoá rồi tạo lại), phản ánh đúng
    // thực tế trong file, không gây trùng lặp.
    await setAssetAccessories(asset.id, { hasAdapter, hasCable });

    // CHỈ ghi phiếu nhập + lịch sử "Nhập kho" khi đây THỰC SỰ là thiết bị mới
    // (chưa từng có trong hệ thống trước lần chạy này). Trước đây ghi vô điều
    // kiện mỗi lần import — nên chạy lại nguyên file nhiều lần (VD: chỉ để bổ
    // sung Xuất kho cho vài dòng, hoặc thêm vài thiết bị mới vào cùng file
    // cũ) sẽ khiến MỌI thiết bị đã có sẵn cũng bị ghi thêm 1 dòng "Nhập kho"
    // trùng lặp trong Timeline, dù thực tế không có gì thay đổi với chúng.
    if (isNewAsset) {
      const targetSlip =
        source.trim() === "Thu Hồi" ? returnedSlip : newPurchaseSlip;

      await prisma.stockInItem
        .create({
          data: {
            stockInSlipId: targetSlip.id,
            assetId: asset.id,
          },
        })
        .catch(() => null);

      // createdAt của dòng lịch sử này PHẢI là thời điểm THẬT SỰ thao tác
      // import diễn ra (để Timeline/chuông thông báo phản ánh đúng lúc dữ
      // liệu được đưa vào hệ thống) — KHÔNG dùng importDate (ngày lấy từ cột
      // "Ngày Nhập" trong file Excel). Trước đây dùng importDate làm createdAt
      // khi cột này có giá trị: Excel chỉ có NGÀY không có GIỜ nên
      // excelDate() luôn parse ra đúng 00:00:00 UTC — hiển thị cố định thành
      // 04:00:00 giờ VN/Dubai (UTC+4/+7) bất kể import lúc nào trong ngày,
      // trông như "giờ bị đứng yên" thay vì phản ánh thời gian thực. Ngày
      // lịch sử thật (importDate) vẫn giữ nguyên ý nghĩa ở purchaseDate của
      // Asset (xem trên) — chỉ tách riêng, không dùng chung cho createdAt.
      await prisma.assetHistory.create({
        data: {
          assetId: asset.id,
          action: HistoryAction.STOCK_IN,
          fromEmployeeId: recoveredFromEmployee?.id ?? null,
          toWarehouseId: rowWarehouse.id,
          note: "Import từ file Excel.",
          createdBy: processedByName || "Admin",
          createdAt: new Date(importBaseTime.getTime() + i * 1000),
        },
      });

      createdCount += 1;
    } else if (fieldChanges.length > 0) {
      // Thiết bị đã có sẵn NHƯNG bị import ghi đè 1 hoặc nhiều trường — ghi
      // lại thành 1 dòng "Cập nhật" trong Timeline/Lịch sử thay đổi, liệt kê
      // rõ trường nào đổi từ gì sang gì, để không còn tình trạng ghi đè âm
      // thầm không ai biết.
      await prisma.assetHistory.create({
        data: {
          assetId: asset.id,
          action: HistoryAction.UPDATE,
          toWarehouseId: rowWarehouse.id,
          note: `Import cập nhật: ${fieldChanges.join("; ")}`,
          createdBy: processedByName || importedByName,
          createdAt: new Date(importBaseTime.getTime() + i * 1000),
        },
      });

      updatedAssetIds.add(asset.id);
    }
  }

  // 3. Apply phần XUẤT KHO để gán thiết bị cho nhân viên đang giữ thật sự (data từ row 4)
  for (let rowNum = 4; rowNum <= worksheet.rowCount; rowNum++) {
    onProgress("Xuất kho (cột Z-AK)", rowNum);

    const row = worksheet.getRow(rowNum);

    const serialNumber = text(cellAt(row, "AB"));
    const hasAdapter = toBool(cellAt(row, "AC"));
    const hasCable = toBool(cellAt(row, "AD"));
    const condition = text(cellAt(row, "AE"));
    const issuedByName = text(cellAt(row, "AF")); // Người Cấp (nhân viên IT xử lý)
    const toName = text(cellAt(row, "AG")); // Nhân Viên (không còn cột "Người Nhận" riêng)
    const teamName = text(cellAt(row, "AH"));
    // Cột AI ("Ngày Xuất") không còn dùng để ghi createdAt — xem chú thích ở
    // chỗ tạo AssetHistory bên dưới.
    const note = text(cellAt(row, "AK"));

    // Dòng trống hoàn toàn — bỏ qua êm, không cảnh báo.
    if (!serialNumber && !toName) continue;

    if (!serialNumber || !toName) {
      const missing = [
        !serialNumber && "Serial Number (cột AB)",
        !toName && "Nhân Viên (cột AG)",
      ]
        .filter(Boolean)
        .join(", ");
      skipped.push({ rowNum, reason: `Xuất kho — thiếu ${missing}` });
      continue;
    }

    const asset = await prisma.asset.findUnique({
      where: { serialNumber },
    });

    if (!asset) {
      skipped.push({
        rowNum,
        reason: `Xuất kho — Serial Number "${serialNumber}" chưa tồn tại trong hệ thống (chưa được nhập kho ở khối Nhập kho/dòng nào khác trong file)`,
      });
      continue;
    }

    // "Người Cấp" là nhân viên IT xử lý bàn giao (vd "A Ashton") — chỉ ghi
    // lại làm createdBy (ai thực hiện thao tác), KHÔNG tạo hồ sơ Employee
    // cho họ và KHÔNG gán làm fromEmployeeId (bản cũ làm vậy khiến IT staff
    // bị lẫn vào danh sách nhân viên đang/từng giữ thiết bị). Thiết bị đến
    // từ kho (fromWarehouseId), không phải từ một nhân viên khác.
    const toEmployee = await upsertEmployee(toName, teamName || null);

    // So sánh với người đang giữ TRƯỚC khi update — dùng để quyết định có
    // thực sự cần ghi thêm 1 dòng "Bàn giao" hay không (xem giải thích dưới).
    const previousEmployeeId = asset.currentEmployeeId;
    const previousStatus = asset.status;
    const previousCondition = asset.condition;
    const newCondition = condition || asset.condition;
    const conditionChanged = (newCondition ?? null) !== (previousCondition ?? null);

    // LỚP CẢNH BÁO: thiết bị đang được gán cho 1 người (A) mà file lại ghi
    // nhận cho 1 người KHÁC (B/C...) — dừng lại, KHÔNG tự động chuyển, để
    // Admin tự xác nhận đây có đúng là 1 lần bàn giao thật không. Trước đây
    // code tự động ghi đè currentEmployeeId ngay lập tức, chỉ khác nhau ở chỗ
    // CÓ ghi log hay không (bản vá trước) — vẫn có rủi ro chuyển nhầm thiết
    // bị sang người khác chỉ vì file nguồn bị lỗi/nhầm serial. Trường hợp
    // asset CHƯA có người giữ (IN_STOCK...) hoặc file ghi ĐÚNG người đang giữ
    // (không đổi gì) thì vẫn xử lý bình thường, không bị chặn.
    if (
      previousStatus === AssetStatus.ASSIGNED &&
      previousEmployeeId !== null &&
      toEmployee &&
      previousEmployeeId !== toEmployee.id
    ) {
      const oldEmployeeName = await getEmployeeName(previousEmployeeId);
      skipped.push({
        rowNum,
        reason: `Xuất kho — Serial "${serialNumber}" đang được gán cho "${oldEmployeeName}", nhưng file lại ghi nhận cho "${toName}" — bỏ qua để tránh gán nhầm người. Nếu đây đúng là 1 lần bàn giao thật (đổi người giữ), vào trang chi tiết thiết bị và dùng chức năng "Bàn giao" để xác nhận thủ công, không import lại dòng này.`,
      });
      continue;
    }

    await prisma.asset.update({
      where: { id: asset.id },
      data: {
        status: AssetStatus.ASSIGNED,
        currentEmployeeId: toEmployee?.id ?? null,
        condition: condition || asset.condition,
      },
    });

    // Phụ kiện lúc BÀN GIAO là sự thật hiện tại — ghi đè lại giá trị đã set
    // ở bước 2 (lúc nhập kho luôn là true/true, không phản ánh đúng những gì
    // nhân viên thực sự đang cầm). Luôn chạy — idempotent, không gây trùng.
    await setAssetAccessories(asset.id, { hasAdapter, hasCable });

    // CHỈ ghi lịch sử "Bàn giao" khi việc gán người giữ THỰC SỰ thay đổi so
    // với trước (thiết bị chưa từng được gán, hoặc đổi sang người khác).
    // Trước đây ghi vô điều kiện mỗi lần import — nên chạy lại nguyên file
    // (VD: thêm 1 thiết bị mới vào cùng file cũ) sẽ khiến các thiết bị đã
    // bàn giao từ trước, không đổi gì, cũng bị ghi thêm 1 dòng "Bàn giao"
    // trùng lặp trong Timeline mỗi lần chạy.
    const assignmentChanged =
      previousStatus !== AssetStatus.ASSIGNED ||
      previousEmployeeId !== (toEmployee?.id ?? null);

    if (assignmentChanged) {
      // Cùng lý do như dòng STOCK_IN ở khối "2." bên trên — createdAt phải
      // là thời điểm import THẬT SỰ chạy, không dùng exportedAt (ngày từ cột
      // Excel, chỉ có ngày không có giờ nên luôn hiện cố định 1 mốc giờ sai
      // lệch múi giờ, không phải thời gian thực).
      let transferNote = note || "Import lịch sử xuất kho từ Excel";

      if (conditionChanged) {
        transferNote += ` (Tình trạng: "${previousCondition ?? "-"}" → "${newCondition}")`;
      }

      await prisma.assetHistory.create({
        data: {
          assetId: asset.id,
          action: HistoryAction.TRANSFER,
          fromWarehouseId: asset.warehouseId,
          toEmployeeId: toEmployee?.id ?? null,
          note: transferNote,
          createdBy: issuedByName || "Admin",
          createdAt: new Date(importBaseTime.getTime() + rowNum * 1000),
        },
      });

      updatedAssetIds.add(asset.id);
    } else if (conditionChanged) {
      // Người giữ không đổi, nhưng tình trạng thiết bị bị import ghi đè —
      // trước đây trường hợp này hoàn toàn KHÔNG được ghi log (chỉ log khi
      // đổi người giữ), nay ghi lại riêng 1 dòng "Cập nhật" để không mất dấu.
      await prisma.assetHistory.create({
        data: {
          assetId: asset.id,
          action: HistoryAction.UPDATE,
          note: `Import cập nhật: Tình trạng: "${previousCondition ?? "-"}" → "${newCondition}"`,
          createdBy: issuedByName || importedByName,
          createdAt: new Date(importBaseTime.getTime() + rowNum * 1000),
        },
      });

      updatedAssetIds.add(asset.id);
    }
  }

  // Ghi 1 dòng tóm tắt vào Nhật ký thao tác (Cài đặt > Nhật ký thao tác,
  // Admin xem) cho MỖI LẦN chạy import — trước đây import hoàn toàn không
  // ghi gì vào AuditLog, dù đây là 1 trong những thao tác có khả năng ảnh
  // hưởng dữ liệu nhiều nhất trong toàn hệ thống (đọc/ghi hàng trăm dòng
  // cùng lúc). Không throw nếu ghi lỗi — createAuditLog() tự nuốt lỗi.
  await createAuditLog({
    actorName: importedByName,
    action: "IMPORT_EXCEL",
    targetType: "Asset",
    detail: `Import Excel: tạo mới ${createdCount} thiết bị, cập nhật ${updatedAssetIds.size} thiết bị đã có, bỏ qua ${skipped.length} dòng.`,
  });

  return { skipped, createdCount, updatedCount: updatedAssetIds.size };
}
