# So sánh Zipformer và Rumble-2-Flash

> **Kết luận tạm.** Số liệu đo trên 11 ca giọng máy đọc (TTS) trên máy Windows ngày 2026-11-19, nhánh `thu-nghiem/stt-rumble-2-flash`. Giọng máy khác giọng bác sĩ thật, nên chưa đủ để chốt model. Mặc định của ứng dụng **không đổi**: vẫn là Zipformer.

Cách chạy và đọc các cột eval: [README.md](../README.md) mục "Đo nhận dạng giọng nói". Cấu hình chọn model: [STT.md](STT.md) mục "Chọn model nhận dạng cho eForm".

## Tóm tắt

- **Độ chính xác:** Zipformer tốt hơn rõ. WER sau sửa 6,7% so với 13,9% của Rumble. Mã dịch vụ và thuốc đúng 30/42 so với 11/42, liều đúng 20/24 so với 7/24.
- **Bịa chữ:** Rumble bịa chữ trên cả 5 đoạn không lời khi gọi thẳng model (ví dụ "Người", "Một"), còn Zipformer chỉ bịa "Ừ"/"À" ở 3/5 đoạn.
- **Tài nguyên:** Rumble chậm hơn và tốn RAM gấp khoảng 3 lần (xem bảng ở mục 1).
- **Lợi thế của Rumble:** có dấu câu, viết hoa, số đọc dạng chữ số ("38,5 độ"). Đây là điểm bác sĩ thấy ngay khi đọc chữ tạm, nhưng không bù được phần sai thuốc và sai từ.
- **Đề xuất:** giữ Zipformer làm mặc định. Chuyển sang Rumble chỉ khi đã lọc được đoạn không lời và có số liệu giọng thật (mục 5).

## 1. Số liệu trên giọng máy

| Chỉ số | Zipformer | Rumble-2-Flash |
|---|---|---|
| WER chữ thô | 17,4% | 21,4% |
| WER sau sửa | **6,7%** | **13,9%** |
| WER bỏ từ đệm (ừ/à/ờ/ừm/ơ) ở cả hai phía, thô / sau sửa | 16,9% / 6,1% | 21,2% / 13,6% |
| Mã dịch vụ và thuốc đúng, thô | 5/42 | 2/42 |
| Mã dịch vụ và thuốc đúng, sau sửa | **30/42** | **11/42** |
| Liều đúng, thô | 0/24 | 0/24 |
| Liều đúng, sau sửa | **20/24** | **7/24** |
| Sửa nhầm trên câu gốc | 0 từ | 0 từ |
| RTF trong eval (gồm chữ tạm) | **0,22** (117,9 s giải mã cho 545,7 s âm thanh) | **0,51** (277,3 s) |
| RTF một lần giải mã, 15 s đầu ca-01 | 0,015 (0,22 s) | 0,14 (2,1 s) |
| Thời gian nạp model (tiến trình mới) | 2,3 s | 1,9 s (spike: 1,7 s) |
| RAM (RSS) sau nạp | 215 MB | 745 MB |
| RAM (RSS) sau giải mã 15 s | **347 MB** | **1.158 MB** |
| Chu kỳ chữ tạm | 0,4 s | 2 s (bỏ qua khi phần câu đang nói dài hơn 10 s) |
| Đoạn tối đa một lần giải mã | không giới hạn | 18 s, quá thì chia đôi |

Ghi chú về RTF: con số trong eval đo cả chữ tạm, tức là model giải mã lại phần đang nói mỗi 0,4 s (Zipformer) hoặc mỗi 2 s (Rumble). Vì vậy RTF eval không so được với RTF một lần giải mã. Cột "một lần giải mã" đo riêng bằng một lần gọi `decode` trên 15 giây đầu ca-01, 4 luồng cho Rumble và 2 luồng cho Zipformer. Trên máy này, Rumble chậm hơn khoảng 10 lần khi giải mã một đoạn. Spike ghi RAM khoảng 1,5 GB sau nhiều lần giải mã liên tiếp.

### WER theo từng ca (sau sửa)

| Ca | Zipformer | Rumble-2-Flash |
|---|---|---|
| ca-01 | 4,2% | 11,1% |
| ca-02 | 5,6% | 11,2% |
| ca-03 | 6,9% | 16,0% |
| ca-04 | 8,0% | 17,9% |
| ca-05 | 4,4% | 10,1% |
| ca-06 | 9,3% | 14,3% |
| ca-07 | 4,4% | 10,9% |
| ca-08 | 10,3% | 13,3% |
| ca-09 | 6,5% | 15,5% |
| ca-10 | 7,0% | 21,0% |
| ca-11 | 6,6% | 12,2% |

Rumble thua Zipformer ở cả 11 ca.

### Không lời và đoạn ngắn

| Đầu vào | Zipformer | Rumble-2-Flash |
|---|---|---|
| `im-lang.wav` (5 s số 0), qua VAD | VAD 0 đoạn, 0 câu | VAD 0 đoạn, 0 câu |
| `tieng-on.wav` (thở và tiếng ù), qua VAD | 2 câu: "À." \| "À." | 2 câu: "Có." \| "Một." |
| Số 0 dài 1 s, không qua VAD | rỗng | "Người" |
| Nhiễu thở 0,3 s, không qua VAD | rỗng | "Một" |
| Nhiễu thở 1,5 s, không qua VAD | "Ừ" | "đó" |
| Tiếng ù 0,5 s, không qua VAD | "À" | "Đó" |
| Tiếng ù 1,5 s, không qua VAD | "À" | "Một" |

`im-lang.wav` chỉ kiểm VAD: VAD không đưa đoạn nào cho model, nên 0 câu là hiển nhiên và không nói được gì về model. Việc bịa chữ được đo bằng `tieng-on.wav` và phần "Gọi thẳng model".

## 2. Lỗi tiêu biểu (sau sửa)

Các lỗi dưới đây còn lại sau bước sửa chữ. Số ca lấy từ `eval-giong-noi --chi-tiet`.

### Rumble-2-Flash

1. **Ciprofloxacin thành Ofloxacin** (ca-11): sai nhóm thuốc, nguy hiểm nhất trong danh sách.
2. **Cefuroxim thành "C. Fuzo xin"** (ca-04): không sửa được, mã thuốc không khớp.
3. **Esomeprazol thành "Eso mới tựa dạo dồn"** (ca-10).
4. **Methylprednisolon thành "Prednisolon"** (ca-10): mất phần đầu tên thuốc.
5. **Ginkgo biloba thành "Gin Kobe lô tháng 3 năm 4000 mờ rê"** (ca-08): bịa thêm liều 4000.
6. **Amoxicillin thành "Amucicin"** (ca-01).
7. **Desloratadin thành "Đất Loratadin si do"** (ca-05).
8. **Số sai:** "sốt 39 độ" thành "suốt 30 9 độ" (ca-04). "sốt 37,8 độ" thành "30,78 độ" (ca-03).
9. **Từ viết tắt và thuật ngữ:** "viêm VA" thành "Viêm Vang" (ca-05); "u bã đậu" thành "Trần Đoan Đũa bã đậu sao thay phải" (ca-09); "viêm amidan" thành "viêm ảm mị đạn" (ca-04, trước sửa).
10. **Từ khám và chẩn đoán:** "Khám" thành "Khang"/"Kháng"; "Chẩn đoán" thành "Trần đoán" (lặp lại ở nhiều ca, bảng sửa chưa bắt được).

### Zipformer

1. **Penicillin thành "penline"** (ca-11): không được sửa.
2. **VA thành "ba"** (ca-05): "Chẩn đoán viêm ba".
3. **Desloratadin thành "De carlinxi"** (ca-05): mã thuốc không khớp.
4. **"type 2" thành "tai hai"** (ca-06): "đái tháo đường tai hai".
5. **Ginkgo biloba thành "Ginkgo biloba tháng 3 năm bốn không m"** (ca-08): liều bị mất.
6. **Mất từ "hạch"** (ca-04): "dưới hàm hai bên".
7. **"ngoáy tai" thành "tự tai"** (ca-07): câu dặn dò mất nghĩa.
8. **"u bã đậu" thành "gú đầu"** (ca-09): mất tên chẩn đoán.
9. **Liều thành chữ vô nghĩa:** "Augmentin 1 g" thành "Augmentin một dê uống 1 viên" (ca-02).
10. **Mất từ "đỏ, phải"** (ca-01): "màng nhĩ phải đỏ" thành "màng nhĩ phồng".

Điểm chung: Zipformer hay làm rơi từ (mất "hạch", "phải đỏ") và đọc sai từ viết tắt (VA, type 2). Rumble hay đọc sai tên thuốc và số, và thường đọc sai đúng nhóm thuốc (ciprofloxacin/ofloxacin).

## 3. Phương án

| Phương án | Ưu điểm | Nhược điểm | Khi nào nên chọn |
|---|---|---|---|
| **A. Giữ Zipformer** (mặc định, khuyến nghị hiện tại) | WER thấp hơn một nửa; nhanh hơn; RAM khoảng 350 MB; ít bịa chữ hơn | Chữ tạm và chữ chốt không dấu câu, phải viết hoa bằng quy tắc | Khi số liệu giọng thật vẫn cho thấy Zipformer tốt hơn |
| **B. Chuyển sang Rumble** | Dấu câu, viết hoa, số dạng chữ số tự nhiên | WER cao hơn gần gấp đôi; RAM khoảng 1,2 GB; giải mã chặn event loop lâu hơn; bịa chữ trên đoạn không lời | Chỉ khi đã có bộ lọc không lời trước khi giải mã và số liệu giọng thật vượt Zipformer |
| **C. Kết hợp** | Zipformer cho chữ tạm mượt, Rumble chỉ chạy trên câu chốt để thêm dấu câu | Cần nạp cả hai model (khoảng 1,6 GB RAM); mỗi câu chốt tốn thêm thời gian giải mã; Rumble vẫn sai thuốc nên không giảm lỗi thuốc; chưa được đo | Cần thử nghiệm riêng, chỉ khi người dùng thấy dấu câu quan trọng hơn độ chính xác |

Khuyến nghị: **phương án A**, và không đổi mặc định trong nhánh này. Chưa có lý do số liệu để chuyển sang B hay C.

## 4. Giới hạn của kết quả

- **Giọng máy:** 11 ca TTS đọc đều đều, không có tiếng ồn phòng khám, không có giọng vùng miền, không có ngắt quãng của người thật.
- **Mẫu nhỏ:** 42 mục mã và 24 mục liều. Một vài lỗi thay đổi kết quả một mục.
- **Bảng sửa chữ được chỉnh theo lỗi của Zipformer.** Một số lỗi Rumble được sửa nhờ tình cờ, một số lỗi Rumble không được sửa vì bảng chưa có mẫu đó. Lợi thế so sánh bị nghiêng về Zipformer.
- **Từ đệm:** các câu gốc có "Ừ", "À". Rumble hay bỏ các từ này, nên bị trừ điểm WER. Dòng "WER bỏ từ đệm" cho thấy phần chênh này nhưng không loại hết.
- **Dấu câu trong WER:** WER so cả dấu câu, nên lợi thế dấu câu của Rumble có thể được tính một phần.
- **RTF trong eval** gồm cả chữ tạm, xem ghi chú ở mục 1.
- **Hotword** của sherpa-onnx chỉ thử trên Zipformer; chưa thử cho Rumble.

## 5. Đo trên giọng thật (chưa làm)

Bước này cần người dùng ghi âm. Chưa có file nào trong `temp-1/giong-noi-that/`.

1. Ghi 5 đến 11 ca giả, mỗi ca là một câu đọc tự nhiên như bác sĩ nói với bệnh nhân. Không dùng tên, số CCCD hay hồ sơ thật.
2. Lưu vào `temp-1/giong-noi-that/` (thư mục này đã gitignore), định dạng WAV 16 kHz mono, tên `ca-XX.<nhãn>.wav`. Ví dụ: `ca-01.phong-on.wav`, `ca-02.quat-tran.wav`. `XX` là mã ca trong `data/cases/`, và nhãn mô tả điều kiện ghi âm.
3. Đọc `input_noi` của cùng mã ca trong `data/cases/ca-XX.json`; đó là câu đúng để so.
4. Chạy cho từng model:

```bash
npm run eval-giong-noi -- --model=zipformer --thu-muc=temp-1/giong-noi-that --nhan-lai
npm run eval-giong-noi -- --model=rumble --thu-muc=temp-1/giong-noi-that --nhan-lai
```

5. Thêm bảng kết quả vào mục này, ghi rõ ngày và điều kiện ghi âm.

Kết luận từ bước này vẫn là **tạm (provisional)**, vì giọng ghi âm vẫn là giọng giả trong phòng yên. Chỉ coi là kết luận khi có ghi âm trong điều kiện phòng khám thật.

## 6. Cách chạy lại

```bash
npm run tai-model-giong-noi                      # Zipformer, nếu chưa có
npm run tai-model-giong-noi -- --model=rumble    # Rumble-2-Flash, khoảng 655 MB
npm run eval-giong-noi -- --model=zipformer --nhan-lai --chi-tiet
npm run eval-giong-noi -- --model=rumble --nhan-lai --chi-tiet
```

Script spike `scripts/thu-rumble.ts` đã xóa trong nhánh này, vì bộ tải và bộ eval đã thay thế nó. Bản cũ còn trong lịch sử git.
