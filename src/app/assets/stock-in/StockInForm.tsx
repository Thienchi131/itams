"use client";

import { createStockInAction, checkDuplicateSerialsAction, type StockInState } from "./actions";
import Link from "next/link";
import { useActionState, useCallback, useMemo, useState } from "react";
import ModelSearchSelect from "./ModelSearchSelect";
import SerialScannerModal from "./SerialScannerModal";
import EmployeeSelect from "../../components/EmployeeSelect";
import QuickAddEmployeeModal from "./QuickAddEmployeeModal";
import {
  PackagePlus,
  Building2,
  Warehouse,
  Calendar,
  Laptop,
  Cpu,
  HardDrive,
  Monitor,
  ClipboardList,
  Save,
  X,
  TriangleAlert,
  Plus,
  Trash2,
  UserRoundSearch,
  MessageSquareText,
  ScanLine,
} from "lucide-react";

const SERIAL_MAX_LENGTH = 16;

type ModelItem = {
  id: number;
  modelCode: string | null;
  brand: string;
  modelName: string;
  defaultCpu: string | null;
  defaultRam: string | null;
  defaultStorage: string | null;
  defaultScreen: string | null;
  defaultGpu: string | null;
  category: { name: string };
  _count: { assets: number };
};

type WarehouseItem = {
  id: number;
  code: string;
  name: string;
};

type EmployeeItem = {
  id: number;
  employeeCode: string;
  fullName: string;
  team?: { name: string } | null;
};

// Lý do thu hồi — cố định 3 lựa chọn theo yêu cầu vận hành, lưu kèm luôn
// nhãn tiếng Việt vào AssetHistory.note (xem actions.ts) thay vì thêm cột
// DB riêng, vì đây chỉ là 1 dòng mô tả bối cảnh chứ không cần lọc/thống kê
// theo lý do sau này.
const RETURN_REASONS = [
  { value: "MAINTENANCE", label: "Bảo trì/bảo hành" },
  { value: "TRANSFER", label: "Luân chuyển" },
  { value: "RESIGNED", label: "Nghỉ việc" },
] as const;

type Line = {
  key: string;
  modelId: string;
  serials: string[];
  hasAdapter: boolean;
  hasCable: boolean;
  // Tình trạng lúc nhập kho — mặc định Tốt. Đánh dấu Hư hỏng khi lô hàng/thu
  // hồi về đã thấy hỏng ngay lúc nhập, để KHÔNG tính vào tồn kho khả dụng
  // (tránh kế toán thấy tồn kho có máy nhưng thật ra là máy hỏng nằm chờ sửa).
  condition: "GOOD" | "DAMAGED";
  damagedNote: string;
};

let lineCounter = 0;
function newLine(): Line {
  lineCounter += 1;
  return {
    key: `line-${lineCounter}`,
    modelId: "",
    serials: [""],
    hasAdapter: false,
    hasCable: false,
    condition: "GOOD",
    damagedNote: "",
  };
}

export default function StockInForm({
  models,
  warehouses,
  employees,
}: {
  models: ModelItem[];
  warehouses: WarehouseItem[];
  employees: EmployeeItem[];
}) {
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [stockInType, setStockInType] = useState<"NEW_PURCHASE" | "RETURNED">(
    "NEW_PURCHASE"
  );
  // Bắt buộc chọn thời hạn bảo hành khi nhập Thiết bị mới — không cho để
  // trống/bỏ qua như trước (từng có lựa chọn "Không có bảo hành").
  const [warrantyMonths, setWarrantyMonths] = useState("");
  // Danh sách nhân viên hiển thị trong ô "Thu hồi từ ai" — bắt đầu bằng danh
  // bạ có sẵn, cộng thêm nhân viên vừa tạo qua popup "Tạo nhanh" (để nếu user
  // xoá rồi tìm lại vẫn thấy) mà không cần load lại trang (load lại sẽ mất
  // toàn bộ dữ liệu phiếu nhập đang nhập dở).
  const [returnEmployees, setReturnEmployees] = useState<EmployeeItem[]>(employees);
  const [returnedFromEmployee, setReturnedFromEmployee] = useState<EmployeeItem | null>(
    null
  );
  const [returnReason, setReturnReason] = useState("");
  const [duplicateCheck, setDuplicateCheck] = useState<{
    duplicatedInInput: string[];
    existingInSystem: string[];
  } | null>(null);
  const [checking, setChecking] = useState(false);
  // Chỉ hiện lỗi "thiếu Serial" SAU khi user đã bấm Lưu ít nhất 1 lần — tránh
  // báo đỏ ngay từ lúc mới mở form (ô Serial nào cũng trống mặc định).
  const [submitAttempted, setSubmitAttempted] = useState(false);
  // Dòng model đang mở camera quét Serial (null = không quét).
  const [scanLineKey, setScanLineKey] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState<StockInState, FormData>(
    createStockInAction,
    null
  );

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  }

  function addLine() {
    setLines((prev) => [...prev, newLine()]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }

  function updateSerial(lineKey: string, index: number, value: string) {
    setLines((prev) =>
      prev.map((line) =>
        line.key !== lineKey
          ? line
          : {
              ...line,
              serials: line.serials.map((s, i) =>
                i === index ? value.slice(0, SERIAL_MAX_LENGTH) : s
              ),
            }
      )
    );
  }

  function addSerial(lineKey: string) {
    setLines((prev) =>
      prev.map((line) =>
        line.key !== lineKey ? line : { ...line, serials: [...line.serials, ""] }
      )
    );
  }

  function removeSerial(lineKey: string, index: number) {
    setLines((prev) =>
      prev.map((line) =>
        line.key !== lineKey || line.serials.length <= 1
          ? line
          : { ...line, serials: line.serials.filter((_, i) => i !== index) }
      )
    );
  }

  // Dán (Ctrl+V) nguyên 1 danh sách nhiều serial (từ Excel, ghi chú...) vào
  // 1 ô — tự tách ra từng ô thay vì nhét hết vào 1 ô rồi bị cắt còn 16 ký
  // tự (mất data). Dán đúng 1 giá trị thì để hành vi mặc định xử lý.
  function handleSerialPaste(
    lineKey: string,
    index: number,
    e: React.ClipboardEvent<HTMLInputElement>
  ) {
    const text = e.clipboardData.getData("text");
    const parts = text
      .split(/[\n\r,;\t]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (parts.length <= 1) return;

    e.preventDefault();

    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== lineKey) return line;

        const nextSerials = [...line.serials];

        parts.forEach((part, i) => {
          const targetIndex = index + i;
          const value = part.slice(0, SERIAL_MAX_LENGTH);

          if (targetIndex < nextSerials.length) {
            nextSerials[targetIndex] = value;
          } else {
            nextSerials.push(value);
          }
        });

        return { ...line, serials: nextSerials };
      })
    );
  }

  // Thêm 1 serial vừa quét vào dòng: điền vào ô trống đầu tiên, hết ô trống
  // thì thêm ô mới.
  const addScannedSerial = useCallback((lineKey: string, serial: string) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== lineKey) return line;
        const value = serial.slice(0, SERIAL_MAX_LENGTH);
        const emptyIndex = line.serials.findIndex((s) => s.trim() === "");
        if (emptyIndex >= 0) {
          return {
            ...line,
            serials: line.serials.map((s, i) => (i === emptyIndex ? value : s)),
          };
        }
        return { ...line, serials: [...line.serials, value] };
      })
    );
  }, []);

  const checkSerialsInSystem = useCallback(async (serials: string[]) => {
    const result = await checkDuplicateSerialsAction(serials);
    return result.existingInSystem;
  }, []);

  // Kiểm tra trùng dựa trên TOÀN BỘ serial của mọi dòng cộng lại — 1 phiếu
  // giờ có thể có nhiều model nên phải gộp chung mới phát hiện được trùng
  // giữa các dòng khác nhau (VD: gõ nhầm cùng 1 serial cho cả MacBook lẫn
  // iPhone).
  async function handleAnyBlur() {
    const allSerials = lines.flatMap((line) =>
      line.serials.map((s) => s.trim()).filter(Boolean)
    );

    if (allSerials.length === 0) {
      setDuplicateCheck(null);
      return;
    }

    setChecking(true);

    try {
      const result = await checkDuplicateSerialsAction(allSerials);
      const hasDuplicates =
        result.duplicatedInInput.length > 0 || result.existingInSystem.length > 0;

      setDuplicateCheck(hasDuplicates ? result : null);
    } catch (error) {
      console.error("CHECK_DUPLICATE_SERIALS_ERROR:", error);
    } finally {
      setChecking(false);
    }
  }

  const linesJson = useMemo(
    () =>
      JSON.stringify(
        lines.map((line) => ({
          modelId: line.modelId,
          serialNumbers: line.serials.map((s) => s.trim()).filter(Boolean),
          hasAdapter: line.hasAdapter,
          hasCable: line.hasCable,
          condition: line.condition,
          damagedNote: line.damagedNote.trim(),
        }))
      ),
    [lines]
  );

  const totalSerials = lines.reduce(
    (sum, line) => sum + line.serials.filter((s) => s.trim()).length,
    0
  );

  // Set (lowercase) toàn bộ serial đang bị coi là trùng — dùng để tô đỏ
  // đúng ô đang lỗi, và để khoá nút Lưu lại cho tới khi user sửa xong.
  const duplicateSerialSet = duplicateCheck
    ? new Set(
        [...duplicateCheck.duplicatedInInput, ...duplicateCheck.existingInSystem].map(
          (s) => s.trim().toLowerCase()
        )
      )
    : null;

  const hasBlockingDuplicate = Boolean(duplicateCheck);

  // Trước đây form cho phép bấm "Lưu phiếu nhập" dù chưa chọn Model hoặc
  // chưa nhập Serial nào (dòng đó âm thầm bị loại bỏ ở server, không báo gì
  // cho user) — giờ chặn ngay ở client + báo rõ dòng nào đang thiếu gì.
  const lineIssues = lines.map((line) => ({
    key: line.key,
    missingModel: !line.modelId,
    missingSerial: line.serials.filter((s) => s.trim()).length === 0,
  }));
  const missingWarranty = stockInType === "NEW_PURCHASE" && !warrantyMonths;
  const missingReturnEmployee = stockInType === "RETURNED" && !returnedFromEmployee;
  const missingReturnReason = stockInType === "RETURNED" && !returnReason;
  const hasMissingField =
    lineIssues.some((issue) => issue.missingModel || issue.missingSerial) ||
    missingWarranty ||
    missingReturnEmployee ||
    missingReturnReason;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (hasMissingField || hasBlockingDuplicate) {
      e.preventDefault();
      setSubmitAttempted(true);
      // Form khá dài — nếu lỗi nằm ở khung cuối trang (gần nút Lưu), user
      // bấm Lưu xong sẽ không thấy gì thay đổi vì banner báo lỗi lại nằm
      // NGAY DƯỚI chỗ họ đang đứng. Cuộn hẳn lên đầu trang để banner báo
      // lỗi (đặt ngay đầu form) luôn lọt vào tầm mắt.
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="linesJson" value={linesJson} />

      {state?.error && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-rose-600" />
          <div className="text-sm text-rose-700">
            <p className="font-bold">Không lưu được phiếu nhập</p>
            <p className="mt-1">{state.error}</p>
          </div>
        </div>
      )}

      {duplicateCheck && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-rose-600" />

          <div className="text-sm text-rose-700">
            <p className="font-bold">Phát hiện Serial Number trùng</p>

            {duplicateCheck.duplicatedInInput.length > 0 && (
              <p className="mt-1">
                Bị lặp trong danh sách vừa nhập:{" "}
                <span className="font-semibold">
                  {duplicateCheck.duplicatedInInput.join(", ")}
                </span>
              </p>
            )}

            {duplicateCheck.existingInSystem.length > 0 && (
              <p className="mt-1">
                Đã tồn tại trong hệ thống:{" "}
                <span className="font-semibold">
                  {duplicateCheck.existingInSystem.join(", ")}
                </span>
              </p>
            )}

            <p className="mt-1 text-rose-500">
              Vui lòng sửa lại trước khi lưu phiếu nhập.
            </p>
          </div>
        </div>
      )}

      {submitAttempted && hasMissingField && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-rose-600" />

          <div className="text-sm text-rose-700">
            <p className="font-bold">Chưa thể lưu phiếu nhập</p>
            <p className="mt-1">
              Còn dòng Model chưa chọn Model hoặc chưa nhập Serial Number
              {missingWarranty && ", hoặc chưa chọn Thời hạn bảo hành"}
              {(missingReturnEmployee || missingReturnReason) &&
                ", hoặc chưa nhập đủ thông tin Thu hồi (từ ai / lý do)"}{" "}
              — vui lòng kiểm tra lại các mục được tô đỏ bên dưới.
            </p>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
            <PackagePlus size={24} />
          </div>

          <div>
            <h3 className="text-xl font-bold text-slate-900">Thông tin nhập kho</h3>
            <p className="text-sm text-slate-500">
              Chọn kho nhập chung, có thể thêm nhiều model khác nhau trong cùng 1 phiếu
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <OptionCard title="Loại nhập kho">
            <Radio
              name="stockInType"
              value="NEW_PURCHASE"
              label="Thiết bị mới"
              checked={stockInType === "NEW_PURCHASE"}
              onChange={() => setStockInType("NEW_PURCHASE")}
            />
            <Radio
              name="stockInType"
              value="RETURNED"
              label="Thu hồi"
              checked={stockInType === "RETURNED"}
              onChange={() => setStockInType("RETURNED")}
            />
          </OptionCard>

          <Field icon={<Warehouse size={18} />} label="Kho nhập" required>
            <select name="warehouseCode" className="input-style" required defaultValue="">
              <option value="" disabled>
                Chọn kho
              </option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.code}>
                  {warehouse.code} - {warehouse.name}
                </option>
              ))}
            </select>
          </Field>

          <Field icon={<Building2 size={18} />} label="Nhà cung cấp">
            <input
              name="vendorName"
              className="input-style"
              placeholder="VD: Apple / Dell / UAE Supplier"
            />
          </Field>

          {/* Chỉ thiết bị mới mới có bảo hành nhà cung cấp — thiết bị Thu hồi
              coi như không còn bảo hành mới nên bỏ hẳn field này, tránh gán
              nhầm bảo hành cho thiết bị cũ. Ngày hết hạn được HỆ THỐNG tự
              tính = ngày nhập kho (hôm nay) + số tháng chọn, không cho tự
              gõ ngày để tránh nhập sai/không khớp với ngày nhập thật. Bắt
              buộc phải chọn — không còn tuỳ chọn "Không có bảo hành". */}
          {stockInType === "NEW_PURCHASE" && (
            <Field icon={<Calendar size={18} />} label="Thời hạn bảo hành" required>
              <select
                name="warrantyMonths"
                required
                className="input-style"
                value={warrantyMonths}
                onChange={(e) => setWarrantyMonths(e.target.value)}
              >
                <option value="" disabled>
                  Chọn thời hạn bảo hành
                </option>
                <option value="12">12 tháng</option>
                <option value="24">24 tháng</option>
                <option value="36">36 tháng</option>
              </select>
              {submitAttempted && missingWarranty && (
                <p className="mt-1.5 text-xs font-semibold text-rose-600">
                  Vui lòng chọn thời hạn bảo hành cho thiết bị mới.
                </p>
              )}
            </Field>
          )}
        </div>

        {stockInType === "RETURNED" && (
          <div className="mt-5 space-y-5">
            <div className="grid grid-cols-2 gap-5">
              <Field icon={<UserRoundSearch size={18} />} label="Thu hồi từ ai" required>
                <EmployeeSelect
                  // Đổi key mỗi khi lựa chọn đổi (đặc biệt sau khi tạo nhanh
                  // 1 nhân viên mới) để ép EmployeeSelect remount sạch, tự
                  // nhận initialSelected mới thay vì giữ state cũ — xem ghi
                  // chú trong EmployeeSelect.tsx.
                  key={returnedFromEmployee?.id ?? "none"}
                  name="returnedFromEmployeeId"
                  employees={returnEmployees}
                  hasError={submitAttempted && missingReturnEmployee}
                  initialSelected={returnedFromEmployee}
                  onSelectedChange={(employee) => setReturnedFromEmployee(employee)}
                />

                <QuickAddEmployeeModal
                  onCreated={(employee) => {
                    setReturnEmployees((prev) =>
                      prev.some((e) => e.id === employee.id) ? prev : [employee, ...prev]
                    );
                    setReturnedFromEmployee(employee);
                  }}
                />

                {submitAttempted && missingReturnEmployee && (
                  <p className="mt-1.5 text-xs font-semibold text-rose-600">
                    Vui lòng chọn nhân viên đã thu hồi thiết bị này.
                  </p>
                )}
              </Field>

              <Field icon={<MessageSquareText size={18} />} label="Lý do thu hồi" required>
                <select
                  name="returnReason"
                  className="input-style"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                >
                  <option value="" disabled>
                    Chọn lý do thu hồi
                  </option>
                  {RETURN_REASONS.map((reason) => (
                    <option key={reason.value} value={reason.value}>
                      {reason.label}
                    </option>
                  ))}
                </select>
                {submitAttempted && missingReturnReason && (
                  <p className="mt-1.5 text-xs font-semibold text-rose-600">
                    Vui lòng chọn lý do thu hồi.
                  </p>
                )}
              </Field>
            </div>

            <Field icon={<ClipboardList size={18} />} label="Ghi chú tình trạng thiết bị">
              <textarea
                name="conditionNote"
                className="min-h-[52px] w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                placeholder="VD: Trầy nhẹ mặt lưng, pin chai còn ~85%, thiếu hộp..."
              />
            </Field>
          </div>
        )}
      </section>

      {lines.map((line, index) => {
        const selectedModel = models.find(
          (model) => String(model.id) === line.modelId
        );
        const serialCount = line.serials.filter((s) => s.trim()).length;

        return (
          <section
            key={line.key}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                  <ClipboardList size={22} />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Model #{index + 1}
                    {serialCount > 0 && (
                      <span className="ml-2 text-sm font-normal text-slate-500">
                        ({serialCount} thiết bị)
                      </span>
                    )}
                  </h3>
                </div>
              </div>

              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(line.key)}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                >
                  <Trash2 size={16} />
                  Xoá dòng
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-5">
              <Field icon={<Laptop size={18} />} label="Model thiết bị" required>
                <ModelSearchSelect
                  models={models}
                  value={line.modelId}
                  onChange={(modelId) => updateLine(line.key, { modelId })}
                />
                {submitAttempted && !line.modelId && (
                  <p className="mt-1.5 text-xs font-semibold text-rose-600">
                    Vui lòng chọn Model cho dòng này.
                  </p>
                )}
              </Field>

              <OptionCard title="Phụ kiện đi kèm">
                <Checkbox
                  label="Adapter"
                  checked={line.hasAdapter}
                  onChange={(checked) => updateLine(line.key, { hasAdapter: checked })}
                />
                <Checkbox
                  label="Cáp sạc"
                  checked={line.hasCable}
                  onChange={(checked) => updateLine(line.key, { hasCable: checked })}
                />
              </OptionCard>
            </div>

            {/* Tình trạng lúc nhập — đánh dấu Hư hỏng nếu máy về/thu hồi đã
                thấy hỏng ngay, để hệ thống tự chuyển thẳng sang trạng thái
                Bảo trì (không tính vào tồn kho khả dụng) thay vì phải vào
                sửa lại thủ công sau khi đã nhập kho như Trong kho bình
                thường rồi mới phát hiện ra. */}
            <div className="mt-5">
              <OptionCard title="Tình trạng lúc nhập">
                <Radio
                  name={`condition-${line.key}`}
                  value="GOOD"
                  label="Tốt"
                  checked={line.condition === "GOOD"}
                  onChange={() => updateLine(line.key, { condition: "GOOD" })}
                />
                <Radio
                  name={`condition-${line.key}`}
                  value="DAMAGED"
                  label="Hư hỏng"
                  checked={line.condition === "DAMAGED"}
                  onChange={() => updateLine(line.key, { condition: "DAMAGED" })}
                />
              </OptionCard>

              {line.condition === "DAMAGED" && (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <label className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-800">
                    <TriangleAlert size={16} />
                    Mô tả tình trạng hư hỏng
                  </label>
                  <textarea
                    value={line.damagedNote}
                    onChange={(e) =>
                      updateLine(line.key, { damagedNote: e.target.value })
                    }
                    className="min-h-[52px] w-full rounded-lg border border-amber-200 bg-white px-4 py-3 text-sm outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                    placeholder="VD: Vỡ màn hình, không lên nguồn..."
                  />
                  <p className="mt-1.5 text-xs text-amber-700">
                    Các thiết bị ở dòng này sẽ được lưu ở trạng thái{" "}
                    <span className="font-semibold">Bảo trì</span> (không tính vào tồn
                    kho khả dụng) và hiện ở trang Theo dõi sửa chữa.
                  </p>
                </div>
              )}
            </div>

            {selectedModel && (
              <div className="mt-5 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900">
                      {selectedModel.brand} {selectedModel.modelName}
                    </h4>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedModel.modelCode ?? "Chưa có Model Code"} ·{" "}
                      {selectedModel.category.name}
                    </p>
                  </div>

                  <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">
                    {selectedModel._count.assets} thiết bị hiện có
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <InfoBox icon={<Cpu />} label="CPU" value={selectedModel.defaultCpu ?? "-"} />
                  <InfoBox icon={<HardDrive />} label="RAM" value={selectedModel.defaultRam ?? "-"} />
                  <InfoBox icon={<HardDrive />} label="SSD" value={selectedModel.defaultStorage ?? "-"} />
                  <InfoBox icon={<Monitor />} label="Screen" value={selectedModel.defaultScreen ?? "-"} />
                  <InfoBox icon={<Cpu />} label="GPU" value={selectedModel.defaultGpu ?? "-"} />
                </div>
              </div>
            )}

            <div className="mt-5">
              <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                Danh sách Serial <span className="text-red-500">*</span>
              </label>

              <div className="flex flex-wrap gap-2">
                {line.serials.map((serial, sIndex) => {
                  const isDuplicate =
                    duplicateSerialSet !== null &&
                    serial.trim() !== "" &&
                    duplicateSerialSet.has(serial.trim().toLowerCase());
                  const isEmptyError =
                    submitAttempted && serialCount === 0 && serial.trim() === "";

                  return (
                    <div
                      key={sIndex}
                      className={`flex items-center overflow-hidden rounded-lg border bg-slate-50 focus-within:bg-white focus-within:ring-4 ${
                        isDuplicate || isEmptyError
                          ? "border-rose-400 bg-rose-50 focus-within:border-rose-500 focus-within:ring-rose-100"
                          : "border-slate-200 focus-within:border-blue-400 focus-within:ring-blue-100"
                      }`}
                      title={
                        isDuplicate
                          ? "Serial này đang bị trùng"
                          : isEmptyError
                          ? "Không được để trống Serial Number"
                          : undefined
                      }
                    >
                      <input
                        value={serial}
                        maxLength={SERIAL_MAX_LENGTH}
                        onChange={(e) =>
                          updateSerial(line.key, sIndex, e.target.value)
                        }
                        onPaste={(e) => handleSerialPaste(line.key, sIndex, e)}
                        onBlur={handleAnyBlur}
                        placeholder={`SN${sIndex + 1}`}
                        className={`w-28 bg-transparent px-3 py-2 text-sm outline-none ${
                          isDuplicate ? "text-rose-700" : ""
                        }`}
                      />

                      {line.serials.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSerial(line.key, sIndex)}
                          className="px-1.5 text-slate-300 hover:text-rose-500"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={() => addSerial(line.key)}
                  className="flex h-[38px] w-10 items-center justify-center rounded-lg border border-dashed border-blue-300 text-blue-500 hover:bg-blue-50"
                  title="Thêm ô Serial"
                >
                  <Plus size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => setScanLineKey(line.key)}
                  className="flex h-[38px] items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
                  title="Quét mã vạch / QR Serial bằng camera"
                >
                  <ScanLine size={16} />
                  Quét mã
                </button>
              </div>

              <p className="mt-2 text-xs text-slate-400">
                Tối đa {SERIAL_MAX_LENGTH} ký tự mỗi ô. Có thể dán (Ctrl+V) nhiều
                serial cùng lúc — sẽ tự tách ra từng ô, hoặc bấm <b>Quét mã</b> để quét
                mã vạch / QR Serial bằng camera.
              </p>

              {submitAttempted && serialCount === 0 && (
                <p className="mt-1.5 text-xs font-semibold text-rose-600">
                  Không được để trống Serial Number — vui lòng nhập ít nhất 1 Serial.
                </p>
              )}
            </div>

            {scanLineKey === line.key && (
              <SerialScannerModal
                title={
                  selectedModel
                    ? `Model #${index + 1}: ${selectedModel.brand} ${selectedModel.modelName}`
                    : `Model #${index + 1}`
                }
                maxLength={SERIAL_MAX_LENGTH}
                defaultStripApplePrefix={selectedModel?.brand.trim().toLowerCase() === "apple"}
                existingInForm={
                  new Map(
                    lines.flatMap((l) =>
                      l.serials
                        .map((s) => s.trim().toLowerCase())
                        .filter(Boolean)
                        .map((s) => [s, l.key === line.key ? "line" : "other"] as const)
                    )
                  )
                }
                onAdd={(serial) => addScannedSerial(line.key, serial)}
                checkInSystem={checkSerialsInSystem}
                onClose={() => {
                  setScanLineKey(null);
                  // Kiểm tra trùng toàn phiếu (cả với hệ thống) như khi gõ tay.
                  void handleAnyBlur();
                }}
              />
            )}
          </section>
        );
      })}

      <button
        type="button"
        onClick={addLine}
        className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-blue-300 bg-blue-50/50 px-5 py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50"
      >
        <Plus size={18} />
        Thêm model khác vào cùng phiếu này
      </button>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Tổng cộng <span className="font-bold text-slate-900">{totalSerials}</span>{" "}
          thiết bị trong <span className="font-bold text-slate-900">{lines.length}</span>{" "}
          model
          {/* Hiện CÙNG dòng (không chèn 1 dòng mới phía trên nút Lưu) — trước
              đây dòng "Đang kiểm tra trùng..." chèn thêm làm nút Lưu bị đẩy
              xuống giữa lúc đang bấm, cú click đầu rơi ra ngoài nút. */}
          {checking && <span className="ml-2 text-slate-400">· Đang kiểm tra trùng...</span>}
        </p>

        <div className="flex gap-3">
          <Link
            href="/assets"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <X size={18} />
            Hủy
          </Link>

          {/* LỖI CŨ "bấm Lưu lần 1 không phản ứng": đang ở ô Serial mà bấm
              Lưu -> ô Serial mất focus (blur) NGAY lúc nhấn chuột -> chạy
              kiểm tra trùng -> nút bị disable (checking) + layout xê dịch ->
              cú click bị nuốt, phải bấm lần 2. Sửa: (1) chặn mất focus khi
              nhấn chuột vào nút (onMouseDown preventDefault) nên không chạy
              kiểm tra trùng chen ngang; (2) KHÔNG disable nút trong lúc đang
              kiểm tra — server vẫn kiểm tra trùng Serial lần cuối khi lưu
              (createStockInAction) và báo lỗi rõ ràng nếu có. */}
          <button
            type="submit"
            onMouseDown={(e) => e.preventDefault()}
            disabled={hasBlockingDuplicate || isPending}
            title={
              hasBlockingDuplicate
                ? "Vui lòng sửa các Serial Number bị trùng trước khi lưu"
                : undefined
            }
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
          >
            <Save size={18} />
            {isPending ? "Đang lưu..." : "Lưu phiếu nhập"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Field({
  icon,
  label,
  required,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
        <span className="text-slate-400">{icon}</span>
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function InfoBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-2 text-blue-500">{icon}</div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-900">{value}</p>
    </div>
  );
}

function OptionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <p className="mb-4 font-bold text-slate-800">{title}</p>
      <div className="flex gap-6 text-sm">{children}</div>
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 font-medium text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-blue-600"
      />
      {label}
    </label>
  );
}

function Radio({
  name,
  value,
  label,
  checked,
  onChange,
}: {
  name: string;
  value: string;
  label: string;
  checked?: boolean;
  onChange?: () => void;
}) {
  return (
    <label className="flex items-center gap-2 font-medium text-slate-700">
      <input
        name={name}
        type="radio"
        value={value}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-blue-600"
      />
      {label}
    </label>
  );
}
