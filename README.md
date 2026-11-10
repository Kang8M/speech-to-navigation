# Trợ lý điền bệnh án TMH – Prototype

Bác sĩ **nói** hoặc **gõ tắt** một đoạn tóm tắt; AI tách ra và điền nháp vào 3 phần (**Phiếu khám, Chỉ định, Đơn thuốc**); bác sĩ duyệt, sửa rồi xác nhận.

> **Chỉ dùng dữ liệu giả, không nhập thông tin bệnh nhân thật.**
> **Danh mục, mã và liều thuốc đều là dữ liệu minh họa, không dùng cho lâm sàng.**

## Cài đặt và chạy

Cần Node.js 20.12 trở lên.

```bash
npm install
npm run dev
```

Mở http://localhost:3000 bằng Chrome. Mặc định chạy chế độ `mock`, không cần internet hay API key.

## Đổi nhà cung cấp AI

Sao chép `.env.example` thành `.env.local`, rồi sửa:

| `LLM_PROVIDER` | Cần thêm | Ghi chú |
|---|---|---|
| `mock` (mặc định) | Không | Câu trùng ca mẫu trả kết quả soạn sẵn, câu khác tách bằng quy tắc đơn giản. Dùng làm dự phòng khi demo. |
| `anthropic` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Trả JSON theo schema, sai schema thì thử lại 1 lần. |
| `openai` | `OPENAI_API_KEY`, `OPENAI_MODEL` | Trả JSON theo schema, sai schema thì thử lại 1 lần. |

Khởi động lại `npm run dev` sau khi sửa `.env.local`. Header của ứng dụng hiện chế độ đang dùng.

## Nhập giọng nói

Dùng Web Speech API của Chrome (`vi-VN`), chạy trên localhost. Trình duyệt không hỗ trợ thì nút 🎤 tự ẩn và chỉ còn ô gõ.

**Web Speech gửi âm thanh lên dịch vụ của Google và cần internet, vì vậy chỉ dùng với dữ liệu giả.**

## Thêm hoặc sửa trường form

Chỉ cần sửa JSON trong `config/forms/`, rồi tải lại trang. Giao diện, schema gửi cho LLM và prompt đều sinh từ các file này.

| File | Nội dung |
|---|---|
| `phieu-kham.json` | Các trường phiếu khám ngoại trú |
| `chi-dinh.json` | Các trường một dòng chỉ định |
| `ke-don.json` | Các trường một dòng thuốc |
| `hanh-chinh.json` | Thông tin hành chính giả ở đầu màn hình |

Ví dụ thêm trường "Mạch" vào phiếu khám, chèn vào mảng `fields` của `phieu-kham.json`:

```json
{ "id": "mach", "label": "Mạch (lần/phút)", "type": "number", "required": false,
  "hint": "Chỉ điền khi bác sĩ nói", "ai_fill": true, "mock_keywords": ["mạch"] }
```

| Khóa | Ý nghĩa |
|---|---|
| `id` | Mã trường, không trùng trong một form |
| `label`, `hint` | Nhãn và gợi ý; `hint` cũng được đưa vào prompt cho LLM |
| `type` | `text`, `textarea`, `number`, `date`, hoặc `select` (kèm `"options": ["A", "B"]`) |
| `required` | `true` thì hiện cảnh báo khi để trống (không chặn xác nhận) |
| `ai_fill` | `false` thì AI không điền |
| `mock_keywords` | Không bắt buộc. Từ khóa để chế độ `mock` nhận ra phần này trong câu tự do |

Trường mã có thêm `catalog` (tên danh mục), `name_field` (trường tên) và `strength_field` (trường hàm lượng, nếu có) để hiện ô tìm kiếm trong danh mục. Không đặt `ai_fill: true` cho trường mã: mã chỉ được gán bởi code khớp danh mục ở `lib/match.ts`.

Các cấu hình khác:

- `config/viet-tat.json`: bảng từ viết tắt. Khóa một chữ cái phân biệt hoa thường và phải đứng riêng thành từ.
- `config/canh-bao.json`: ngưỡng tuổi trẻ em, cách tính tổng số lượng thuốc.
- `config/theme.json`: màu giao diện.
- `data/catalog/*.json`: danh mục dịch vụ và thuốc mẫu.

Lưu ý với file `ca-*.json` đã có: thêm trường mới thì nên bổ sung giá trị vào `expected` để điểm eval không bị tính là "Thừa".

## Thêm ca mẫu

Tạo file JSON mới trong `data/cases/`, chép từ một ca có sẵn:

```json
{
  "id": "ca-11",
  "ten": "Tên hiển thị của ca",
  "hanh_chinh": { "ho_ten": "Tên giả", "tuoi": 30, "gioi": "Nam", "can_nang": 60 },
  "input_noi": "Câu bác sĩ nói tự nhiên...",
  "input_go_tat": "Phiên bản gõ tắt...",
  "expected": {
    "phieu_kham": { "ly_do_kham": "...", "chan_doan_chinh": "..." },
    "chi_dinh": [ { "ma_dich_vu": "DV-TMH-002", "ten_dich_vu": "Nội soi Tai Mũi Họng" } ],
    "ke_don": []
  }
}
```

Ca mới tự xuất hiện trong nút "Chọn ca mẫu" và trong eval. Trong `expected`, trường không được nói thì bỏ qua; với dòng khớp danh mục thì ghi đúng tên và mã theo danh mục.

## Đo lường

Mỗi lần bấm **Xác nhận**, một file JSON được lưu vào `data/sessions/`. File chỉ chứa số đếm (thời gian, số trường AI điền, số trường sửa, số mục khớp danh mục, kiểu nhập), **không chứa nội dung nhập hay thông tin hành chính**.

Trang **Kết quả thử nghiệm** có bảng các lượt, số liệu trung bình và nút xuất CSV. Lượt nạp từ "Chọn ca mẫu" không có thời gian nhập thật nên mặc định không tính vào số trung bình; có ô đánh dấu để tính cả.

- Thời gian: từ lúc bắt đầu nhập (gõ ký tự đầu, bấm mic hoặc nạp ca mẫu) đến lúc bấm Xác nhận.
- Trường giữ nguyên: tính trên các trường `ai_fill`. Dòng AI điền mà bác sĩ xóa được tính là đã sửa.
- Khớp danh mục: tính tại thời điểm AI điền nháp, trước khi bác sĩ sửa.

## Chấm điểm (eval)

```bash
npm run eval                          # dùng LLM_PROVIDER trong .env.local (mặc định mock)
npm run eval -- --rule-only           # chỉ chạy bộ tách bằng quy tắc, làm mốc so sánh
npm run eval -- --provider=anthropic  # chọn nhà cung cấp, tốn phí API (20 lượt gọi)
```

Script chạy cả 10 ca (bản nói và bản gõ tắt) qua pipeline, in độ chính xác theo từng phần và từng trường.

- **Chính xác = Đúng / (Đúng + Sai + Thiếu + Thừa).** Trường cả hai bên đều trống không được tính.
- **Thừa** là pipeline điền trường bác sĩ không nói, cần đặc biệt chú ý.
- Văn bản tự do được coi là đúng khi giống nhau từ 70% số từ trở lên **và** trùng khít các con số cùng bên phải/trái.
- Ở chế độ `mock`, ca mẫu trả kết quả soạn sẵn nên điểm gần 100% là đương nhiên, chỉ để kiểm tra pipeline. Muốn có số đo có ý nghĩa, hãy dùng `--rule-only` hoặc LLM thật.

## Mô phỏng eForm ngoại trú

Trang `/eform` mô phỏng phiếu khám ngoại trú với một ca TMH giả, kèm 3 điểm AI hỗ trợ. **Cả 3 điểm đều là mock bằng rule, không gọi LLM**, kể cả khi đã cấu hình `LLM_PROVIDER`.

| Điểm AI | Cách hoạt động | Giới hạn |
|---|---|---|
| ✨ AI tóm tắt (thay nút Copy ở Tiền sử bản thân, Tiền sử gia đình, Bệnh sử) | Trích câu có sẵn, gộp câu trùng qua các lần khám. Câu khác bên phải/trái hoặc khác số liệu không bị gộp. Bác sĩ sửa rồi mới chèn. | Không diễn đạt lại, nên rút gọn ít hơn LLM thật |
| ✨ Gợi ý ICD10 (top 3) | Chấm điểm từ khóa trong Bệnh sử và Khám lâm sàng, có xét phủ định ("không sốt"). Đoạn tóm tắt lịch sử cũ và chỗ `[ ]` chưa chọn không được tính. | **Độ tin cậy chỉ là điểm khớp từ khóa, không phải xác suất bệnh** |
| ✨ Gợi ý mẫu câu | Chọn mẫu Tai/Mũi/Vòm/Họng theo Lý do đến khám. Kết quả khám để trống cho bác sĩ chọn, AI không tự điền. | Chỉ có 7 nhóm lý do khám mẫu |

Nhãn trên giao diện: **Dữ liệu cũ**, **✨ AI gợi ý**, **Đã sửa**, **Hiển thị trên BCYT**. Nút "Báo cáo y tế" cho xem trước các trường có nhãn BCYT.

Các nút lấy dữ liệu từ hệ thống khác và nút In chỉ hiện thông báo mô phỏng. Nút Lưu không ghi xuống đĩa, tải lại trang là về dữ liệu ban đầu.

| File trong `data/eform/` | Nội dung |
|---|---|
| `ca-gia.json` | Ca giả và lịch sử khám |
| `icd10.json` | 28 mã TMH mẫu kèm từ khóa |
| `mau-cau.json` | Mẫu câu theo nhóm lý do khám, chỗ trống viết dạng `[a\|b]` |
| `quy-tac.json` | Ngưỡng tóm tắt, cách tính điểm, từ phủ định |
| `thu-vien.json` | Thư viện mẫu câu tĩnh của các ô khác |
| `tuy-chon.json` | Danh sách trạng thái và lựa chọn |

## Cấu trúc thư mục

```
config/         cấu hình form, màu, viết tắt, cảnh báo
data/catalog/   danh mục mẫu
data/cases/     ca giả
data/sessions/  kết quả các lượt thử (tự sinh, không đưa lên git)
data/eform/     ca giả, danh mục và quy tắc của trang eForm
lib/            schema, prompt, khớp danh mục, cảnh báo, đo lường
lib/llm/        mock, anthropic, openai
lib/eform/      rule tóm tắt, gợi ý ICD10, gợi ý mẫu câu
components/     thành phần giao diện
components/eform/ giao diện trang eForm
app/            trang và API
scripts/eval.ts chấm điểm
```
