# Làm việc nhiều agent song song

Áp dụng cho mọi agent (Claude, Gemini/Antigravity, Codex…) khi nhiều agent cùng làm trên repo này. `CLAUDE.md` áp dụng y nguyên cho mọi agent, **trừ quy tắc 7** (chia việc cho sub-agent, chỉ dành cho Claude). Agent không có skill `ghi-tai-lieu`/hook `Stop` của Claude thì tự thêm mục vào `docs/CHANGELOG.md` theo đúng mẫu các mục đã có (quy tắc 1).

## Chia việc
- **Một việc = một agent = một worktree = một nhánh = một PR vào `dev`.** Người điều phối giữ bảng việc (việc, agent, worktree/cổng, file chính, trạng thái). Agent chỉ làm đúng việc được giao, không tự nhận việc khác.
- Chia sao cho các việc chạy cùng lúc **không sửa chung file**. File buộc phải dùng chung (ví dụ `src/shared/eform/types.ts`, `src/server/du-lieu/eform.ts`) thì chỉ thêm dòng, không sửa hay xếp lại dòng có sẵn. Cần sửa file ngoài danh sách của việc mình thì dừng, hỏi người dùng.
- Việc phụ thuộc nhau thì làm nối tiếp (PR sau đặt base là nhánh PR trước), không làm song song.

## Worktree
- Tạo theo quy tắc 6: `git fetch origin` rồi `git worktree add -b <nhánh> ../wt/<tên> origin/dev`. Đặt worktree **ngoài** thư mục repo.
- Worktree mới chưa có file bị gitignore: chép `.env`/`.env.local` từ repo chính, đưa `models/stt/zipformer-vi/` vào (tải lại hoặc liên kết), chạy `npm ci`, chạy `npx next typegen` trước `npx tsc --noEmit`.
- Mỗi worktree một cổng riêng: `npm run dev -- -p 3001`, `3002`… Cổng 3000 để cho repo chính. Không chạy hai `next dev` trong cùng một thư mục.

## Commit và PR
- Chỉ commit trên nhánh của worktree mình. `git add` đúng đường dẫn (không `git add -A`), commit tiếng Việt.
- Agent **không push, không merge, không rebase, không đụng `dev`/`main`** khi chưa được người dùng đồng ý. Người dùng xem kết quả rồi mới push nhánh và mở PR vào `dev`.
- Gộp nhiều PR: gộp lần lượt từng PR. Trước mỗi lần gộp, merge `origin/dev` mới nhất vào nhánh, giải xung đột, chạy lại test/lint/build. Xung đột ở `docs/CHANGELOG.md` thì giữ cả hai mục (mục mới hơn ở trên). Chuỗi PR nối tiếp: gộp PR trước vào `dev`, đổi base PR sau sang `dev`, merge `dev` vào nhánh rồi mới gộp.
- Gộp xong thì xoá worktree và nhánh cục bộ (`git worktree remove`, `git branch -d`). Còn sổ theo dõi trong `.superpowers/` của worktree thì chép ra trước khi xoá.

## An toàn dữ liệu
- Chỉ dùng dữ liệu giả (quy tắc 2). Không mở lại `/api/extract` (đã khoá); mọi lời gọi AI phải qua luồng che PII (`checkClinicalPrivacy`, `extractClinicalDraft`). AI không kê thuốc (quy tắc 8).

## Xong việc khi
- `npm test`, `npm run lint`, `npm run build` đều qua (so với mốc của `dev` lúc tạo nhánh), và đã tự thử trên trình duyệt ở cổng của mình nếu việc có giao diện. Không qua sau vài lần sửa thì dừng, ghi lý do.
- Có mục trong `docs/CHANGELOG.md`, cập nhật bảng việc (trạng thái, commit, cách kiểm tra), rồi báo người dùng.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

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
