# IT Portal - Asset Management Blueprint

## 1. Mục tiêu

IT Portal là hệ thống nội bộ cho team IT quản lý tài sản, nhân viên, nhập kho, xuất kho, thu hồi, điều chuyển và bảo hành.

Version 1 tập trung vào module Asset Management.

---

## 2. Phạm vi Version 1

### Có trong V1

- Dashboard
- Quản lý tài sản
- Quản lý nhân viên
- Nhập kho theo phiếu
- Xuất kho theo phiếu
- Thu hồi thiết bị
- Điều chuyển thiết bị
- Theo dõi bảo hành
- Phụ kiện đi kèm: Adapter, Cáp sạc
- Import Excel
- Export Excel/CSV
- Nhật ký thiết bị
- Phân quyền Admin / IT / Viewer

### Chưa làm trong V1

- QR Code
- BOT app chat
- Ticket IT
- License
- SIM
- MDM integration

---

## 3. Quy ước mã tài sản

Asset Tag format:

IT-DDMMYY-0000001

Ví dụ:

IT-260626-0000001

Serial Number là mã của hãng.
Asset Tag là mã nội bộ của công ty.

---

## 4. Luồng nghiệp vụ

### Nhập kho

Tạo phiếu nhập → Chọn ngày nhập → Chọn vendor → Chọn kho → Thêm nhiều thiết bị → Lưu.

### Xuất kho

Tạo phiếu xuất → Chọn nhân viên → Tự lấy Team/Chức vụ → Chọn thiết bị → Tick Adapter/Cáp sạc → Lưu.

### Thu hồi

Chọn nhân viên → Hiện thiết bị đang giữ → IT kiểm tra Serial/Cấu hình/Adapter/Cáp sạc → Hoàn tất → Sinh form text để copy vào app chat.

### Điều chuyển

Chọn thiết bị → Chuyển từ nhân viên A sang nhân viên B hoặc từ kho A sang kho B → Lưu lịch sử.

---

## 5. Thiết kế database chính

Master Data:

- users
- roles
- employees
- teams
- positions
- warehouses
- vendors
- asset_categories
- asset_models

Asset:

- assets
- asset_accessories
- asset_warranties

Transaction:

- stock_in_slips
- stock_in_items
- stock_out_slips
- stock_out_items
- asset_histories

---

## 6. Import Excel

Import Excel phải có các bước:

1. Upload file
2. Preview dữ liệu
3. Validate lỗi
4. Confirm import

Quy tắc:

- Serial Number không được trùng
- Asset Tag không được trùng
- Nếu thiếu Asset Tag thì hệ thống tự sinh
- Nếu Model chưa có thì tự tạo
- Nếu Warehouse chưa có thì tự tạo
- Nếu Employee Code tồn tại thì gán thiết bị cho nhân viên
- Nếu có Warranty End Date thì tạo dữ liệu bảo hành
- Nếu Adapter/Cáp sạc là Yes/Có/1 thì lưu phụ kiện

---

## 7. Hiệu năng

Hệ thống phải hỗ trợ tối thiểu:

- 10.000+ thiết bị
- 20+ user IT/Admin
- Tìm kiếm nhanh theo Asset Tag, Serial Number, Employee, Model, Status
- Có phân trang ở các danh sách lớn

Các trường cần index:

- assetTag
- serialNumber
- status
- currentEmployeeId
- warehouseId
- modelId
- employeeCode
- fullName

---

## 8. Roadmap

### Sprint 1

- Cài môi trường
- Tạo Next.js
- Tạo UI cơ bản
- PostgreSQL
- Prisma

### Sprint 2

- Seed dữ liệu mẫu
- Đọc dữ liệu thật từ database
- Asset list
- Employee list

### Sprint 3

- Thêm/Sửa tài sản
- Search
- Pagination
- Import Excel cơ bản

### Sprint 4

- Nhập kho
- Xuất kho
- Thu hồi
- Form bàn giao text

### Sprint 5

- Dashboard thật
- Export Excel
- Deploy VPS