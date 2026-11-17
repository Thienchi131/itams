import ExcelJS from "exceljs";

// Sinh file Excel MẪU cho chức năng Import (/assets/import) từ dữ liệu hiện
// tại. Bố cục PHẢI khớp với runImport() trong src/app/assets/import/actions.ts:
// sheet đầu tiên, tiêu đề ở dòng 2, dữ liệu từ dòng 4, các khối cột
// B-D (Danh mục) · J-W (Nhập kho) · Z-AK (Xuất kho). Cột X và AL là cột
// "Kiểm tra" tự động (công thức) — importer không đọc 2 cột này.

export type ImportTemplateData = {
  models: { code: string; category: string; brand: string; name: string; tag: string; assetCount: number }[];
  warehouses: { code: string; name: string; region: string }[];
  teams: string[];
  itStaff: string[];
  employees: { fullName: string; team: string; code: string }[];
  serials: { serial: string; status: string }[];
  generatedAt: Date;
};

const FIRST = 4;
const LAST = 503;
const FONT = "Arial";
const CONDITIONS = ["Máy Mới", "Good", "Bình Thường", "Cũ", "Hư", "Lock iCloud"];
const STATUSES = ["Trong kho", "Đã giao", "Hỏng", "Mất"];
const SOURCES = ["Mua Mới", "Thu Hồi"];

const C = {
  hdr: { cat: "FF6B7280", in: "FF2C58C9", out: "FF0F766E" },
  sub: { cat: "FFF3F4F6", in: "FFE8EFFC", out: "FFE3F5F2" },
  input: "FFFFF9DB",
  auto: "FFEEF2F6",
  red: "FFFDE2E2",
  amber: "FFFEF3C7",
  green: "FFDCFCE7",
  blue: "FFDBEAFE",
};

type Block = keyof typeof C.hdr;
type Kind = "in" | "auto" | "skip";

const SPEC: [string, string, string, Block, Kind, number][] = [
  ["B", "Mã Thiết Bị", "chỉ điền khi model MỚI", "cat", "in", 16],
  ["C", "Tên Thiết Bị", "nhóm: iPhone, Mac Air…", "cat", "in", 16],
  ["D", "Thông Số Thiết Bị", "tên model đầy đủ", "cat", "in", 26],
  ["J", "Mã Thiết Bị", "▼ chọn mã model", "in", "in", 16],
  ["K", "Tên Thiết bị", "tự hiện theo mã", "in", "auto", 28],
  ["L", "Tổng Nhập", "", "in", "skip", 6],
  ["M", "Serial Number", "bắt buộc", "in", "in", 20],
  ["N", "Phụ kiện", "Adapter", "in", "in", 9],
  ["O", "", "Cáp sạc", "in", "in", 9],
  ["P", "Trạng Thái", "▼", "in", "in", 12],
  ["Q", "Tình Trạng", "▼", "in", "in", 13],
  ["R", "Ngày Nhập", "dd/mm/yyyy", "in", "in", 12],
  ["S", "Người Nhập", "▼ IT xử lý", "in", "in", 14],
  ["T", "Nhân Viên", "▼ thu hồi từ ai (nếu có)", "in", "in", 20],
  ["U", "Nguồn", "▼", "in", "in", 10],
  ["V", "Team", "▼ team của NV (nếu có)", "in", "in", 12],
  ["W", "Kho", "▼ bắt buộc", "in", "in", 10],
  ["X", "Kiểm tra", "tự động", "in", "auto", 32],
  ["Z", "Mã Thiết Bị", "▼ chọn mã model", "out", "in", 16],
  ["AA", "Tên thiết bị (tự hiện)", "tự hiện theo mã", "out", "auto", 26],
  ["AB", "Serial Number", "bắt buộc", "out", "in", 20],
  ["AC", "Phụ kiện", "Adapter", "out", "in", 9],
  ["AD", "", "Cáp sạc", "out", "in", 9],
  ["AE", "Tình Trạng", "▼", "out", "in", 13],
  ["AF", "Người Cấp", "▼ IT xử lý", "out", "in", 14],
  ["AG", "Nhân Viên", "▼ người nhận máy", "out", "in", 22],
  ["AH", "Team", "▼", "out", "in", 12],
  ["AI", "Ngày xuất", "dd/mm/yyyy", "out", "in", 12],
  ["AJ", "Xác Nhận", "", "out", "in", 10],
  ["AK", "Note", "", "out", "in", 22],
  ["AL", "Kiểm tra", "tự động", "out", "auto", 32],
];

const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const font = (extra: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: FONT, size: 10, ...extra });
const thin: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFCBD5E1" } };
const BORDER: Partial<ExcelJS.Borders> = { top: thin, left: thin, bottom: thin, right: thin };

export async function buildImportTemplate(data: ImportTemplateData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ITAMS";
  wb.created = data.generatedAt;
  wb.calcProperties.fullCalcOnLoad = true;

  // Sheet đầu tiên BẮT BUỘC là sheet nhập liệu — importer chỉ đọc worksheets[0].
  const ws = wb.addWorksheet("Import", {
    properties: { tabColor: { argb: "FF2C58C9" } },
    views: [{ state: "frozen", xSplit: 1, ySplit: 3 }],
  });
  const guide = wb.addWorksheet("Hướng dẫn", { properties: { tabColor: { argb: "FFF59E0B" } } });
  const wm = wb.addWorksheet("Model", { properties: { tabColor: { argb: "FF6B7280" } }, views: [{ state: "frozen", ySplit: 1 }] });
  const wd = wb.addWorksheet("Danh mục", { properties: { tabColor: { argb: "FF6B7280" } }, views: [{ state: "frozen", ySplit: 1 }] });
  const we = wb.addWorksheet("Nhân viên", { properties: { tabColor: { argb: "FF6B7280" } }, views: [{ state: "frozen", ySplit: 1 }] });
  const wsr = wb.addWorksheet("_Serial", { state: "hidden" });

  // ---------- Sheet tra cứu ----------
  function headerRow(sheet: ExcelJS.Worksheet, titles: string[], widths: number[]) {
    titles.forEach((t, i) => {
      const cell = sheet.getCell(1, i + 1);
      cell.value = t || null;
      if (!t) return;
      cell.font = font({ bold: true, color: { argb: "FFFFFFFF" } });
      cell.fill = fill("FF374151");
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });
    widths.forEach((w, i) => (sheet.getColumn(i + 1).width = w));
  }

  headerRow(wm, ["Mã model", "Loại", "Hãng", "Tên model", "Tag", "Số TB đang có"], [16, 14, 12, 40, 10, 13]);
  data.models.forEach((m, i) => {
    wm.getRow(i + 2).values = [m.code, m.category, m.brand, m.name, m.tag, m.assetCount];
  });
  const NM = data.models.length + 1;
  wm.autoFilter = `A1:F${NM}`;

  const lists: [string, string, string[]][] = [
    ["A", "Mã kho", data.warehouses.map((w) => w.code)],
    ["B", "Tên kho", data.warehouses.map((w) => w.name)],
    ["C", "Khu vực", data.warehouses.map((w) => w.region)],
    ["E", "Team", data.teams],
    ["G", "Người IT (Admin/IT)", data.itStaff],
    ["I", "Tình trạng", CONDITIONS],
    ["K", "Trạng thái", STATUSES],
    ["M", "Nguồn", SOURCES],
  ];
  headerRow(wd, [], [12, 18, 14, 2, 18, 2, 20, 2, 14, 2, 12, 2, 12]);
  const ref: Record<string, string> = {};
  for (const [col, title, values] of lists) {
    const head = wd.getCell(`${col}1`);
    head.value = title;
    head.font = font({ bold: true, color: { argb: "FFFFFFFF" } });
    head.fill = fill("FF374151");
    head.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    values.forEach((v, i) => (wd.getCell(`${col}${i + 2}`).value = v));
    ref[title] = `'Danh mục'!$${col}$2:$${col}$${Math.max(values.length + 1, 2)}`;
  }

  headerRow(we, ["Họ tên (đúng như trong ITAMS)", "Team", "Mã NV"], [34, 16, 22]);
  data.employees.forEach((e, i) => (we.getRow(i + 2).values = [e.fullName, e.team, e.code]));
  const NE = data.employees.length + 1;
  we.autoFilter = `A1:C${NE}`;

  wsr.getRow(1).values = ["Serial", "Trạng thái"];
  data.serials.forEach((s, i) => (wsr.getRow(i + 2).values = [s.serial, s.status]));
  const NS = data.serials.length + 1;

  const DS = {
    model: `Model!$A$2:$A$${NM}`,
    modelBrand: `Model!$C$2:$C$${NM}`,
    modelName: `Model!$D$2:$D$${NM}`,
    emp: `'Nhân viên'!$A$2:$A$${Math.max(NE, 2)}`,
    serial: `_Serial!$A$2:$A$${Math.max(NS, 2)}`,
    kho: ref["Mã kho"],
  };

  // ---------- Sheet Import ----------
  ["A", "E", "F", "G", "H", "I", "Y"].forEach((c) => (ws.getColumn(c).width = 2.5));
  ws.getColumn("L").hidden = true;

  const titles: [string, string, Block][] = [
    ["B1:D1", "DANH MỤC — chỉ điền khi có model MỚI chưa có ở sheet Model", "cat"],
    ["J1:X1", "NHẬP KHO — thiết bị đưa vào kho", "in"],
    ["Z1:AL1", "XUẤT KHO — thiết bị cấp cho nhân viên (chỉ điền khi máy đang ở người dùng)", "out"],
  ];
  for (const [range, text, b] of titles) {
    ws.mergeCells(range);
    const cell = ws.getCell(range.split(":")[0]);
    cell.value = text;
    cell.font = font({ size: 11, bold: true, color: { argb: "FFFFFFFF" } });
    cell.fill = fill(C.hdr[b]);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }
  ws.getRow(1).height = 24;
  ws.getRow(2).height = 30;
  ws.getRow(3).height = 26;

  for (const [col, header, hint, b, kind, width] of SPEC) {
    ws.getColumn(col).width = width;
    const h = ws.getCell(`${col}2`);
    h.value = header || null;
    h.font = font({ bold: true, color: { argb: "FFFFFFFF" } });
    h.fill = fill(C.hdr[b]);
    h.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    h.border = BORDER;

    const sub = hint === "Adapter" || hint === "Cáp sạc";
    const s = ws.getCell(`${col}3`);
    s.value = hint || null;
    s.font = font({ size: 9, bold: sub, italic: !sub, color: { argb: sub ? "FF1F2937" : "FF6B7280" } });
    s.fill = fill(C.sub[b]);
    s.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    s.border = BORDER;

    for (let r = FIRST; r <= LAST; r++) {
      const cell = ws.getCell(`${col}${r}`);
      cell.border = BORDER;
      cell.font = font();
      cell.alignment = {
        horizontal: ["N", "O", "AC", "AD"].includes(col) ? "center" : "left",
        vertical: "middle",
      };
      if (kind === "in") cell.fill = fill(C.input);
      if (kind === "auto") cell.fill = fill(C.auto);
      if (col === "R" || col === "AI") cell.numFmt = "dd/mm/yyyy";
      // Serial / mã dạng chữ — không để Excel tự đổi thành số (mất số 0 đầu).
      if (["B", "J", "M", "Z", "AB"].includes(col)) cell.numFmt = "@";
    }
  }
  ws.mergeCells("N2:O2");
  ws.mergeCells("AC2:AD2");

  for (let r = FIRST; r <= LAST; r++) {
    const lookup = (c: string) =>
      `IF(${c}${r}="","",IFERROR(INDEX(${DS.modelBrand},MATCH(${c}${r},${DS.model},0))&" "&INDEX(${DS.modelName},MATCH(${c}${r},${DS.model},0)),""))`;
    ws.getCell(`K${r}`).value = { formula: lookup("J") };
    ws.getCell(`AA${r}`).value = { formula: lookup("Z") };
    ws.getCell(`X${r}`).value = {
      formula:
        `IF(AND(J${r}="",M${r}="",W${r}=""),"",` +
        `IF(J${r}="","⚠ Thiếu mã model",IF(M${r}="","⚠ Thiếu Serial",IF(W${r}="","⚠ Thiếu Kho",` +
        `IF(AND(ISNA(MATCH(J${r},${DS.model},0)),ISNA(MATCH(J${r},$B$${FIRST}:$B$${LAST},0))),"✖ Mã model chưa có (điền khối Danh mục)",` +
        `IF(ISNA(MATCH(W${r},${DS.kho},0)),"✖ Kho không có / ngoài phạm vi của bạn",` +
        `IF(COUNTIF($M$${FIRST}:$M$${LAST},M${r})>1,"✖ Serial trùng trong file",` +
        `IF(ISNUMBER(MATCH(M${r},${DS.serial},0)),"ℹ Serial đã có – sẽ cập nhật máy cũ","✔ OK"))))))))`,
    };
    ws.getCell(`AL${r}`).value = {
      formula:
        `IF(AND(AB${r}="",AG${r}=""),"",` +
        `IF(AB${r}="","⚠ Thiếu Serial",IF(AG${r}="","⚠ Thiếu Nhân viên",` +
        `IF(AND(ISNA(MATCH(AB${r},${DS.serial},0)),COUNTIF($M$${FIRST}:$M$${LAST},AB${r})=0),"✖ Serial chưa có (thêm ở khối Nhập kho)",` +
        `IF(COUNTIF($AB$${FIRST}:$AB$${LAST},AB${r})>1,"✖ Serial trùng trong file",` +
        `IF(ISNA(MATCH(AG${r},${DS.emp},0)),"ℹ Nhân viên mới – sẽ tạo mã tạm","✔ OK"))))))`,
    };
  }

  // ---------- Danh sách chọn ----------
  const range = (c: string) => `${c}${FIRST}:${c}${LAST}`;
  // Khai báo 1 vùng duy nhất cho mỗi cột. (Gán từng ô thì exceljs tự gộp
  // nhưng sinh ra các vùng CHỒNG LẤN, vd "AC4:AD503" + "AC10:AD503" — Excel
  // có thể báo file lỗi.) API theo vùng có sẵn ở runtime nhưng thiếu kiểu.
  const sheetValidations = (ws as unknown as {
    dataValidations: { add(address: string, validation: ExcelJS.DataValidation): void };
  }).dataValidations;
  const setValidation = (col: string, validation: ExcelJS.DataValidation) => {
    sheetValidations.add(range(col), validation);
  };
  const list = (
    cols: string[],
    formula: string,
    strict: boolean,
    error: [string, string],
    prompt?: [string, string]
  ) => {
    for (const c of cols) {
      setValidation(c, {
        type: "list",
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: true,
        // Bỏ trống = "stop" (chặn hẳn). Chuẩn OOXML chỉ nhận stop/warning/information.
        ...(strict ? {} : { errorStyle: "warning" }),
        errorTitle: error[0],
        error: error[1],
        ...(prompt ? { showInputMessage: true, promptTitle: prompt[0], prompt: prompt[1] } : {}),
      });
    }
  };
  list(["J"], DS.model, false,
    ["Mã model chưa có", "Mã này không có trong sheet Model. Nếu là model MỚI, khai báo ở khối Danh mục (cột B-D)."],
    ["Mã model", "Chọn từ danh sách. Tra ở sheet Model; cột K tự hiện tên để đối chiếu."]);
  list(["Z"], DS.model, false, ["Mã model chưa có", "Mã này không có trong sheet Model."]);
  list(["N", "O", "AC", "AD"], '"x"', true, ["Chỉ điền x", "Điền x nếu có phụ kiện, để trống nếu không."]);
  list(["P"], ref["Trạng thái"], true, ["Trạng thái", "Chọn từ danh sách."]);
  list(["Q", "AE"], ref["Tình trạng"], false, ["Tình trạng ngoài danh sách", "Nên chọn từ danh sách để dữ liệu thống nhất."]);
  list(["S", "AF"], ref["Người IT (Admin/IT)"], false, ["Người IT", "Tên này không có trong danh sách Admin/IT."]);
  list(["T", "AG"], DS.emp, false,
    ["Nhân viên chưa có", "Tên không khớp chính xác nhân viên nào trong ITAMS — hệ thống sẽ TẠO nhân viên mới với mã tạm. Kiểm tra chính tả ở sheet Nhân viên."],
    ["Nhân viên", "Chọn đúng họ tên như trong ITAMS (sheet Nhân viên)."]);
  list(["U"], ref["Nguồn"], true, ["Nguồn", "Chọn Mua Mới hoặc Thu Hồi."]);
  list(["V", "AH"], ref["Team"], false, ["Team chưa có", "Team không có trong danh sách — hệ thống sẽ tạo team mới."]);
  list(["W"], DS.kho, true, ["Kho không hợp lệ", "Chọn mã kho từ danh sách (các kho bạn được phân quyền)."],
    ["Kho", "Mã kho nơi thiết bị nằm."]);
  for (const c of ["R", "AI"]) {
    setValidation(c, {
      type: "date",
      operator: "between",
      allowBlank: true,
      formulae: [new Date(Date.UTC(2015, 0, 1)), new Date(Date.UTC(data.generatedAt.getFullYear() + 1, 11, 31))],
      showErrorMessage: true,
      errorTitle: "Ngày không hợp lệ",
      error: "Nhập ngày dạng dd/mm/yyyy.",
    });
  }

  // ---------- Tô màu cột Kiểm tra ----------
  for (const c of ["X", "AL"]) {
    const rule = (sym: string, bg: string, color: string, bold = false, priority = 1): ExcelJS.ConditionalFormattingRule => ({
      type: "expression",
      priority,
      formulae: [`LEFT(${c}${FIRST},1)="${sym}"`],
      style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: bg } }, font: { color: { argb: color }, bold } },
    });
    ws.addConditionalFormatting({
      ref: range(c),
      rules: [
        rule("✖", C.red, "FFB91C1C", true, 1),
        rule("⚠", C.amber, "FF92400E", false, 2),
        rule("ℹ", C.blue, "FF1E40AF", false, 3),
        rule("✔", C.green, "FF166534", false, 4),
      ],
    });
  }
  ws.addConditionalFormatting({
    ref: range("M"),
    rules: [
      {
        type: "expression",
        priority: 5,
        formulae: [`AND(M${FIRST}<>"",COUNTIF($M$${FIRST}:$M$${LAST},M${FIRST})>1)`],
        style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: C.red } } },
      },
    ],
  });

  // ---------- Sheet Hướng dẫn ----------
  guide.getColumn(1).width = 3;
  guide.getColumn(2).width = 26;
  guide.getColumn(3).width = 92;
  let row = 2;
  const put = (b: string, c = "", opt: { size?: number; color?: string; bg?: string; bold?: boolean } = {}) => {
    const cb = guide.getCell(`B${row}`);
    const cc = guide.getCell(`C${row}`);
    cb.value = b;
    cc.value = c || null;
    cb.font = font({ size: opt.size ?? 10, bold: opt.bold ?? Boolean(c), color: { argb: opt.color ?? "FF111827" } });
    cc.font = font({ size: opt.size ?? 10, color: { argb: opt.color ?? "FF111827" } });
    cb.alignment = cc.alignment = { vertical: "middle", wrapText: true };
    if (opt.bg) cb.fill = cc.fill = fill(opt.bg);
    row++;
  };
  const stamp = data.generatedAt.toLocaleString("vi-VN", { timeZone: "Asia/Dubai" });
  put("MẪU IMPORT THIẾT BỊ — ITAMS", "", { size: 14, color: "FF2C58C9", bold: true });
  put(`Sinh tự động lúc ${stamp} từ dữ liệu ITAMS: ${data.models.length} model, ${data.warehouses.length} kho, ${data.teams.length} team, ${data.employees.length} nhân viên. Tải lại mẫu mới khi có thêm model/nhân viên.`, "", { color: "FF6B7280" });
  row++;
  put("CÁC BƯỚC", "", { size: 11, bold: true });
  put("1. Điền sheet Import", "Chỉ sửa sheet đầu tiên (Import), từ dòng 4. KHÔNG xoá/đổi dòng tiêu đề 1-3, không đổi thứ tự sheet.");
  put("2. Chọn mã model", "Cột J (và Z): bấm ô → chọn mã. Không chắc mã nào? Mở sheet Model, lọc theo Loại/Hãng/Tên. Cột K tự hiện tên model để đối chiếu với máy thật.");
  put("3. Xem cột Kiểm tra", "Cột X (Nhập kho) và AL (Xuất kho) tự kiểm tra từng dòng. Chỉ upload khi không còn dòng ✖.");
  put("4. Upload", "ITAMS → Quản lý tài sản → Import Excel → chọn file đã lưu.");
  row++;
  put("MÀU Ô", "", { size: 11, bold: true });
  put("Ô vàng", "Ô cần điền.", { bg: C.input });
  put("Ô xám", "Tự động — không cần điền.", { bg: C.auto });
  row++;
  put("Ý NGHĨA CỘT KIỂM TRA", "", { size: 11, bold: true });
  put("✔ OK", "Dòng hợp lệ.", { bg: C.green });
  put("ℹ Serial đã có", "Máy đã có trong ITAMS — import sẽ CẬP NHẬT máy đó. Máy đang luân chuyển hoặc đã thanh lý sẽ bị bỏ qua.", { bg: C.blue });
  put("ℹ Nhân viên mới", "Tên không khớp chính xác ai trong ITAMS — hệ thống tạo nhân viên mới với mã tạm. Kiểm tra chính tả trước.", { bg: C.blue });
  put("⚠ Thiếu …", "Thiếu thông tin bắt buộc — dòng sẽ bị bỏ qua.", { bg: C.amber });
  put("✖ …", "Sai — sửa trước khi upload (mã model chưa có, kho sai, serial trùng…).", { bg: C.red });
  row++;
  put("KHỐI NHẬP KHO (J–W)", "", { size: 11, bold: true });
  put("Bắt buộc", "J Mã model · M Serial · W Kho");
  put("Adapter / Cáp sạc", "Điền x nếu có kèm, để trống nếu không.");
  put("Trạng Thái", "Thường chọn \"Trong kho\". \"Hỏng\" = đưa vào Bảo trì.");
  put("Nhân Viên (T)", "Chỉ điền khi máy THU HỒI từ một nhân viên (ghi lịch sử). Không phải người đang giữ máy.");
  row++;
  put("KHỐI XUẤT KHO (Z–AK)", "", { size: 11, bold: true });
  put("Khi nào điền", "Chỉ khi máy đang ở người dùng. Serial phải có trong ITAMS hoặc ở khối Nhập kho cùng file.");
  put("Bắt buộc", "AB Serial · AG Nhân viên (người đang giữ máy)");
  row++;
  put("MODEL MỚI", "", { size: 11, bold: true });
  put("Cách khai báo", "Tốt nhất: tạo model trong ITAMS (Model Library) rồi tải lại mẫu. Hoặc điền khối Danh mục (B Mã, C Loại, D Tên đầy đủ) và dùng đúng mã đó ở cột J.");
  const ex = data.models[0];
  if (ex) {
    row++;
    put("VÍ DỤ 1 DÒNG", "", { size: 11, bold: true });
    const example: [string, string][] = [
      ["J Mã Thiết Bị", ex.code],
      ["K (tự hiện)", `${ex.brand} ${ex.name}`],
      ["M Serial Number", "C02XJ0L7JG5J"],
      ["N / O", "x / x"],
      ["P Trạng Thái", "Trong kho"],
      ["Q Tình Trạng", "Good"],
      ["R Ngày Nhập", "04/11/2026"],
      ["S Người Nhập", data.itStaff[0] ?? ""],
      ["U Nguồn", "Mua Mới"],
      ["W Kho", data.warehouses[0]?.code ?? ""],
    ];
    example.forEach(([k, v]) => put(k, v));
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
