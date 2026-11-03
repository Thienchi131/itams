import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { signSession, verifySession, SESSION_MAX_AGE_MS } from "@/lib/session";

// Fixed-cost bcrypt hash with no matching plaintext, used so that login()
// takes the same time whether or not the account exists (prevents timing
// based user/email enumeration).
const DUMMY_HASH =
  "$2b$10$LU9oQToK/3QxBpU1jRLXO.H.XM6BmhhBzMey9vCB6tE64jYit6rhy";

export async function login(
  email: string,
  password: string,
  remember: boolean = false
) {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      username: normalizedEmail,
    },
    include: {
      role: true,
    },
  });

  const isPasswordValid = await bcrypt.compare(
    password,
    user?.password ?? DUMMY_HASH
  );

  if (!user || !isPasswordValid) {
    return null;
  }

  const cookieStore = await cookies();

  // Cookie "Secure" chỉ được trình duyệt lưu khi truy cập qua HTTPS — nếu
  // domain chưa gắn SSL (đang chạy HTTP thường) mà vẫn set Secure=true, cookie
  // đăng nhập sẽ bị trình duyệt âm thầm từ chối lưu, gây hiện tượng đăng nhập
  // "lúc được lúc mất" rất khó chẩn đoán. Cho phép tắt qua biến môi trường
  // COOKIE_SECURE=false trong lúc chưa có HTTPS; khi đã gắn SSL thì bỏ biến
  // này đi (hoặc set = true) để cookie an toàn trở lại.
  const isSecureCookie =
    process.env.COOKIE_SECURE === "false"
      ? false
      : process.env.NODE_ENV === "production";

  // Phiên đăng nhập LUÔN hết hạn sau 2 giờ (verifySession() tự chặn token
  // cũ hơn SESSION_MAX_AGE_MS, kể cả khi tick "Ghi nhớ đăng nhập"). Cookie
  // maxAge ở đây chỉ quyết định việc cookie có sống sót qua việc đóng/mở lại
  // trình duyệt hay không trong khoảng thời gian đó — không tick thì cookie
  // là session-cookie kèm thêm trần cứng 2 giờ cho gọn; tick thì giữ cookie
  // tới 30 ngày nhưng vẫn bị buộc đăng nhập lại sau 2 giờ như đã thống nhất.
  const REMEMBER_ME_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
  const DEFAULT_MAX_AGE_SECONDS = SESSION_MAX_AGE_MS / 1000;

  // twoFactorVerified LUÔN bắt đầu là false ở đây, kể cả khi tài khoản đã
  // bật 2FA từ trước — đây là phiên đăng nhập MỚI, phải xác thực TOTP lại,
  // không được kế thừa trạng thái "đã xác thực" từ phiên cũ. requireLogin()
  // sẽ đá qua /setup-2fa hoặc /verify-2fa cho tới khi bước này hoàn tất.
  cookieStore.set("userId", signSession(user.id, false), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureCookie,
    maxAge: remember ? REMEMBER_ME_MAX_AGE_SECONDS : DEFAULT_MAX_AGE_SECONDS,
  });

  return user;
}

// Dùng bởi /setup-2fa (vừa thiết lập xong lần đầu) và /verify-2fa (vừa nhập
// đúng mã) để "nâng cấp" phiên hiện tại thành đã xác thực 2FA — không tạo
// session mới, chỉ ký lại cookie với cùng userId nhưng twoFactorVerified=true.
// Cố tình dùng maxAge mặc định (không phải remember-me 30 ngày) vì token
// không lưu lại lựa chọn "Ghi nhớ đăng nhập" ban đầu — chấp nhận đánh đổi nhỏ
// này để không phải luồn thêm state giữa các bước, phiên vẫn bị chặn cứng ở
// 2 giờ như bình thường nên không ảnh hưởng bảo mật.
export async function upgradeSessionTo2FAVerified(userId: number) {
  const cookieStore = await cookies();

  const isSecureCookie =
    process.env.COOKIE_SECURE === "false"
      ? false
      : process.env.NODE_ENV === "production";

  cookieStore.set("userId", signSession(userId, true), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureCookie,
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("userId")?.value;
  const session = verifySession(token);

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.userId,
    },
    include: {
      role: true,
      region: { include: { warehouses: true } },
      warehouse: true,
      // Danh sách kho bổ sung gán tay ngoài region/warehouse — xem ghi chú
      // ở UserWarehouseAccess trong schema.prisma. Dùng cho case cần xem
      // nhiều kho cắt ngang nhiều Region (VD kế toán).
      warehouseAccess: { select: { warehouseId: true } },
    },
  });

  if (!user) return null;

  const customWarehouseIds = user.warehouseAccess.map((w) => w.warehouseId);

  // regionWarehouseIds: null = không giới hạn (Admin, hoặc tài khoản chưa
  // được gán Region/Warehouse/danh sách bổ sung nào — coi như xem hết). Ưu
  // tiên warehouseId (phạm vi hẹp — CHỈ 1 kho lẻ, dùng cho nhân viên phụ
  // trách 1 kho cụ thể) trước regionId (phạm vi rộng — cả khu vực, dùng cho
  // Lead). Có Region/Warehouse nhưng Region đó chưa có kho nào thì trả mảng
  // rỗng — cố tình KHÔNG coi là "không giới hạn", đúng ý "chưa cấu hình xong
  // thì chưa thấy gì" thay vì lỡ tay mở toang quyền xem.
  //
  // Nếu KHÔNG có warehouseId lẫn region nhưng CÓ danh sách kho bổ sung (case
  // kế toán: không khoá theo 1 Region/Warehouse nào cả, chỉ có tổ hợp kho
  // tuỳ chọn) thì dùng thẳng danh sách đó làm phạm vi — nếu không, user này
  // sẽ rơi vào nhánh "null = không giới hạn" và vô tình thấy TẤT CẢ kho thay
  // vì chỉ đúng những kho được chọn.
  let regionWarehouseIds = user.warehouseId
    ? [user.warehouseId]
    : user.region
      ? user.region.warehouses.map((w) => w.id)
      : customWarehouseIds.length > 0
        ? customWarehouseIds
        : null;

  if (regionWarehouseIds !== null) {
    // Cộng thêm danh sách kho bổ sung vào phạm vi hiện có — cho phép kết hợp
    // (VD user vừa phụ trách 1 Region vừa được cấp thêm 1-2 kho ngoài Region
    // đó), không chỉ dùng khi đây là nguồn DUY NHẤT (nhánh else ở trên).
    if (customWarehouseIds.length > 0) {
      regionWarehouseIds = [
        ...new Set([...regionWarehouseIds, ...customWarehouseIds]),
      ];
    }

    // Kho đánh dấu "dùng chung" (isShared) phải luôn lọt vào phạm vi xem của
    // MỌI tài khoản, kể cả đang bị giới hạn theo Region/1 Warehouse — dùng
    // cho các kho kiểu "Kho máy huỷ" mà ai cũng cần thấy/chuyển máy vào,
    // không thuộc riêng khu vực nào. Tài khoản không giới hạn
    // (regionWarehouseIds đang null) đã thấy hết rồi nên bỏ qua, không cần
    // query thêm.
    const sharedWarehouses = await prisma.warehouse.findMany({
      where: { isShared: true },
      select: { id: true },
    });

    if (sharedWarehouses.length > 0) {
      regionWarehouseIds = [
        ...new Set([...regionWarehouseIds, ...sharedWarehouses.map((w) => w.id)]),
      ];
    }
  }

  // twoFactorVerified thuộc về PHIÊN (cookie), không phải tài khoản — gắn
  // thêm vào đây để requireLogin() có đủ thông tin quyết định có cần đá qua
  // /verify-2fa hay không mà không phải verifySession() lại lần nữa.
  return { ...user, twoFactorVerified: session.twoFactorVerified, regionWarehouseIds };
}

export async function requireLogin(options?: {
  skipPasswordCheck?: boolean;
  skip2FACheck?: boolean;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Tài khoản mới tạo (hoặc vừa bị Admin reset password) phải đổi mật khẩu
  // trước khi được dùng bất kỳ trang nào khác. `skipPasswordCheck` chỉ dùng
  // bởi chính trang /change-password để tránh redirect lặp vô hạn.
  if (user.mustChangePassword && !options?.skipPasswordCheck) {
    redirect("/change-password");
  }

  // 2FA bắt buộc với MỌI tài khoản — chỉ kiểm tra sau khi đã qua bước đổi
  // mật khẩu (nếu có) để không dồn 2 bước bắt buộc chồng lên nhau cùng lúc.
  // `skip2FACheck` chỉ dùng bởi chính /setup-2fa và /verify-2fa để tránh
  // redirect lặp vô hạn vào chính nó.
  if (!user.mustChangePassword && !options?.skip2FACheck) {
    if (!user.twoFactorEnabled) {
      redirect("/setup-2fa");
    }

    if (!user.twoFactorVerified) {
      redirect("/verify-2fa");
    }
  }

  return user;
}

export async function requireRole(roles: string[]) {
  const user = await requireLogin();

  if (!roles.includes(user.role.name)) {
    // Trước đây đá thẳng về trang mặc định của role (thường là "/") mà
    // không giải thích gì — trông như link chết. Nay đá qua trang thông báo
    // rõ lý do; trang đó tự tính lại route mặc định đúng cho role, nên
    // không có rủi ro lặp redirect vô hạn (access-denied không tự gọi lại
    // requireRole).
    redirect("/access-denied");
  }

  return user;
}

// Dùng trong các server action thao tác trên 1 asset/supply cụ thể (bàn
// giao, thu hồi, luân chuyển kho, cấp thêm thiết bị, nhập/xuất vật tư...).
// Trang chi tiết/employee panel đã lọc theo kho ở UI rồi, nhưng đó chỉ là
// ẩn/hiện — 1 tài khoản bị gán Region vẫn có thể gọi thẳng server action với
// id thuộc kho ngoài Region nếu không chặn ở đây. Admin/tài khoản chưa gán
// Region (regionWarehouseIds = null) không bị giới hạn.
export function assertWarehouseScope(
  currentUser: { regionWarehouseIds: number[] | null },
  targetWarehouseId: number | null
) {
  if (
    currentUser.regionWarehouseIds &&
    (targetWarehouseId === null ||
      !currentUser.regionWarehouseIds.includes(targetWarehouseId))
  ) {
    throw new Error(
      "Thiết bị này không thuộc khu vực bạn được phân quyền quản lý."
    );
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("userId");

  redirect("/login");
}