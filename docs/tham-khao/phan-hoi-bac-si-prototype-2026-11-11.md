# Phản hồi của bác sĩ sau khi xem prototype – 11/11/2026

Ghi lại từ sổ tay của tác giả (học viên thực tập), đã làm sạch: không có tên bác sĩ hay thông tin bệnh nhân. Bác sĩ TMH xem trang eForm có cột Trợ lý AI, rồi nhận xét miệng.

## Bác sĩ nói gì (chép gần nguyên văn)

> Bác sĩ thì chỉ cần chuyển voice to text thôi, làm cái đấy cho tốt thì là được. Hoặc là hệ thống thông minh hơn nữa thì có thể nó phải ghi âm cái cuộc trò chuyện của bác sĩ, từ đó nó điền hộ thông tin. Còn cái kê đơn hay là dịch vụ chỉ định thì không phải ca nào cũng có cái đó. Kê đơn thì bác sĩ hỏi là nó có cá nhân hóa không, vì mỗi bác sĩ sẽ có thói quen kê đơn khác nhau.

## Tách thành ý

| # | Ý | Đã làm gì |
|---|---|---|
| 1 | Chuyển giọng nói thành chữ cho tốt là đủ dùng | Đo độ chính xác nhận dạng (`npm run eval-giong-noi`) và thêm bước sửa chữ sau nhận dạng (`config/sua-chu-giong-noi.json`). Xem `docs/CHANGELOG.md` ngày 2026-11-11 |
| 2 | Mức cao hơn: ghi âm cả cuộc trò chuyện bác sĩ – bệnh nhân rồi tự điền | Chưa làm. Cần sự đồng ý của bệnh nhân, tách người nói, lọc tiếng ồn phòng khám; chạm quy định bảo mật nên để sau khi được duyệt |
| 3 | Không phải ca nào cũng có kê đơn, chỉ định | Chưa đổi giao diện (chủ dự án quyết định không làm) |
| 4 | Kê đơn nên cá nhân hóa theo thói quen từng bác sĩ | Gợi ý "Đơn anh/chị đã kê" theo mã ICD10 chính, học từ các lần bác sĩ bấm Lưu |

## Cần hỏi thêm (kiểu Mom Test)

- Lần gần nhất anh/chị gõ phiếu, phần nào mất thời gian nhất: gõ chữ, chọn mã ICD hay tìm thuốc? Nếu là gõ chữ thì ý 1 đúng là trọng tâm. Nếu là chọn mã hay tìm thuốc thì phần AI điền vẫn có giá trị.
- Với một chẩn đoán hay gặp, anh/chị có kê gần như giống hệt mỗi lần không? Khác nhau ở chỗ nào (thuốc, liều, số ngày)?
- Anh/chị đã từng dùng phần mềm đọc chính tả nào chưa? Bỏ dùng vì sao?
