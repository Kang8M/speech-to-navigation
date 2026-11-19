# Thử nghiệm STT Rumble-2-Flash song song Zipformer – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chạy được Rumble-2-Flash (bản sherpa-onnx INT8) trên máy, chọn bằng biến môi trường, đo và so sánh với Zipformer hiện có trên cùng bộ âm thanh. Zipformer giữ nguyên là mặc định.

**Architecture:** Thêm lớp `bo-nhan-dang.ts` bọc hai cấu hình `OfflineRecognizer` của `sherpa-onnx-node` (transducer cho Zipformer, `qwen3Asr` cho Rumble). `asr.ts` giữ nguyên luồng VAD + chữ tạm/chữ chốt, chỉ gọi `decode` qua lớp này. Chọn model bằng `ASR_MODEL=zipformer|rumble` (mặc định `zipformer`); `ASR_PROVIDER=zipformer` vẫn là cổng chính sách "chỉ nhận dạng trên máy", không đổi.

**Tech Stack:** Next.js 16, `sherpa-onnx-node` 2.0.1 (đã cài, native có `qwen3Asr`), node:test, tsx.

**Spec:** phần "Đánh giá" ngay dưới đây (không có spec riêng).

## Đánh giá model và độ phù hợp với máy (2026-11-19)

| | Zipformer hiện có | Rumble-2-Flash |
|---|---|---|
| Nguồn | `csukuangfj/sherpa-onnx-zipformer-vi-int8-2025-04-20` | `Reson8/Rumble-2-Flash` (Apache-2.0, ra 14/10/2026), bản chạy: `TypeWhisper/Rumble-2-Flash-sherpa-onnx-int8` |
| Kiến trúc | Transducer, chỉ tiếng Việt | Qwen3-ASR 0.5B (encoder 18 lớp + decoder LLM 14 lớp), 45 ngôn ngữ có `vi` |
| Dung lượng | ~70 MB | ~655 MB (conv_frontend 44 MB, encoder int8 182 MB, decoder int8 427 MB) |
| Đầu ra | Chữ in hoa, không dấu câu | Có hoa thường, dấu câu, số viết bằng chữ số (`digits=true`) |
| Tốc độ công bố | rất nhanh | RTF 0,051 trên 4 luồng CPU Mac mini, RAM đỉnh 2,1 GB |
| Điểm tiếng Việt | đã đo trong dự án | **chưa có số công bố** (chỉ có EN, DE, ES, FR, IT, NL, PT, HI, ZH) |

Máy: Intel Core Ultra 5 225H (14 nhân), RAM 15,4 GB, GPU Intel Arc 130T (không CUDA), ổ C trống 214 GB, Python 3.12, Node 26.

Kết luận: **chạy được**, theo đường sherpa-onnx INT8 trên CPU. Không dùng được vLLM (cần CUDA) và không nên dùng Transformers (cần bản 5.21 dev, chạy BF16 trên CPU chậm). RAM đủ (2,1 GB đỉnh, cộng Next dev và NER PhoBERT vẫn dưới 8 GB). Dự kiến RTF 0,05–0,15 trên máy này, tức câu 10 giây giải mã khoảng 0,5–1,5 giây, chậm hơn Zipformer rõ.

Rủi ro chính phải đo, không đoán:
1. Chất lượng tiếng Việt y khoa chưa ai công bố, nhất là tên thuốc và thuật ngữ TMH.
2. Bản ONNX do bên thứ ba (TypeWhisper) chuyển, export với `max-total-len 512`: prompt + token âm thanh (13 token/giây) + chữ ra phải dưới 512, nên một đoạn VAD 20 giây (260 token) là sát giới hạn.
3. Decoder tự hồi quy nên chữ tạm cứ 0,4 giây giải mã lại cả câu sẽ quá nặng; cần bước chữ tạm dài hơn.
4. Model sinh chữ có thể "bịa" vài từ cuối trên đoạn ngắn hoặc im lặng (ghi chú của bản GGUF).

## Global Constraints

- Không xóa hay đổi hành vi mặc định của Zipformer: không đặt `ASR_MODEL` thì mọi thứ y như trước.
- Chỉ nhận dạng trên máy; không gọi API ngoài, không thêm vLLM/Transformers/Python cho Rumble.
- Model khóa revision `a8128305e8e8c4aa5bf6fcd0a8454347ff80d6d1` và kiểm SHA-256:
  - `conv_frontend.onnx` `00c48c47db2937884636a3d99f23166390088e8c939ff7e9e803e69b8af4c0b5`
  - `encoder.int8.onnx` `e6b4847992553dfa57bffda161b8c62d0af79c952c73269e6a2f6dc887f3e5dd`
  - `decoder.int8.onnx` `e9be29023d0d52518e75cc4b77abbfc569564c7453ad1f546e50174c9a8b426c`
  - `tokenizer/{vocab.json,merges.txt,tokenizer_config.json}`: không có LFS hash trên HF, ghi SHA-256 lúc tải lần đầu vào `MODEL_RUMBLE.sha256` (Task 2).
- Thư mục model: `models/stt/rumble-2-flash/` (đã nằm trong `models/` bị gitignore).
- Âm thanh giọng thật của người dùng (dù đọc ca giả) để trong `temp-1/` chứ không đưa vào `data/`.
- Nhãn, log, tài liệu bằng tiếng Việt. Mỗi task ghi `docs/CHANGELOG.md` bằng skill `ghi-tai-lieu`.
- Nhánh: `thu-nghiem/stt-rumble-2-flash` (tạo từ `origin/dev`), PR vào `dev`.
- Chia việc theo CLAUDE.md quy tắc 7: model gợi ý ghi ở đầu mỗi task.

## Review Focus

1. Đoạn VAD dài gần 20 giây: Rumble không được lỗi/cắt chữ vì `maxTotalLen` – nếu vượt thì `bo-nhan-dang` tự chia đôi đoạn và nối chữ (test ở Task 3 với âm 20 giây).
2. Đầu ra có tiền tố nhận diện ngôn ngữ (`language Vietnamese<asr_text>…`) khi không ép được ngôn ngữ: phải bị bỏ trước khi vào ô nhập (test ở Task 1 `chuanHoaCau`).
3. Đoạn im lặng hoặc rất ngắn: không được trả câu bịa; câu rỗng hoặc chỉ dấu câu thì bỏ (test Task 1 + đo bằng file im lặng ở Task 4).
4. Số viết bằng chữ số (`2 viên`, `3 lần`): bộ sửa chữ `sua-chu.ts` vốn chỉnh cho Zipformer không được đổi sai; eval in dòng "Sửa nhầm" riêng từng model (Task 4).
5. Đổi `ASR_MODEL` khi `next dev` đang chạy: recognizer cũ vẫn trong bộ nhớ; tài liệu ghi rõ phải khởi động lại, GET `/api/asr` báo đúng model đang nạp (Task 3).

---

### Task 0: Spike – xác nhận API Node và tốc độ trên máy (session chính hoặc Sonnet)

Mục đích: chốt tên trường `qwen3Asr` trong binding Node và cách ép tiếng Việt trước khi viết code thật. Không commit code spike vào `src/`.

**Files:**
- Create: `scripts/thu-rumble.ts` (script tạm, xóa ở Task 5 hoặc giữ nếu hữu ích)

- [ ] **Step 1:** Tải tay 6 file của model (revision ở Global Constraints) vào `models/stt/rumble-2-flash/` giữ cấu trúc `tokenizer/`.
- [ ] **Step 2:** Viết `scripts/thu-rumble.ts`: tạo `OfflineRecognizer` với `modelConfig: { qwen3Asr: { convFrontend, encoder, decoder, tokenizer, maxTotalLen: 512, maxNewTokens: 128 }, tokens: "", numThreads: 4, provider: "cpu" }`, `featConfig: { sampleRate: 16000, featureDim: 128 }`; đọc `data/giong-noi/ca-01.tts.wav`, decode, in chữ và RTF (thời gian giải mã / độ dài âm).
- [ ] **Step 3:** Thử ép ngôn ngữ: lần lượt `qwen3Asr.language = "Vietnamese"`, `stream.setOption?.("language", "Vietnamese")`; ghi cách nào có tác dụng (đầu ra không còn tiền tố `language …`). Thử `numThreads` 2, 4, 6 và ghi RTF.
- [ ] **Step 4:** Ghi kết quả (tên trường đúng, cách ép ngôn ngữ, RTF theo số luồng, RAM đỉnh xem bằng Task Manager) vào cuối file plan này, mục "Kết quả spike".

Run: `npx tsx scripts/thu-rumble.ts`
Expected: in ra một câu tiếng Việt gần với `input_noi` của `data/cases/ca-01.json`, RTF < 0,3. Nếu không nạp được model hoặc RTF > 0,5 thì **dừng plan, báo người dùng**.

### Task 1: Chuẩn hóa câu theo model (Haiku)

**Files:**
- Create: `src/shared/giong-noi/chuan-hoa-cau.ts`
- Test: `src/shared/giong-noi/chuan-hoa-cau.test.ts`
- Modify: `src/server/ai/asr.ts:74-78` (bỏ `chuThuong`, dùng hàm mới)

**Interfaces:**
- Produces: `type TenModelGiongNoi = "zipformer" | "rumble"` (export từ `src/shared/model-giong-noi.ts`); `chuanHoaCau(text: string, model: TenModelGiongNoi, chot: boolean): string` – `chot=true` thì thêm dấu chấm cuối câu nếu chưa có `.?!…`.

- [ ] **Step 1: Test**

```ts
test("zipformer: chữ in hoa thành chữ thường, viết hoa đầu câu", () =>
  assert.equal(chuanHoaCau("ĐAU HỌNG BA NGÀY", "zipformer", true), "Đau họng ba ngày."));
test("zipformer chữ tạm không thêm dấu chấm", () =>
  assert.equal(chuanHoaCau("ĐAU HỌNG", "zipformer", false), "Đau họng"));
test("rumble: giữ hoa thường và dấu câu sẵn có", () =>
  assert.equal(chuanHoaCau("Viêm họng cấp, cho Augmentin 1g.", "rumble", true), "Viêm họng cấp, cho Augmentin 1g."));
test("rumble: bỏ tiền tố nhận diện ngôn ngữ", () =>
  assert.equal(chuanHoaCau("language Vietnamese<asr_text>Đau tai trái", "rumble", true), "Đau tai trái."));
test("câu rỗng hoặc chỉ dấu câu trả rỗng", () => {
  assert.equal(chuanHoaCau("  ", "rumble", true), "");
  assert.equal(chuanHoaCau(".", "rumble", true), "");
});
```

- [ ] **Step 2:** `npm test` → FAIL (chưa có module).
- [ ] **Step 3:** Viết `chuanHoaCau`; trong `asr.ts` chữ chốt dùng `chuanHoaCau(text, model, true)` và bỏ qua khi rỗng, chữ tạm dùng `chot=false`. Tạm thời `model` lấy cố định `"zipformer"` (Task 3 nối biến môi trường).
- [ ] **Step 4:** `npm test` và `npm run eval-giong-noi -- --nhan-lai` → PASS, WER Zipformer không đổi so với trước (ghi số vào CHANGELOG).
- [ ] **Step 5:** Ghi tài liệu, commit `refactor(stt): tách chuẩn hóa câu theo model`.

### Task 2: Khai báo và tải model Rumble (Haiku)

**Files:**
- Modify: `src/shared/model-giong-noi.ts`, `scripts/tai-model-giong-noi.ts`, `package.json` (không thêm lệnh mới)

**Interfaces:**
- Produces: `MODEL_RUMBLE = { id, revision, thuMuc: "models/stt/rumble-2-flash", file: { convFrontend: "conv_frontend.onnx", encoder: "encoder.int8.onnx", decoder: "decoder.int8.onnx", tokenizer: "tokenizer" }, tepTokenizer: ["vocab.json","merges.txt","tokenizer_config.json"], sha256: Record<string,string> }`; `MODEL_THEO_TEN: Record<TenModelGiongNoi, { thuMuc: string; canCo: string[] }>` (`canCo` là đường dẫn tương đối từ gốc dự án, gồm cả 3 file tokenizer).

- [ ] **Step 1:** Thêm `MODEL_RUMBLE` với revision và 3 SHA-256 ở Global Constraints; SHA-256 tokenizer lấy từ file đã tải ở Task 0 (`certutil -hashfile <file> SHA256`).
- [ ] **Step 2:** `tai-model-giong-noi.ts` nhận `--model=rumble` (mặc định `zipformer`, giữ hành vi cũ), tải theo revision, kiểm SHA-256, ghi `provision.json` trong thư mục model; vẫn tải Silero VAD nếu thiếu. Tải file lớn bằng stream ra đĩa (decoder 427 MB) thay vì `arrayBuffer()`.
- [ ] **Step 3:** Xóa thư mục Task 0, chạy `npm run tai-model-giong-noi -- --model=rumble` → tải đủ, SHA khớp; chạy lại lần hai → "đã có …, bỏ qua" cho mọi file.
- [ ] **Step 4:** `npm run lint` sạch; ghi tài liệu (README mục tải model); commit `feat(stt): khai báo và tải model Rumble-2-Flash`.

### Task 3: Chọn model bằng ASR_MODEL trong luồng nhận dạng (Sonnet)

**Files:**
- Create: `src/server/ai/bo-nhan-dang.ts`
- Modify: `src/server/ai/asr.ts`, `src/server/ai/sherpa-onnx-node.d.ts`, `src/shared/api.ts` (`AsrTrangThai`), `src/app/api/asr/route.ts`, `src/app/api/asr/route.test.ts`, `src/client/chung/MicButton.tsx`, `.env.example`

**Interfaces:**
- Consumes: `chuanHoaCau` (Task 1), `MODEL_THEO_TEN`, `MODEL_RUMBLE`, `MODEL_GIONG_NOI` (Task 2).
- Produces:
  - `getAsrModel(): TenModelGiongNoi` – đọc `ASR_MODEL`, giá trị lạ thì về `"zipformer"` và `console.warn`.
  - `layBoNhanDang(model: TenModelGiongNoi): { decode(samples: Float32Array): string; buocTamGiay: number }` – cache một recognizer mỗi model trên `globalThis`. Zipformer: cấu hình hiện tại, `buocTamGiay` 0,4. Rumble: cấu hình `qwen3Asr` theo kết quả Task 0, `numThreads` theo spike, `buocTamGiay` 1,2.
  - `fileModelThieu(model?: TenModelGiongNoi): string[]` (mặc định model đang chọn).
  - `AsrTrangThai.model: TenModelGiongNoi`; `thuMucModel` theo model đang chọn.

- [ ] **Step 1: Test** trong `route.test.ts`: GET với `ASR_MODEL=rumble` trả `model: "rumble"`, `thuMucModel: "models/stt/rumble-2-flash"`; không đặt thì `model: "zipformer"`; `ASR_MODEL=abc` thì `"zipformer"`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Viết `bo-nhan-dang.ts`; Rumble `decode` với đoạn > 18 giây thì chia đôi tại giữa và nối hai kết quả (tránh vượt `maxTotalLen` 512). `asr.ts`: `PhienNhanDang` nhận model lúc tạo phiên, dùng `buocTamGiay` thay `INTERIM_STEP` cố định. Bổ sung kiểu `qwen3Asr` vào `.d.ts` đúng tên trường Task 0 xác nhận. `MicButton` hiện tên model nhỏ cạnh nút micro ("Zipformer" / "Rumble-2-Flash") để biết đang thử model nào. `.env.example` thêm `ASR_MODEL=zipformer` kèm ghi chú "đổi thì khởi động lại `npm run dev`".
- [ ] **Step 4:** `npm test`, `npm run lint` → PASS. Test tay: `ASR_MODEL=rumble npm run dev`, mở `/`, đọc một câu ca-01, thấy chữ tạm và chữ chốt có dấu câu; ghi độ trễ cảm nhận.
- [ ] **Step 5:** Ghi tài liệu (`docs/STT.md` mục chọn model), commit `feat(stt): chọn Zipformer hoặc Rumble-2-Flash bằng ASR_MODEL`.

### Task 4: Đo so sánh trong eval-giong-noi (Sonnet)

**Files:**
- Modify: `scripts/eval-giong-noi.ts`

**Interfaces:**
- Consumes: `getAsrModel`, phiên ASR từ Task 3.
- Produces: cờ `--model=zipformer|rumble` (mặc định theo `ASR_MODEL`), `--thu-muc=<đường dẫn>` (mặc định `data/giong-noi`); chữ thô lưu `<tên>.tho.json` cho Zipformer (giữ tương thích) và `<tên>.tho.rumble.json` cho Rumble; in thêm cột "RTF" và tổng giây giải mã.

- [ ] **Step 1:** Thêm cờ và đường lưu theo model; đặt `process.env.ASR_MODEL` trước khi tạo phiên.
- [ ] **Step 2:** Đo thời gian giải mã (`performance.now()` quanh `nhanDang`), in RTF từng file và tổng.
- [ ] **Step 3:** Thêm file im lặng 5 giây `data/giong-noi/im-lang.wav` (sinh bằng script, kèm `im-lang.txt` rỗng) để đo Review Focus 3: kỳ vọng 0 câu chốt cho cả hai model.
- [ ] **Step 4:** Chạy cả hai:
  - `npm run eval-giong-noi -- --model=zipformer --nhan-lai`
  - `npm run eval-giong-noi -- --model=rumble --nhan-lai`
  Expected: cả hai chạy hết 11 ca + file im lặng, in WER, mục danh mục, số liệu thuốc, Sửa nhầm, RTF.
- [ ] **Step 5:** Ghi tài liệu, commit `feat(stt): eval-giong-noi đo được Rumble-2-Flash và RTF`.

### Task 5: Báo cáo so sánh (Haiku chạy đo, session chính viết kết luận)

**Files:**
- Create: `docs/STT-SO-SANH-RUMBLE.md`
- Modify: `docs/CHANGELOG.md`, `README.md`

- [ ] **Step 1:** Bảng số liệu hai model trên giọng máy (11 ca TTS): WER thô / sau sửa, mục danh mục giữ được, số liệu thuốc, Sửa nhầm, RTF, RAM đỉnh, thời gian nạp model lần đầu.
- [ ] **Step 2:** (Cần người dùng) ghi âm giọng thật đọc 5–11 ca giả vào `temp-1/giong-noi-that/` (16 kHz mono, tên `ca-XX.<nhãn>.wav`), chạy eval với `--thu-muc=temp-1/giong-noi-that` cho cả hai model, thêm bảng thứ hai. Giọng máy Windows không đủ để kết luận cho giọng bác sĩ.
- [ ] **Step 3:** Liệt kê 10 lỗi tiêu biểu mỗi model (thuốc, thuật ngữ TMH, số), kết luận: giữ Zipformer / chuyển Rumble / dùng kết hợp (vd. Rumble chỉ cho chữ chốt). Không đổi mặc định trong nhánh này.
- [ ] **Step 4:** Xóa `scripts/thu-rumble.ts` nếu không còn dùng; `npm run lint`, `npm test`; review toàn nhánh (Opus), sửa phát hiện (Sonnet/Haiku); commit `docs(stt): báo cáo so sánh Zipformer và Rumble-2-Flash`.

## Kết quả spike

Kết luận: **GO**. Model nạp và chạy được qua binding Node `sherpa-onnx-node` 2.0.1 trên máy này, RTF tốt nhất 0,18 (< 0,5). Thử bằng `scripts/thu-rumble.ts` (`npx tsx scripts/thu-rumble.ts`). Ba file ONNX khớp SHA-256 trong Global Constraints.

**Cấu hình Node chạy được** (tên trường đúng, không cần `tokens`):

```ts
new OfflineRecognizer({
  featConfig: { sampleRate: 16000, featureDim: 128 },
  modelConfig: {
    qwen3Asr: {
      convFrontend: ".../conv_frontend.onnx",
      encoder: ".../encoder.int8.onnx",
      decoder: ".../decoder.int8.onnx",
      tokenizer: ".../tokenizer", // thư mục chứa vocab.json, merges.txt, tokenizer_config.json
      maxTotalLen: 512,
      maxNewTokens: 128,
    },
    tokens: "",
    numThreads: 4,
    provider: "cpu",
    debug: 0,
  },
});
```

**Ép tiếng Việt:** chỉ `stream.setOption("language", "Vietnamese")` (gọi trên từng stream trước `acceptWaveform`) có tác dụng. Đặt `qwen3Asr.language` trong config không có tác dụng (không báo lỗi, vẫn ra như không ép). Không ép: model tự nhận ngôn ngữ và kết quả chỉ là chuỗi `language Vietnamese` (token `language`, ` Vietnamese`), không có phần chữ nên không dùng được. Ép rồi: đầu ra là câu sạch, không còn tiền tố `language ...` hay `<asr_text>`; `lang`, `timestamps`, `ys_log_probs` đều rỗng, chỉ `text` và `tokens`. Đầu ra có dấu câu, viết hoa, chữ số ("38,5 độ", "250 miligram") nhưng lúc là số lúc là chữ ("ba ngày", "bảy ngày", "hai gói"), nên Task 1 phải chuẩn hóa. Ngắt từ giữa chừng cũng xảy ra ("Aza Cetamol", "n ay" chỉ là token, ghép lại đúng).

**Giới hạn độ dài (quan trọng):** `maxTotalLen` 512 là giới hạn cứng của decoder đã xuất, gồm cả prompt, token âm thanh (~13 token/giây) và chữ sinh ra. Ca-01 dài 56,8 s không giải mã nổi một lần: native in cảnh báo `context_len (753) exceeds max_total_len (512). Truncating audio placeholders` và kết quả chỉ còn `Ừ`/`language`. Không ném lỗi, chỉ cắt âm thanh âm thầm. Thử: chunk 20 s đủ; 30 s chạy nhưng chữ cuối bị cụt; 36 s chỉ ra được khoảng 10 s đầu. Vậy phải cắt đoạn **tối đa khoảng 15-20 s** (thực tế tốt nhất cắt theo VAD/chỗ im lặng) rồi nối chữ. Task 2 nên có hằng số độ dài đoạn tối đa và cắt ở chỗ năng lượng thấp (script spike đã cắt thử mỗi 15 s, lùi về chỗ im lặng trong ±1,5 s).

**Kết quả ca-01** (4 đoạn 14,1 + 13,9 + 14,7 + 14,1 s, `numThreads` 4, ép Vietnamese), so với `input_noi`:

- Nhận dạng: "Ừ, bé này đến khám vì đau thai phổi và sốt. À, bệnh sử là ba ngày nay bé đau thai phổi sốt 38,5 độ. Trước đó có sổ mũi khoảng năm ngày. Tiên sử thì khỏe mạnh, chưa dị ứng thuốc gì. Toàn thân bé tỉnh. Sốt 38 độ, ừ, kháng hai mũi họng thấy màng nhĩ phải đỏ, phồng, mất nón sáng, hai trái bình thường, mũi có dịch đầy, trần đoán viêm thai giữa cấp thai phải, hướng điều trị là điều trị nội khoa ngoại trú, à. Chỉ định nội soi hai mũi họng một lần, kê đơn, Amoxicillin 250 miligram dạng gói, uống hai gói một lần, ngày hai lần, sau ăn, trong bảy ngày, Aza Cetamol 250 miligram gói, ..."
- Tham chiếu: "Ừ, bé này đến khám vì đau tai phải và sốt. À, bệnh sử là 3 ngày nay bé đau tai phải, sốt 38,5 độ, ... Chẩn đoán viêm tai giữa cấp tai phải. ... Paracetamol 250 mg gói, ..."
- Nhận xét: đúng phần lớn, tên thuốc Amoxicillin đúng, có dấu câu, giữ cả "ừ", "à". Lỗi điển hình: thiếu âm đầu "tai" -> "thai" ("thai phải", "viêm thai giữa"), "tai mũi họng" -> "hai mũi họng"/"kháng", "Paracetamol" -> "Aza Cetamol", "chảy mủ tai" -> "mủ thai". Đây là giọng máy đọc (TTS), chưa phải giọng người.

**Tốc độ** (tổng thời gian giải mã 4 đoạn, không tính nạp; một lần chạy mỗi mức, máy không chạy việc nặng khác, đoạn đầu làm nóng riêng):

| numThreads | Thời gian giải mã 56,8 s | RTF |
|---|---|---|
| 2 | 16,6 s | 0,293 |
| 4 | 10,5 s | 0,184 |
| 6 | 11,2 s | 0,197 |

Chọn `numThreads` 4. Chunk đơn lẻ (4 luồng): 20 s mất 3,8 s (RTF 0,19), 30 s mất 6,3 s (RTF 0,21). Thời gian nạp model: 1,7 s (4 luồng; 3,0-3,8 s ở 2 và 6 luồng, lần nạp sau trong cùng tiến trình).

**RAM** (xấp xỉ, `process.memoryUsage().rss`): ~0,75 GB ngay sau khi nạp, ~1,5 GB sau khi giải mã. Trong script spike RSS cộng dồn lên 4-5 GB vì tạo nhiều recognizer liên tiếp trong cùng tiến trình và native không nhả; ở eForm chỉ nên tạo một recognizer duy nhất (cache).

**SHA-256 tokenizer** (cho `MODEL_RUMBLE.sha256` ở Task 2):

```
c5e356c0638515539c196bca5da724fcf35a91fceaf1a2204c2a7193adc21059  tokenizer/vocab.json
ca57770275b525f8766ed68bf4b2d1d66b85adc41b06d8b5686cc3ca2b808aa9  tokenizer/merges.txt
c812aa17410d17b1b8c12f499d5359d6d9bd7395729bc7a7e1742aaa21f2b7df  tokenizer/tokenizer_config.json
```

Kích thước file: conv_frontend 44.148.280 B, encoder 182.491.662 B, decoder 426.507.858 B (tổng ~655 MB), vocab 1.961.918 B, merges 1.075.910 B, tokenizer_config 13.585 B.

**Bất ngờ khác:** (1) tải từ Hugging Face bị ngắt kết nối giữa chừng ("Connection was reset") với 3 file, cần `curl -C -` thử lại; (2) binding native in cảnh báo ra stderr cho mỗi lần cắt âm thanh, dùng để phát hiện đoạn quá dài; (3) không có `lang`/timestamps trong kết quả.
