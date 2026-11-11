# Nhật ký thay đổi

Mỗi thay đổi, dù nhỏ, đều có một mục ở đây. Mục mới nhất ở trên cùng. Cách ghi xem `.claude/skills/ghi-tai-lieu/SKILL.md`.

## 2026-11-10

### Nhận dạng giọng nói trên máy bằng Zipformer (`ASR_PROVIDER=zipformer`)
- **Loại:** Tính năng, Phụ thuộc, Cấu hình
- **Thay đổi:**
  - Thêm phụ thuộc `sherpa-onnx-node` (2.0.1, kèm gói native `sherpa-onnx-win-x64`), khai báo `serverExternalPackages` trong `next.config.ts` để Node nạp trực tiếp file `.node`.
  - `scripts/tai-model-giong-noi.ts` + lệnh `npm run tai-model-giong-noi`: tải `sherpa-onnx-zipformer-vi-30M-int8-2026-02-09` (~26 MB, từ release công khai của k2-fsa/sherpa-onnx, gốc là model hynt/Zipformer-30M-RNNT-6000h) và `silero_vad.onnx` về `models/`, giải nén bằng `tar` có sẵn. Đã có thì bỏ qua.
  - **Chữ hiện ra trong lúc nói như Web Speech** dù model là loại không streaming, bằng cách nhận dạng hai lớp trong một phiên (`lib/asr.ts`, lớp `PhienNhanDang`): trình duyệt gửi mẩu âm thanh mỗi 0,4 giây; khi VAD thấy đang có tiếng nói thì nhận dạng lại phần câu đang nói dở để trả **chữ tạm**; khi Silero VAD thấy ngắt nghỉ ≥ 0,5 giây (câu tối đa 20 giây) thì nhận dạng cả câu và trả **câu chốt**. Chữ in hoa của model được đổi sang chữ thường, viết hoa chữ đầu, thêm dấu chấm cuối câu. `OfflineRecognizer` tạo một lần (2 luồng CPU, greedy search). Phiên giữ trong bộ nhớ server, tối đa 10 phút, bỏ sau 60 giây không nhận thêm âm thanh; âm thanh không được ghi ra file. `lib/sherpa-onnx-node.d.ts` khai báo kiểu tối thiểu vì gói không kèm `.d.ts`.
  - API: `GET /api/asr` trả chế độ đang dùng và model đã sẵn chưa; `POST /api/asr` mở phiên, trả `id`; `POST /api/asr/[id]` nhận PCM 16-bit mono 16 kHz (mỗi mẩu ≤ 10 giây), trả `{ chot, tam }`; `DELETE /api/asr/[id]` chốt câu cuối và xóa phiên.
  - `components/MicButton.tsx`: hỏi `GET /api/asr`; chế độ `zipformer` (`ZipformerMic`) thu âm bằng AudioWorklet ở 16 kHz (trình duyệt không hỗ trợ thì hạ mẫu bằng nội suy), gửi mẩu theo hàng đợi đúng thứ tự, hiện chữ tạm in nghiêng dưới nút và đưa từng câu chốt vào ô nhập qua `onText` như Web Speech. Nút hiện đồng hồ, "Đang mở micro…", "Đang chốt câu cuối…". Web Speech cũ giữ nguyên thành `WebSpeechMic`; chọn `zipformer` mà chưa có model thì tự dùng Web Speech và báo dưới nút. Dùng chung cho trang chính và `/eform`.
  - (Bản đầu trong cùng ngày làm kiểu ghi âm xong mới nhận dạng; chủ dự án yêu cầu phải vừa nói vừa hiện chữ nên đổi sang phiên như trên, bỏ API nhận cả đoạn.)
  - `.env.example` thêm `ASR_PROVIDER=web` (mặc định). `.gitignore` thêm `/models`.
  - README: viết lại phần "Nhập giọng nói", thêm script và thư mục vào cấu trúc. CLAUDE.md: thêm lệnh `tai-model-giong-noi`.
- **Lý do:** Chủ dự án thử Web Speech thấy nghe kém, yêu cầu dùng Zipformer. Thêm lợi ích: âm thanh không gửi lên Google.
- **File:** `package.json`, `package-lock.json`, `next.config.ts`, `lib/asr.ts`, `lib/sherpa-onnx-node.d.ts`, `app/api/asr/route.ts`, `app/api/asr/[id]/route.ts`, `components/MicButton.tsx`, `scripts/tai-model-giong-noi.ts`, `.env.example`, `.gitignore`, `README.md`, `CLAUDE.md`, `docs/CHANGELOG.md`
- **Kiểm tra:** `npx tsc --noEmit`, `npm run lint` sạch. `npm run tai-model-giong-noi` tải và giải nén được (sửa lỗi GNU tar của Git Bash hiểu `D:\…` là máy từ xa bằng cách chạy tar trong thư mục `models/`). Chạy model trên 3 file mẫu kèm model: 1,6–3,7 giây âm thanh nhận dạng trong 31–57 ms, đúng nội dung. Script tạm mô phỏng trình duyệt: ghép 3 file kèm 1 giây im lặng, gửi vào phiên từng mẩu 0,4 giây: chữ tạm dài dần sau mỗi mẩu ("Rồi cũng hỗ" → "Rồi cũng hỗ trợ" → …), mỗi lần 20–60 ms; câu chốt ra 0,5–0,8 giây sau khi dứt lời, đúng 3 câu có dấu chấm; kết thúc phiên thì phiên bị xóa. **Chưa thử qua trình duyệt và Next** vì dev server của chủ dự án đang chạy ở cổng 3000 (Next 16 không cho chạy server thứ hai cùng thư mục), cần khởi động lại để nạp `next.config.ts` và `.env.local` mới. **Chưa đo độ chính xác với câu tóm tắt TMH** (tên thuốc, thuật ngữ) so với Web Speech.
- **Ảnh hưởng:** Mặc định vẫn là `web`, không đổi gì nếu không đặt `ASR_PROVIDER`. Người kéo repo về muốn dùng Zipformer phải chạy `npm run tai-model-giong-noi`. Chữ tạm của Zipformer cập nhật theo nhịp 0,4 giây (Web Speech mượt hơn một chút); chữ tạm và câu chốt có thể khác nhau ít (ví dụ "tivi" / "tv") vì câu chốt được nhận dạng lại trên đoạn đã cắt.

### Gợi ý chỉ định và đơn thuốc theo chẩn đoán trên `/eform`
- **Loại:** Tính năng, Giao diện, Dữ liệu, Cấu hình
- **Thay đổi:**
  - Thêm khung "✨ Gợi ý theo chẩn đoán" (`components/eform/GoiYTheoChanDoan.tsx`) ở đầu tab Chỉ định dịch vụ và tab Đơn thuốc. Khung đọc mã ICD10 đang chọn (ra viện → ban đầu → kèm theo), tìm bộ mẫu khớp, liệt kê theo từng chẩn đoán kèm ô tích. Bác sĩ tích chọn rồi bấm "Thêm N mục đã chọn"; không có gì tự thêm. Mục đã có trong danh sách hoặc trùng gợi ý phía trên bị làm mờ. Thuốc cùng nhóm dị ứng không tích sẵn, có cảnh báo đỏ. Tab Đơn thuốc có thêm nút "Chèn vào Lời dặn" cho lời dặn mẫu. Chưa có mã ICD hoặc chưa có bộ mẫu thì hiện hướng dẫn.
  - Tên tab Chỉ định / Đơn thuốc hiện ✨ khi có gợi ý (`EformScreen.tsx`), để bác sĩ đang ở phiếu khám biết.
  - Dữ liệu `data/eform/goi-y-theo-chan-doan.json`: 12 bộ mẫu giả phủ 22/28 mã ICD của trang eForm, chưa có H81.1, J32.9, J33.9, J34.2, R04.0, T17.1 (viêm tai giữa cấp/mạn, viêm tai ngoài, nút ráy, dị vật tai, nghe kém/ù tai, viêm xoang cấp, viêm mũi dị ứng, viêm họng, viêm amidan, khàn tiếng, trào ngược). Chỉ ghi tên; `lib/eform/goi-y.ts` (`khopBoMau`) gán mã bằng `matchCatalog` của `lib/match.ts` lúc nạp trang (`lib/eform/load.ts`), khớp chưa chắc thì dòng là "xem". `chonBoMau` chọn bộ mẫu theo mã, không lặp.
  - Tách kiểm tra dị ứng ra `lib/eform/di-ung.ts` (`trungDiUng`) để đơn thuốc và gợi ý dùng chung; `DonThuocTab.tsx` gọi hàm này thay cho bản cũ trong file.
  - `lib/eform/types.ts`: `EformData` thêm `goiY`; sửa chú thích provider có `gemini`.
  - `.gitignore` thêm `/.playwright-mcp` (ảnh chụp và snapshot plugin playwright tạo ra khi kiểm tra giao diện).
  - README: thêm mô tả gợi ý theo chẩn đoán, file dữ liệu mới và module mới. CLAUDE.md: thêm gợi ý theo chẩn đoán vào mô tả `lib/eform/`.
- **Lý do:** Chủ dự án chọn làm tiếp phần gợi ý theo chẩn đoán. Quan sát thực địa: bác sĩ tìm dịch vụ chỉ định lâu (có ca ~23 phút), phải mở hồ sơ bệnh nhân khác để tra; màn chỉ định thật đã biết chẩn đoán nhưng không dùng để gợi ý.
- **File:** `components/eform/GoiYTheoChanDoan.tsx`, `components/eform/ChiDinhTab.tsx`, `components/eform/DonThuocTab.tsx`, `components/eform/EformScreen.tsx`, `lib/eform/goi-y.ts`, `lib/eform/di-ung.ts`, `lib/eform/load.ts`, `lib/eform/types.ts`, `data/eform/goi-y-theo-chan-doan.json`, `.gitignore`, `README.md`, `docs/CHANGELOG.md`, `CLAUDE.md`
- **Kiểm tra:** `npx tsc --noEmit` và `npm run lint` sạch. Script tạm nạp `loadEformData()`: cả 12 bộ mẫu khớp đủ mã dịch vụ/thuốc, mọi mã ICD trong bộ mẫu có trong `data/eform/icd10.json`. Mở `/eform` trên Chrome 1536 px, chế độ `gemini`: trước khi điền, khung hiện hướng dẫn chưa có ICD; bấm Câu mẫu (nói) → Điền vào phiếu (ICD H66.3, kèm theo J30.4) → hai tab hiện ✨; tab Đơn thuốc có 2 nhóm, Ciprofloxacin/Paracetamol "Đã có", Augmentin không tích và cảnh báo dị ứng Penicillin, 3 thuốc viêm mũi dị ứng tích sẵn; bấm Thêm → đơn 5 thuốc, Fexofenadin tổng 14; Chèn lời dặn → nút thành "Đã chèn"; tab Chỉ định: 3 dịch vụ H66.3 "Đã có", gợi ý thêm Nội soi mũi xoang. Console không lỗi. Chưa thử màn hình hẹp.
- **Ảnh hưởng:** Không đổi pipeline hay điểm eval (chỉ trang `/eform`). Liều trong bộ mẫu là minh họa, cần thay bằng dữ liệu bác sĩ đưa trước khi demo với bác sĩ.

### Thêm nhà cung cấp LLM `gemini`
- **Loại:** Tính năng, Phụ thuộc, Cấu hình
- **Thay đổi:**
  - Thêm `lib/llm/gemini.ts` dùng SDK `@google/genai` (bản 3.0.0): gửi system prompt qua `systemInstruction`, ép JSON bằng `responseMimeType: application/json` + `responseJsonSchema` (dùng chung schema với Anthropic/OpenAI). Báo lỗi rõ khi thiếu key/model, khi Gemini chặn yêu cầu (`blockReason`, `SAFETY`) hoặc bị cắt do hết token. Timeout 90 giây như hai provider kia.
  - Đăng ký `gemini` trong `lib/llm/index.ts`, nên tự có kiểm tra schema bằng zod và thử lại 1 lần như các provider khác. `npm run eval -- --provider=gemini` chạy được.
  - `.env.example` thêm `GEMINI_API_KEY`, `GEMINI_MODEL` (bắt buộc điền tên model, không đặt sẵn vì tên model Gemini đổi thường xuyên).
  - README: thêm dòng `gemini` vào bảng "Đổi nhà cung cấp AI" và phần cấu trúc thư mục. CLAUDE.md: thêm `gemini` vào lệnh eval tốn phí và sơ đồ kiến trúc. Sửa chú thích trong `lib/schema.ts` và `scripts/eval.ts`.
- **Lý do:** Chủ dự án chốt dùng LLM bên ngoài cho prototype vì thời gian có hạn, và định dùng API key Gemini.
- **File:** `lib/llm/gemini.ts`, `lib/llm/index.ts`, `lib/schema.ts`, `scripts/eval.ts`, `package.json`, `package-lock.json`, `.env.example`, `README.md`, `CLAUDE.md`, `docs/CHANGELOG.md`
- **Kiểm tra:** `npx tsc --noEmit` và `npm run lint` sạch. Gọi thử 1 lượt câu nói mẫu của ca 11 qua `runPipeline`: `gemini-3.5-flash` nhận nguyên schema (`anyOf` với `null`, `additionalProperties: false`), mất 10,3 giây, ra 10 trường phiếu khám, 3 chỉ định, 2 thuốc, chẩn đoán đúng ý. `gemini-3.8-flash` trả lỗi 503 (quá tải) lúc thử. Chọn `gemini-3.5-flash` cho `.env.local`. Chưa chạy eval đầy đủ.
- **Ảnh hưởng:** Không đổi hành vi khi `LLM_PROVIDER` là `mock`, `anthropic` hay `openai`. Điểm eval không đổi.

### Cào danh mục thật (ICD-10, dịch vụ kỹ thuật, thuốc) về `data/tham-khao/`
- **Loại:** Dữ liệu, Tính năng
- **Thay đổi:**
  - Thêm `scripts/cao-du-lieu.ts` và lệnh `npm run cao-du-lieu` (`--bo-thuoc` để bỏ phần thuốc). Script tải CodeSystem của HL7 Vietnam VN Core IG và gọi API tra cứu số đăng ký công khai của Cục Quản lý Dược, lọc phần TMH, ghi ra `data/tham-khao/`.
  - `icd10-tmh.json`: 433 mã ICD-10 bản 2026 (TT 06/2026/TT-BYT) nhóm tai, mũi họng, thanh quản, u đầu cổ, dị vật... bao trùm cả 28 mã đang dùng ở `data/eform/icd10.json`.
  - `dich-vu-ky-thuat-tmh.json`: 486 kỹ thuật theo TT 23/2024/TT-BYT (toàn bộ chương 15 và phần liên quan của chẩn đoán hình ảnh, nội soi, thăm dò chức năng, xét nghiệm, phẫu thuật nội soi).
  - `thuoc-hoat-chat.json`: 960 mã hoạt chất (QĐ 7603/QĐ-BYT). `thuoc-luu-hanh-tmh.json`: 4.914 thuốc còn hiệu lực số đăng ký của 58 hoạt chất hay kê ở TMH, tối đa 100 thuốc mỗi hoạt chất.
  - `data/tham-khao/README.md` ghi nguồn, phạm vi lọc và giới hạn; `nguon.json` ghi ngày cào và số mục.
  - README: thêm `data/tham-khao/` và script vào phần cấu hình và cấu trúc thư mục. CLAUDE.md: thêm lệnh vào "Lệnh thường dùng".
- **Lý do:** Chủ dự án yêu cầu lên mạng lấy dữ liệu bệnh TMH, thuốc và dịch vụ chỉ định về thư mục data. Để riêng ở `data/tham-khao/` vì `data/catalog/` được ứng dụng tự nạp: thay vào đó sẽ đổi mã khớp danh mục và làm sai `expected` của 11 ca eval (đang dùng mã giả `DV-TMH-*`, `TH-*`).
- **File:** `scripts/cao-du-lieu.ts`, `package.json`, `data/tham-khao/{icd10-tmh,dich-vu-ky-thuat-tmh,thuoc-hoat-chat,thuoc-luu-hanh-tmh,nguon}.json`, `data/tham-khao/README.md`, `README.md`, `CLAUDE.md`, `docs/CHANGELOG.md`
- **Kiểm tra:** `npm run cao-du-lieu` chạy hết không lỗi; `npm run lint` sạch. Soi tay: không còn thuốc lọt do API tìm theo chuỗi con (Levofloxacin dưới "Ofloxacin", Desloratadin dưới "Loratadin", Esomeprazol dưới "Omeprazol", Methylprednisolon dưới "Prednisolon"); đã loại 2 kỹ thuật lọc nhầm ("xoang hang", "u não vòm sọ"). Chưa chạy eval vì ứng dụng không đọc dữ liệu mới.
- **Ảnh hưởng:** Không đổi hành vi ứng dụng hay điểm eval. Dữ liệu là danh mục công khai, không có thông tin bệnh nhân. HL7 Vietnam ghi chú tái phân phối bản chuẩn hóa cần phê duyệt trước khi dùng production.

### Trang `/eform` giống màn EMR, cột Trợ lý AI điền cả phiếu, chỉ định và đơn thuốc
- **Loại:** Tính năng, Giao diện
- **Thay đổi:**
  - Giao diện `/eform` theo màn EMR thật (đối chiếu 2 ảnh chụp trong `temp-1/` và `docs/cau-truc-phieu-kham-ngoai-tru.md`): header có logo và dải cam "Bệnh án điện tử", Menu, dòng PID có nhãn giới và dị ứng, Xem LSKB, tiêu đề "Phiếu khám ngoại trú", thanh mục xanh đậm, ô chỉ đọc màu xám, font Arial, thanh đáy xanh gồm 7 nút trạng thái và các nút Quay lại / Báo cáo y tế / In ngay / Lưu. Bảng lịch sử có thêm nút Copy từng dòng. Thanh header của prototype ẩn trên trang này.
  - Thêm cột phải "✨ Trợ lý AI điền phiếu" (`components/eform/TroLyAi.tsx`): nói (mic) hoặc gõ tắt → `/api/extract` (pipeline có sẵn của trang chính) → điền 14 trường phiếu khám, chỉ định và đơn thuốc. Có danh sách trường đã điền với nút "xem →", đánh dấu "✓ Đúng", hoàn tác.
  - Thêm 2 tab Chỉ định dịch vụ (`ChiDinhTab.tsx`) và Đơn thuốc (`DonThuocTab.tsx`): sửa từng dòng, chọn lại khi khớp chưa chắc, thêm từ danh mục, tổng số lượng tự tính, cảnh báo thuốc cùng nhóm dị ứng.
  - `lib/eform/dien-phieu.ts`: đổ kết quả AI vào phiếu. Không ghi đè ô bác sĩ đã nhập; mã ICD10 do code chấm điểm gán (không từ LLM), luôn đánh dấu "cần xem lại"; hẹn tái khám tự tính ngày từ thời gian khám.
  - Thêm nguồn `xem` (AI chưa chắc) vào `lib/eform/types.ts`, màu vàng. Màu AI trên trang này đổi sang tím để không lẫn với xanh/cam của EMR.
  - `config/theme.json` thêm màu `emr_*`, `ai_tim`, `xem`; `app/globals.css` thêm token tương ứng.
  - `lib/eform/load.ts` nạp thêm danh mục dịch vụ/thuốc, quy tắc tính tổng, chế độ AI và câu mẫu.
  - Thêm ca mẫu `data/cases/ca-11-viem-tai-giua-man-dot-cap.json` (cùng bệnh nhân giả của trang eForm, dị ứng Penicillin nên đơn không có kháng sinh nhóm penicillin) để chế độ mock demo được đầy đủ.
  - README: viết lại phần "Mô phỏng eForm ngoại trú", số ca eval 10 → 11, giải thích khóa màu mới.
- **Lý do:** Chủ dự án muốn trang eForm giống EMR để bác sĩ dễ làm quen, khác ở chỗ AI điền hộ để bác sĩ thao tác ít nhất; đã chọn bố cục "cột trợ lý AI bên phải" trên mockup.
- **File:** `app/globals.css`, `components/Header.tsx`, `components/eform/{EformScreen,EformHeader,TroLyAi,ChiDinhTab,DonThuocTab,fields,EformForm,IcdField,LichSuBlock,GoiYIcdPanel,MauCauPanel,BaoCaoDialog}.tsx`, `lib/eform/{dien-phieu,types,load}.ts`, `config/theme.json`, `data/cases/ca-11-viem-tai-giua-man-dot-cap.json`, `README.md`, `docs/CHANGELOG.md`
- **Kiểm tra:** `npx tsc --noEmit` và `npm run lint` sạch. Mở `/eform` trên Chrome (1536 px): bấm Câu mẫu → Điền vào phiếu ra 14 trường, 3 trường vàng (ICD H66.3, H66.3, J30.4), 3 chỉ định và 2 thuốc khớp danh mục, Paracetamol tổng 15; "xem →" cuộn đúng ô; thêm Augmentin hiện cảnh báo dị ứng; điền thêm "Chỉ định nội soi." thành 4 dịch vụ (dòng mới màu vàng, có ô chọn lại); Hoàn tác về 3. Không có lỗi console. Chưa thử trên màn hình hẹp và chưa thử với LLM thật.
- **Ảnh hưởng:** Eval có 11 ca thay vì 10. Rule-only trước/sau: Phiếu khám nói 96,8% → 97,1%, gõ tắt 97,9% → 98,1%; Chỉ định nói 91,7% → 92,9%; Đơn thuốc nói 99,5% → 99,1%. Mock vẫn 100%.

### Quy ước: thông tin nhạy cảm để trong `temp-1/`
- **Loại:** Tài liệu
- **Thay đổi:**
  - Làm sạch `docs/tham-khao/`: tên tác giả (5 chỗ) → "tác giả (học viên thực tập)"; "người Nga", "hộ chiếu Nga", "tiếng Nga" (9 chỗ) → "nước ngoài" hoặc "ngôn ngữ trên hộ chiếu".
  - Bản gốc đầy đủ từ Claude Project chuyển vào `temp-1/vinmec-project/`: 10 file `.md`, gồm `context-thuc-tap-vinmec.md`, và `vinmec-project-docs.json` (chuyển từ `D:\Download\`).
  - Thêm quy tắc vào `CLAUDE.md` và ghi chú trong `docs/tham-khao/README.md`.
- **Lý do:** Chủ dự án yêu cầu: cái gì nhạy cảm thì ghi vào `temp-1/`.
- **File:** `docs/tham-khao/bao-cao-tuan-1-phan-1-2.md`, `docs/tham-khao/bao-cao-tuan-1-phan-4.md`, `docs/tham-khao/nhat-ky-day-du-tmh.md`, `docs/tham-khao/nhat-ky-quay-tiep-don-tmh.md`, `docs/tham-khao/README.md`, `CLAUDE.md`, `docs/CHANGELOG.md`
- **Kiểm tra:** grep tên tác giả và chữ "Nga" trong `docs/tham-khao/*.md` không còn kết quả; `git status` không liệt kê `temp-1/`.

### Đưa tài liệu quan sát từ Claude Project "Vinmec" vào repo
- **Loại:** Tài liệu
- **Thay đổi:**
  - Thêm 5 file vào `docs/tham-khao/`: `nhat-ky-day-du-tmh.md`, `nhat-ky-day-du-tmh-tuan-2.md`, `nhat-ky-quay-tiep-don-tmh.md`, `bao-cao-tuan-1-phan-1-2.md`, `bao-cao-tuan-1-phan-4.md`. Nội dung giữ nguyên, chỉ sửa đường dẫn `claude/...` cho trỏ đúng vị trí trong repo.
  - Thêm `docs/tham-khao/README.md`: mục lục, thời gian quan sát, phần app liên quan, lưu ý dữ liệu.
  - `CLAUDE.md` trỏ tới `docs/tham-khao/`.
  - Không chép: `context-thuc-tap-vinmec.md` (hồ sơ cá nhân và tên người phụ trách CAIR, để ở `temp-1/` ngoài git), file HTML `vinmec-ai-sprint-ban-2.html` (1,7 MB) và 21 ảnh JPG.
  - Không thay 4 file đã có trong `docs/`: `cau-truc-phieu-kham-ngoai-tru.md` giống hệt bản trên project, các file còn lại là bản đã làm sạch (bỏ tên mentor, sửa đường dẫn).
- **Lý do:** Chủ dự án muốn tài liệu trong Claude Project dùng được khi làm việc trong repo.
- **File:** `docs/tham-khao/*.md`, `CLAUDE.md`, `docs/CHANGELOG.md`
- **Kiểm tra:** Rà bằng grep tên người, PID, số điện thoại, email: không có thông tin bệnh nhân. Mọi liên kết `.md` trong `docs/tham-khao/` trỏ tới file có thật.

### Thiết lập Claude Code: plugin, quy tắc và bắt buộc ghi tài liệu
- **Loại:** Cấu hình
- **Thay đổi:**
  - Thêm `CLAUDE.md`: quy tắc dự án cho Claude (ghi tài liệu mọi thay đổi, chỉ dữ liệu giả, mã danh mục chỉ do code gán, đọc docs Next 16 trước khi code), lệnh thường dùng, kiến trúc nhanh. File này nạp `AGENTS.md`.
  - Thêm skill `ghi-tai-lieu` (`.claude/skills/ghi-tai-lieu/SKILL.md`): mẫu mục CHANGELOG và bảng "đổi gì thì cập nhật tài liệu nào".
  - Thêm hook `Stop` (`.claude/hooks/check-docs.mjs`): khi Claude định kết thúc lượt, nếu còn file không phải tài liệu (ngoài `docs/`, `*.md`, `.claude/`) được sửa sau lần cập nhật `docs/CHANGELOG.md` gần nhất thì chặn lại và yêu cầu ghi tài liệu. Chỉ nhắc một lần mỗi lượt để tránh lặp.
  - Bật 5 plugin ở phạm vi project trong `.claude/settings.json`:
    - `typescript-lsp`: Claude thấy lỗi kiểu và nhảy định nghĩa trong TS/TSX. Cần cài `npm i -g typescript-language-server typescript` (đã cài trên máy này, bản 6.0.3).
    - `playwright`: mở trình duyệt để xem thật các trang `/`, `/eform`, `/ket-qua` sau khi sửa giao diện.
    - `security-guidance`: cảnh báo lỗ hổng (XSS, lộ secret, injection) khi sửa code; phù hợp vì app gọi API LLM và xử lý nội dung y tế.
    - `claude-md-management`: rà soát và cập nhật `CLAUDE.md` khi quy ước thay đổi.
    - `commit-commands`: lệnh `/commit`, `/commit-push-pr` cho git.
  - Các plugin đã có sẵn ở phạm vi người dùng và vẫn dùng được: `superpowers`, `context7` (tra docs Next 16, Tailwind 4, SDK), `frontend-design`, `andrej-karpathy-skills`, `document-skills`.
- **Lý do:** Yêu cầu từ chủ dự án: cài plugin/skill phù hợp, đặt quy tắc cho Claude và mọi thay đổi nhỏ nhất đều phải có tài liệu.
  - `README.md`: thêm `docs/`, `.claude/` vào phần cấu trúc thư mục và trỏ tới `docs/CHANGELOG.md`, `CLAUDE.md`.
- **File:** `CLAUDE.md`, `README.md`, `.claude/settings.json`, `.claude/hooks/check-docs.mjs`, `.claude/skills/ghi-tai-lieu/SKILL.md`, `docs/CHANGELOG.md`
- **Kiểm tra:** Chạy thử hook bằng `echo '{}' | node .claude/hooks/check-docs.mjs`: trả về `decision: block` khi `.gitignore` sửa mà chưa ghi; trả về rỗng khi `stop_hook_active: true`.

### Bỏ qua thư mục `temp-1/` và `.superpowers/` khỏi git
- **Loại:** Cấu hình
- **Thay đổi:** Thêm `/temp-1` và `/.superpowers` vào `.gitignore`.
- **Lý do:** `temp-1/` là thư mục làm việc tạm và chứa thông tin nhạy cảm. `.superpowers/` chứa mockup nháp khi thiết kế lại giao diện `/eform` cho giống EMR.
- **File:** `.gitignore`
- **Kiểm tra:** `git status` không còn liệt kê `temp-1/` hay `.superpowers/`.
