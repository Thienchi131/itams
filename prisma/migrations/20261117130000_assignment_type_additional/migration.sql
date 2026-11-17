-- AlterEnum: thêm loại cấp phát "Cấp thêm thiết bị cho nhân viên" (ADDITIONAL)
-- — nhân viên đã có máy, cấp thêm 1 máy chính thức nữa; không có hạn cảnh báo
-- (giống PERMANENT), tách riêng để thống kê "cấp mới" vs "cấp thêm".
ALTER TYPE "AssignmentType" ADD VALUE 'ADDITIONAL';
