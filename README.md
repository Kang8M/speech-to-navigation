# Trợ lý điền bệnh án TMH – Prototype

**Luồng hiện tại (17/11/2026):** STT → máy chủ che PII tự động (R1–R14, chốt chặn R11) → AI tạo JSON phiếu khám và chỉ định → bác sĩ sửa, lưu, duyệt và in. **Kê đơn ngoài scope**, do bác sĩ làm riêng. Hướng dẫn đầy đủ: [docs/CLINICAL-WORKFLOW.md](docs/CLINICAL-WORKFLOW.md). Sơ đồ draw.io hai luồng chính (nói → phiếu khám, gõ tắt) và bước lọc dữ liệu nhạy cảm R1–R14: [docs/so-do/luong-chinh.drawio](docs/so-do/luong-chinh.drawio). Mở bằng app.diagrams.net hoặc draw.io desktop. eForm và `/demo-luong` cùng dùng bộ rule này.

## Demo luồng dữ liệu (`/demo-luong`)

Mở **[http://localhost:3000/demo-luong](http://localhost:3000/demo-luong)** để trình diễn trọn luồng: ① ghi âm (micro, file WAV hoặc kịch bản mẫu trong `data/demo-luong/kich-ban/`) → ② bản thô (tô đỏ, rê chuột thấy mã rule) → ③ bản đã che tự động (nhãn xanh, chốt chặn R11; còn sót thì tự che thêm rồi kiểm lại, xem kịch bản `ca-tu-che`) → ④ AI (mock) → ⑤ phiếu đọc lại từ kho để bác sĩ sửa và duyệt. Một phiếu có nhiều phiên ghi âm; "+ Phiếu khám mới" mở phiếu khác. Công tắc **Bác sĩ / Lãnh đạo | Kỹ thuật**: chế độ Kỹ thuật mở chi tiết từng bước (đếm theo rule, nguyên văn dữ liệu gửi AI, phiên bản rule/prompt/schema, JSON phiếu, dòng nhật ký). Bản thô chỉ nằm trong bộ nhớ trình duyệt; dữ liệu chạy lưu ở `data/demo-luong/` (gitignore), nút "Xóa dữ liệu demo" xóa sạch. Nguồn micro/WAV cần dịch vụ STT local (`npm run stt:start`).

## Thử nghiệm STT local từ P-018

Mở **[http://localhost:3000/stt](http://localhost:3000/stt)** để thử model **Zipformer tiếng Việt INT8**, chạy CPU qua sherpa-onnx. Trang này có phiên micro liên tục, trả văn bản dần trong lúc nói, tải file âm thanh và thời gian suy luận. Phần STT được tách riêng từ P-018; không mang theo TTS, LLM, tin nhắn hay điều khiển xe.

Trong PowerShell tại thư mục dự án:

```powershell
# Máy này đã được cài dependency và tải trọng số trong lần tách code.
# Chạy lại sau khi khởi động máy hoặc khi dịch vụ đã dừng:
npm run stt:start

# Cài đầy đủ trên máy mới: cần Python 3.12+ và Node.js 20.12+.
npm run stt:setup
```

`stt:setup` tạo `.venv-stt`, cài thư viện theo `stt/requirements-lock.txt`, tải riêng model STT tại revision cố định và chạy nhận dạng file mẫu thật. Cần internet khi cài/tải lần đầu. Sau đó, nhận dạng chạy local, không cần API key, GPU hoặc internet.

`stt:start` chạy backend ở `127.0.0.1:8765` và Next.js ở `127.0.0.1:3000` dưới nền. Có thể chạy lại lệnh để dùng dịch vụ đang hoạt động. Log và PID nằm trong `logs/`. Nếu đã chạy Next.js bằng `npm run dev`, chỉ cần khởi động backend:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-stt.ps1 -BackendOnly
```

Micro cần Chrome/Edge, localhost hoặc HTTPS và quyền micro. Phiên micro không có giới hạn thời gian: âm thanh được tách tại khoảng nghỉ hoặc tối đa mỗi 5 giây, trả text dần và nối theo thứ tự. Bấm “Kết thúc phiên” để dừng micro và nhận nốt các đoạn còn lại. File tải lên không giới hạn thời lượng/dung lượng ở ứng dụng, hỗ trợ WAV/MP3/M4A/WebM/Ogg/FLAC tùy bộ giải mã của trình duyệt. Trình duyệt đổi âm thanh sang WAV PCM16 mono 16 kHz trước khi gửi tới backend. Âm thanh và văn bản chỉ nằm trong bộ nhớ; không ghi lịch sử bản thu.

Thêm thuật ngữ bằng cách sửa `config/stt-hotwords.json`, đặt danh sách trong `phrases` (xem ví dụ trong docs/STT.md). Danh sách áp dụng từ đoạn nhận dạng tiếp theo, không cần huấn luyện lại. Đã tích hợp phân biệt 2 giọng và gắn từ theo timestamp: nhãn Người nói 1/2 giữ trong phiên, chưa tự gán vai bác sĩ/bệnh nhân. Text tạm thời được sửa/ghép lại khi nhận thêm âm thanh, nên một lượt nói 8 giây bị gửi thành 5+3 giây vẫn hiển thị liền mạch.

File mẫu có sẵn tại `models/stt/zipformer-vi/test_wavs/` sau khi setup. Chi tiết nguồn code, API, kiểm thử, chạy thủ công và giới hạn: **[docs/STT.md](docs/STT.md)**.

Bác sĩ **nói** hoặc **gõ tắt** một đoạn tóm tắt; AI tách ra và điền nháp **Phiếu khám và Chỉ định dịch vụ** sau bước kiểm tra riêng tư; bác sĩ duyệt, sửa rồi xác nhận.

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

Các trang `/dashboard`, `/benh-nhan/...` và API `/api/clinic/*` chỉ kiểm header Host/Origin/Sec-Fetch-Site (chặn trình duyệt gọi chéo origin và DNS rebinding); client không phải trình duyệt tự đặt được Host nên không bị chặn. Muốn máy khác trong mạng không vào được, chạy `npx next dev -H 127.0.0.1` (đừng dùng `-H 0.0.0.0`), nhưng hãy mở trang bằng `localhost`: eForm gọi guard của lớp clinical và báo "Nguồn yêu cầu không hợp lệ" nếu truy cập bằng `127.0.0.1`.

Dashboard (`/dashboard`) và hồ sơ bệnh nhân (`/benh-nhan/<PID>`) đọc phiếu khám thật của lớp clinical (`data/clinical/encounters`) cùng 4 phiếu cũ giả trong `data/clinic/history/` (tạo lại bằng `npm run tao-lich-su-clinic`). Lịch, bệnh nhân và danh bạ nằm ở `data/clinic/`, cùng định danh với `data/eform/encounter-contexts.json`; lịch chỉ mở được phiếu khi có ngữ cảnh khám tương ứng. Từ popup lịch hẹn hoặc màn bệnh nhân bấm "Mở phiếu khám" để sang eForm đúng bệnh nhân; "Xem phiếu" ở lịch sử mở toàn bộ phiếu cũ ở chế độ chỉ đọc. Bộ 8 ca dùng cho test nằm ở `data/clinic-test/`.

Khởi động lại `npm run dev` sau khi sửa `.env.local`. Header của ứng dụng hiện chế độ đang dùng.

## Nhập giọng nói

Nút micro trên **màn hình làm việc cũ** dùng Web Speech API của Chrome (`vi-VN`), chạy trên localhost. Trình duyệt không hỗ trợ thì nút 🎤 tự ẩn và chỉ còn ô gõ. Trang **`/stt`** ở trên dùng model Zipformer local riêng.
Có hai chế độ, chọn bằng `ASR_PROVIDER` trong `.env.local`:

| `ASR_PROVIDER` | Cách chạy | Ghi chú |
|---|---|---|
| `web` (mặc định) | Web Speech API của Chrome (`vi-VN`), hiện chữ ngay khi đang nói | **Gửi âm thanh lên Google, cần internet.** Trình duyệt không hỗ trợ thì nút 🎤 tự ẩn |
| `zipformer` | Trình duyệt gửi âm thanh mỗi 0,4 giây lên `/api/asr` của chính prototype; model Zipformer tiếng Việt (`csukuangfj/sherpa-onnx-zipformer-vi-int8-2025-04-20`, encoder ~70 MB, ở `models/stt/zipformer-vi/`, dùng chung với trang `/stt`) nhận dạng trên máy. Đang nói thì hiện chữ tạm (in nghiêng dưới nút); ngắt nghỉ ~0,5 giây thì Silero VAD chốt câu và đưa vào ô | **Âm thanh không ra khỏi máy và không được lưu**, không cần internet. Tối đa 10 phút mỗi lần bấm |

Bật `zipformer`:

```bash
npm run tai-model-giong-noi   # tải Zipformer ~70 MB về models/stt/zipformer-vi/ (kiểm SHA-256) và Silero VAD về models/; không đưa lên git, đã có thì bỏ qua
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
npm run tao-am-thanh-mau     # Windows: giọng máy đọc 11 ca thành data/giong-noi/<id>.tts.wav
npm run eval-giong-noi       # thêm --chi-tiet để in từng câu, --nhan-lai để nhận dạng lại từ đầu
```

Mỗi file `.wav` trong `data/giong-noi/` đi qua đúng luồng VAD của ứng dụng rồi được so với câu `input_noi` của ca cùng id. Script in cho chữ thô và chữ sau khi sửa: **WER** (tỉ lệ từ sai, so cả dấu, số đổi thành chữ ở hai phía), **Mã** (số mã dịch vụ, mã thuốc bộ tách quy tắc vẫn ra đúng so với khi tách câu gốc), **Liều** (số dòng thuốc có liều, số lần/ngày, số ngày trùng câu gốc), và **Sửa nhầm trên câu gốc** (bộ sửa chạy trên câu đúng mà đổi mất bao nhiêu từ, nên bằng 0). Chữ thô được lưu cạnh file âm thanh nên chỉnh bảng sửa rồi chạy lại chỉ mất vài giây. Cách tự ghi âm để đo bằng giọng thật: `data/giong-noi/README.md`.

Kết quả trên giọng máy ngày 2026-11-11: WER 21,4% thành 10,5%, Mã 7/42 thành 22/42, Liều 0/24 thành 11/24, sửa nhầm 0. **Giọng máy khác người thật**, nên các số này chỉ để so trước và sau một lần sửa. Hotword của sherpa-onnx (ưu tiên cụm từ ngay lúc giải mã) đã thử với `modified_beam_search` nhưng không thấy tác dụng trên model này, nên chưa dùng.

**Dù dùng chế độ nào, chỉ dùng với dữ liệu giả.**

## Thêm hoặc sửa trường form

**Luồng mới:** sửa `config/clinical/*.schema.json`, chạy `npm run clinical:types` và `npm run clinical:check`. Các config/forms và eval bên dưới là bộ thử pipeline cũ, không còn là hợp đồng endpoint trích xuất hiện tại.

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
- `config/canh-bao.json`: cách tính tổng số lượng thuốc (`tinh_tong`). Các khóa tuổi trẻ em, cân nặng là của cảnh báo trên trang cũ đã bỏ, hiện không dùng.
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

Trên trang eForm, khi AI đã điền ít nhất một lần, lần bấm **Lưu** đầu tiên ghi một lượt thử thành file JSON trong `data/sessions/` (thông báo dưới đáy có câu "Đã ghi số đo lượt thử"). Bấm Lưu nữa thì không ghi thêm; muốn thử lượt mới thì tải lại trang. Chưa áp dụng AI thì không ghi metrics; hồ sơ clinical vẫn được lưu bình thường. File metrics chỉ chứa số đếm (thời gian, số trường AI điền, số trường sửa, số mục khớp danh mục, kiểu nhập), **không chứa nội dung phiếu hay thông tin bệnh nhân**.

Trang **Kết quả thử nghiệm** có bảng các lượt, số liệu trung bình và nút xuất CSV. Lượt dùng "Thử câu mẫu" không có thời gian nhập thật nên mặc định không tính vào số trung bình; có ô đánh dấu để tính cả.

- Thời gian: từ lúc bắt đầu nhập (gõ ký tự đầu, bấm 🎤 hoặc bấm câu mẫu) đến lúc bấm Lưu.
- Kiểu nhập: "Nói" nếu trong lượt có bấm 🎤 hoặc dùng câu mẫu kiểu nói, còn lại là "Gõ".
- AI điền: số trường phiếu khám AI điền cộng số dòng chỉ định, thuốc AI thêm (mỗi dòng tính một mục), cộng dồn qua các lần "Điền thêm".
- Đã sửa: trường AI điền mà bác sĩ đã sửa, cộng dòng AI thêm mà bác sĩ đã sửa hoặc xóa. Bấm "✓ Đúng" không tính là sửa.
- Bổ sung: ô bác sĩ tự gõ vào chỗ trống, cộng dòng bác sĩ tự thêm (kể cả chọn từ "Gợi ý theo chẩn đoán").
- Khớp danh mục: tính trên các dòng AI thêm, tại thời điểm AI điền, trước khi bác sĩ sửa.
- Cảnh báo: số chỗ còn "cần xem lại" lúc Lưu, cộng số thuốc trùng nhóm dị ứng.
- Hoàn tác lần AI điền thì số đếm của lần đó cũng bị trừ.
- Lượt ghi trước ngày 2026-11-11 đến từ trang "Màn hình làm việc" cũ (đã bỏ), cách đếm trên từng ô của form JSON nên không so trực tiếp được với lượt mới.

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

### Đo phiếu mẫu (`npm run eval-mau`)

```bash
npm run eval-mau                       # mock: không tốn lượt gọi
npm run eval-mau -- --provider=gemini  # mức 2 gọi LLM thật, mỗi ca có mẫu 1 lượt
```

Chấm phiếu mẫu (`data/eform/phieu-mau.json`) so với `expected` của các ca có `mau_id` trong `data/cases/`, cùng cách chấm với `npm run eval` (phần chấm dùng chung ở `scripts/cham-diem.ts`). **Mức 1** là chỉ có mẫu, tức bác sĩ chỉ gõ tên mẫu. **Mức 2** là mẫu kèm câu chi tiết ngắn `input_mau` của ca (ví dụ `"vtg cấp trẻ em, tai P, 3n, sốt 38"`). Script in thêm số "không tính tiền sử", vì mẫu không điền tiền sử, ô đó bác sĩ Copy từ lần khám trước. Đây chỉ là **ước tính**: mẫu và đáp án đều do nhóm soạn, số thật phải đo khi bác sĩ thử.

### Test (`npm test`)

`npm test` chạy các file `src/**/*.test.ts` và `lib/**/*.test.ts` bằng `node:test` qua `tsx` (không cần thư viện test riêng, có cờ `--conditions=react-server` nên test được cả code `src/server`). Test được import `node:*` kể cả trong `src/shared` (`eslint.config.mjs` tắt luật import cho `*.test.ts`).

## Mô phỏng eForm ngoại trú

Trang `/` có hai tab **Phiếu khám** và **Chỉ định dịch vụ**, dữ liệu giả. Trợ lý bên phải có bước lọc/xem lại transcript trước model và bước áp dụng bản nháp. Bác sĩ tự kê đơn trong quy trình riêng.

Trang chính mở theo **mã khám**: thanh **Lượt khám** ở đầu trang chuyển giữa các bệnh nhân (đang khám, chờ kết quả) hoặc mở mã khác; mỗi mã khám là một hồ sơ có nhiều phiên ghi âm. Nút **Lưu phiếu & chỉ định** ghi hồ sơ JSON có revision; **Tải bản lưu** và URL `?ho_so=...` khôi phục đúng hồ sơ. Duyệt theo từng phần (phiếu ban đầu, kết luận, tóm tắt, từng chỉ định); sửa phần nào chỉ phần đó cần duyệt lại. **Chờ kết quả**, **Tiếp tục khám**, **Hoàn tất lượt khám** đổi trạng thái lượt khám, tách khỏi việc duyệt. Đề xuất của AI hiện thành danh sách để bác sĩ chấp nhận hoặc từ chối từng mục. Chỉ in được khi mọi phần đã duyệt đúng bản đang lưu. Chuyển lượt khi phiếu chưa lưu hoặc còn nội dung chưa kiểm tra sẽ bị chặn hoặc hỏi lại.

Chi tiết endpoint, data model, riêng tư, nguồn dẫn, model và các giới hạn: [CLINICAL-WORKFLOW.md](docs/CLINICAL-WORKFLOW.md). Các nút kết nối hệ thống ngoài vẫn là mô phỏng. Mô tả eForm/pipeline cũ được giữ tại [tư liệu lịch sử](docs/legacy-eform-before-clinical.md).

## Cấu trúc thư mục

```
config/         cấu hình form, màu, viết tắt, cảnh báo
data/catalog/   danh mục bệnh viện soạn tay (khớp trước danh mục thật)
data/cases/     ca giả
data/sessions/  kết quả các lượt thử (tự sinh, không đưa lên git)
data/thoi-quen/ đơn từng tài khoản bác sĩ đã Lưu, cho gợi ý theo thói quen (tự sinh, không đưa lên git)
data/giong-noi/ file âm thanh để đo nhận dạng giọng nói (tự sinh hoặc tự ghi, không đưa lên git, trừ README)
data/eform/     ca giả, danh mục và quy tắc của trang eForm
data/tham-khao/ danh mục thật cào từ nguồn công khai, ứng dụng nạp kèm data/catalog/
src/app/        trang và API (định tuyến Next, mỏng)
src/client/     giao diện chạy trên trình duyệt: chung/ (Header, MicButton), eform/ (trang chủ), trinh-dien/ (trang Trình diễn), ket-qua/, api.ts (gọi API)
src/server/ai/  AI thật: pipeline, prompt, schema, llm/ (mock, rules, anthropic, openai, gemini), asr.ts (Zipformer)
src/server/du-lieu/ nạp config và data, lưu lượt thử và đơn đã kê, dữ liệu trang Trình diễn (trinh-dien.ts)
src/shared/     dùng chung hai phía: kiểu, khớp danh mục, chuẩn hóa, tính tổng, đo lường, api.ts (hợp đồng FE–BE)
src/shared/eform/ rule của trang eForm: tóm tắt, gợi ý ICD10, mẫu câu, gợi ý theo chẩn đoán và theo thói quen (thoi-quen.ts), cảnh báo dị ứng, đổ kết quả AI vào phiếu, đếm số đo lượt thử (do-luong.ts)
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
