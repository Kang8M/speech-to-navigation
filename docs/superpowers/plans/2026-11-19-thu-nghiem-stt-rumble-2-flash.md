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

_(điền ở Task 0)_
