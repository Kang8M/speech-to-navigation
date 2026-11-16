@AGENTS.md

# Trợ lý điền bệnh án TMH – hướng dẫn cho Claude

Prototype Next.js 16 (App Router) + React 19 + Tailwind 4. Bác sĩ nói hoặc gõ tắt, AI tách và điền nháp Phiếu khám, Chỉ định, Đơn thuốc. Chi tiết cách chạy và cấu hình xem `README.md`; quan sát thực địa xem `docs/` (tóm tắt và cấu trúc màn hình EMR) và `docs/tham-khao/` (nhật ký, báo cáo tuần, mục lục ở `docs/tham-khao/README.md`). Cần biết bác sĩ thực sự nhập gì, mất bao lâu thì tra ở đó trước khi đoán.

## Quy tắc bắt buộc

1. **Mọi thay đổi đều phải ghi tài liệu, kể cả thay đổi nhỏ nhất** (một dòng code, một khóa JSON, một màu, một dependency). Sau khi sửa, dùng skill `ghi-tai-lieu`: thêm mục vào `docs/CHANGELOG.md` và cập nhật `README.md` / `docs/` liên quan. Hook `Stop` sẽ chặn nếu quên.
2. **Chỉ dùng dữ liệu giả.** Không thêm tên, PID, CCCD, tài khoản bác sĩ hay nội dung lâm sàng thật vào code, dữ liệu mẫu, tài liệu hay commit. **Thông tin nhạy cảm** (tên người thật, quốc tịch bệnh nhân, hồ sơ cá nhân, ảnh chụp màn hình EMR, bản gốc chưa làm sạch) **chỉ để trong `temp-1/`** (đã gitignore). Đưa vào `docs/` thì phải làm sạch trước.
3. **Mã danh mục chỉ được gán bởi code khớp danh mục** (`src/shared/match.ts`), không bao giờ để LLM tự điền mã. Không đặt `ai_fill: true` cho trường mã.
4. **Next.js 16 khác dữ liệu huấn luyện.** Trước khi viết code dùng API Next, đọc `node_modules/next/dist/docs/` hoặc tra context7.
5. Viết tài liệu, nhãn giao diện, thông báo lỗi bằng tiếng Việt, giữ giọng văn hiện có.

## Lệnh thường dùng

```bash
npm run dev                  # http://localhost:3000, mặc định LLM_PROVIDER=mock
npm run lint
npm test                     # test node:test cho src/**/*.test.ts
npm run build
npm run eval -- --rule-only  # chấm điểm bộ tách quy tắc, không tốn phí API
npm run eval-mau             # đo phiếu mẫu theo bệnh đúng sẵn bao nhiêu (mock, không tốn phí)
npm run cao-du-lieu          # cào lại danh mục thật về data/tham-khao/ (ứng dụng chưa nạp)
npm run tai-model-giong-noi  # tải model Zipformer về models/, cần cho ASR_PROVIDER=zipformer
npm run tao-am-thanh-mau     # Windows: giọng máy đọc 11 ca thành data/giong-noi/*.wav
npm run tao-lich-su-clinic   # tạo lại 4 phiếu cũ giả (data/clinic/history) và ngữ cảnh LK-GIA-0458 cho dashboard
npm run eval-giong-noi       # đo nhận dạng giọng nói + bộ sửa chữ (config/sua-chu-giong-noi.json)
```

`npm run eval -- --provider=anthropic|openai|gemini` gọi API thật và tốn phí: hỏi trước khi chạy.

## Kiến trúc nhanh

- Chỉ có hai trang: `/` là eForm (mô phỏng phiếu khám EMR + cột Trợ lý AI, `src/client/eform/`), `/ket-qua` là số đo lượt thử (ghi khi bấm Lưu trên eForm). Trang "Màn hình làm việc" cũ đã bỏ ngày 2026-11-11.
- `config/forms/*.json` sinh ra schema gửi LLM, prompt, mock và eval. Giao diện eForm viết tay: thêm trường thì sửa JSON, rồi nối vào `src/shared/eform/dien-phieu.ts` và `src/client/eform/` nếu cần hiện trên phiếu.
- Code chia theo nơi chạy, xem `docs/cau-truc-du-an.md`: `src/app` (định tuyến mỏng), `src/client` (FE), `src/server` (BE, có `import "server-only"`), `src/shared` (TS thuần dùng cả hai phía). `src/client` không import `src/server`, gọi qua `/api/*` bằng `src/client/api.ts`; kiểu request/response đặt ở `src/shared/api.ts`. `npm run lint` chặn import sai chiều.
- AI thật (LLM, ASR) ở `src/server/ai/`: `pipeline.ts` → `llm/{mock,anthropic,openai,gemini,rules}.ts` → `src/shared/match.ts` (khớp danh mục) → `src/shared/validate.ts`.
- `src/shared/eform/` là rule mock cho trang eForm (tóm tắt, gợi ý ICD10, mẫu câu, gợi ý chỉ định và đơn thuốc theo chẩn đoán, đếm số đo lượt thử), chạy trên trình duyệt, không gọi LLM.
- Script ngoài Next import code server phải chạy bằng `tsx --conditions=react-server` (như `npm run eval`), nếu không `server-only` sẽ báo lỗi.
- Thêm trường mới thì bổ sung `expected` trong `data/cases/ca-*.json` để eval không tính là "Thừa".

## Kiểm tra trước khi báo xong

- `npm run lint` sạch; đổi logic tách/khớp thì chạy `npm run eval -- --rule-only` và ghi điểm trước/sau vào CHANGELOG.
- Đổi giao diện thì mở trang trong trình duyệt (plugin playwright) để xem thật.

## Plugin dùng trong dự án

Khai báo trong `.claude/settings.json`: `typescript-lsp` (cần `npm i -g typescript-language-server typescript`), `playwright`, `security-guidance`, `claude-md-management`, `commit-commands`, `frontend-design` (skill thiết kế giao diện). Lý do chọn từng cái xem `docs/CHANGELOG.md` mục ngày 2026-11-10 và 2026-11-11.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **speech-to-navigation** (3316 symbols, 8035 relationships, 277 execution flows).

> Index stale? Run `node .gitnexus/run.cjs analyze --index-only` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? Bootstrap with `npx`, `bunx`, or `pnpm dlx` — e.g. `bunx gitnexus@latest analyze` (npm 11 npx crash; #1939).

## Always Do

- **MUST run impact before editing.** Use `impact({target: "symbolName", direction: "upstream"})` or `node .gitnexus/run.cjs impact "symbolName" --direction upstream --repo .`; report callers, processes, and risk. Never substitute grep for graph analysis.
- **MUST analyze graph changes before committing.** Use `detect_changes({scope: "all"})` (MCP) or `node .gitnexus/run.cjs detect-changes --scope all --repo .` (CLI fallback). `partial: true` or `truncated: true` is not a clean check — a zero means unseen, not unaffected; re-run it. For regression review: `detect_changes({scope: "compare", base_ref: "main"})` or `node .gitnexus/run.cjs detect-changes --scope compare --base-ref "main" --repo .`.
- MUST warn on HIGH/CRITICAL `risk` pre-edit; never use `riskSharedAxes` to waive a HIGH/CRITICAL `risk` warning. Compare File/symbol: MCP File omits axes; Graph-RAG expands File.
- **MUST treat `risk: UNKNOWN` as unresolved, not as low.** An empty caller set is not evidence the symbol is unused — it can also mean the callers are not resolvable by the index (plain-object property access, dynamic dispatch, cross-language calls). `impact` pairs `UNKNOWN` with a `riskNote` saying so. Confirm with a text search before treating the symbol as safe to change or delete; do not proceed on the strength of a zero.
- **MUST use `query({search_query: "concept"})` for concepts/flows, `context({name: "symbolName"})` for a named symbol, or `impact` for blast radius, on read-only callers, dependencies, imports, or execution flow.** Graph first; text search only for empty/`UNKNOWN`/literals.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method before MCP/CLI impact analysis.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis, and never read `UNKNOWN` as an all-clear — it means the walk could not answer, which is the one verdict that requires confirming by other means.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit before MCP/CLI graph change analysis.

## Resources

| Resource | Use for |
| --- | --- |
| `gitnexus://repo/speech-to-navigation/context` | Codebase overview, check index freshness |
| `gitnexus://repo/speech-to-navigation/clusters` | All functional areas |
| `gitnexus://repo/speech-to-navigation/processes` | All execution flows |
| `gitnexus://repo/speech-to-navigation/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
| --- | --- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
