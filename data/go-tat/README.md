# Bộ gõ tắt riêng của bác sĩ

Mỗi tài khoản một file `<tài khoản>.json` (ví dụ `user_bs01.json`, tài khoản lấy từ `?bs=` trên URL hoặc `dang_nhap` trong `data/eform/ca-gia.json`). Thư mục này **không đưa lên git**, trừ file README này, vì có thể chứa câu chữ thật của bác sĩ. Tài khoản chưa có file thì trang dùng bộ giả `data/eform/go-tat-mau.json`.

Định dạng giống `data/eform/go-tat-mau.json`:

```json
[
  { "ma": "tbth", "o": "kham_chuyen_khoa", "noi_dung": "Tai: ống tai 2 bên khô sạch, ..." },
  { "ma": "kco", "o": "tu", "noi_dung": "không có" }
]
```

- `ma`: mã gõ tắt, phân biệt hoa thường, không có dấu cách. Mã trùng thì chỉ dòng đầu được dùng.
- `o`: ô nhận câu, một trong `ly_do_kham`, `benh_su`, `kham_toan_than`, `kham_chuyen_khoa`, `kham_khac` (Khám các bộ phận khác), `chan_doan_chinh`, `huong_dieu_tri`, `loi_dan`, hoặc `tu` (từ ngắn, bung ngay tại chỗ trong câu, ví dụ `k` → `không`). Dòng có ô khác (ví dụ cách thức mổ) bị bỏ qua.
- `noi_dung`: câu bung ra, giữ nguyên cách viết của bác sĩ.

Chấm điểm: `npm run eval-go-tat -- --tai-khoan=<tài khoản>` đọc thêm `<tài khoản>.ca.json` (cùng định dạng `data/eform/go-tat-ca.json`).
