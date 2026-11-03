/**
 * Quyết định field nào trong panel "Cấu hình" nên hiển thị theo TÊN CATEGORY
 * của thiết bị — trước đây trang chi tiết render cứng CPU/RAM/SSD/Màn hình/
 * GPU/Màu cho MỌI loại, khiến iPhone/iPad/YubiKey/Màn hình... hiện toàn "-".
 *
 * Category là dữ liệu tự do (MasterOption, Admin có thể thêm loại mới bất kỳ
 * lúc nào) nên dùng khớp từ khoá (không phân biệt hoa/thường, có dấu/không
 * dấu cơ bản) thay vì enum cố định — loại chưa từng gặp (VD: Router, UPS...)
 * sẽ rơi vào nhánh mặc định (ẩn hết specs máy tính, không đoán bừa).
 *
 * PA1: chỉ ẩn/hiện + đổi nhãn ở UI, KHÔNG đổi schema — field vẫn là
 * actualCpu/actualRam/actualStorage/actualScreen/actualGpu/color như cũ.
 */

export type AssetFieldProfile = {
  showCpu: boolean;
  cpuLabel: string;
  showRam: boolean;
  showStorage: boolean;
  storageLabel: string;
  showScreen: boolean;
  showGpu: boolean;
  showColor: boolean;
};

const LAPTOP_KEYWORDS = ["laptop", "macbook"];
const PHONE_TABLET_KEYWORDS = ["iphone", "ipad", "dien thoai", "điện thoại", "phone", "tablet"];
const SCREEN_KEYWORDS = ["man hinh", "màn hình", "monitor", "display"];

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/đ/g, "d") // "đ" không tách được bằng NFD như các ký tự có dấu khác
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // bỏ dấu tiếng Việt để so khớp từ khoá không dấu
}

export function getAssetFieldProfile(categoryName?: string | null): AssetFieldProfile {
  const name = normalize(categoryName ?? "");

  if (LAPTOP_KEYWORDS.some((k) => name.includes(k))) {
    return {
      showCpu: true,
      cpuLabel: "CPU",
      showRam: true,
      showStorage: true,
      storageLabel: "SSD",
      showScreen: true,
      showGpu: true,
      showColor: true,
    };
  }

  if (PHONE_TABLET_KEYWORDS.some((k) => name.includes(k))) {
    return {
      showCpu: true,
      cpuLabel: "Chip",
      showRam: false,
      showStorage: true,
      storageLabel: "Dung lượng",
      showScreen: true,
      showGpu: false,
      showColor: true,
    };
  }

  // Phụ kiện/thiết bị đơn giản (YubiKey, Wacom, Màn hình rời, và mọi loại
  // chưa định nghĩa trước — Router, UPS, máy in...) — ẩn hết specs kiểu máy
  // tính, chỉ giữ Màn hình (nếu đúng là loại màn hình) + Màu sắc.
  return {
    showCpu: false,
    cpuLabel: "CPU",
    showRam: false,
    showStorage: false,
    storageLabel: "SSD",
    showScreen: SCREEN_KEYWORDS.some((k) => name.includes(k)),
    showGpu: false,
    showColor: true,
  };
}
