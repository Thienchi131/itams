# ITAMS — Nhật ký công việc

Ghi lại toàn bộ tính năng, sửa lỗi và thay đổi đã thực hiện cho hệ thống ITAMS (IT Asset Management System), để tra cứu nhanh thay vì lục lại lịch sử chat. Cập nhật gần nhất: 2026-08-17.

## Nền tảng & Kiến trúc

- Next.js + Prisma + PostgreSQL, deploy bằng Docker Compose trên VPS (175.100.28.81).
- Custom `server.js` để lấy đúng IP client thật + enforce IP whitelist.
- Region + Warehouse scoping: mỗi user chỉ thấy dữ liệu thuộc Region/Kho được gán, cộng thêm cơ chế cấp quyền truy cập nhiều kho tùy chỉnh (`UserWarehouseAccess`) và khái niệm "kho dùng chung" (shared warehouse) hiển thị cho tất cả mọi người.
- Session + bảo mật: đăng nhập bắt buộc 2FA (TOTP), session hết hạn tuyệt đối sau 2 giờ, giới hạn tốc độ đăng nhập (rate limiting), ghi log các lần đăng nhập.
- **Component phân trang dùng chung (2026-08-17):** thêm `src/app/components/Pagination.tsx`, dùng lại ở 5 trang danh sách (Tài sản, Nhân viên, Hoạt động, Nhật ký thao tác, Nhật ký đăng nhập) — ngoài nút "Trước"/"Sau" giờ hiện thêm tối đa 5 nút số trang (cửa sổ trượt quanh trang hiện tại) để nhảy qua lại giữa các trang nhanh hơn khi danh sách có rất nhiều trang.

## Quản lý tài sản (Assets)

- CRUD tài sản đầy đủ: nhập kho (stock-in, hỗ trợ nhiều model trong 1 phiếu), cấp phát, thu hồi, chuyển kho, sửa thông tin, xóa (chỉ Admin, bắt buộc nhập lý do + ghi audit log).
- Nhập kho hỗ trợ nhiều serial/model cùng lúc, cảnh báo trùng Serial Number ngay khi nhập, validate bắt buộc chọn Model + Serial trước khi lưu.
- Thêm trường "Thời hạn bảo hành" bắt buộc khi nhập thiết bị mới (12/24/36 tháng), ngày hết hạn hệ thống tự tính.
- **Tình trạng lúc nhập (2026-07-29):** thêm lựa chọn Tốt / Hư hỏng cho từng dòng model khi nhập kho — máy đánh dấu Hư hỏng tự chuyển thẳng sang trạng thái Bảo trì (không tính vào tồn kho khả dụng), tự tạo lịch sử sửa chữa để hiện ở trang Theo dõi sửa chữa.
- Trang sửa tài sản giới hạn chỉ Admin, cho phép đổi cả Model gán cho thiết bị.
- Ẩn các trường không liên quan (CPU/RAM/GPU...) với thiết bị không phải laptop.
- QR Code thiết bị: đã làm nhưng đang ẩn theo yêu cầu (chưa cần dùng, không xóa code).
- Timeline lịch sử thiết bị giới hạn hiển thị 10 dòng gần nhất + link "Xem tất cả".
- Export danh sách tài sản ra CSV: có thông báo hoàn tất + tự đóng popup, thêm cột "Tình trạng" để kế toán biết máy nào hư hỏng.
- **Thêm hàng loạt vào Kho thanh lý (2026-09-30):** nút "Thêm thiết bị" trên trang Kho thanh lý (Admin/IT) — dán danh sách Asset Tag/Serial (tối đa 1000 mã, copy thẳng cột Excel được) + 1 lý do chung, bấm Kiểm tra để xem trước máy hợp lệ/bị loại kèm lý do (không tìm thấy, đang cấp phát, đã ở kho thanh lý, đang luân chuyển, ngoài khu vực phân quyền), rồi xác nhận chuyển cả lô sang Chờ thanh lý trong 1 transaction. Chỉ nhận máy Trong kho hoặc Bảo trì; ghi AssetHistory RETIRE cho từng máy.
- Import Excel: đọc theo template DXB cố định cột, báo rõ dòng nào bị bỏ qua và vì sao, validate tiêu đề cột đúng template chuẩn trước khi đọc dữ liệu (tránh đọc nhầm file sai mẫu), có thể bật/tắt tính năng này qua Cài đặt (Admin).

## Sửa chữa / Bảo hành

- Gửi thiết bị đi sửa chữa/bảo hành (chuyển trạng thái Bảo trì) và "Hoàn tất sửa chữa" để trả về Trong kho.
- Trang Theo dõi sửa chữa (`/assets/warranty`): liệt kê thiết bị đang Bảo trì, hiện số ngày đã gửi, cảnh báo đỏ khi quá 14 ngày chưa hoàn tất.

## Model Library (Danh mục thiết bị)

- Mọi role đều xem được danh sách Model; chỉ Admin được thêm/sửa/xóa.
- Chặn tạo trùng Model Code ngay khi submit (báo lỗi rõ ràng thay vì crash trang).
- Nút Xóa tự ẩn/khóa khi Model đó vẫn còn thiết bị đang gắn.

## Vật tư (Supplies)

- Trang danh sách, tạo mới, chi tiết, nhập/xuất kho, sửa vật tư.
- Admin có nút xóa vật tư, chỉ bật khi tồn kho = 0, bắt buộc nhập lý do + ghi audit log.
- Chặn cứng xuất kho vượt số lượng tồn.

## Nhân viên (Employees)

- Trang chi tiết nhân viên: panel thiết bị đang giữ, thao tác cấp phát/thu hồi/chuyển kho ngay tại đó.
- Gộp hồ sơ nhân viên trùng (do gõ nhầm tên lúc import): chuyển toàn bộ lịch sử/tài sản sang hồ sơ chính trước khi xóa bản trùng, không mất dữ liệu.
- Phân trang danh sách nhân viên.

## Dashboard

- 7 thẻ thống kê theo phạm vi Region/Kho của từng user, các thẻ có thể bấm để lọc sang trang Tài sản (giữ đúng phạm vi kho/region đang chọn).
- Sửa lỗi thẻ "Chưa được cấp phát" bị mất phạm vi kho khi bấm vào.
- Bố cục 2 khung cân đối, khung danh sách kho có giới hạn chiều cao + cuộn thay vì kéo dài khung bên cạnh.

## Thông báo & Audit log

- Chuông thông báo ở topbar: đếm đúng số chưa đọc, không bị hiện lại badge sai sau khi điều hướng trang.
- Trang nhật ký hoạt động (activity log) cho các thao tác nhạy cảm ngoài phạm vi tài sản (xóa user, reset mật khẩu, reset 2FA, xóa tài sản/vật tư...).

## Quản lý người dùng & Bảo mật hệ thống

- Tạo/sửa user với Region + danh sách kho tùy chỉnh.
- Admin: reset mật khẩu, reset 2FA, xóa user — có popup xác nhận tự đóng sau khi thao tác xong.
- Trang quản lý IP Whitelist (Admin), trang quản lý Kho/Region.
- Trang cài đặt bật/tắt tính năng Import Excel.
- Trang theo dõi sức khỏe VPS (CPU/RAM/Swap).

## Hạ tầng & Vận hành VPS

- Đã chuẩn bị đầy đủ artifact Docker + `.env.production` template + hướng dẫn tạo secret + runbook triển khai.
- Deploy chuẩn: `rsync -avz --exclude .env --exclude node_modules --exclude .next -e "ssh -p 22000" ./ it-hd@175.100.28.81:~/itams/` rồi `docker compose up -d --build`. Lưu ý `docker compose restart` KHÔNG reload `.env`, phải dùng `up -d --force-recreate`.
- Đã seed 11 kho vào DB production, seed dữ liệu MasterOption còn thiếu.
- Đã cấu hình backup định kỳ + swapfile trên VPS.
- Hướng dẫn đổi mail cấp App Password cho SMTP (Gmail) khi mail cũ bị khóa — thay đổi chỉ nằm ở `.env`, không ảnh hưởng user hiện có.

## Các lỗi đã sửa gần đây (rà soát chủ động theo kịch bản người dùng thực tế)

- Tạo trùng Model Code từng làm crash trang thay vì báo lỗi rõ ràng — đã chặn và báo lỗi trước khi lưu.
- Thiết bị gửi sửa chữa xong quên bấm "Hoàn tất sửa chữa" sẽ kẹt mãi ở Bảo trì mà không ai biết — đã thêm cảnh báo quá hạn 14 ngày ở trang Theo dõi sửa chữa.
- File Excel import sai template (đúng định dạng nhưng khác cấu trúc cột) từng bị đọc nhầm âm thầm — đã thêm validate tiêu đề cột, báo lỗi rõ ràng nếu không khớp mẫu chuẩn.
- Popup xác nhận (reset mật khẩu/2FA/xóa) không tự đóng sau khi thao tác thành công — đã sửa.

## Đã rà soát và xác nhận ổn (không cần sửa)

- Mở 2 tab cùng sửa 1 thiết bị: hiếm gặp (chỉ Admin sửa được), chưa cần khóa xung đột.
- Tìm kiếm/phân trang danh sách tài sản: có debounce 500ms, phân trang server-side, không bị chậm khi dữ liệu lớn.
- Xuất kho vật tư vượt tồn: đã chặn cứng ở server, không chỉ cảnh báo.
- Gộp nhân viên trùng: không mất lịch sử thiết bị vì luôn chuyển dữ liệu trước khi xóa bản trùng.
