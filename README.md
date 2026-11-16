# Trợ lý điền bệnh án TMH – Prototype

Bác sĩ **nói** hoặc **gõ tắt** một đoạn tóm tắt; AI tách ra và điền nháp vào 3 phần (**Phiếu khám, Chỉ định, Đơn thuốc**); bác sĩ duyệt, sửa rồi Lưu.

> **Chỉ dùng dữ liệu giả, không nhập thông tin bệnh nhân thật.**
> **Danh mục thật (ICD-10, kỹ thuật, thuốc lưu hành) chỉ để tham khảo; danh mục bệnh viện, liều thuốc và bộ mẫu là dữ liệu minh họa. Không dùng cho lâm sàng.**

## Cài đặt và chạy

Cần Node.js 20.12 trở lên.

```bash
npm install
npm run dev
```

Mở http://localhost:3000 bằng Chrome: trang đầu là **Mô phỏng eForm ngoại trú** (link cũ `/eform` tự chuyển về đây). Thanh trên cùng có link sang **Kết quả thử nghiệm** (`/ket-qua`). Mặc định chạy chế độ `mock`, không cần internet hay API key.

## Đổi nhà cung cấp AI

Sao chép `.env.example` thành `.env.local`, rồi sửa:

| `LLM_PROVIDER` | Cần thêm | Ghi chú |
|---|---|---|
| `mock` (mặc định) | Không | Câu trùng ca mẫu trả kết quả soạn sẵn, câu khác tách bằng quy tắc đơn giản. Dùng làm dự phòng khi demo. |
| `anthropic` | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Trả JSON theo schema, sai schema thì thử lại 1 lần. |
| `openai` | `OPENAI_API_KEY`, `OPENAI_MODEL` | Trả JSON theo schema, sai schema thì thử lại 1 lần. |
| `gemini` | `GEMINI_API_KEY`, `GEMINI_MODEL` | Key lấy ở Google AI Studio. Trả JSON theo schema (`responseJsonSchema`), sai schema thì thử lại 1 lần. Key miễn phí nên đặt `GEMINI_MODEL=gemini-3.5-flash-lite` (khoảng 2–3 giây/lượt). Gemma 4 (`gemma-4-31b-it`, `gemma-4-26b-a4b-it`) mất 75–85 giây/lượt và hay lỗi 500. `gemini-3.8-flash` với mức suy nghĩ mặc định bị 504 sau khoảng 90 giây. |

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

### Sửa chữ sau nhận dạng

Mỗi câu chốt (cả Zipformer lẫn Web Speech) đi qua `src/shared/giong-noi/sua-chu.ts` trên trình duyệt trước khi vào ô nhập. Bảng sửa ở `config/sua-chu-giong-noi.json`, sửa rồi tải lại trang là có hiệu lực:

| Khóa | Làm gì |
|---|---|
| `thay` | Thay cụm hay nghe nhầm: `sai` (các cách nghe nhầm) thành `dung`. Có `tru_khi_truoc`, `tru_khi_sau` (từ ngay trước/sau thì không thay: "có thai" giữ nguyên) và `chi_khi_sau` (chỉ thay khi từ sau là một trong các từ này: "suốt" thành "sốt" chỉ khi sau là "nhẹ", "cao", số). Áp theo thứ tự trong file |
| `tu_chuyen_khoa` | Tên thuốc: `dung` là tên chuẩn ghi vào ô, `doc` là cách bác sĩ đọc bằng âm tiết tiếng Việt ("pa ra xê ta mon"). So gần đúng sau khi bỏ dấu và gộp âm gần nhau (x/s, d/gi/r, ph/f…) |
| `nguong_giong` | Độ giống tối thiểu để thay tên thuốc (0,72; thấp hơn thì bắt đầu sửa nhầm câu đúng) |
| `dau_hieu_thuoc` | Tên thuốc chỉ được thay khi trong 4 từ phía sau có một từ này hoặc một con số, hoặc từ ngay trước là "đơn", "thuốc". Thiếu điều kiện này thì "thanh quản" bị thay thành "Tanakan" |

Cuối cùng số đọc thành chữ được đổi sang chữ số khi đứng trước đơn vị (ngày, lần, viên, mg, độ…) hoặc là số nhiều chữ: "năm trăm mi li gam" thành "500 mg", "ba mươi tám phẩy năm độ" thành "38,5 độ". "hai bên", "một ít", "năm nay" giữ nguyên.

### Đo nhận dạng giọng nói

```bash
npm run tao-am-thanh-mau     # Windows: giọng máy đọc từng ca thành data/giong-noi/<id>.tts.wav
npm run eval-giong-noi       # thêm --chi-tiet để in từng câu, --nhan-lai để nhận dạng lại từ đầu
```

Mỗi file `.wav` trong `data/giong-noi/` đi qua đúng luồng VAD của ứng dụng rồi được so với câu `input_noi` của ca cùng id. Script in cho chữ thô và chữ sau khi sửa: **WER** (tỉ lệ từ sai, so cả dấu, số đổi thành chữ ở hai phía), **Mã** (số mã dịch vụ, mã thuốc bộ tách quy tắc vẫn ra đúng so với khi tách câu gốc), **Liều** (số dòng thuốc có liều, số lần/ngày, số ngày trùng câu gốc), và **Sửa nhầm trên câu gốc** (bộ sửa chạy trên câu đúng mà đổi mất bao nhiêu từ, nên bằng 0). Chữ thô được lưu cạnh file âm thanh nên chỉnh bảng sửa rồi chạy lại chỉ mất vài giây. Cách tự ghi âm để đo bằng giọng thật: `data/giong-noi/README.md`.

Kết quả trên giọng máy ngày 2026-11-11: WER 21,4% thành 10,5%, Mã 7/42 thành 22/42, Liều 0/24 thành 11/24, sửa nhầm 0. **Giọng máy khác người thật**, nên các số này chỉ để so trước và sau một lần sửa. Hotword của sherpa-onnx (ưu tiên cụm từ ngay lúc giải mã) đã thử với `modified_beam_search` nhưng không thấy tác dụng trên model này, nên chưa dùng.

**Dù dùng chế độ nào, chỉ dùng với dữ liệu giả.**

## Thêm hoặc sửa trường form

Các trường AI tách ra nằm trong JSON ở `config/forms/`. Schema gửi cho LLM, prompt, chế độ `mock` và eval đều sinh từ các file này.

**Giao diện eForm không sinh từ JSON.** Thêm trường mới vào JSON thì AI sẽ tách được ngay (thấy trong eval), nhưng muốn trường hiện trên phiếu thì phải nối thêm: trường phiếu khám vào bảng `ANH_XA` trong `src/shared/eform/dien-phieu.ts` và vào ô tương ứng ở `src/client/eform/EformForm.tsx`; cột chỉ định, thuốc vào `dienPhieu` và `ChiDinhTab.tsx` / `DonThuocTab.tsx`.

| File | Nội dung |
|---|---|
| `phieu-kham.json` | Các trường phiếu khám ngoại trú |
| `chi-dinh.json` | Các trường một dòng chỉ định |
| `ke-don.json` | Các trường một dòng thuốc |

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
| `required` | Đánh dấu trường bắt buộc trong schema; giao diện eForm hiện chưa dùng khóa này |
| `ai_fill` | `false` thì AI không điền |
| `mock_keywords` | Không bắt buộc. Từ khóa để chế độ `mock` nhận ra phần này trong câu tự do |

Trường mã có thêm `catalog` (tên danh mục), `name_field` (trường tên) và `strength_field` (trường hàm lượng, nếu có) để pipeline biết khớp danh mục nào bằng trường nào. Không đặt `ai_fill: true` cho trường mã: mã chỉ được gán bởi code khớp danh mục ở `src/shared/match.ts`.

Các cấu hình khác:

- `config/viet-tat.json`: bảng từ viết tắt. Khóa một chữ cái phân biệt hoa thường và phải đứng riêng thành từ.
- `config/canh-bao.json`: cách tính tổng số lượng thuốc (`tinh_tong`). Có `truong_so_luong_ke` (số bác sĩ nói rõ, ví dụ "kê 10 viên") thì lấy số đó, không thì liều × số lần/ngày × số ngày với thuốc đếm được. `don_vi_viet_tat` bung đơn vị gõ tắt trong liều ("1 v" → "1 viên") trước khi tính. Các khóa tuổi trẻ em, cân nặng là của cảnh báo trên trang cũ đã bỏ, hiện không dùng.
- `config/theme.json`: màu giao diện. Các khóa `ef_*` là màu của trang eForm (nền, viền, chữ, xanh thao tác chính, đỏ dị ứng), `ai_tim` là màu tím đánh dấu phần AI điền, `xem` là màu vàng đất "cần xem lại".
- Danh mục ứng dụng nạp gồm hai phần, ghép ở `src/server/du-lieu/danh-muc.ts`:
  - **Danh mục bệnh viện soạn tay** `data/catalog/dich-vu.json` (30 mục), `data/catalog/thuoc.json` (33 thuốc): có `ten_khac` (tên bác sĩ hay gọi) và được khớp trước. Dịch vụ có kỹ thuật tương ứng trong TT 23/2024 dùng mã thật (ví dụ `20.13` Nội soi tai mũi họng); 11 dịch vụ TT 23 không có (khám TMH, nội soi tai riêng, lấy ráy, test nhanh liên cầu, CT xoang...) giữ mã giả `DV-TMH-*`. Thuốc giữ mã nội bộ giả `TH-*`.
  - **Danh mục thật** ở `data/tham-khao/` (xem `data/tham-khao/README.md`, cào lại bằng `npm run cao-du-lieu`): 486 kỹ thuật, 4.914 số đăng ký thuốc gộp còn khoảng 4.770 mục (trùng tên + hàm lượng + dạng bào chế thì giữ số đăng ký còn hạn lâu nhất), 433 mã ICD-10 lọc còn 367 mã chi tiết nhất. Mục thật trùng mã với mục soạn tay thì lấy bản soạn tay.
  - Thứ tự khớp (`matchCatalog`): trùng tên ở danh mục bệnh viện → trùng tên ở danh mục thật → tìm mờ ở danh mục bệnh viện → tìm mờ ở danh mục thật. Ví dụ "Paracetamol 500mg" ra `TH-013`, "Betaserc 24mg" (bệnh viện chỉ có 16 mg) ra số đăng ký thật, "đo thính lực lời" ra `21.61`.

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

Ca mới tự vào eval. Trang eForm chỉ dùng câu mẫu của `ca-11` (cùng bệnh nhân giả, nút "Thử câu mẫu"); `hanh_chinh` hiện không dùng. Trong `expected`, trường không được nói thì bỏ qua; với dòng khớp danh mục thì ghi đúng tên và mã theo danh mục.

## Đo lường

Kịch bản cho buổi thử với bác sĩ (gọi phiếu mẫu theo bệnh, một ca đọc cả đoạn để so sánh, số đo mẫu đúng sẵn, bảng ghi chép, câu hỏi sau buổi thử) ở `docs/kich-ban-thu-bac-si.md`.

Trên trang eForm, khi AI đã điền ít nhất một lần hoặc bác sĩ đã gõ vào ô chữ của phiếu (kể cả nhận gợi ý Tab), lần bấm **Lưu** đầu tiên ghi một lượt thử thành file JSON trong `data/sessions/` (thông báo dưới đáy có câu "Đã ghi số đo lượt thử"). Bấm Lưu nữa thì không ghi thêm; muốn thử lượt mới thì tải lại trang. Chưa làm gì thì Lưu không ghi gì. File chỉ chứa số đếm (thời gian, số trường AI điền, số trường sửa, số mục khớp danh mục, kiểu nhập, số gợi ý Tab), **không chứa nội dung phiếu hay thông tin bệnh nhân**.

Trang **Kết quả thử nghiệm** có bảng các lượt, số liệu trung bình và nút xuất CSV. Lượt dùng "Thử câu mẫu" không có thời gian nhập thật nên mặc định không tính vào số trung bình; có ô đánh dấu để tính cả.

- Thời gian: từ lúc bắt đầu nhập (gõ ký tự đầu ở bong bóng hay cột Trợ lý AI hoặc vào ô chữ của phiếu, bấm 🎤 hoặc bấm câu mẫu) đến lúc bấm Lưu.
- Kiểu nhập: "Nói" nếu trong lượt có bấm 🎤 hoặc dùng câu mẫu kiểu nói, còn lại là "Gõ".
- AI điền: số trường phiếu khám AI điền cộng số dòng chỉ định, thuốc AI thêm (mỗi dòng tính một mục), cộng dồn qua các lần "Điền thêm".
- Đã sửa: trường AI điền mà bác sĩ đã sửa, cộng dòng AI thêm mà bác sĩ đã sửa hoặc xóa. Bấm "✓ Đúng" không tính là sửa.
- Bổ sung: ô bác sĩ tự gõ vào chỗ trống, cộng dòng bác sĩ tự thêm (kể cả chọn từ "Gợi ý theo chẩn đoán").
- Khớp danh mục: tính trên các dòng AI thêm, tại thời điểm AI điền, trước khi bác sĩ sửa.
- Cảnh báo: số chỗ còn "cần xem lại" lúc Lưu, cộng số thuốc trùng nhóm dị ứng.
- Hoàn tác lần AI điền thì số đếm của lần đó cũng bị trừ.
- Gợi ý Tab (cột "Gợi ý Tab" ghi nhận/hiện, kèm số đã nhận rồi sửa; "–" là lượt tắt gợi ý hoặc ghi trước 2026-11-16):
  - Hiện: số gợi ý khác nhau đã hiện ra (cùng ô, cùng câu chỉ tính một lần). Gõ dở một câu có thể làm hiện nhiều gợi ý khác nhau, nên số này lớn hơn số câu.
  - Nhận: số lần bấm Tab. Nhận rồi sửa: câu đã nhận mà lúc Lưu không còn nguyên trong ô.
  - Chữ đến từ gợi ý: số ký tự vào ô nhờ Tab, so với số ký tự bác sĩ tự gõ vào ô chữ của phiếu (đếm theo độ dài tăng thêm của ô, không phải số phím bấm). Chữ gõ ở bong bóng hay cột Trợ lý AI không tính.
  - Muốn so có và không có gợi ý: làm cùng một ca giả hai lượt, một lượt mở `/?goi-y=tat` (giao diện cũ thì bỏ tích "Gợi ý chữ mờ, bấm Tab để nhận" ở dòng Chú giải), rồi so cột Thời gian.
- Giao diện (cột "Giao diện"): "Gọn" là bong bóng trợ lý (mặc định), "Cũ" là cột Trợ lý AI (`/?giao-dien=cu`). Lượt ghi trước 2026-11-16 tối không có trường này, hiện "Cũ".
- Bấm chuột (cột "Bấm chuột"): số lần bấm chuột trên màn eForm từ lúc mở phiếu đến lúc Lưu, kể cả bấm vào ô để gõ. Dùng để so giao diện gọn với giao diện cũ trên cùng một ca; lượt cũ hiện "–".
- Lượt ghi trước ngày 2026-11-11 đến từ trang "Màn hình làm việc" cũ (đã bỏ), cách đếm trên từng ô của form JSON nên không so trực tiếp được với lượt mới.

## Chấm điểm (eval)

```bash
npm run eval                          # dùng LLM_PROVIDER trong .env.local (mặc định mock)
npm run eval -- --rule-only           # chỉ chạy bộ tách bằng quy tắc, làm mốc so sánh
npm run eval -- --provider=anthropic  # chọn nhà cung cấp, tốn phí API (24 lượt gọi)
```

Script chạy cả 12 ca (bản nói và bản gõ tắt) qua pipeline, in độ chính xác theo từng phần và từng trường.

- **Chính xác = Đúng / (Đúng + Sai + Thiếu + Thừa).** Trường cả hai bên đều trống không được tính.
- **Thừa** là pipeline điền trường bác sĩ không nói, cần đặc biệt chú ý.
- Văn bản tự do được coi là đúng khi giống nhau từ 70% số từ trở lên **và** trùng khít các con số cùng bên phải/trái.
- Ở chế độ `mock`, ca mẫu trả kết quả soạn sẵn nên điểm gần 100% là đương nhiên, chỉ để kiểm tra pipeline. Muốn có số đo có ý nghĩa, hãy dùng `--rule-only` hoặc LLM thật.

### Đo phiếu mẫu (`npm run eval-mau`)

```bash
npm run eval-mau                       # mock: không tốn lượt gọi
npm run eval-mau -- --provider=gemini  # mức 2 gọi LLM thật, mỗi ca có mẫu 1 lượt
```

Chấm phiếu mẫu (`data/eform/phieu-mau.json`) so với `expected` của các ca có `mau_id` trong `data/cases/`, cùng cách chấm với `npm run eval` (phần chấm dùng chung ở `scripts/cham-diem.ts`). **Mức 1** là chỉ có mẫu, tức bác sĩ chỉ gõ tên mẫu. **Mức 2** là mẫu kèm câu chi tiết ngắn `input_mau` của ca (ví dụ `"vtg cấp trẻ em, tai P, 3n, sốt 38"`). Script in thêm số "không tính tiền sử", vì mẫu không điền tiền sử, ô đó bác sĩ Copy từ lần khám trước. Đây chỉ là **ước tính**: mẫu và đáp án đều do nhóm soạn, số thật phải đo khi bác sĩ thử.

### Đo câu quen của bác sĩ (`npm run eval-go-tat`)

```bash
npm run eval-go-tat -- --provider=gemini                     # bộ giả + data/eform/go-tat-ca.json, 2 lượt mỗi ca
npm run eval-go-tat -- --provider=gemini --tai-khoan=user_bs01  # bộ riêng data/go-tat/user_bs01.json + user_bs01.ca.json (local)
```

Mỗi ca chạy 2 lần: không có và có câu quen trong prompt. **Nguyên văn** = số câu quen ra đúng nguyên văn / số câu mong đợi. **Thừa** = câu quen của ý bác sĩ không nói, phải bằng 0. Gemini quá tải (503) thì chờ 10 giây thử lại một lần; giữa các lượt chờ 4,5 giây cho khỏi vượt 15 lượt/phút. Ở `mock` hai cột như nhau vì bộ tách quy tắc không dùng câu quen.

### Test (`npm test`)

`npm test` chạy các file `src/**/*.test.ts` bằng `node:test` qua `tsx` (không cần thư viện test riêng, có cờ `--conditions=react-server` nên test được cả code `src/server`). Test được import `node:*` kể cả trong `src/shared` (`eslint.config.mjs` tắt luật import cho `*.test.ts`).

## Mô phỏng eForm ngoại trú

Trang chủ `/` mô phỏng màn **Phiếu khám ngoại trú của EMR** với một ca TMH giả. Các mục, trường, thứ tự, tab và trạng thái lượt khám giữ như EMR thật (xem `docs/cau-truc-phieu-kham-ngoai-tru.md`) để bác sĩ nhận ra ngay; cách trình bày thì làm mới cho gọn và dễ đọc hơn EMR:

- **Header ghim trên cùng** (từ khổ màn rộng): tên bệnh nhân, giới, PID, lượt khám, nhãn dị ứng đỏ (bấm xem chi tiết), Menu. Dòng dưới là **sinh hiệu chỉ đọc** từ phiếu điều dưỡng (chuyển từ mục Đánh giá chung lên đây để luôn thấy khi cuộn), "Đánh giá ban đầu", lần sửa cuối, Xem LSKB, Mở rộng.
- Mỗi mục là một thẻ trắng trên nền xám nhạt; lựa chọn Có/Không dạng thẻ bấm; bảng chỉ kẻ ngang, có nút Copy.
- **Thanh dưới đáy 2 tầng như EMR**, ghim ở mọi khổ màn: tầng trên là dải 7 trạng thái lượt khám (khổ điện thoại thì vuốt ngang); tầng dưới là Quay lại, Báo cáo y tế, In ngay, nút **Lưu** dài kèm số chỗ còn cần xem lại, nút lên đầu trang.
  - **In ngay** mở hộp thoại in của trình duyệt với bản in A4 (`src/client/eform/BanIn.tsx`): hành chính, sinh hiệu, các trường phiếu khám đã có chữ, chẩn đoán (mã và mô tả), bảng chỉ định, bảng đơn thuốc, chỗ ký bác sĩ, có dấu "DỮ LIỆU GIẢ – BẢN MÔ PHỎNG". Bản in giữ nguyên như đang hiện, kể cả chỗ AI chưa chắc.
  - **Trạng thái lượt khám**: "Chờ KQ CLS" mở ô Chuyển nội soi. "Hoàn thành khám" khóa phiếu, chỉ định, đơn thuốc và trợ lý (chỉ đọc), chọn lại "Đang khám" để sửa; còn thay đổi chưa Lưu thì không cho chọn. Các trạng thái khác chỉ đổi lựa chọn, chưa có tác dụng gì.
- Chữ Be Vietnam Pro 14px. Thanh header của prototype (link sang Kết quả thử nghiệm, chế độ AI) nằm trên cùng và cuộn đi khi kéo xuống; header bệnh nhân vẫn ghim. Nút "Quay lại" chỉ hiện thông báo "Chưa kết nối hệ thống thật".
- **Giao diện tối giản, không hiện chú thích của prototype**: không có dải cảnh báo dữ liệu giả, không có nhãn "Dữ liệu cũ", "(tự động)", "(mô phỏng …)", không có các dòng giải thích cách AI hoạt động dưới từng điểm AI. Các giới hạn đó ghi trong README này. Dấu "DỮ LIỆU GIẢ" chỉ còn trên bản in, để tờ giấy in ra không bị nhầm là phiếu thật.

Chỗ khác với EMR là **bong bóng "✨ Trợ lý"** ở góc phải dưới (`src/client/eform/BongBongAi.tsx`). Mục tiêu: AI không thêm bước, không chiếm chỗ trên màn hình, bỏ qua thì không tốn gì.

1. Bấm bong bóng hoặc phím **F2** (F2 lần nữa hoặc Esc để đóng, con trỏ trở về ô đang gõ). Bong bóng mở thành một ô lệnh nhỏ có nút 🎤 Nói.
2. Nói hoặc gõ **một lệnh**: tên mẫu ("mẫu viêm tai giữa cấp, tai P, 3 ngày"), mã gõ tắt (`ttbt tbt mv`), hay cả ca. **Enter** là điền (Shift+Enter xuống dòng). Logic giống cột cũ, dùng chung `src/client/eform/useDienAi.ts`: mã gõ tắt bung trước, tên mẫu gọi phiếu mẫu, phần còn lại gửi `/api/extract` (theo `LLM_PROVIDER`). AI điền cùng lúc phiếu khám, **chỉ định dịch vụ** và **đơn thuốc**.
3. Điền xong bong bóng tự thu lại. Không trả lời bằng chữ, không giữ lịch sử. Thanh đáy (giữa In ngay và Lưu, từ khổ màn vừa trở lên) chỉ còn một dòng báo đã điền gì, kèm **Xem N ô vàng** (mỗi lần bấm nhảy sang ô vàng tiếp theo), **↶ Hoàn tác** và nút ẩn. Đặt ở thanh đáy để không che ô phiếu.

Giao diện gọn còn bỏ các thứ gây nhiễu trên phiếu: dòng Chú giải, nút "Mở thư viện tham khảo", "✨ Gợi ý mẫu câu", "✨ Gợi ý ICD10", dấu ✨ trên tên tab. Ô và dòng AI điền giữ nền trắng, chỉ còn vạch tím ở lề; nhãn "AI điền" và "Đã sửa" ẩn đi; chỉ màu vàng ("⚠ Cần xem lại") là chỗ bác sĩ phải nhìn. Câu thư viện vẫn có trong chữ mờ Tab.

**Giao diện cũ** (`/?giao-dien=cu`), giữ để đo so sánh: **cột "✨ Trợ lý AI điền phiếu" bên phải**, đầu cột có thanh 3 bước Nói hoặc gõ → AI điền → Duyệt, Lưu. Bác sĩ bấm 🎤 hoặc gõ (có "Thử câu mẫu" để demo), bấm **✨ Điền vào phiếu** (hoặc Ctrl+Enter). Cột hiện "Đã điền N trường", thanh tiến độ, danh sách chỗ cần xem lại có nút Xem và ✓ Đúng, nút hoàn tác. Trang Trình diễn luôn dùng giao diện này.

**Gọi phiếu mẫu theo bệnh** (`data/eform/phieu-mau.json`, `src/shared/eform/phieu-mau.ts`):

- Gõ hoặc nói tên mẫu vào bong bóng (hoặc ô nhập của cột cũ) rồi bấm Điền, ví dụ "mẫu viêm tai giữa cấp", "vtg cấp" hoặc "viem tai giua cap". Tên mẫu phải đứng đầu câu (có thể có "mẫu", "điền mẫu", "theo mẫu" phía trước) hoặc đứng ngay sau chữ "mẫu". Tên bệnh nằm giữa một câu kể cả ca thì vẫn chạy luồng AI tách như cũ.
- Đang gõ dở (2–40 ký tự) mà chưa khớp mẫu nào thì dưới ô nhập hiện "Mẫu theo bệnh:" với tối đa 5 tên, bấm là điền luôn. Tên khớp nhiều mẫu (bí danh trùng) thì hiện các tên mẫu để chọn.
- Chỉ có tên mẫu thì **không gọi API**: mẫu đã gán mã sẵn ở server lúc nạp trang và đổ thẳng vào phiếu.
- Có chi tiết sau tên ("vtg cấp, tai T, 3n, sốt 38,5") thì gọi `/api/extract` **một lần** với `mau_id`, phần chi tiết gửi làm `text`. Server lấy mẫu theo id. LLM nhận mẫu trong thẻ `<phieu_mau>`, được dặn giữ nguyên câu chữ, chỉ thay chỗ trống và sửa đúng chỗ bác sĩ nói. Sau đó code chạy thêm quy tắc `dienChoTrongNhap` cho chỗ trống LLM còn bỏ sót. Quy tắc:
  - `T`→trái, `3n`→3 ngày, "hai bên"→2 bên.
  - "phải/trái" chỉ tính khi đứng sau từ chỉ vị trí (tai, mũi, bên, họng…) hoặc đứng riêng một vế, nên động từ "phải" không bị hiểu là bên phải.
  - Nhiệt độ lấy số sau "sốt" trong khoảng 35–42, không lấy "sốt 2 ngày".
  - `[số]` không tìm được số thì giữ nguyên.

  Ở chế độ `mock` chỉ chạy quy tắc. Chỗ không hiểu thì giữ nguyên ngoặc và tô vàng. Gọi AI lỗi (quá tải, hết lượt) thì vẫn điền theo mẫu bằng quy tắc, kèm thông báo đỏ. Bác sĩ gõ vào ô nào trong lúc chờ AI thì ô đó được giữ. Mã ICD của mẫu chỉ dùng khi chẩn đoán LLM trả về vẫn là bệnh của mẫu; khác thì gợi ý mã theo từ khóa như luồng thường. Mã dịch vụ, thuốc vẫn qua bước khớp danh mục như mọi nháp.
- **Chỉ điền ô còn trống**: ô đã có chữ (điều dưỡng nhập sẵn, AI điền lần trước, bác sĩ gõ) giữ nguyên. Riêng Hẹn tái khám "Không" mặc định vẫn được đổi theo mẫu, trừ khi bác sĩ đã tự chọn. Chỉ định, thuốc trùng thì bỏ. Ô Khám các bộ phận khác cũng lấy từ mẫu.
- Chỗ riêng của bệnh nhân trong mẫu (`[phải|trái|2 bên]`, `[số] ngày`) hiện vàng để bác sĩ sửa. Mã ICD10 tra theo tên ICD của mẫu, luôn vàng như mọi mã ICD AI điền.
- Thông báo: "Đã điền theo mẫu …: N ô, X chỉ định, Y thuốc. Bỏ qua K ô đã có chữ." Giao diện cũ thêm "Còn M chỗ cần điền (tô vàng)"; giao diện gọn bỏ câu này vì nút "Xem N ô vàng" đã đếm (hai số đếm hai thứ khác nhau, để cả hai dễ rối). Hoàn tác dùng chung nút hoàn tác. Lưu thì số đo lượt thử ghi thêm `mau_id`, trang Kết quả hiện "Mẫu <id>".

**Gợi ý chữ mờ, bấm Tab để nhận** (`src/shared/eform/goi-y-tab.ts`, ô nhập `TextBox` trong `src/client/eform/fields.tsx`):

- Trong các ô chữ tự do của phiếu khám (lý do khám, bệnh sử, khám toàn thân, khám chuyên khoa, khám các bộ phận khác, hướng điều trị, lời dặn…), khi con trỏ ở cuối ô, câu gợi ý hiện mờ ngay sau con trỏ. **Tab** nhận, **Esc** bỏ qua (gõ tiếp thì gợi ý quay lại). Dưới ô có dòng nhắc phím; bác sĩ đã nhận 2 lần thì dòng nhắc thôi hiện.
- Ba kiểu gợi ý:
  1. Đang gõ dở một câu hoặc vế sau dấu phẩy (từ 2 ký tự): gợi ý câu bắt đầu như vậy. Khớp không dấu, nên gõ "giu kho" ra "Giữ khô tai…"; nhận thì sửa luôn dấu và chữ hoa (vế sau dấu phẩy giữ chữ thường).
  2. Ô trống hoặc vừa hết câu: gợi ý câu tiếp theo chưa có trong ô (ô khám xuống dòng). Chỉ lấy câu **đủ chắc**, tức không phải câu chỉ có ở bệnh khác: ca đau tai chưa có mã ICD thì ô trống không hiện "Súc họng nước muối ấm.", gõ "suc h" thì vẫn gợi ý.
  3. Chữ cuối là mã gõ tắt của ô đó (hoặc từ ngắn `tu`): gợi ý bung mã, hiện "→ câu".
- Nguồn câu, xếp theo thứ tự: bộ gõ tắt của tài khoản đang đăng nhập và lời dặn đã kê cho đúng mã ICD đang chọn; câu trong phiếu mẫu của bệnh khớp ngữ cảnh (mã ICD, hoặc tên/bí danh mẫu có trong lý do khám, mô tả chẩn đoán); thư viện tham khảo (`data/eform/thu-vien.json`); cuối cùng là câu của bệnh khác. Câu gặp ở nhiều nguồn được cộng điểm.
- Câu còn chỗ trống `[a|b]`, `[số]` bị bỏ vì đó là kết quả khám bác sĩ phải tự chọn. Câu đã có trong ô hoặc gần trùng (từ 70% số từ đã có) không gợi ý lại.
- Không gọi LLM, chạy hết trên trình duyệt.
- Chỉ hiện khi bác sĩ đã bấm chuột vào ô hoặc gõ: dùng phím Tab để đi qua các ô thì Tab vẫn chuyển ô như thường.
- Ô chữ của phiếu giờ cao theo nội dung (không cuộn bên trong, không kéo đổi cỡ được) để chữ mờ luôn thấy hết.
- Tắt để đo lượt đối chứng: mở `/?goi-y=tat` (giao diện cũ thì bỏ tích "Gợi ý chữ mờ, bấm Tab để nhận" ở dòng Chú giải).

**Bộ gõ tắt riêng của bác sĩ** (như macro UniKey; `src/shared/eform/go-tat.ts`, `src/server/du-lieu/go-tat.ts`):

- Mỗi tài khoản một file `data/go-tat/<tài khoản>.json` (không đưa lên git vì có thể là câu chữ thật của bác sĩ, định dạng xem `data/go-tat/README.md`). Chưa có file thì dùng bộ giả `data/eform/go-tat-mau.json`. Mỗi mã gắn với một ô: `kham_toan_than`, `kham_chuyen_khoa`, `kham_khac`, `chan_doan_chinh`, `loi_dan`… hoặc `tu` (từ ngắn bung tại chỗ, ví dụ `k` → không).
- Gõ các mã vào bong bóng Trợ lý (hoặc cột cũ), ví dụ `ttbt tbt mv hv, vmx, ldmh rm`, rồi bấm Điền. Mỗi mã bung **đúng câu của bác sĩ** vào đúng ô, không gọi AI. Nhiều mã cùng ô thì nối theo thứ tự gõ (ô khám xuống dòng, ô khác thêm dấu chấm nếu câu trước chưa có). Mã phân biệt hoa thường và phải đứng riêng (`tbt:` hay `ktbt` không tính). Chỉ điền ô còn trống, như phiếu mẫu.
- Mã chẩn đoán (`vmx` → viêm mũi xoang cấp) còn gọi mẫu theo bệnh cùng tên, để có chỉ định và đơn thuốc; câu gõ tắt thay câu mẫu ở cùng ô. Phần không phải mã đi tiếp vào luồng mẫu hoặc AI như cũ, với từ ngắn đã bung.
- **AI viết theo câu quen của bác sĩ**: `/api/extract` nhận thêm `tai_khoan`; server đưa các câu trong bộ gõ tắt vào system prompt (thẻ `<cau_quen>`, theo từng trường). Bác sĩ nói "tai bình thường" thì AI ghi nguyên văn câu tả tai bình thường của bác sĩ đó. Ô Khám các bộ phận khác và từ ngắn không đưa vào prompt.
- Thông báo: "Đã điền gõ tắt tbt, mv…: N ô." hoặc thêm "Gõ tắt: …" vào thông báo mẫu/AI.

| Quy tắc | Chi tiết |
|---|---|
| Màu | Tím = AI điền (vạch tím bên trái ô; giao diện cũ tô thêm nền tím). Vàng = AI chưa chắc, cần xem lại (vạch và nền vàng; bấm "✓ Đúng" ngay cạnh nhãn trường hoặc trong cột AI cũ, hoặc sửa để bỏ đánh dấu). |
| Không ghi đè | Ô bác sĩ đã gõ hoặc đã sửa thì AI không ghi đè (thông báo ghi "Bỏ qua K ô đã có chữ"). |
| Mã ICD10 | Không lấy từ LLM. Code chấm điểm từ khóa trên câu chẩn đoán để gán mã, luôn đánh dấu vàng. |
| Mã dịch vụ, thuốc | Do `src/shared/match.ts` khớp danh mục. Khớp chưa chắc thì dòng vàng, có ô chọn lại: bấm vào hiện ứng viên AI tìm được, gõ để tìm trong cả danh mục. |
| Ô tìm danh mục | Tìm dịch vụ, tìm thuốc, ICD10 đều là ô gõ để tìm (`TimDanhMuc.tsx`, tìm mờ theo tên, tên khác, hoạt chất, mã; hiểu từ viết tắt), hiện tối đa 30 kết quả. Mục có nhãn **DM BV** là danh mục bệnh viện. |
| Nói nhiều lần | Lần điền sau chỉ thêm dòng chỉ định/thuốc chưa có (trùng mã thì bỏ qua). |
| Đơn thuốc | Cột **Khi cần** cho thuốc dùng khi đau, khi sốt: tích vào thì ô Lần/ngày thành số lần tối đa, được để trống. AI tự tích khi bác sĩ nói "khi đau", "khi sốt", "khi cần" (bộ mẫu cũ ghi "Khi đau" ở Thời điểm cũng được tính). Ô **Tổng SL** gõ được: bác sĩ nói "kê 10 viên" thì AI điền 10; để trống thì tự tính theo `config/canh-bao.json` (số tự tính hiện mờ trong ô). Thuốc khi cần chưa có số lần, chưa có tổng thì ô viền vàng. Thuốc cùng nhóm với dị ứng trên header (ví dụ Penicillin → Augmentin, Amoxicillin) hiện cảnh báo đỏ; danh sách nhóm chỉ là minh họa. |

**✨ Gợi ý theo chẩn đoán** nằm đầu tab Chỉ định dịch vụ và tab Đơn thuốc:

- Lấy mã ICD10 đang chọn trên phiếu khám (ra viện, ban đầu, kèm theo; do bác sĩ chọn hoặc Trợ lý AI điền), tìm bộ mẫu khớp trong `data/eform/goi-y-theo-chan-doan.json` và liệt kê dịch vụ, thuốc kèm liều, lời dặn theo từng chẩn đoán. Giao diện cũ: tab nào có gợi ý thì hiện ✨ trên tên tab.
- **Giao diện gọn:** chưa có mã hay không còn gì để thêm thì không hiện gì. Có thì chỉ một dòng: "Anh/chị hay kê cho H66.0: …" (hoặc "Bộ mẫu cho …") với tên các mục tích sẵn, nút **Thêm N**, và "Chọn từng mục" để mở danh sách đủ như dưới. Thuốc bị bỏ tích vì trùng dị ứng vẫn hiện tên và lý do bằng chữ đỏ ngay trong dòng đó.
- **Không tự thêm gì.** Bác sĩ tích chọn rồi bấm "Thêm N mục đã chọn". Mục đã có trong danh sách hoặc trùng gợi ý phía trên thì làm mờ. Thuốc cùng nhóm dị ứng trên header (ví dụ Augmentin khi dị ứng Penicillin) không được tích sẵn và có cảnh báo đỏ.
- Lời dặn mẫu có nút "Chèn vào Lời dặn" (thêm vào cuối ô Lời dặn & theo dõi, đánh dấu AI điền).
- Bộ mẫu chỉ ghi tên dịch vụ và thuốc. Mã do `src/shared/match.ts` gán khi nạp trang; khớp chưa chắc thì dòng hiện vàng "cần xem lại".
- Chạy bằng rule, không gọi LLM. **12 bộ mẫu hiện có đều là dữ liệu giả, liều chỉ minh họa**; sẽ thay bằng danh sách bệnh hay gặp do bác sĩ đưa.
- **Đơn anh/chị đã kê (theo thói quen từng bác sĩ).** Mỗi lần bấm Lưu khi phiếu đã có mã ICD10 chính (chẩn đoán ra viện, chưa có thì ban đầu) và có ít nhất một dòng chỉ định hoặc thuốc, server ghi lại các dòng đó cùng lời dặn vào `data/thoi-quen/<tài khoản>.json` (không đưa lên git, giữ 200 lần gần nhất). Một lượt mở phiếu là một lần kê: Lưu lại nhiều lần thì ghi đè, không đếm thêm. Lần sau, với cùng mã ICD10 chính, nhóm "Đơn anh/chị đã kê N lần trước" đứng đầu khung gợi ý. Mỗi dòng hiện "kê x/N lần", lấy liều của lần gần nhất. Dòng kê từ một nửa số lần trở lên được tích sẵn; khi đã có nhóm này thì bộ mẫu chung không tích sẵn dòng nào. Mã đã lưu mà không còn trong danh mục thì dòng hiện vàng "cần xem lại". Nhóm này chỉ có sau khi bác sĩ đã Lưu, lần đầu chưa có gì.
- Tài khoản là `dang_nhap` trong `data/eform/ca-gia.json` (`user_bs01`). Nhiều bác sĩ thử chung một máy thì mở `/?bs=user_bs02`, `/?bs=user_bs03`… để thói quen không lẫn nhau (tên chỉ gồm chữ, số, `_`, `-`). Tên tài khoản hiện ở góc phải header.

Ở chế độ `mock`, câu mẫu của ca `data/cases/ca-11-viem-tai-giua-man-dot-cap.json` (cùng bệnh nhân giả với trang này) trả kết quả soạn sẵn; câu khác được tách bằng quy tắc nên kém hơn LLM thật.

Các điểm AI cũ vẫn nằm ngay tại ô, **đều là mock bằng rule, không gọi LLM**:

| Điểm AI | Cách hoạt động | Giới hạn |
|---|---|---|
| ✨ AI tóm tắt (Tiền sử bản thân, Tiền sử gia đình, Bệnh sử) | Trích câu có sẵn, gộp câu trùng qua các lần khám. Câu khác bên phải/trái hoặc khác số liệu không bị gộp. Bác sĩ sửa rồi mới chèn. **Đang ẩn** cùng các bảng "Thông tin khai thác" (lịch sử tiền sử, bệnh sử, dị ứng kèm nút Copy); đổi `HIEN_THONG_TIN_KHAI_THAC` ở đầu `src/client/eform/EformForm.tsx` thành `true` để hiện lại. | Không diễn đạt lại, nên rút gọn ít hơn LLM thật |
| ✨ Gợi ý ICD10 (top 3) | Chấm điểm từ khóa trong Bệnh sử và Khám lâm sàng, có xét phủ định ("không sốt"). Đoạn tóm tắt lịch sử cũ và chỗ `[ ]` chưa chọn không được tính. Giao diện gọn không có nút: ô chẩn đoán ban đầu, ra viện còn trống thì dưới ô hiện một dòng tối đa 2 mã (`GoiYIcdDong`), bấm là chọn; chẩn đoán kèm theo không gợi ý. | **Độ tin cậy chỉ là điểm khớp từ khóa, không phải xác suất bệnh** |
| ✨ Gợi ý mẫu câu | Chọn mẫu Tai/Mũi/Vòm/Họng theo Lý do đến khám. Kết quả khám để trống cho bác sĩ chọn, AI không tự điền. **Chỉ có ở giao diện cũ.** | Chỉ có 7 nhóm lý do khám mẫu |

Nhãn trên giao diện: **✨ AI điền**, **⚠ AI chưa chắc, cần xem lại**, **Đã sửa**, **(Hiển thị trên báo cáo y tế)**; giao diện gọn chỉ còn **⚠ Cần xem lại** và nhãn báo cáo y tế. Nút "Báo cáo y tế" cho xem trước báo cáo: khối hành chính (họ tên, giới, PID, thời gian khám, bác sĩ, dị ứng), các trường có nhãn BCYT, chẩn đoán chính (chẩn đoán ra viện, chưa có thì chẩn đoán ban đầu) và chẩn đoán kèm theo. Ảnh chụp EMR chỉ thấy nhãn BCYT ở chẩn đoán kèm theo; việc đưa chẩn đoán chính và hành chính vào là giả định, cần xác nhận với bác sĩ.

Các nút lấy dữ liệu từ hệ thống khác, Menu, Xem LSKB và Quay lại chỉ hiện thông báo mô phỏng. Nút Lưu không ghi nội dung phiếu xuống đĩa. Nó chỉ ghi số đo lượt thử (xem mục Đo lường) và các dòng chỉ định, thuốc cho gợi ý theo thói quen. Tải lại trang là phiếu về dữ liệu ban đầu.

### Trang Trình diễn (`/trinh-dien`, tạm ẩn)

> Từ 2026-11-12 trang này tạm ẩn: không còn link ở thanh đầu, mở `/trinh-dien` ra 404. Code và kịch bản vẫn giữ nguyên, bật lại bằng cách khôi phục `src/app/trinh-dien/page.tsx` (xem ghi chú trong file).

Dùng trong buổi họp với bác sĩ, để cho thấy "làm việc với AI" cụ thể là thế nào. Vẫn là phiếu eForm với ca giả như trên. Thanh trên cùng chọn một trong 4 kiểu tương tác. Mỗi lần chọn (hoặc bấm "↺ Làm lại từ đầu") phiếu mở lại từ đầu theo kiểu đó. Thẻ giải thích ghi kiểu này giống thứ gì bác sĩ đã quen, dùng lúc nào, bác sĩ làm gì, máy làm gì, bác sĩ cần kiểm tra gì. Giải thích xong thì bấm "Ẩn giải thích" để cột Trợ lý AI hiện trọn trên màn laptop.

| Kiểu | Phiếu mở ra thế nào | Gọi LLM? |
|---|---|---|
| 1. Máy điền sẵn | Đã có nháp AI của câu mẫu (kết quả soạn sẵn, server đổ sẵn vào phiếu) | Không |
| 2. Bấm một lần | Đã chọn H66.1, mở tab Đơn thuốc, có "Đơn anh/chị đã kê 3 lần trước" (giả) | Không |
| 3. Nói một câu | Đã chọn H66.1, ô nhập có câu "Kê như mọi khi, thêm Cetirizin… Hẹn tái khám sau 7 ngày." | Có, khi bấm Điền |
| 4. Nghe cả buổi khám | Nút "▶ Bắt đầu nghe buổi khám" phát lại 12 câu hội thoại giả vào ô nhập (`BS: …`, `BN: …`), mỗi câu khoảng 1,4 giây, không dùng micro | Có, khi bấm Điền |

- Câu lệnh "kê như mọi khi", "như lần trước", "đơn quen"… dùng được ở cả trang chính. Máy lấy các dòng bác sĩ hay kê (kê từ một nửa số lần trở lên) cho chẩn đoán chính trên phiếu; phiếu chưa có thì dùng mã AI vừa gán. Các dòng này đứng trước dòng AI tách từ câu nói. Chưa có đơn đã kê thì thông báo không lấy được bộ quen.
- Prompt LLM hiểu hội thoại: lời bệnh nhân (`BN:`) chỉ dùng cho lý do khám, bệnh sử, tiền sử; khám, chẩn đoán, chỉ định, thuốc, lời dặn chỉ lấy từ lời bác sĩ.
- Ở trang này, bấm Lưu không ghi số đo lượt thử hay đơn đã kê.
- Kiểu 3, 4 chạy với `mock` thì tách bằng quy tắc nên kém. Nên dùng LLM thật. Gemini miễn phí thỉnh thoảng báo 503 quá tải: phiếu hiện "AI đang quá tải, bấm Điền lại sau vài giây" (`src/shared/loi-ai.ts` đổi lỗi tiếng Anh thành câu tiếng Việt, chi tiết lỗi chỉ in ở terminal), bấm lại là được.
- Kịch bản (chữ trên thẻ, câu lệnh, hội thoại, 3 đơn đã kê giả) ở `data/eform/trinh-dien.json`. Sửa rồi tải lại trang là có hiệu lực.

| File trong `data/eform/` | Nội dung |
|---|---|
| `ca-gia.json` | Ca giả và lịch sử khám |
| `trinh-dien.json` | Kịch bản trang `/trinh-dien`: `kieu` (chữ trên thẻ của 4 kiểu), `lenh` (câu kiểu 3), `hoi_thoai` (hội thoại kiểu 4, `ai` là `BS` hoặc `BN`), `thoi_quen` (đơn đã kê giả, chỉ ghi tên; mã gán bằng `src/shared/match.ts` khi nạp trang) |
| `go-tat-mau.json` | Bộ gõ tắt giả, dùng khi tài khoản chưa có `data/go-tat/<tài khoản>.json`: `ma`, `o` (ô nhận câu), `noi_dung` |
| `go-tat-ca.json` | Ca giả cho `npm run eval-go-tat`: `noi` (bác sĩ nói tự do), `mong_doi` (theo trường: các mã có câu phải ra nguyên văn) |
| `phieu-mau.json` | Phiếu mẫu theo bệnh (giả), bác sĩ gọi bằng tên trong ô Trợ lý AI. Mỗi mẫu: `id`, `ten`, `bi_danh` (viết tắt, cách gọi khác; không trùng giữa các mẫu, tránh từ ngắn dễ nhầm như "va"), `icd_ten` (đúng tên một mã trong `data/tham-khao/icd10-tmh.json`, mã do code tra), `kham_khac` (ô Khám các bộ phận khác), `nhap` (cùng dạng nháp của `config/forms`: `phieu_kham`, `chi_dinh`, `ke_don`; không có trường mã). Chỗ riêng của bệnh nhân viết `[phải\|trái\|2 bên]` hoặc `[số] ngày` (đơn vị: ngày, tuần, tháng, giờ, độ, lần, kg). Không ghi `so_luong` chỉ định khi là 1 (eForm tự hiểu là 1). Sửa xong chạy `npm test` để chắc mọi mẫu tra được ICD và mọi dòng khớp chắc danh mục |
| `goi-y-theo-chan-doan.json` | Bộ mẫu chỉ định, thuốc, lời dặn theo mã ICD10 (giả). Mỗi mẫu: `id`, `ten`, `icd` (danh sách mã), `chi_dinh` (`ten`), `don_thuoc` (`ten`, `ham_luong`, `duong_dung`, `lieu_moi_lan`, `so_lan_ngay`, `thoi_diem`, `so_ngay`, `ghi_chu`, không bắt buộc `so_luong_ke`), `loi_dan`. Thuốc có `thoi_diem` bắt đầu bằng "Khi" được coi là dùng khi cần. Tên nên có trong danh mục bệnh viện `data/catalog/` để khớp chắc mã |
| `icd10.json` | Từ khóa gợi ý ICD10 (`manh`, `vua`) cho 29 mã TMH hay gặp. Danh sách mã để chọn lấy từ `data/tham-khao/icd10-tmh.json` (367 mã chi tiết); mã ở đây mà nguồn thật không có vẫn được giữ |
| `mau-cau.json` | Mẫu câu theo nhóm lý do khám, chỗ trống viết dạng `[a\|b]` |
| `quy-tac.json` | Ngưỡng tóm tắt, cách tính điểm, từ phủ định |
| `thu-vien.json` | Thư viện mẫu câu tĩnh của các ô khác |
| `tuy-chon.json` | Danh sách trạng thái và lựa chọn |

## Cấu trúc thư mục

```
config/         cấu hình form, màu, viết tắt, cảnh báo
data/catalog/   danh mục bệnh viện soạn tay (khớp trước danh mục thật)
data/cases/     ca giả
data/sessions/  kết quả các lượt thử (tự sinh, không đưa lên git)
data/go-tat/    bộ gõ tắt riêng từng tài khoản bác sĩ (không đưa lên git, trừ README)
data/thoi-quen/ đơn từng tài khoản bác sĩ đã Lưu, cho gợi ý theo thói quen (tự sinh, không đưa lên git)
data/giong-noi/ file âm thanh để đo nhận dạng giọng nói (tự sinh hoặc tự ghi, không đưa lên git, trừ README)
data/eform/     ca giả, danh mục và quy tắc của trang eForm
data/tham-khao/ danh mục thật cào từ nguồn công khai, ứng dụng nạp kèm data/catalog/
src/app/        trang và API (định tuyến Next, mỏng)
src/client/     giao diện chạy trên trình duyệt: chung/ (Header, MicButton), eform/ (trang chủ; BongBongAi.tsx bong bóng trợ lý, TroLyAi.tsx cột cũ, useDienAi.ts logic điền dùng chung), trinh-dien/ (trang Trình diễn), ket-qua/, api.ts (gọi API)
src/server/ai/  AI thật: pipeline, prompt, schema, llm/ (mock, rules, anthropic, openai, gemini), asr.ts (Zipformer)
src/server/du-lieu/ nạp config và data, lưu lượt thử và đơn đã kê, dữ liệu trang Trình diễn (trinh-dien.ts)
src/shared/     dùng chung hai phía: kiểu, khớp danh mục, chuẩn hóa, tính tổng, đo lường, api.ts (hợp đồng FE–BE)
src/shared/eform/ rule của trang eForm: tóm tắt, gợi ý ICD10, mẫu câu, gợi ý theo chẩn đoán và theo thói quen (thoi-quen.ts), gợi ý chữ mờ bấm Tab (goi-y-tab.ts), cảnh báo dị ứng, đổ kết quả AI vào phiếu, đếm số đo lượt thử (do-luong.ts)
src/shared/giong-noi/ sửa chữ sau nhận dạng giọng nói (sua-chu.ts), đọc số thành chữ để chấm (so.ts)
scripts/eval.ts chấm điểm
scripts/eval-giong-noi.ts đo nhận dạng giọng nói trên data/giong-noi/
scripts/tao-am-thanh-mau.ts (+ tts-windows.ps1) giọng máy Windows đọc các ca thành file âm thanh mẫu
scripts/cao-du-lieu.ts cào danh mục công khai về data/tham-khao/
scripts/tai-model-giong-noi.ts tải model Zipformer và Silero VAD về models/
models/         model nhận dạng giọng nói (tự tải, không đưa lên git)
docs/           quan sát thực địa, cấu trúc màn hình EMR, kịch bản thử với bác sĩ, CHANGELOG.md
.claude/        cấu hình Claude Code: plugin, hook, skill
```

Chi tiết ranh giới FE/BE, AI đặt ở đâu, cái gì dùng lại được và thêm mới thì đặt ở đâu: xem `docs/cau-truc-du-an.md`. `npm run lint` chặn import sai chiều (giao diện không được import `src/server`).

Mọi thay đổi đều được ghi trong `docs/CHANGELOG.md`. Quy tắc làm việc với Claude Code xem `CLAUDE.md`.
