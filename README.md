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
| `gemini` | `GEMINI_API_KEY`, `GEMINI_MODEL` | Key lấy ở Google AI Studio. Trả JSON theo schema (`responseJsonSchema`), sai schema thì thử lại 1 lần. |

Các trang `/dashboard`, `/benh-nhan/...` và API `/api/clinic/*` chỉ kiểm header Host/Origin/Sec-Fetch-Site (chặn trình duyệt gọi chéo origin và DNS rebinding); client không phải trình duyệt tự đặt được Host nên không bị chặn. Muốn máy khác trong mạng không vào được, chạy `npx next dev -H 127.0.0.1` (đừng dùng `-H 0.0.0.0`).

Khởi động lại `npm run dev` sau khi sửa `.env.local`. Header của ứng dụng hiện chế độ đang dùng.

## Nhập giọng nói

Có hai chế độ, chọn bằng `ASR_PROVIDER` trong `.env.local`:

| `ASR_PROVIDER` | Cách chạy | Ghi chú |
|---|---|---|
| `web` (mặc định) | Web Speech API của Chrome (`vi-VN`), hiện chữ ngay khi đang nói | **Gửi âm thanh lên Google, cần internet.** Trình duyệt không hỗ trợ thì nút 🎤 tự ẩn |
| `zipformer` | Trình duyệt gửi âm thanh mỗi 0,4 giây lên `/api/asr` của chính prototype; model Zipformer tiếng Việt (`sherpa-onnx-zipformer-vi-30M-int8`, ~26 MB) nhận dạng trên máy. Đang nói thì hiện chữ tạm (in nghiêng dưới nút); ngắt nghỉ ~0,5 giây thì Silero VAD chốt câu và đưa vào ô | **Âm thanh không ra khỏi máy và không được lưu**, không cần internet. Tối đa 10 phút mỗi lần bấm |

Bật `zipformer`:

```bash
npm run tai-model-giong-noi   # tải model về models/ (không đưa lên git), chạy một lần
```

rồi thêm `ASR_PROVIDER=zipformer` vào `.env.local` và khởi động lại `npm run dev`. Chưa tải model thì nút 🎤 tự quay về Web Speech và báo dưới nút.

Model Zipformer bản tiếng Việt là loại không streaming (nghe hết một đoạn mới nhận dạng), nên chữ tạm có được là nhờ nhận dạng lại phần câu đang nói dở sau mỗi mẩu; mỗi lần chỉ mất vài chục mili giây. Model trả chữ in hoa, không dấu câu; server đổi sang chữ thường, viết hoa chữ đầu và thêm dấu chấm cuối mỗi câu chốt. Gói `sherpa-onnx-node` là gói native, được khai báo ở `serverExternalPackages` trong `next.config.ts`.

**Dù dùng chế độ nào, chỉ dùng với dữ liệu giả.**

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

Trường mã có thêm `catalog` (tên danh mục), `name_field` (trường tên) và `strength_field` (trường hàm lượng, nếu có) để hiện ô tìm kiếm trong danh mục. Không đặt `ai_fill: true` cho trường mã: mã chỉ được gán bởi code khớp danh mục ở `src/shared/match.ts`.

Các cấu hình khác:

- `config/viet-tat.json`: bảng từ viết tắt. Khóa một chữ cái phân biệt hoa thường và phải đứng riêng thành từ.
- `config/canh-bao.json`: ngưỡng tuổi trẻ em, cách tính tổng số lượng thuốc.
- `config/theme.json`: màu giao diện. Các khóa `emr_*` là màu của trang `/eform` theo EMR, `ai_tim` là màu tím đánh dấu phần AI điền, `xem` là màu vàng "cần xem lại".
- `data/catalog/*.json`: danh mục dịch vụ và thuốc mẫu (mã giả). Danh mục thật cào từ nguồn công khai (ICD-10, kỹ thuật TT 23/2024, hoạt chất, thuốc lưu hành) nằm ở `data/tham-khao/`, ứng dụng chưa dùng; xem `data/tham-khao/README.md`, cào lại bằng `npm run cao-du-lieu`.

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
npm run eval -- --provider=anthropic  # chọn nhà cung cấp, tốn phí API (22 lượt gọi)
```

Script chạy cả 11 ca (bản nói và bản gõ tắt) qua pipeline, in độ chính xác theo từng phần và từng trường.

- **Chính xác = Đúng / (Đúng + Sai + Thiếu + Thừa).** Trường cả hai bên đều trống không được tính.
- **Thừa** là pipeline điền trường bác sĩ không nói, cần đặc biệt chú ý.
- Văn bản tự do được coi là đúng khi giống nhau từ 70% số từ trở lên **và** trùng khít các con số cùng bên phải/trái.
- Ở chế độ `mock`, ca mẫu trả kết quả soạn sẵn nên điểm gần 100% là đương nhiên, chỉ để kiểm tra pipeline. Muốn có số đo có ý nghĩa, hãy dùng `--rule-only` hoặc LLM thật.

## Mô phỏng eForm ngoại trú

Trang `/eform` mô phỏng màn **Phiếu khám ngoại trú của EMR** với một ca TMH giả, để bác sĩ thấy quen ngay. Bố cục và màu theo màn EMR thật (xem `docs/cau-truc-phieu-kham-ngoai-tru.md`): logo và dải cam "Bệnh án điện tử", nút Menu, dòng PID có nhãn giới tính và dị ứng, nút "Xem LSKB", thanh mục xanh đậm, bảng lịch sử có nút Copy, thanh trạng thái và nút Lưu ghim dưới đáy. Thanh header của prototype được ẩn trên trang này; nút "Quay lại" dẫn về trang chính.

Chỗ khác với EMR là **cột "✨ Trợ lý AI điền phiếu" bên phải**:

1. Bác sĩ bấm 🎤 Nói trong lúc khám, hoặc gõ tắt một đoạn (có nút "Câu mẫu" để demo), rồi bấm **✨ Điền vào phiếu**.
2. AI dùng chung pipeline với trang chính (`/api/extract`, theo `LLM_PROVIDER`) và điền cùng lúc: lý do khám, bệnh sử, tiền sử, khám toàn thân, khám chuyên khoa, chẩn đoán, hướng điều trị, lời dặn, hẹn tái khám (tự tính ngày), **chỉ định dịch vụ** và **đơn thuốc** (hai tab cạnh tab Phiếu khám).
3. Cột AI liệt kê các trường đã điền; bấm "xem →" để cuộn tới ô. Bác sĩ duyệt, sửa rồi bấm Lưu. Có nút hoàn tác lần AI điền.

| Quy tắc | Chi tiết |
|---|---|
| Màu | Tím = AI điền. Vàng = AI chưa chắc, cần xem lại (bấm "✓ Đúng" hoặc sửa để bỏ đánh dấu). |
| Không ghi đè | Ô bác sĩ đã gõ hoặc đã sửa thì AI không ghi đè, cột AI báo "giữ nguyên". |
| Mã ICD10 | Không lấy từ LLM. Code chấm điểm từ khóa trên câu chẩn đoán để gán mã, luôn đánh dấu vàng. |
| Mã dịch vụ, thuốc | Do `src/shared/match.ts` khớp danh mục. Khớp chưa chắc thì dòng vàng, có ô chọn lại trong danh sách gần đúng. |
| Nói nhiều lần | Lần điền sau chỉ thêm dòng chỉ định/thuốc chưa có (trùng mã thì bỏ qua). |
| Đơn thuốc | Tổng số lượng tự tính như trang chính. Thuốc cùng nhóm với dị ứng trên header (ví dụ Penicillin → Augmentin, Amoxicillin) hiện cảnh báo đỏ; danh sách nhóm chỉ là minh họa. |

**✨ Gợi ý theo chẩn đoán** nằm đầu tab Chỉ định dịch vụ và tab Đơn thuốc:

- Lấy mã ICD10 đang chọn trên phiếu khám (ra viện, ban đầu, kèm theo; do bác sĩ chọn hoặc Trợ lý AI điền), tìm bộ mẫu khớp trong `data/eform/goi-y-theo-chan-doan.json` và liệt kê dịch vụ, thuốc kèm liều, lời dặn theo từng chẩn đoán. Tab nào có gợi ý thì hiện ✨ trên tên tab.
- **Không tự thêm gì.** Bác sĩ tích chọn rồi bấm "Thêm N mục đã chọn". Mục đã có trong danh sách hoặc trùng gợi ý phía trên thì làm mờ. Thuốc cùng nhóm dị ứng trên header (ví dụ Augmentin khi dị ứng Penicillin) không được tích sẵn và có cảnh báo đỏ.
- Lời dặn mẫu có nút "Chèn vào Lời dặn" (thêm vào cuối ô Lời dặn & theo dõi, đánh dấu AI điền).
- Bộ mẫu chỉ ghi tên dịch vụ và thuốc. Mã do `src/shared/match.ts` gán khi nạp trang; khớp chưa chắc thì dòng hiện vàng "cần xem lại".
- Chạy bằng rule, không gọi LLM. **12 bộ mẫu hiện có đều là dữ liệu giả, liều chỉ minh họa**; sẽ thay bằng danh sách bệnh hay gặp do bác sĩ đưa.

Ở chế độ `mock`, câu mẫu của ca `data/cases/ca-11-viem-tai-giua-man-dot-cap.json` (cùng bệnh nhân giả với trang này) trả kết quả soạn sẵn; câu khác được tách bằng quy tắc nên kém hơn LLM thật.

Các điểm AI cũ vẫn nằm ngay tại ô, **đều là mock bằng rule, không gọi LLM**:

| Điểm AI | Cách hoạt động | Giới hạn |
|---|---|---|
| ✨ AI tóm tắt (Tiền sử bản thân, Tiền sử gia đình, Bệnh sử) | Trích câu có sẵn, gộp câu trùng qua các lần khám. Câu khác bên phải/trái hoặc khác số liệu không bị gộp. Bác sĩ sửa rồi mới chèn. | Không diễn đạt lại, nên rút gọn ít hơn LLM thật |
| ✨ Gợi ý ICD10 (top 3) | Chấm điểm từ khóa trong Bệnh sử và Khám lâm sàng, có xét phủ định ("không sốt"). Đoạn tóm tắt lịch sử cũ và chỗ `[ ]` chưa chọn không được tính. | **Độ tin cậy chỉ là điểm khớp từ khóa, không phải xác suất bệnh** |
| ✨ Gợi ý mẫu câu | Chọn mẫu Tai/Mũi/Vòm/Họng theo Lý do đến khám. Kết quả khám để trống cho bác sĩ chọn, AI không tự điền. | Chỉ có 7 nhóm lý do khám mẫu |

Nhãn trên giao diện: **Dữ liệu cũ**, **✨ AI điền**, **⚠ AI chưa chắc, cần xem lại**, **Đã sửa**, **(Hiển thị trên báo cáo y tế)**. Nút "Báo cáo y tế" cho xem trước các trường có nhãn BCYT.

Các nút lấy dữ liệu từ hệ thống khác, Menu, Xem LSKB và In chỉ hiện thông báo mô phỏng. Nút Lưu không ghi xuống đĩa, tải lại trang là về dữ liệu ban đầu.

| File trong `data/eform/` | Nội dung |
|---|---|
| `ca-gia.json` | Ca giả và lịch sử khám |
| `goi-y-theo-chan-doan.json` | Bộ mẫu chỉ định, thuốc, lời dặn theo mã ICD10 (giả). Mỗi mẫu: `id`, `ten`, `icd` (danh sách mã), `chi_dinh` (`ten`), `don_thuoc` (`ten`, `ham_luong`, `duong_dung`, `lieu_moi_lan`, `so_lan_ngay`, `thoi_diem`, `so_ngay`, `ghi_chu`), `loi_dan`. Tên phải có trong `data/catalog/` để khớp được mã |
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
data/tham-khao/ danh mục thật cào từ nguồn công khai, chỉ để tra cứu (ứng dụng chưa nạp)
src/app/        trang và API (định tuyến Next, mỏng)
src/client/     giao diện chạy trên trình duyệt: chung/ (MicButton, CatalogPicker...), workspace/, eform/, ket-qua/, api.ts (gọi API)
src/server/ai/  AI thật: pipeline, prompt, schema, llm/ (mock, rules, anthropic, openai, gemini), asr.ts (Zipformer)
src/server/du-lieu/ nạp config và data, lưu lượt thử
src/shared/     dùng chung hai phía: kiểu, khớp danh mục, chuẩn hóa, tính tổng, đo lường, api.ts (hợp đồng FE–BE)
src/shared/eform/ rule của trang eForm: tóm tắt, gợi ý ICD10, mẫu câu, gợi ý theo chẩn đoán, cảnh báo dị ứng, đổ kết quả AI vào phiếu
scripts/eval.ts chấm điểm
scripts/cao-du-lieu.ts cào danh mục công khai về data/tham-khao/
scripts/tai-model-giong-noi.ts tải model Zipformer và Silero VAD về models/
models/         model nhận dạng giọng nói (tự tải, không đưa lên git)
docs/           quan sát thực địa, cấu trúc màn hình EMR, CHANGELOG.md
.claude/        cấu hình Claude Code: plugin, hook, skill
```

Chi tiết ranh giới FE/BE, AI đặt ở đâu, cái gì dùng lại được và thêm mới thì đặt ở đâu: xem `docs/cau-truc-du-an.md`. `npm run lint` chặn import sai chiều (giao diện không được import `src/server`).

Mọi thay đổi đều được ghi trong `docs/CHANGELOG.md`. Quy tắc làm việc với Claude Code xem `CLAUDE.md`.
