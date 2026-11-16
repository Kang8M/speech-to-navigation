# Quy tắc sử dụng dữ liệu y tế

Phiên bản medical-data-use-2 / local-review-2, 2026-11-13. Đây là quy tắc vận hành do người dùng cung cấp, không phải chứng nhận ẩn danh hoặc kết luận pháp lý.

| Cấp | Nội dung | Quyền dùng AI |
| --- | --- | --- |
| 1: public | Tài liệu tham chiếu được xác nhận công khai; tên thuốc riêng lẻ kể cả thuốc đặc thù | Được dùng AI nội bộ hoặc bên ngoài |
| 2: masked_internal | Audio, transcript, bệnh án kể cả đã che tên/CCCD | Chỉ nội bộ, cần sự đồng ý rõ ràng cho bản nội dung được kiểm tra |
| 2b: deidentified | Bản transcript đã qua chốt chặn PII tự động `pii-auto-1` (14 rule R1–R14), chỉ ở luồng `/demo-luong` | Chạy local luôn được. Ra AI bên ngoài chỉ khi bệnh nhân đã đồng ý xử lý AI; chưa đồng ý thì ném "Bệnh nhân chưa đồng ý xử lý AI — chỉ được chạy bộ tách local." |
| 3: restricted | Hợp đồng, system prompt/tài liệu chỉ dẫn mật do người dùng nhập | Không đưa vào bất kỳ AI nào |

Tên thuốc công khai không biến thông tin một người bệnh dùng thuốc đó thành dữ liệu công khai. Masking không tự nâng bệnh án cấp 2 thành cấp 1. Đường clinical luôn mặc định cấp 2; không có tham số HTTP cho phép tự khai bệnh án là public. Prompt ứng dụng cố định dùng để định nghĩa hành vi không phải tài liệu prompt mật được nhập để phân tích.

## Cấp deidentified (chỉ luồng /demo-luong)

- Phạm vi: chỉ áp dụng cho luồng `/demo-luong`. eForm `/` và API `/api/clinical/*` hiện hành giữ nguyên: bản đã masking vẫn là cấp 2, vẫn cần bước duyệt riêng tư thủ công (ticket) và không ra AI bên ngoài.
- Bản thô không ghi đĩa. Bộ che `pii-auto-1` (che định danh, chốt chặn R11 chặn nếu còn sót, đồng ý R14, nhật ký R13) chạy trước; chỉ khi chốt chặn qua mới có `DeidentificationProof { policy_version: "pii-auto-1", gate_passed: true, consent }` và `classifyData` trả `deidentified`. Nội dung cấp 3 vẫn là `restricted` dù có proof.
- Đồng ý (`consent`) lấy từ hồ sơ bệnh nhân. R14: chưa đồng ý thì chỉ chạy bộ tách local; đường ra ngoài bị chặn ở `assertDataUseAllowed`.
- Tùy chọn `noCache` của `extractClinical` bỏ đọc cache/run-index để mỗi lần demo chạy lại thật; vẫn ghi file lượt chạy.
- Căn cứ tham chiếu (không phải kết luận pháp lý): Luật 91/2025 Điều 2.1, 14.6, 20, 26, 30; Nghị định 356/2025; HIPAA §164.514(b)(2). Chốt chặn tự động không chứng minh ẩn danh tuyệt đối: tuổi, giới, thời điểm và bệnh hiếm vẫn có thể tái định danh.

## Cơ chế thực thi

- STT dùng Zipformer cục bộ; không fallback Web Speech gửi audio bên ngoài.
- Bộ lọc cục bộ che định danh trực tiếp, tuổi cụ thể/tuổi trẻ nhỏ, giới tính được nói rõ, ngày lịch và giờ điều trị. Giữ số đo, liều, thời gian tương đối và tên thuốc.
- Tuổi + giới tính + thời điểm điều trị + bệnh hiếm vẫn có thể tái định danh. Người kiểm tra phải loại/mask trường không cần thiết. Không có danh sách bệnh hiếm đầy đủ và không tự suy diễn/xóa chẩn đoán.
- Trước thu/nhận dạng audio, giao diện micro và upload yêu cầu checkbox đồng ý nội bộ; service STT loopback không phải hệ thống quản lý consent độc lập.
- Checkbox đồng ý phân tích transcript nội bộ mặc định tắt; thay đổi nội dung hoặc phát sinh masking cần kiểm tra/xác nhận lại. Server yêu cầu consent=true, ticket lưu thời điểm đồng ý trong bộ nhớ và hết hạn 10 phút. Bỏ chọn checkbox không thu hồi các bearer đã cấp; chưa có API thu hồi consent. Đây chưa phải sổ consent bền vững hay cơ chế xác minh người có thẩm quyền đồng ý.
- Clinical extraction chặn mọi provider bên ngoài và callback provider thử nghiệm trước cache, ghi artifact hoặc gọi mạng. Hiện chỉ mock/rules cục bộ; chưa có adapter LLM nội bộ. Đặt biến môi trường không thể bỏ chặn.
- Tài liệu có dấu hiệu hợp đồng/system prompt bị chặn trước khi cấp ticket và trước AI. Nhận diện từ khóa là heuristic, có thể bỏ sót hoặc chặn nhầm: người dùng không được nhập tài liệu cấp 3. Không dùng LLM để phân loại dữ liệu nhạy cảm.

## Kiểm chứng

Tests bao phủ: thiếu consent, tái xác nhận, cấp 3, zero outbound calls, masking không đổi mức phân loại, giữ tên thuốc/đơn vị/số đo/thời gian lâm sàng. Cần bộ mẫu đã gán nhãn và quy trình consent thực tế trước triển khai với bệnh án thật. Việc review không chứng minh đã ẩn danh tuyệt đối.
