# Trợ lý gọn: bong bóng, gọi phiếu mẫu bằng tên, câu quen (việc 7)

- **Ngày:** 2026-11-27 · **Trạng thái:** Bản đề xuất, chờ bạn cùng nhóm duyệt, chưa code
- **Nguồn:** chuyển từ nhánh `thanh` (commit b7c0900 "bong bóng Trợ lý", d8fa4f8 "câu quen trong prompt") sang `dev`, theo luồng che PII của `dev`

## Vì sao

Bác sĩ mất quá nhiều thời gian nhập phiếu. Nhật ký thực địa 16/11 (`docs/tham-khao/nhat-ky-day-du-tmh-tuan-3.md`): điền phiếu mất 3–10 phút, dài hơn thời gian khám (2–4 phút) ở 4/6 ca. Phần lớn ca TMH lặp lại theo vài bệnh quen, và mỗi bác sĩ có sẵn câu quen cho từng ô. Vì vậy cách nhanh nhất là gọi một mẫu đúng bệnh rồi chỉ sửa chỗ khác, thay vì đọc lại cả phiếu cho AI tách.

## Mục tiêu

1. Bác sĩ gõ một lệnh ngắn ("viêm họng cấp 3 ngày sốt 38", "tbt mv") là phiếu điền xong phần có sẵn **ngay trên máy**, không chờ AI. Lần này ô lệnh chỉ nhận gõ (xem mục 1).
2. Phần bác sĩ nói thêm ngoài mẫu vẫn đi đúng luồng của `dev`: che PII → AI trích có bằng chứng → đề xuất → bác sĩ duyệt.
3. Trợ lý không chiếm một cột cố định. Phiếu được dùng cả bề ngang, Trợ lý mở bằng bong bóng hoặc phím F2.

## Không làm (lần này)

- Không để AI viết câu quen hay điền chỗ trống trong mẫu. Hai việc này trái với luật trích có bằng chứng (`validateClinicalExtraction`, `preserveDetails` trong `src/server/clinical/extraction.ts`), đã loại ở phần Các hướng đã xét.
- Không kê thuốc. `dev` đã đưa kê đơn ra ngoài phạm vi. Phần thuốc trong mẫu cũng bỏ, như PR #7 đã làm.
- Không sửa lõi che PII, lõi kiểm AI, cách tạo và duyệt đề xuất (`src/server/clinical/*`, `src/shared/clinical/changes.ts`).
- Không đưa nút "Dùng câu quen" cạnh đề xuất AI (để sau, xem Câu hỏi 3).
- Không chuyển phần khác của b7c0900 ("bỏ nút gợi ý rải trên phiếu", "chữ mờ chỉ gợi ý câu đủ chắc"). Gợi ý Tab đã có qua PR #6.

## Điều không được xảy ra

- Chữ bác sĩ gõ trong ô lệnh rời trình duyệt mà chưa qua che PII. Ô lệnh chỉ chạy trên máy. Phần nào cần AI thì bác sĩ chuyển sang ô "Nội dung buổi khám" và đi luồng che như hiện nay.
- Mẫu ghi đè chữ bác sĩ đã nhập hoặc đã sửa (nguồn `bs`, `sua`).
- Trước khi lưu, bác sĩ không phân biệt được ô do mẫu điền với ô tự mình nhập. Sau khi lưu thì ô do mẫu điền tính là bác sĩ nhập (mục 3).
- Chữ do mẫu điền bị ghi là AI viết.

## Ràng buộc

- Chỉ dữ liệu giả (CLAUDE.md quy tắc 2). Phiếu mẫu `data/eform/phieu-mau.json` và bộ gõ tắt `data/go-tat/` đều là dữ liệu giả.
- Mã ICD chỉ do code khớp danh mục gán (quy tắc 3). Mẫu đã có mã tra sẵn (`icdTheoMau`).
- `dev` không cho duyệt đề xuất AI khi phiếu còn thay đổi chưa lưu (`dirty` trong `TroLyAi`). Đề xuất tính trước/sau theo bản đã lưu trên máy chủ (`proposeClinicalChanges`).
- Trang trình diễn (`/trinh-dien`, không có `bridge`) không ghi hồ sơ.

## Các hướng đã xét

| Hướng | Cách làm | Được | Mất |
|---|---|---|---|
| **A (chọn)** | Mẫu, gõ tắt, câu quen chạy trên máy. Chỉ lời nói đi qua che PII → AI → đề xuất | Nhanh nhất ở ca thường gặp, không chờ AI. Không đụng lõi PII và lõi kiểm AI, duyệt nhanh | Chỗ trống trong mẫu điền theo quy tắc (bên, số ngày, nhiệt độ), không tinh bằng AI |
| B | Nới luật kiểm AI, cho trích từ mẫu và câu quen làm nguồn | Một lần gọi AI điền hết, chỗ trống tinh hơn | Sửa lõi `validateClinicalExtraction`, rủi ro an toàn, duyệt lâu. Lần nào cũng chờ AI |
| C | Chỉ bong bóng và phiếu mẫu, bỏ câu quen | Nhỏ nhất | Mất phần giúp phiếu ra đúng giọng văn từng bác sĩ |

Người dùng chọn **A** vì nó nhắm thẳng vào thời gian chờ và không phải xin sửa luồng PII.

## Thiết kế

### 1. Bong bóng Trợ lý

- Nút tròn góc dưới phải, ngay trên thanh đáy (`--cao-day`). Bấm hoặc nhấn F2 thì mở khung, Esc thì đóng và trả con trỏ về ô đang gõ. Lấy theo `BongBongAi.tsx` của `thanh` (a8dcac3).
- Phiếu (`<main>`) dùng cả bề ngang. Cột `TroLyAi` cố định bên phải được bỏ.
- Trong khung có hai phần:

```
┌ Trợ lý ─────────────────────────────── [×] ┐
│ Lệnh nhanh (chạy trên máy, không gửi đi)   │
│ [ viêm họng cấp 3 ngày sốt 38 tbt      ]   │
│ ✓ Đã điền 9 ô từ mẫu "Viêm họng cấp".      │
│   Chỗ vàng là chỗ cần xem. [Xem chỗ vàng]  │
│   "kèm ho đờm" chưa điền được: nói ở dưới. │
│   [Lưu phiếu]                              │
├────────────────────────────────────────────┤
│ Nội dung buổi khám (che PII rồi mới gửi AI)│
│ (nguyên phần TroLyAi của dev: Hội thoại /  │
│  Bác sĩ đọc, micro, ô nhập, bản đã che,    │
│  "Che thông tin và tạo bản nháp", đề xuất) │
└────────────────────────────────────────────┘
```

- Phần dưới giữ nguyên logic của `TroLyAi` trên `dev`, chỉ đổi chỗ hiển thị. Mọi chỗ gọi `checkClinicalPrivacy`, `extractClinicalDraft`, `recordingApi`, `ClinicalChanges` để nguyên.
- **`TroLyAi` luôn được mount, đóng khung chỉ ẩn đi** (không render có điều kiện). Lý do: khi mount, `TroLyAi` đăng ký `bridge.setTextSink` và gỡ ra khi unmount (`TroLyAi.tsx:134-142`). Không có nơi nhận thì chữ từ micro bị bỏ mà không báo gì (`EncounterWorkspace.tsx:103`). Chữ chưa che, kết quả kiểm tra và bản nháp đều nằm trong state của `TroLyAi`, nên unmount là mất hết.
- Đang ghi âm thì bong bóng có dấu hiệu đang ghi (chấm đỏ) kể cả khi khung đóng. Đóng khung không dừng ghi âm.
- **Ô lệnh không có micro** (Claude chọn). Micro của `dev` gửi âm thanh lên `/api/asr` và chữ đi qua `bridge` vào ô Nội dung buổi khám. Cho ô lệnh nhận giọng nói thì phải thêm một đường ghi âm riêng ngoài phiên ghi âm và luồng che. Bác sĩ muốn nói thì dùng micro ở phần dưới như hiện nay.
- **Bỏ hẳn cột Trợ lý, không giữ công tắc giao diện cũ/gọn** (Claude chọn). Đỡ phải duy trì hai bố cục. Mốc "trước" để so là các lượt thử đã ghi `giao_dien: "cu"` (xem mục 7).

### 2. Ô lệnh nhanh: thứ tự xử lý

Lấy theo `useDienAi.ts` của `thanh`, bỏ mọi đường gọi `/api/extract`:

1. **Gõ tắt** `tachGoTat(lệnh, data.goTat)`: mã gõ tắt của bác sĩ bung vào đúng ô. Câu quen đi theo đường này. Ô đích đã có chữ (Claude chọn):
   - Nguồn `cu`, `ai`, `xem` hoặc chữ mẫu vừa điền: **thay** chữ cũ, giống `chenGoTat` của `thanh`, vì bác sĩ đã chọn đích danh câu này.
   - Nguồn `bs` hoặc `sua` (bác sĩ tự nhập hoặc đã sửa): **nối thêm**, xuống dòng với ô khám, dấu cách với ô khác (như `XUONG_DONG` trong `go-tat.ts`), không xoá chữ bác sĩ.
2. **Tên mẫu** `timPhieuMau(phần còn lại, data.phieuMau)`. Không khớp tên thì thử theo chẩn đoán mà gõ tắt vừa bung ra, như `thanh`.
   - Khớp **một** mẫu: điền mẫu.
   - Khớp **nhiều** mẫu: hiện nút chọn mẫu (`goiYTenMau`), giữ lại chi tiết và gõ tắt đã tách.
3. **Chi tiết** sau tên mẫu: `ketQuaTheoQuyTac(mau, chiTiet, data.vietTat)` thay chỗ trống (bên, số ngày, nhiệt độ…).
4. **Phần dư** quy tắc không đặt được: không bỏ im lặng. Hiện câu "… chưa điền được: nói hoặc gõ ở Nội dung buổi khám". Có nút chép phần dư xuống ô dưới, để bác sĩ chủ động đưa qua luồng che PII.

Không có mẫu, không có gõ tắt thì báo "Không thấy mẫu hay gõ tắt nào. Nói hoặc gõ nội dung ở phần dưới để AI trích."

### 3. Điền phiếu từ mẫu

- Dùng `dienPhieu(..., { chiOTrong: true, icd, oKhac, chepLichSu: true, clinicalOnly: true })` đã có trên `dev` (PR #7). Chỉ điền ô trống, ô bác sĩ đã nhập giữ nguyên.
- **Nguồn ô trên màn hình (trước khi lưu):** chữ lấy nguyên từ mẫu là `cu`. Chỗ trống quy tắc vừa thay là `xem` (tô vàng, đếm vào "chỗ vàng"). Ô bung từ gõ tắt là `bs`, vì đó là chữ của chính bác sĩ.
  - `dienPhieu` hiện làm ngược: chữ mẫu thành `ai`, và `xem` chỉ khi chỗ trống *còn chưa* điền (`dien-phieu.ts:134-135`). Cần bọc hoặc thêm tùy chọn để biết chỗ nào quy tắc *vừa* thay, rồi gán nguồn như trên.
  - Màn hình giữ danh sách id các ô do mẫu điền trong lượt này, để phân biệt với dữ liệu cũ thật cũng mang nguồn `cu`.
- **Nguồn ô khi lưu (người dùng chọn):** ô do mẫu điền được **lưu như bác sĩ nhập** (`nhap_tay`). Lý do: chính bác sĩ gọi mẫu, xem chỗ vàng rồi bấm Lưu. Không đụng lõi `src/shared/clinical`.
  - Nếu giữ nguyên, `applyEformSnapshot` sẽ đổi `cu` thành `he_thong` (trông như dữ liệu cũ) và `xem` thành `ai` chưa duyệt (ghi sai là AI viết) (`src/shared/clinical/eform.ts:57`).
  - Cách làm: trước khi dựng snapshot để lưu, phía màn hình đổi nguồn các ô trong danh sách "do mẫu điền" sang `bs`. Dữ liệu cũ thật giữ `cu`.
  - Cái giá: mở lại hồ sơ thì không còn biết ô nào do mẫu điền. Muốn giữ dấu đó về sau thì thêm nguồn "mẫu" vào lõi (xem Câu hỏi 3).
- Chỉ định trong mẫu đi vào tab Chỉ định như gói chỉ định (PR #8), qua bước Xác nhận chỉ định sẵn có.
- Điền xong thì phiếu ở trạng thái chưa lưu. Khung hiện nút **Lưu phiếu** gọi đúng hàm lưu hiện có. Nút "Che thông tin và tạo bản nháp" giữ luật của `dev`.

### 4. Ghép với luồng che PII và đề xuất

Trình tự một ca thường gặp:

```
Lệnh "viêm họng cấp 3 ngày" → điền mẫu trên máy (0 giây chờ) → Lưu phiếu
→ bác sĩ nói thêm ở Nội dung buổi khám → che PII → AI trích → đề xuất (trước: chữ của mẫu, sau: chữ AI)
→ bác sĩ chấp nhận để thay, hoặc bỏ qua để giữ chữ của mẫu
```

Không cần đổi gì phía máy chủ. Lưu trước nên đề xuất so với bản đã có mẫu, bác sĩ thấy rõ AI muốn đổi gì.

### 5. Câu quen

- **Lần này:** câu quen dùng qua (a) mã gõ tắt trong ô lệnh và trong ô phiếu, (b) chữ mờ bấm Tab (PR #6). Cả hai đều chạy trên máy.
- **Bỏ:** đưa câu quen vào prompt AI (`phanCauQuen` của `thanh`), vì AI chỉ được trích từ lời nói.

### 6. Trang trình diễn

Không có `bridge` thì ô lệnh nhanh vẫn chạy (không ghi hồ sơ), phần dưới giữ thông báo hiện có "Trợ lý lâm sàng chỉ hoạt động trong một lượt khám đã mở".

### 7. Đo hiệu quả

- Thời gian điền phiếu mỗi lượt thử ở `/ket-qua` (`src/shared/metrics.ts`): so trước/sau khi có ô lệnh nhanh, theo `docs/kich-ban-thu-bac-si.md`. Trường `giao_dien` đã có (`"gon" | "cu"`) nhưng `EformScreen.tsx:341` ghi cứng `"cu"`. Đổi thành `"gon"`, các lượt cũ làm mốc "trước".
- `npm run eval-mau`: mẫu đúng sẵn bao nhiêu phần (hiện 67,5%, ghi ở PR #7).
- Số đo chỉ ghi số đếm (đã dùng mẫu nào, bao nhiêu ô, bao nhiêu chỗ vàng), không ghi chữ trong ô lệnh.

## Câu hỏi cho bạn cùng nhóm

1. **Bỏ cột Trợ lý, chuyển vào bong bóng (`TroLyAi` luôn mount, chỉ ẩn):** còn chỗ nào của luồng ghi âm nhiều phiên cần Trợ lý hiện ra (focus, cảnh báo, chuyển lượt khám) mà khung đóng sẽ che mất không?
2. **Nút Lưu phiếu trong khung:** để riêng như trên, hay gộp thành một nút "Lưu rồi tạo bản nháp" để bớt một lần bấm?
3. **Nguồn "mẫu" trong lõi** (về sau): lần này ô do mẫu điền lưu như bác sĩ nhập. Có muốn thêm nguồn riêng cho mẫu vào `Source` để giữ dấu sau khi lưu không?
4. **Câu quen cạnh đề xuất AI** (để sau): AI đề xuất ô X, mà bác sĩ có câu quen cho ô X, thì hiện câu quen để bấm thay. Việc này đụng `ClinicalChanges`, có nên làm không?

## Để người làm tự quyết

- Chia component (`BongBong`, `LenhNhanh`, hook kiểu `useLenhNhanh`) và cách ẩn khung mà vẫn giữ `TroLyAi` mount.
- Bọc hay thêm tùy chọn cho `dienPhieu` để gán nguồn ở mục 3.
- Còn chỗ vàng thì có cho Lưu không: theo luật đếm "chỗ vàng" sẵn có của `EformScreen`.
- Câu chữ thông báo, giữ giọng văn hiện có.
- Test: thứ tự xử lý ô lệnh (gõ tắt → mẫu → chi tiết → phần dư), không ghi đè ô `bs`/`sua`, ô lệnh không gọi `fetch`.

## Tham chiếu code

- `thanh`: `src/client/eform/BongBongAi.tsx`, `useDienAi.ts` (a8dcac3); `src/server/ai/prompt.ts` `phanCauQuen` (d8fa4f8, không chuyển)
- `dev`: `src/client/eform/TroLyAi.tsx`, `EformScreen.tsx`, `ClinicalChanges.tsx`; `src/shared/eform/{phieu-mau,go-tat,dien-phieu}.ts`; `src/server/clinical/extraction.ts`; `src/shared/clinical/changes.ts`
