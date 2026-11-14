# Nghiệm thu trình duyệt: Dashboard lịch khám và popup lịch hẹn

Chạy `npx next dev -p 3101`, mở `http://localhost:3101/dashboard` bằng Playwright (Chromium). Dữ liệu giả trong `data/clinic/`, ngày thử là 14/11/2026 (ngày chạy). Ảnh chụp lưu ngoài repo. Chỉ ghi PASS khi đã chạy thật.

Phạm vi file này: Task 3 (dashboard) và Task 4 (popup lịch hẹn) của plan Dashboard và Bệnh nhân, ứng với nghiệm thu 1, 2, 3, 8 của thiết kế. Nghiệm thu 4 đến 7 thuộc hồ sơ bệnh nhân và nút tạo phiếu (Task 5, 6), chưa nằm ở đây.

## Task 3: Dashboard

| # | Kiểm tra | Kết quả |
| --- | --- | --- |
| 3.1 | Bộ 8 ca: tổng 8, Hoàn thành 2/8, Còn lại 4/8, Đang khám / chờ kết quả 2/8, Ca hủy 1, Kết thúc khác 1, Chưa xác định 0 | PASS (đọc từ trang thật) |
| 3.2 | Mỗi khối có list thật: đúng 2 / 4 / 2 dòng, mỗi dòng đúng mã LK-00000x và PID giữ số 0 đầu (000123...) | PASS |
| 3.3 | Nhãn "Đang khám / chờ kết quả" ghi rõ "Nằm trong số Còn lại, không cộng thêm"; ca 10:00 và 13:30 xuất hiện ở cả Còn lại và khối này | PASS |
| 3.4 | Mặc định tối đa 5 dòng và "Xem tất cả (n)" | Chưa kiểm bằng dữ liệu thật: bộ 8 ca không có khối nào quá 5 dòng. Logic nằm trong `EncounterGroup` (`items.slice(0, 5)`), chưa chạy nút |
| 3.5 | Khối rỗng có thông báo riêng (ngày 13/11: "Chưa có ca nào hoàn thành.", khối ca ngày trước "Không có ca nào còn dở từ ngày trước.") | PASS |
| 3.6 | Dòng "Ca hủy: 1 · Kết thúc khác: 1 · Chưa xác định: 0" mở danh sách khi bấm; mục 0 bị tắt | PASS: bấm "Kết thúc khác" mở danh sách có ca nhập viện LK-000008 (aria-expanded=true) |
| 3.7 | Khối "Chưa hoàn tất từ ngày trước" hiện ca LK-000009 (13/11 16:00) khi xem 14/11, không tính vào N | PASS |
| 3.8 | Xem 13/11: N=1; ca LK-000009 nằm trong Còn lại và Đang khám / chờ kết quả, khối ngày trước rỗng | PASS |
| 3.9 | Danh sách chia Buổi sáng (5 lịch: 08:00, 08:30, 09:00, 09:00, 10:00) và Buổi chiều (3 lịch: 13:30, 14:00, 15:00); trùng giờ 09:00 sắp theo mã | PASS |
| 3.10 | Đúng mốc 12:00 | Chỉ có test đơn vị (`layout.test.ts`, `schedule.test.ts`); fixture không có ca 11:59/12:00 |
| 3.11 | Calendar: trục 07:00 đến 18:00, 8 khối, hai lịch 09:00 xếp cạnh nhau, ghi chú 30 phút (viền dưới nét đứt) và ghi chú trùng giờ | PASS |
| 3.12 | Nhãn "Bây giờ" hiện khi xem hôm nay (14:58 lúc chụp) | PASS; bị ẩn khi xem 15/11 (calendar, không có "Bây giờ") |
| 3.13 | Chú giải trạng thái đủ 9 mục, mỗi mục có nhãn chữ, luôn nằm trên cả list và calendar | PASS (ảnh `cal-1440.png`) |
| 3.14 | Không tràn ngang: 1440 (scrollWidth 1425 so với 1440 viewport), 1024 (1009 so với 1024), 390 (375 so với 390), cả list và calendar ở 390 | PASS (chênh lệch là thanh cuộn) |
| 3.15 | Nút Ngày trước / Hôm nay / Ngày sau / chọn ngày / Làm mới | PASS: Ngày sau chuyển 14 sang 15/11 (N=1, giữ view=calendar), Hôm nay quay về 14/11; nạp trực tiếp ?date=2026-11-13 đúng. Chưa thử Ngày trước, ô chọn ngày, Làm mới |
| 3.16 | Đổi Danh sách / Lịch theo giờ cập nhật URL (`view=`) | PASS: bấm "Lịch theo giờ" đổi URL thành ?date=2026-11-14&view=calendar |
| 3.17 | Response làm mới của ngày A không ghi đè ngày B | Chưa kiểm trong trình duyệt. Cơ chế: mỗi ngày là một thể hiện (`key`), request bị hủy khi rời ngày và có số thứ tự |
| 3.18 | Lỗi và đang tải (`error.tsx`, `loading.tsx`) | Chưa kiểm |

## Task 4: Popup lịch hẹn

(Điền sau khi chạy.)
