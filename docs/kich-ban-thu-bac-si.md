# Kịch bản thử với bác sĩ

Tài liệu cho một buổi thử Trợ lý AI điền phiếu với bác sĩ TMH. **Phần 1** in ra đưa bác sĩ đọc, **Phần 2** dành cho người điều phối buổi thử.

> **Chỉ dùng thông tin bịa.** Bác sĩ không nói tên, tuổi, PID hay bệnh sử của bệnh nhân thật, kể cả khi đang kể lại một ca quen.

---

## Phần 1. Cho bác sĩ

Phiếu trên màn hình là một bệnh nhân giả: **chị Nguyễn Thị Giả, 38 tuổi, dị ứng Penicillin**. Điều dưỡng đã nhập sẵn lý do khám và bệnh sử. Nút tròn **Trợ lý** ở góc dưới bên phải (hoặc phím **F2**) mở khung Trợ lý; bấm lại hoặc Esc để đóng.

Trong khung có ô **Lệnh nhanh** (chạy hoàn toàn trên máy, không gọi AI, không có micro) và bên dưới là **Trợ lý lâm sàng** cho phần cần AI. Có sẵn **39 phiếu mẫu theo bệnh** (viêm tai giữa cấp, viêm mũi xoang cấp, viêm họng cấp, chóng mặt tư thế…). Anh/chị gõ **tên mẫu** kèm vài chi tiết riêng của bệnh nhân, hoặc mã gõ tắt; phiếu được điền theo mẫu, sau đó anh/chị kiểm tra và sửa. Phiếu có hai tab: **Phiếu khám** và **Chỉ định dịch vụ**.

### Các bước

1. Mở bong bóng Trợ lý, gõ vào ô **Lệnh nhanh**, ví dụ:
   - `mẫu viêm tai giữa cấp`
   - `vtg cấp, tai T, 3n, sốt 38,5`

   Bấm Enter. Câu báo bên dưới cho biết đã điền mấy ô, còn mấy chỗ vàng. Nếu tên khớp nhiều mẫu thì bấm chọn mẫu muốn dùng.
2. Kiểm tra hai tab **Phiếu khám** và **Chỉ định dịch vụ**. Chỗ **vàng** là phải xem lại (ví dụ `[phải|trái|2 bên]` còn chưa chọn). Sửa như sửa phiếu bình thường. Chỗ vàng mà đã đúng thì bấm **✓ Đúng**.
3. Phần chi tiết mà ô Lệnh nhanh không điền được (hoặc bệnh chưa có mẫu): bấm **Chép xuống** để đưa vào ô **Nội dung buổi khám** của Trợ lý lâm sàng ngay bên dưới, rồi bấm **Che thông tin và tạo bản nháp** và duyệt từng đề xuất (Chấp nhận hoặc Từ chối). Bước này mới gọi AI.
4. Vào tab **Đơn thuốc**. Thuốc của mẫu (nếu mẫu có thuốc) đã vào đơn dưới dạng chưa duyệt. Thêm hoặc sửa thuốc, nhập liều, số lần, số ngày; hoặc tích **Không kê đơn thuốc** nếu không kê. Bấm **Lưu**, rồi duyệt phần **Đơn thuốc** trong khung Duyệt. **In đơn thuốc** là tờ riêng, không có trong **In phiếu khám**.
5. Thấy phiếu ổn thì bấm **Lưu phiếu** (trong ô Lệnh nhanh) hoặc **Lưu phiếu & chỉ định** ở thanh dưới. **Tải lại trang (F5)** trước khi sang kịch bản sau.

Mẫu **chỉ điền vào ô còn trống**: ô đã có chữ (điều dưỡng nhập, anh/chị đã gõ) được giữ nguyên. Gọi lại cùng mẫu thì ô đã đúng không bị điền lại, chỉ định không bị thêm trùng. Ô do mẫu điền được lưu như chữ bác sĩ nhập.

Số đo `/ket-qua` của lượt này hiện giao diện "Gọn". Số lần dùng lệnh nhanh, số ô và số chỗ vàng còn lại được ghi vào dữ liệu lượt thử và CSV (chỉ số đếm, không có chữ).

### Kịch bản

- **M1. Chỉ gõ tên mẫu.** Một bệnh anh/chị hay gặp nhất, ví dụ `mẫu viêm họng cấp`. Sau đó sửa phiếu cho khớp một bệnh nhân anh/chị tự nghĩ ra.
- **M2. Tên mẫu kèm 2–3 chi tiết.** Ví dụ `vtg cấp, tai P, 2n, sốt 39`, hoặc theo cách anh/chị vẫn gõ tắt.
- **M3. Phiếu đã có chữ.** Gọi một mẫu bất kỳ, xem lý do khám và bệnh sử điều dưỡng nhập sẵn có được giữ nguyên không.
- **M4. Bệnh chưa có mẫu.** Tóm tắt một ca không có trong danh sách (ví dụ u bã đậu sau tai) đúng như cách anh/chị vẫn đọc hay gõ. Chép xuống Nội dung buổi khám, bấm **Che thông tin và tạo bản nháp** rồi duyệt từng đề xuất.
- **M5. Nói thay vì gõ (phần Trợ lý lâm sàng).** Ô Lệnh nhanh không có micro. Muốn nói thì dùng ô Nội dung buổi khám của Trợ lý lâm sàng: nói "viêm mũi xoang cấp, ngạt mũi hai bên, bảy ngày", dừng nghe rồi bấm **Che thông tin và tạo bản nháp**.
- **A1. Để so sánh: đọc cả ca.** Đọc to đoạn dưới đây (đúng bệnh nhân trên phiếu), xem mất bao lâu so với gọi mẫu:

  > Chị đến khám vì đau tai phải, chảy mủ tai phải 4 ngày. Bệnh sử 4 ngày nay đau tai phải, 2 ngày nay chảy mủ vàng tai phải, nghe kém tai phải, sốt nhẹ. Tiền sử viêm tai giữa mạn tính tai phải, dị ứng penicillin. Khám thấy ống tai phải có mủ vàng, màng nhĩ phải thủng trung tâm. Chẩn đoán đợt cấp viêm tai giữa mạn tính có mủ tai phải. Chỉ định nội soi tai, đo thính lực đơn âm, làm sạch ống tai hút dịch tai. Kê Ciprofloxacin nhỏ tai phải 5 giọt một lần, ngày 2 lần, 7 ngày. Paracetamol 500 mg uống 1 viên một lần, ngày 3 lần, sau ăn, 5 ngày. Dặn giữ khô tai, không bơi. Hẹn tái khám sau 7 ngày.

---

## Phần 2. Cho người điều phối

### Chuẩn bị

- Đặt `ASR_PROVIDER=zipformer` trong `.env.local` (đã tải model bằng `npm run tai-model-giong-noi`) để âm thanh không rời khỏi máy.
- Chọn `LLM_PROVIDER`.
  - Ô Lệnh nhanh (M1, M2, M3) **không bao giờ gọi LLM**, chạy được cả ở `mock`. Chi tiết được thay vào mẫu bằng quy tắc (bên, số ngày, nhiệt độ).
  - M4, M5 và A1 đi qua Trợ lý lâm sàng nên cần LLM thật mới tách tốt.
- Nếu dùng `gemini` bằng key miễn phí: đặt `GEMINI_MODEL=gemini-3.5-flash-lite` (**15 lượt gọi mỗi phút, 500 lượt mỗi ngày**, mỗi lượt khoảng 2–3 giây). Model mạnh hơn hết hạn mức rất nhanh. Thỉnh thoảng Google trả lỗi 503 khi quá tải, gặp lỗi thì bấm lại.
- Mở `/ket-qua` trước buổi thử để biết đã có bao nhiêu lượt cũ. Lượt có dùng mẫu hiện "· Mẫu <id>".
- Danh sách mẫu và cách gọi tắt: `data/eform/phieu-mau.json` (`ten`, `bi_danh`), hoặc gõ 2 chữ vào ô để hiện gợi ý.

### Mẫu đúng sẵn bao nhiêu (ước tính)

Đo bằng `npm run eval-mau` trên 10 ca mẫu có mẫu tương ứng (ngày 2026-11-12):

| | Chung | Phiếu khám | Chỉ định |
|---|---|---|---|
| Chỉ gõ tên mẫu | 67,5% | 38,9% | 97,4% |
| Tên mẫu kèm chi tiết (quy tắc, chưa dùng LLM) | 72,5% | 53,7% | 97,4% |

Chỗ mẫu hay sai nhất là bệnh sử, khám toàn thân, khám chuyên khoa và lời dặn, vì bên tai, con số và câu chữ của từng ca khác mẫu. Hẹn tái khám, hướng điều trị và mã chỉ định gần như luôn đúng. **Mẫu và đáp án đều do nhóm soạn**, nên số thật phải đo ở buổi thử này.

### Cần biết trước để không bất ngờ

- **Mẫu có sẵn câu khám kiểu "Tim đều, phổi không ran", "màng nhĩ 2 bên bình thường".** Bác sĩ không khám chỗ đó mà vẫn Lưu thì bệnh án ghi sai. Ghi lại bác sĩ có đọc kỹ từng ô không, hay bấm Lưu luôn.
- **Tên mẫu chỉ được nhận khi đứng đầu câu hoặc đứng sau chữ "mẫu".** Câu kể cả ca có nhắc tên bệnh ở giữa thì chạy luồng tách cũ. Bác sĩ nói "mẫu…" giữa chừng thì vẫn nhận.
- **Ô vàng `[phải|trái|2 bên]`, `[số] ngày`** là chỗ mẫu cần bác sĩ điền. Nói kèm chi tiết thì phần lớn được thay tự động; không thay được thì vẫn để vàng.
- **Nhận dạng giọng nói hay nghe sai tên thuốc và từ chuyên môn.** Lần thử bằng giọng đọc máy ngày 2026-11-11 có khoảng 29% số từ bị sai. Sau bước sửa chữ (`config/sua-chu-giong-noi.json`) còn khoảng 10% trên giọng máy; giọng người thật chưa đo. Tên bệnh ngắn trong lệnh gọi mẫu cũng có thể bị nghe sai. Ghi lại bác sĩ gõ sửa ngay, đọc lại, hay bỏ cuộc.
- Mỗi lần tải trang chỉ ghi **một** lượt số đo, vào lần Lưu đầu tiên sau khi đã dùng ô Lệnh nhanh hoặc AI điền. Quên tải lại thì kịch bản sau không được ghi.
- Dùng link "Thử câu mẫu" thì lượt đó không tính vào số trung bình. Ở buổi thử, bác sĩ gõ hoặc nói thật.

### Ghi chép mỗi kịch bản

Số đếm (thời gian, số trường AI điền, đã sửa, bổ sung, khớp danh mục, mẫu đã dùng, số lệnh nhanh, số chỗ vàng còn lại) đã tự ghi ở `/ket-qua`. Người điều phối ghi thêm bằng tay:

| Kịch bản | Mẫu đã gọi | Chữ nào trong mẫu phải sửa | Ô nào bác sĩ không đọc mà vẫn Lưu | Bác sĩ dừng hay do dự ở đâu | Câu bác sĩ nói nguyên văn |
|---|---|---|---|---|---|
| M1 | | | | | |
| M2 | | | | | |
| M3 | | | | | |
| M4 | (không có mẫu) | | | | |
| M5 | (nói, không qua mẫu) | | | | |
| A1 | (đọc cả ca) | | | | |

### Hỏi sau buổi thử

Hỏi về việc đã xảy ra, không hỏi bác sĩ có thích không:

- Ở lượt vừa rồi, chữ nào trong mẫu anh/chị phải sửa?
- Lần gần nhất điều dưỡng gõ mẫu viết tắt xong, anh/chị sửa những chữ nào?
- Bộ viết tắt điều dưỡng đang dùng có bao nhiêu mẫu? Ai soạn, lần cuối sửa khi nào?
- Ca hôm qua anh/chị nhập phiếu và đơn mất bao lâu? Phần nào chiếm nhiều thời gian nhất?
- Bệnh nào anh/chị gặp nhiều mà danh sách mẫu chưa có?
- Lúc nãy chỗ nào anh/chị không tin kết quả và phải đọc lại kỹ?
