# Kê đơn thuốc trở lại: tab Đơn thuốc, gợi ý theo chẩn đoán, in hai bản

- **Ngày:** 2026-11-27 · **Trạng thái:** Bản đề xuất, chờ bạn cùng nhóm duyệt, chưa code
- **Nguồn:** chuyển từ nhánh `thanh` (d8fa4f8 "kê thuốc dùng khi cần, liều 1 v tự tính tổng", 5d40321 "gợi ý theo chẩn đoán lên 57 bộ", 6b06182 "tách In ngay thành In phiếu khám và In đơn thuốc") sang `dev`, theo lớp hồ sơ clinical của `dev` (lưu, duyệt theo phần, nguồn dữ liệu)

## Vì sao

Bác sĩ TMH khám xong là kê đơn: phần lớn ca chỉ chọn lại vài thuốc quen theo bệnh, rồi in một tờ đơn riêng đưa bệnh nhân (EMR thật in phiếu khám và đơn thuốc là hai tờ). Trên `dev`, PR #7 đưa kê đơn ra ngoài phạm vi để AI không kê thuốc, nhưng làm mất luôn chỗ bác sĩ tự kê: tab Đơn thuốc bị ẩn, `donThuoc` trong `EformScreen` luôn rỗng, nút "In ngay" chỉ in phiếu và chỉ định. Việc này đưa lại phần bác sĩ tự kê, **không đưa lại việc AI kê**.

## Mục tiêu

1. Tab **Đơn thuốc** hiện lại trên eForm. Bác sĩ nhập tay hoặc chọn từ gợi ý theo chẩn đoán; thuốc **dùng khi cần**; liều kiểu "1 v" tự tính **Tổng SL**.
2. Đơn thuốc **lưu vào hồ sơ clinical** (có phiên bản, nguồn dữ liệu, mã danh mục do code gán) và là **một phần duyệt riêng**, như phần Chỉ định.
3. Hai nút in: **In phiếu khám** và **In đơn thuốc**, hai bản in khác nhau, khổ A4, thanh đáy gọn ở khổ điện thoại.
4. Hồ sơ cũ (chưa có đơn thuốc) vẫn đọc và in được như trước.

## Quyết định đã chốt (không bàn lại)

1. Hiện lại tab Đơn thuốc ở `EformScreen.tsx` (`TABS` hiện chỉ có Phiếu khám, Chỉ định dịch vụ); có thuốc dùng khi cần và Tổng SL tự tính.
2. Gợi ý thuốc theo chẩn đoán từ `data/eform/goi-y-theo-chan-doan.json`, khớp ICD theo tiền tố. **Mở rộng** `GoiYTheoChanDoan.tsx` và `src/shared/eform/goi-y.ts` đang có trên `dev`, không viết lại.
3. Tách "In ngay" thành In phiếu khám và In đơn thuốc.
4. **AI không kê thuốc.** Giữ `clinicalOnlyResult` (`src/shared/clinical/scope.ts`), không sửa prompt, schema AI, luồng che PII. Mã thuốc chỉ do `src/shared/match.ts` gán (CLAUDE.md quy tắc 3), danh mục `data/catalog/thuoc.json`.
5. Đơn thuốc là phần duyệt riêng. In đơn thuốc chỉ cần đơn đã lưu và đã duyệt; In phiếu khám cần phiếu và chỉ định đã duyệt (điều kiện hiện tại, trừ đơn thuốc).

## Không làm (lần này)

- Không để AI đề xuất, điền hay sửa thuốc dưới bất kỳ hình thức nào: không thêm `don_thuoc` vào `ai-output.schema.json`, không thêm vào `proposeClinicalChanges`, không bật lại `ke_don` trong `clinicalOnlyResult`.
- Không sửa `config/forms/ke-don.json` (nó sinh schema gửi LLM; bản của `thanh` có sửa file này cho `khi_can`, ta bỏ phần đó).
- Không sửa lõi che PII, lõi kiểm AI (`src/server/clinical/{privacy,extraction,...}.ts`).
- Không chặn cứng thuốc trùng dị ứng ở máy chủ (giữ cảnh báo trên giao diện như hiện nay, xem Rủi ro). Không kiểm tương tác thuốc, không kiểm trùng thuốc đang dùng (`thuoc_dang_dung`).
- Không đưa lại phần thói quen kê đơn (`luuThoiQuen` khi Lưu) lần này; chỉ cập nhật cột dữ liệu cho khớp (xem mục 9).
- Không kết nối kho thuốc, giá, BHYT.

## Điều không được xảy ra

- Có dòng thuốc nào trong hồ sơ do đường AI tạo ra (qua `/api/clinical/extract`, `changes`, phiếu trình diễn kiểu AI).
- Mở hồ sơ cũ bị lỗi, hoặc hồ sơ cũ đã duyệt tự đổi thành "chưa duyệt" chỉ vì có thêm phần đơn thuốc.
- In được đơn thuốc chưa duyệt hoặc đã sửa sau khi duyệt.
- Mã thuốc do LLM hoặc client tự điền mà không qua danh mục (máy chủ phải kiểm mã có trong `data/catalog/thuoc.json`).
- Sửa đơn thuốc mà làm các phần khác (phiếu, chỉ định) mất trạng thái đã duyệt, hoặc ngược lại.

## Các hướng đã xét

| Hướng | Cách làm | Được | Mất |
|---|---|---|---|
| **A (chọn)** | Thêm khối `don_thuoc` ngang hàng `chi_dinh` trong hồ sơ, một phạm vi duyệt `prescription`, nâng `schema_version` lên 1.3.0 có đọc-chuyển (migration) | Đúng mô hình đã quen (chỉ định); duyệt, nguồn dữ liệu, phiên bản dùng lại; hồ sơ cũ đọc được | Sửa schema JSON, type sinh ra, vài file lõi `src/shared/clinical` |
| B | Nhét thuốc vào `chi_dinh.items` như một loại dịch vụ | Ít file sửa | Trộn hai khái niệm (`danh_muc` dịch vụ vs thuốc), duyệt từng dòng không hợp tờ đơn, sai in |
| C | Giữ đơn thuốc ngoài hồ sơ (state màn hình, ghi file riêng) | Không đụng schema | Không có phiên bản, không duyệt, mất khi tải lại. Trái yêu cầu 5 |

Người dùng đã chốt đơn thuốc là phần duyệt riêng nên chọn **A**.

## Thiết kế

### 1. Dữ liệu hồ sơ

`config/clinical/encounter.schema.json` thêm khối bắt buộc `don_thuoc` (đặt cạnh `chi_dinh`), định nghĩa dùng chung trong `common.schema.json`:

```
don_thuoc: {
  de_cap: "chua_de_cap" | "khong_ke_don" | "co_ke_don",
  items: PrescriptionItem[]            // tối đa 50 dòng
}
PrescriptionItem {
  id: string,
  noi_dung: {                          // chữ bác sĩ nhập/chọn, đều có thể null
    ten_thuoc, ham_luong, duong_dung, lieu_moi_lan,
    khi_can: boolean,
    so_lan_ngay, thoi_diem, so_ngay,   // chuỗi: "2", "3 lần", để trống với thuốc khi cần
    so_luong_ke,                       // "Tổng SL" bác sĩ tự gõ; trống thì tự tính
    ghi_chu
  },
  danh_muc: CatalogMatch,              // code_system "prototype-drug", do match.ts / bác sĩ chọn, máy chủ kiểm có trong danh mục
  chan_doan_ids: string[],             // chẩn đoán liên quan, tùy chọn (lần này để trống, xem Câu hỏi 5)
  requester_id, requested_at,
  review: Review                       // chua_duyet → chap_nhan khi duyệt
}
```

- **Không có** trường tổng đã tính: `Tổng SL = so_luong_ke nếu > 0, không thì computeTotal(liều, lần/ngày, số ngày)` (`src/shared/validate.ts`) tính lại lúc hiện và in. Lý do: một nguồn sự thật, đổi quy tắc đơn vị ("v" → "viên") thì bản cũ cũng đúng. Cái giá: đổi `config/canh-bao.json` sau này làm số in đổi; bản đã duyệt có `snapshot` đầy đủ nên đối chiếu được.
- `schema_version`: `1.2.0` → **`1.3.0`** (`CLINICAL_SCHEMA_VERSION`, const trong schema, type sinh bằng `npm run clinical:types`). `ai-output.schema.json` **không đổi**.
- **Đọc hồ sơ cũ:** `migrateEncounter` (`src/server/clinical/migrations.ts`) làm theo từng bậc: `1.1.0 → 1.2.0` như cũ, rồi `1.2.0 → 1.3.0` chỉ thêm `don_thuoc: { de_cap: "chua_de_cap", items: [] }` và đổi số phiên bản. Hàm vẫn thuần (không ghi khi đọc); ghi xuống đĩa ở lần `store.update` kế tiếp. Không đổi `revision`, không tạo phiên bản duyệt mới, `approval_versions` cũ giữ nguyên (kể cả snapshot cũ không có `don_thuoc`).
- **Kiểm hợp lệ** (`checkClinical` + `parseEncounter` trong `src/shared/clinical/schema.ts`): `(de_cap === "co_ke_don") === (items.length > 0)`; ID dòng không trùng; `chan_doan_ids` phải tồn tại trong `chan_doan`. Không kiểm sâu hơn ở schema; luật nghiệp vụ nằm ở lúc duyệt (mục 3).
- `emptyEncounter` tự sinh `don_thuoc` rỗng từ schema (`empty()` lấy giá trị enum đầu = `chua_de_cap`).

### 2. Chuyển eForm ↔ hồ sơ

`src/shared/clinical/eform.ts` (nơi `applyEformSnapshot` / `projectEform` đã chuyển Chỉ định):

- `snapshotSchema` thêm **hai khóa tùy chọn**: `donThuoc` (mảng dòng, `ung_vien` bị bỏ như `chiDinh`) và `donThuocDeCap` (`chua_de_cap | khong_ke_don | co_ke_don`). **Khóa vắng thì giữ nguyên `don_thuoc` của hồ sơ** (client cũ, tab chưa mở không xóa đơn). `projectEform` luôn trả cả hai.
- `applyEformSnapshot(base, input, context)`: `context` thêm `drugs: CatalogItem[]` (danh mục thuốc, máy chủ lấy từ `data.danhMuc.thuoc`). Mỗi dòng: ghép với dòng cũ theo `id` (như chỉ định); chọn thuốc mới thì **mã phải có trong `drugs`**, không thì lỗi "Thuốc không có trong danh mục."; giữ nguyên lựa chọn cũ khi chỉ sửa liều. Dòng mới hoặc dòng có nội dung đổi thì `review` về `chua_duyet`. Dòng không đổi giữ nguyên review. `de_cap` suy ra: có dòng → `co_ke_don`; không dòng và `donThuocDeCap === "khong_ke_don"` → `khong_ke_don`; còn lại `chua_de_cap`.
- Nguồn dữ liệu: dòng mới ghi `Source { field_path: "/don_thuoc/items/<i>", nguon: "nhap_tay", source_system: "prototype-eform" }`, kể cả thuốc chọn từ gợi ý theo chẩn đoán (đó là thao tác chọn của bác sĩ, bộ mẫu không phải AI). Đoạn "rebase nguồn theo ID" cuối hàm mở rộng nhận `/don_thuoc/items/<i>` như `/chi_dinh/items/<i>`.
- `projectEform` → `donThuoc: DongThuoc[]` với `nguon: review.trang_thai === "chua_duyet" ? "xem" : "bs"` (giống chỉ định; không bao giờ trả `"ai"`), `ung_vien: []`.
- `audit.approved_at/by` vẫn được xóa mỗi lần Lưu (đã có).

### 3. Duyệt theo phần

`src/shared/clinical/approvals.ts`:

- `ApprovalScope` thêm **`"prescription"`** (một phạm vi cho cả tờ đơn, không theo từng dòng: đơn in là một tờ, sửa một thuốc thì cả tờ cần duyệt lại). `scopeSchema` ở `approval-service.ts` nhận thêm giá trị này.
- `approvalScopeForPath`: `/don_thuoc/de_cap` và `/don_thuoc/items/...` (chỉ các trường nội dung, không phải `review`, `id`) → `prescription`.
- `scopeProjection(record, "prescription")` trả: `de_cap`, từng dòng (`id`, `noi_dung`, `catalog` rút gọn như chỉ định, `chan_doan_ids`), **cùng chẩn đoán (ban đầu và ra viện) và `di_ung`**. Lý do: đơn gắn với chẩn đoán và dị ứng đang in lên tờ; đổi chẩn đoán hoặc dị ứng sau khi duyệt thì đơn phải thành "Đã sửa sau khi duyệt" để bác sĩ nhìn lại, không in được bản cũ. Cái giá: sửa chẩn đoán làm cả phiếu và đơn cần duyệt lại (xem Câu hỏi 2).
- Truy cập an toàn: `record.don_thuoc ?? DON_THUOC_TRONG` ở mọi chỗ đọc `don_thuoc` từ **snapshot cũ** (`approvalState`, `approvalAuditCompatibility`, `scopeProjection` qua `version.snapshot`). Snapshot trong `approval_versions` không được migrate.
- `requiredApprovalScopes`: thêm `"prescription"` **khi `de_cap !== "chua_de_cap"`** (đã quyết định có/không kê thì phải duyệt). Hồ sơ cũ và hồ sơ chưa quyết định không đòi duyệt đơn: hồ sơ cũ đã duyệt đủ vẫn "đã duyệt đủ", `approvalAuditCompatibility` không đổi.
- `validateScope` (`approval-service.ts`, máy chủ) cho `prescription`:
  - `chua_de_cap` → 422 "Hãy xác nhận có hoặc không kê đơn thuốc."
  - Cần ít nhất một chẩn đoán có mã ICD (ban đầu hoặc ra viện).
  - Mỗi dòng: có `danh_muc.code` (đã chọn đúng thuốc); `lieu_moi_lan` không rỗng; thuốc thường (không `khi_can`) cần `so_lan_ngay > 0` và `so_ngay > 0`; **Tổng SL phải xác định** (`so_luong_ke > 0` hoặc `computeTotal` ra số). Thuốc dùng khi cần và thuốc không đếm được (xịt, nhỏ) buộc gõ Tổng SL. Quy tắc đơn vị lấy từ `loadRules()` phía máy chủ.
- `approveScopes`: duyệt `prescription` thì set `review = chap_nhan` cho mọi dòng thuốc, đánh dấu `nguon_du_lieu` có `field_path` bắt đầu `/don_thuoc/` (hàm `sourceScope` thêm nhánh này), rồi ghi `approval_versions` (snapshot đầy đủ, digest của phạm vi). Dùng lại hoàn toàn đường có sẵn.
- `transitionEncounter("complete")`: tự đòi `prescription` ở trạng thái `current` nếu đã quyết định (do `requiredApprovalScopes`). Chưa quyết định có/không kê vẫn hoàn tất được (Câu hỏi 1).
- `approveClinicalForActor` (`service.ts`, đường duyệt-một-lần cũ): kiểm xem còn route nào gọi không; nếu còn thì thêm đánh dấu review cho dòng thuốc, không còn thì để nguyên (không mở rộng thêm).

**Không kê thuốc:** như Chỉ định có "không chỉ định", đơn thuốc có hộp **"Không kê đơn thuốc"** (`de_cap: "khong_ke_don"`, chỉ chọn được khi không có dòng nào). Duyệt phạm vi `prescription` lúc đó nghĩa là "bác sĩ xác nhận không kê". Nút In đơn thuốc tắt (không có gì để in). Chưa chọn gì (`chua_de_cap`) thì khung Duyệt hiện một dòng nhắc nhẹ "Chưa xác nhận có hay không kê đơn thuốc" nhưng **không chặn** hoàn tất.

### 4. Nhật ký thay đổi và phiên bản

- Mỗi lần Lưu tăng `revision` một lần (đã có); đơn thuốc đi cùng bản lưu đó, không có `revision` riêng.
- Nguồn từng dòng: `nguon_du_lieu` (`nhap_tay`, `review` đổi khi duyệt). Mỗi lần duyệt `prescription` ghi một `approval_versions` mới có snapshot cả hồ sơ, nên tra được "đơn nào đã duyệt lúc nào, ai duyệt".
- `change_decisions` (nhật ký chấp nhận/từ chối đề xuất AI) **không** dùng cho thuốc, vì AI không đề xuất thuốc. Ai muốn biết lịch sử sửa đơn thì dùng `approval_versions` + `audit.updated_at/by`.
- Số đo lượt thử (`src/shared/metrics.ts`, `demLuot` ở `do-luong.ts`) tính thuốc như cũ từ `donThuoc` có thật; các chỉ số liên quan AI (`tu_ai`) luôn 0 với thuốc.

### 5. Giao diện tab Đơn thuốc

- `EformScreen.tsx`: `TABS` thêm `{ id: "don_thuoc", nhan: "Đơn thuốc" }`. State `donThuoc` thành `useState` có setter, thêm `khongKeDon` (như `noServices`). `banLuu` (so `chuaLuu`), `finish(response)` (nạp lại từ `snapshot.donThuoc`), `reloadSaved`, `save` (đưa `donThuoc`, `donThuocDeCap` vào `snapshot`), `conXem`, `soDong`, `coGoiY.don_thuoc` đều dùng dữ liệu thật thay cho `[]`.
- `DonThuocTab.tsx` (đang có trên `dev`, thiếu cột): thêm cột **Khi cần** (hộp tích; khi tích thì "Lần/ngày" là số lần tối đa, được trống), cột **Tổng SL** là ô nhập có gợi ý số tự tính (placeholder), mô tả liều `moTaLieu` có "khi cần" và "SL …". Lấy theo `git show thanh:src/client/eform/DonThuocTab.tsx`. Thêm hộp "Không kê đơn thuốc". Đổi dòng trống "Bác sĩ nói đơn thuốc trong cột Trợ lý AI" (sai vì AI không kê) thành "Chưa có thuốc. Tìm ở trên hoặc chọn từ gợi ý theo chẩn đoán."
- `moTaLieu`, hàm chuẩn hóa dòng gợi ý, hàm điều kiện in chuyển sang file thuần `src/shared/eform/don-thuoc.ts` (có test); `BanIn` và `DonThuocTab` cùng import.
- Khung "Duyệt theo từng phần" thêm nhãn "Đơn thuốc" (`scopeLabel`) và dòng nhắc khi `chua_de_cap`. Nút Lưu đổi nhãn "Lưu phiếu, chỉ định & đơn thuốc" (rút gọn ở màn hẹp). Thông báo sau Lưu: "Đã lưu phiếu, chỉ định và đơn thuốc, phiên bản N."

### 6. Gợi ý thuốc theo chẩn đoán

- `GoiYTheoChanDoan.tsx` và `ghepGoiY` đã generic, `DonThuocTab` đã gọi với `lay: mau => mau.donThuoc`. Việc cần làm:
  1. Dòng gợi ý khi **thêm vào đơn** đổi nguồn: `khop` chắc → `"bs"` (bác sĩ chọn), chưa chắc → `"xem"` (giữ `ung_vien` để chọn lại). **Không bao giờ để `"ai"`** trên dòng thuốc: `khopBoMau` đang gán `"ai"` cho dòng khớp chắc (dùng chung với chỉ định), nên chuyển ở `onAdd` của tab thuốc bằng hàm thuần `chuanHoaNguonThuoc` (test).
  2. `khopBoMau` và `thoi-quen.ts` mang thêm `khi_can`, `so_luong_ke` (bộ mẫu cũ ghi "Khi đau", "Khi sốt" ở `thoi_diem` thì `laKhiCan` coi là khi cần).
  3. Bật dấu ✨ trên tab: `coGoiY.don_thuoc = boMau.some(m => m.donThuoc.length > 0)`.
- Bộ mẫu `data/eform/goi-y-theo-chan-doan.json` đã có 57 bộ cùng dòng thuốc trên `dev`, không cần đổi dữ liệu. Khớp ICD theo tiền tố đã có (`khopMaIcd`).
- Gợi ý không tự thêm: bác sĩ tích rồi bấm "Thêm N mục" (như hiện nay). Dòng trùng dị ứng không tích sẵn, có cảnh báo.

### 7. In hai bản

- `BanIn.tsx` nhận `loai: "phieu-kham" | "don-thuoc"` (theo `git show 6b06182`). Phiếu khám: giữ nguyên nội dung hiện tại (tóm tắt, các trường, bảng chỉ định), **bỏ mục đơn thuốc**. Đơn thuốc: tiêu đề "ĐƠN THUỐC", thông tin bệnh nhân, cảnh báo dị ứng, chẩn đoán (chính + kèm theo), bảng STT / Tên thuốc, hàm lượng / Cách dùng (`moTaLieu`) / Tổng SL, chữ ký bác sĩ.
- `EformScreen`: `loaiIn` state, `inBan(loai)` = `flushSync(setLoaiIn)` rồi `window.print()` (để trình duyệt chụp đúng tờ). Dòng chữ "Bản đã duyệt … phiên bản hồ sơ N · duyệt lúc …" của đơn thuốc lấy phiên bản duyệt của phạm vi `prescription`.
- **Điều kiện bật nút** (hàm thuần `dieuKienIn(record, chuaLuu)` trong `don-thuoc.ts`, có test):
  - **In phiếu khám:** `!chuaLuu` và mọi phạm vi của `requiredApprovalScopes` **trừ `prescription`** đều `current` (đúng điều kiện hiện tại về phiếu, chỉ định, kết luận, tóm tắt).
  - **In đơn thuốc:** `!chuaLuu`, `don_thuoc.de_cap === "co_ke_don"` và `approvalState(record, "prescription") === "current"`. Không đòi phiếu khám đã duyệt (theo yêu cầu 5).
  - Nút tắt thì `title` nói rõ thiếu gì ("Chưa lưu", "Đơn thuốc chưa duyệt", "Đơn chưa có thuốc").
- **Lời dặn và hẹn tái khám trên đơn** là trường của phần Kết luận (`conclusion`), có thể chưa duyệt khi in đơn. Mặc định: chỉ in hai dòng này khi `conclusion` đang `current` (hoặc hồ sơ không đòi phần Kết luận); không thì bỏ, tránh in chữ chưa duyệt (Câu hỏi 4).
- `globals.css`: khối `@media print` hiện chỉ đặt khổ A4 và nền trắng; việc "chỉ in khối BanIn" do `print:hidden` trên bố cục màn hình. Kiểm tra lại trong trình duyệt, chỉ sửa nếu bản đơn thuốc lòi phần giao diện.
- **Thanh đáy ở khổ điện thoại:** theo 6b06182: "Báo cáo y tế" rút thành "BCYT", "In phiếu"/"In đơn" (chữ "khám", "thuốc" chỉ hiện từ `md`), nút ↑ ẩn dưới `sm`, nhãn "cần xem lại" rút gọn. Chỉ lấy phần bố cục; bỏ nút "Lưu" đổi tên của `thanh` vì `dev` có nhãn riêng.

### 8. Phiếu mẫu (`phieu-mau`) và lệnh nhanh

Trên `dev`, mẫu phiếu bỏ phần thuốc ở hai chỗ: `{ ...td.phieuMau, donThuoc: [] }` (`EformScreen.tsx` ~105, trang trình diễn kiểu 1) và `ap-lenh.ts` (`dienPhieu(..., { clinicalOnly: true })`, `donThuoc: []`). Đề xuất:

- **Trang trình diễn kiểu 1 (giả lập AI điền nháp): vẫn bỏ thuốc.** Kiểu này mô phỏng AI, mà AI không kê.
- **Ô Lệnh nhanh trong bong bóng Trợ lý (bác sĩ gõ tên mẫu): mở lại thuốc của mẫu.** Lý do: bác sĩ tự gõ tên mẫu và tự chọn, chạy trên máy, không qua LLM; mẫu là bộ do bác sĩ soạn như bộ gợi ý theo chẩn đoán. Cách làm: `dienPhieu` thêm tùy chọn `kemThuoc` (chỉ có hiệu lực cùng `clinicalOnly`), `apKetQuaLenh` trả `donThuoc` có `nguon` đã chuẩn hóa (`bs` hoặc `xem`, không `ai`), `EformScreen` thêm vào đơn các thuốc chưa có, báo "Đã thêm N thuốc từ mẫu vào Đơn thuốc, chưa duyệt". Ô khác của mẫu vẫn theo `ganNguonMau`.
- Nếu nhóm muốn thận trọng hơn: không thêm thuốc vào đơn mà chỉ để tab Đơn thuốc hiện gợi ý theo ICD của mẫu. Đây là Câu hỏi 3 (mặc định như trên).

### 9. Chỗ còn sót `donThuoc` trên `dev`

| Nơi | Hiện trạng | Xử lý |
|---|---|---|
| `EformScreen.tsx` (state `donThuoc`, `banLuu`, `finish`, `conXem`, `soDong`, `coGoiY`, `ghiLuot`, `save`) | `donThuoc` hằng số rỗng; `banLuu.donThuoc: []` | **Sửa**: dữ liệu thật (mục 5) |
| `EformScreen.tsx` ~105 `donThuoc: []` (trình diễn kiểu 1) | Cố ý bỏ | **Giữ** (mục 8) |
| `EformScreen.tsx` ~502 "Bác sĩ kê đơn thuốc bằng quy trình riêng." | Sai sau thay đổi | **Sửa** thành "Phiếu khám, chỉ định dịch vụ và đơn thuốc · Bản lưu N" |
| `BanIn.tsx` (`donThuoc={[]}` ở nơi gọi, bảng thuốc trong bản in) | Rỗng, bảng không bao giờ hiện | **Sửa**: tách hai bản (mục 7) |
| `src/shared/eform/do-luong.ts` (`demLuot` nhận `donThuoc`, đếm thuốc trùng dị ứng) | Đúng sẵn, chỉ nhận mảng rỗng | **Dùng lại**, không sửa |
| `src/shared/eform/ap-lenh.ts` (`donThuoc: []`, `clinicalOnly: true`) | Cố ý bỏ | **Sửa** theo mục 8 (có `kemThuoc`) |
| `src/shared/eform/dien-phieu.ts` (`DongThuoc`, nhánh `clinicalOnly ? [] : draft.ke_don`) | Thiếu `khi_can`, `so_luong_ke` | **Sửa**: thêm hai trường và `laKhiCan`; **giữ** nhánh `clinicalOnly` |
| `src/shared/eform/thoi-quen.ts` (`CotThuoc`, `COT_THUOC`, `goiYThoiQuen`) | Thiếu hai cột | **Sửa**: thêm cột; logic ghép dùng lại |
| `src/shared/eform/goi-y.ts` (`khopBoMau`, `MauGoiY.donThuoc`) | Đủ, thiếu hai trường | **Sửa nhẹ** (mục 6) |
| `src/app/api/thoi-quen/route.ts` (zod `don_thuoc`) | Thiếu hai cột | **Sửa**: thêm `khi_can`, `so_luong_ke` tùy chọn |
| `src/server/du-lieu/trinh-dien.ts` (`ganMa(don.don_thuoc)`) | Dùng đơn đã kê giả cho trình diễn | **Dùng lại**, không sửa |
| `TroLyAi.tsx` ~277 "Đơn thuốc không được tạo tự động; bác sĩ kê toa riêng." | Sai một nửa | **Sửa**: "AI không kê thuốc. Đơn thuốc do bác sĩ nhập ở tab Đơn thuốc." |
| `DonThuocTab.tsx` dòng trống nhắc Trợ lý AI | Sai | **Sửa** (mục 5) |
| `src/shared/validate.ts`, `config/canh-bao.json`, `src/shared/types.ts` (`WarningRules.tinh_tong`) | Chưa có `bungDonViLieu`, `so_luong_ke` | **Sửa**: chuyển từ d8fa4f8 (không kèm `config/forms/ke-don.json`) |

Mọi đường AI (`pipeline`, `prompt`, `schema`, `clinicalOnlyResult`, `extraction`, `changes`, `apply-ai`) **không sửa**; thêm test khóa hành vi (mục 10).

### 10. Chặn AI kê thuốc: cách chứng minh

Thêm test, không thêm code AI:

- `ai-output.schema.json` (đã giải `$ref`) không có khóa `don_thuoc`, `ke_don`, `thuoc` ở mọi cấp trừ `thuoc_dang_dung`/`co_thuoc_dang_dung` (thuốc **đang dùng** của bệnh nhân, khác hẳn).
- `clinicalOnlyResult` vẫn lọc `ke_don` (đã có test; giữ).
- `proposeClinicalChanges` và `applyClinicalChanges` không bao giờ tạo thay đổi có `scope === "prescription"` hay `field_path` bắt đầu `/don_thuoc`; chấp nhận một đề xuất AI không đổi `don_thuoc` và không đổi review của thuốc.
- `applyAiDraft` giữ nguyên `don_thuoc` của hồ sơ nền.
- `approveScopes`/`saveClinical` ghi `nguon: "nhap_tay"` cho mọi dòng thuốc; không có `nguon: "ai"` ở đường dẫn `/don_thuoc/`.

## Ngoài phạm vi

- Thói quen kê đơn (`luuThoiQuen` khi Lưu): lần này chỉ cập nhật cột; việc bật lại ghi thói quen để sau (Câu hỏi 6).
- Cảnh báo cứng thuốc trùng, tương tác, liều tối đa; đơn nhiều đợt, đơn thuốc BHYT/không BHYT, số thứ tự đơn, in tem.
- Quản lý thuốc hủy/thay thế (như `thay_the_order_id` của chỉ định), thuốc nội trú.
- Sửa kịch bản trang trình diễn ngoài việc giữ nó không có thuốc.

## Rủi ro

| Rủi ro | Cách giảm |
|---|---|
| Nâng `schema_version` sót chỗ (test, ví dụ `docs/task-2/examples/encounter.example.json`, fixture) làm hồ sơ cũ không đọc được | Task 2 làm migration trước, test hồ sơ 1.1.0 và 1.2.0 thật; cập nhật mọi fixture; `npm test` toàn bộ |
| Snapshot cũ trong `approval_versions` không có `don_thuoc` làm `scopeProjection` ném lỗi | Truy cập `?? DON_THUOC_TRONG` ở mọi nơi đọc snapshot; test hồ sơ cũ đã duyệt vẫn "đã duyệt đủ" |
| Đưa chẩn đoán và dị ứng vào phạm vi `prescription` làm sửa chẩn đoán kéo theo duyệt lại đơn | Chủ ý (an toàn); nêu ở Câu hỏi 2, đổi mặc định thì chỉ sửa `scopeProjection` |
| Thuốc trùng dị ứng vẫn duyệt và in được | Hiện chỉ cảnh báo đỏ trên dòng (như dev trước PR #7). Đề xuất để Câu hỏi 7; nếu chặn cứng cần lý do override |
| Hai bản in dùng chung một khối `BanIn`, đổi `loaiIn` rồi in trước khi React vẽ lại | `flushSync` như 6b06182; thử tay cả hai tờ ở bước trình duyệt |
| Số in của "Tổng SL" thay đổi nếu sửa `config/canh-bao.json` sau này | Chấp nhận (một nguồn sự thật); bản đã duyệt có snapshot |
| Mở lại thuốc ở Lệnh nhanh bị hiểu là AI kê | Nhãn nguồn `bs`/`xem` (không tím "AI"), thông báo nói rõ "từ mẫu bác sĩ chọn"; test không có `"ai"`; bỏ được bằng một cờ (Câu hỏi 3) |
| Nhiều agent cùng sửa `EformScreen.tsx` (664 dòng) | Task tuần tự, mỗi task commit ngay |

## Câu hỏi còn mở (kèm mặc định)

1. **Chưa quyết định có hay không kê đơn có chặn hoàn tất lượt khám không?** Mặc định: **không chặn**, chỉ nhắc nhẹ (giữ tương thích hồ sơ cũ và ca không cần thuốc). Chặn như Chỉ định thì sửa `requiredApprovalScopes` và `validateScope("initial_note")`.
2. **Chẩn đoán, dị ứng có nằm trong phạm vi duyệt đơn không?** Mặc định: **có** (mục 3). Nếu không, đơn chỉ còn `de_cap` và các dòng thuốc, và in đơn có thể in chẩn đoán chưa duyệt.
3. **Lệnh nhanh có thêm thuốc của mẫu vào đơn không?** Mặc định: **có**, dòng chưa duyệt, nguồn `bs`/`xem`. Thận trọng hơn: chỉ gợi ý, không tự thêm.
4. **Lời dặn, hẹn tái khám trên đơn in:** mặc định chỉ in khi phần Kết luận đã duyệt. Cách khác: luôn in (như `thanh`), hoặc không in.
5. **`chan_doan_ids` của dòng thuốc:** mặc định để trống lần này (đơn gắn chẩn đoán qua phạm vi duyệt). Gán từng thuốc cho từng chẩn đoán để sau.
6. **Ghi thói quen kê đơn khi Lưu (`luuThoiQuen`):** mặc định để sau; trang trình diễn vẫn dùng đơn đã kê giả.
7. **Chặn cứng thuốc trùng dị ứng khi duyệt:** mặc định chỉ cảnh báo trên giao diện.
