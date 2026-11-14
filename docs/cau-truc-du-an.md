# Cấu trúc dự án

Một app Next.js, nhưng code chia ba phần theo **nơi chạy**: giao diện (`src/client`), server (`src/server`), và phần dùng chung (`src/shared`). `src/app` chỉ là lớp định tuyến mỏng nối ba phần này lại. Vẫn một lệnh `npm run dev`, một cổng.

## Sơ đồ thư mục

```
src/
  app/                    Định tuyến Next: chỉ đọc request, gọi server, trả kết quả. Không chứa logic.
    page.tsx              /          nạp cấu hình (server) rồi đưa cho Workspace (client)
    eform/page.tsx        /eform     nạp dữ liệu eForm (server) rồi đưa cho EformScreen (client)
    ket-qua/page.tsx      /ket-qua   đọc các lượt thử (server) rồi đưa cho ResultsView (client)
    api/extract/          POST: văn bản → nháp đã khớp danh mục (gọi server/ai/pipeline)
    api/asr/, api/asr/[id]/  nhận dạng giọng nói Zipformer (gọi server/ai/asr)
    api/sessions/         lưu, liệt kê số đo lượt thử (gọi server/du-lieu/sessions)
    api/clinic/           GET dashboard, appointments/[id], patients/[id] (đọc lịch khám, gọi server/clinic/service)
    layout.tsx, globals.css

  client/                 FE: chạy trên trình duyệt (component có "use client")
    api.ts                gọi /api/extract, /api/sessions (dùng kiểu trong shared/api.ts)
    clinic/api.ts         gọi /api/clinic/* (no-store, AbortSignal, kiểu trong shared/clinic/types.ts)
    chung/                component dùng được ở mọi trang
      MicButton.tsx       nút 🎤: Web Speech hoặc Zipformer (gọi /api/asr)
      CatalogPicker.tsx   ô tìm trong danh mục dịch vụ/thuốc
      DynamicField.tsx    ô nhập sinh từ FieldDef trong config/forms/*.json
      Header.tsx, Banner.tsx
    workspace/            trang /  (Workspace, FormPanel, trang-thai.ts: trạng thái ô và đếm số đo)
    eform/                trang /eform (màn giống EMR + cột Trợ lý AI)
    ket-qua/              trang /ket-qua

  server/                 BE: chỉ chạy trên server (có import "server-only")
    ai/                   ← AI thật: LLM và nhận dạng giọng nói
      pipeline.ts         luồng chung cho /api/extract và scripts/eval.ts
      prompt.ts, schema.ts  sinh prompt và JSON schema từ config/forms/*.json
      llm/                mỗi nhà cung cấp một file: mock, rules, anthropic, openai, gemini
      asr.ts              phiên nhận dạng Zipformer + Silero VAD (gói native sherpa-onnx-node)
    clinic/               đọc lịch khám và hồ sơ bệnh nhân (chỉ đọc), sau cổng để cắm clinical của ưu tiên 1
      ports.ts            ClinicActor, EncounterRef, EncounterSource (cổng)
      fixture-source.ts, demo-actor.ts, guard.ts   adapter DEMO tạm: nguồn Encounter giả, actor cố định, guard localhost
      repository.ts, service.ts   đọc + validate data/clinic/, dựng DTO theo bác sĩ và cơ sở
      errors.ts, http.ts  lỗi có mã HTTP, bọc GET (no-store)
    du-lieu/              đọc/ghi đĩa
      config.ts           nạp config/ và data/catalog, data/cases
      eform.ts            nạp data/eform/ cho trang /eform
      sessions.ts         ghi/đọc data/sessions/

  shared/                 TypeScript thuần: chạy được ở trình duyệt, server và scripts
    api.ts                hợp đồng FE–BE: kiểu request/response của /api/*, hằng âm thanh ASR
    types.ts              FieldDef, FormConfig, Draft, CatalogItem...
    normalize.ts          bỏ dấu, chuẩn hóa, mở rộng viết tắt
    match.ts              khớp danh mục (Fuse.js): nơi DUY NHẤT gán mã dịch vụ/thuốc
    validate.ts           tính tổng số lượng thuốc, cảnh báo
    metrics.ts            kiểu số đo lượt thử, tính trung bình, xuất CSV
    clinic/               DTO, schema, phép tính lịch (schedule.ts), thứ tự lịch sử khám (history.ts)
    eform/                logic trang /eform, gồm cả "AI" bằng rule (xem dưới)

config/  data/  scripts/  models/  docs/   giữ nguyên ở gốc (dữ liệu, script, tài liệu)
```

## Chiều import

```
src/app ──► src/client ──► src/shared
   │                          ▲
   └──────► src/server ───────┘
```

| Thư mục | Được import | Không được import |
|---|---|---|
| `src/client` | `src/shared`, React, Next | `src/server` (gọi qua `/api/*`) |
| `src/server` | `src/shared`, Node, SDK LLM | `src/client` |
| `src/shared` | chỉ file trong `src/shared` và thư viện thuần (zod, fuse.js) | React, Next, `node:*`, `src/client`, `src/server` |
| `src/app` | cả ba | |

Hai lớp chặn:

- **`npm run lint`** báo lỗi ngay khi import sai chiều (luật `no-restricted-imports` trong `eslint.config.mjs`).
- **`import "server-only"`** ở đầu `server/ai/pipeline.ts`, `server/ai/llm/index.ts`, `server/ai/asr.ts` và cả ba file `server/du-lieu/`: lỡ để một component client kéo theo các file này thì `next build` báo lỗi, API key không thể lọt xuống trình duyệt. Script ngoài Next (`npm run eval`) chạy bằng `tsx --conditions=react-server` để vượt qua dấu này.

## AI nằm ở đâu

Có hai loại "AI", đặt ở hai nơi khác nhau vì chạy ở hai nơi khác nhau:

| Loại | Thư mục | Chạy ở | Gồm |
|---|---|---|---|
| **AI thật** (gọi LLM, chạy model) | `src/server/ai/` | server | tách văn bản thành nháp (`pipeline.ts` → `llm/*`), nhận dạng giọng nói (`asr.ts`) |
| **AI bằng rule** (mock, không gọi LLM) | `src/shared/eform/` | trình duyệt (và server lúc nạp trang) | tóm tắt lịch sử (`tom-tat.ts`), gợi ý ICD10 (`icd.ts`), gợi ý mẫu câu (`mau-cau.ts`), gợi ý theo chẩn đoán (`goi-y.ts`), đổ kết quả AI vào phiếu (`dien-phieu.ts`) |

`src/server/ai/llm/rules.ts` cũng là rule nhưng nằm ở server vì nó là một "nhà cung cấp" của pipeline (dùng cho `mock` và `--rule-only`).

Muốn thay một tính năng rule bằng LLM thật (ví dụ tóm tắt lịch sử): viết hàm mới trong `src/server/ai/`, mở route `src/app/api/<ten>/route.ts`, thêm kiểu request/response vào `src/shared/api.ts`, thêm hàm gọi vào `src/client/api.ts`, rồi đổi component gọi hàm đó thay cho hàm rule. Giữ nguyên quy tắc: **mã danh mục chỉ do `src/shared/match.ts` gán**, không để LLM điền mã.

## Luồng chính

**Điền nháp (cả `/` và cột Trợ lý AI của `/eform`):**
`Workspace.tsx` / `TroLyAi.tsx` → `client/api.ts › goiAiDienNhap` → `POST /api/extract` → `server/ai/pipeline.ts › runPipeline` → `llm/index.ts` (chọn theo `LLM_PROVIDER`, kiểm tra zod, thử lại 1 lần) → bỏ trường không `ai_fill` → `shared/match.ts` gán mã → `shared/validate.ts` tính tổng → trả `PipelineResult`.

**Giọng nói Zipformer:** `MicButton.tsx` → `GET /api/asr` (chế độ) → `POST /api/asr` (mở phiên) → `POST /api/asr/[id]` mỗi 0,4 giây (PCM 16 kHz, nhận `{ chot, tam }`) → `DELETE /api/asr/[id]`.

**Nạp trang `/eform`:** `src/app/eform/page.tsx` (server) gọi `server/du-lieu/eform.ts › loadEformData` (đọc `data/eform/`, gán mã cho bộ mẫu gợi ý) → truyền xuống `EformScreen` (client). Các gợi ý rule chạy trên trình duyệt với dữ liệu đó, không gọi API.

## Cái gì dùng lại được

| Thành phần | Ở đâu | Đang dùng ở | Dùng lại thế nào |
|---|---|---|---|
| Pipeline điền nháp | `server/ai/pipeline.ts` | `/api/extract`, `scripts/eval.ts` | Mọi màn mới cần "nói/gõ → nháp" gọi `goiAiDienNhap`, không viết pipeline riêng |
| Nhà cung cấp LLM | `server/ai/llm/*.ts` | pipeline | Mỗi provider là một hàm `LlmCall` (nhận `system`, `user`, `schema`, trả chuỗi JSON). Thêm provider: tạo file mới, đăng ký trong `PROVIDERS` của `llm/index.ts` |
| Form sinh từ JSON | `config/forms/*.json` + `server/ai/{prompt,schema}.ts` + `client/chung/DynamicField.tsx` | trang `/` | Thêm trường chỉ sửa JSON: giao diện, prompt và schema tự đổi theo |
| Khớp danh mục | `shared/match.ts` | pipeline, `Workspace`, `CatalogPicker`, bộ mẫu gợi ý | Gán mã cho bất kỳ tên dịch vụ/thuốc nào (`matchCatalog`), tìm gần đúng (`searchCatalog`) |
| Chuẩn hóa tiếng Việt | `shared/normalize.ts` | match, rule, eval, eform | So khớp không dấu, mở rộng viết tắt theo `config/viet-tat.json` |
| Tính tổng, cảnh báo | `shared/validate.ts` | pipeline, `Workspace`, `DonThuocTab` | Tổng số lượng thuốc, cảnh báo trẻ em |
| Nút micro | `client/chung/MicButton.tsx` | `/`, `/eform` | Chỉ cần `onStart`, `onText`; tự chọn Web Speech hay Zipformer |
| Ô tìm danh mục | `client/chung/CatalogPicker.tsx` | trang `/` | Chưa dùng ở `/eform` (tab Chỉ định/Đơn thuốc đang chọn từ danh sách riêng); có thể thay vào |
| Hợp đồng API | `shared/api.ts` | route + `client/api.ts` + `MicButton` | Đổi kiểu một chỗ, cả route và nơi gọi cùng báo lỗi nếu lệch |
| Nạp cấu hình | `server/du-lieu/config.ts` | các trang, route, eval | Đọc lại file mỗi lần gọi, sửa JSON rồi tải lại trang là thấy |
| Kiểm tra dị ứng | `shared/eform/di-ung.ts` | `DonThuocTab`, `GoiYTheoChanDoan` | Mọi chỗ thêm thuốc nên gọi `trungDiUng` |

## Thêm mới thì đặt ở đâu

| Việc | Đặt ở |
|---|---|
| Trang mới | `src/app/<duong-dan>/page.tsx` (mỏng) + component ở `src/client/<ten-trang>/` |
| Component dùng ở từ hai trang trở lên | `src/client/chung/` |
| API mới | `src/app/api/<ten>/route.ts` (đọc request, kiểm tra bằng zod, gọi hàm server) + logic ở `src/server/` + kiểu ở `src/shared/api.ts` + hàm gọi ở `src/client/api.ts` |
| Tính năng gọi LLM hoặc model | `src/server/ai/` |
| Đọc/ghi file, biến môi trường | `src/server/du-lieu/` (hoặc `src/server/ai/` nếu là cấu hình AI) |
| Hàm tính toán thuần mà cả hai phía cần | `src/shared/` |
| Trường form, danh mục, ca mẫu | `config/`, `data/` (không đổi code) |

## Sau này muốn tách thành hai app

Ranh giới đã đúng chỗ nên tách được mà không viết lại logic: chuyển `src/server` + `src/app/api` sang một server Node riêng (ví dụ Hono), `src/shared` thành gói dùng chung, còn lại là app giao diện. Việc phải làm thêm: CORS, đổi URL trong `client/api.ts` và `MicButton.tsx`, và trang `/` với `/eform` phải lấy dữ liệu qua API thay vì đọc file lúc render. Chưa làm vì với prototype hiện tại chỉ thêm việc mà không thêm lợi ích.
