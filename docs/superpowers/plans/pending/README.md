# Các plan chưa triển khai

Thư mục này chứa các plan mới chưa bắt đầu thực hiện và tài liệu thiết kế đi kèm.

| Plan | Trạng thái | Thiết kế |
| --- | --- | --- |
| [WER CLI: micro và file audio](2026-11-13-wer-cli.md) | Chưa triển khai | [Thiết kế WER CLI](2026-11-13-wer-cli-design.md) |
| [Một lượt khám, nhiều phiên ghi âm](2026-11-14-interrupted-encounters.md) | Đang triển khai — server Task 1–6 đã có test; còn client/giao diện (Task 7) và nghiệm thu (Task 8), việc còn lại ở cuối plan | [Thiết kế lượt khám đứt quãng](2026-11-14-interrupted-encounters-design.md) |
| [Dashboard lịch khám và thông tin bệnh nhân](2026-11-14-dashboard-patient.md) | Đang triển khai — Task 1–6 đã làm (đọc phiếu thật, xem phiếu cũ, mở/tiếp tục phiếu); còn Task 7 (nghiệm thu, mục chưa kiểm ghi ở `docs/testing/2026-11-14-dashboard-patient.md`) | [Thiết kế dashboard và bệnh nhân](2026-11-14-dashboard-patient-design.md) |

Khi bắt đầu thực hiện, cập nhật trạng thái tại đây. Khi hoàn tất, chuyển cả plan và thiết kế ra khỏi `pending`, đồng thời cập nhật các đường dẫn tham chiếu.

Các plan cũ đã triển khai vẫn ở thư mục cha. Community-1 đã có phần triển khai nhưng còn chờ kiểm chứng native/RAM, nên không được xếp thành plan chưa bắt đầu. DeepFilterNet đã triển khai và kiểm chứng; WER CLI là công việc mới chưa làm.
