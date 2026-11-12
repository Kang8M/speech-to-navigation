// Đổi lỗi của nhà cung cấp LLM (thường là chuỗi JSON tiếng Anh) thành câu tiếng Việt cho bác sĩ đọc.

const LOAI_LOI: { mau: RegExp; thongBao: string }[] = [
  {
    mau: /\b503\b|UNAVAILABLE|overloaded|high demand/i,
    thongBao: "AI đang quá tải, bấm Điền lại sau vài giây.",
  },
  {
    mau: /\b429\b|RESOURCE_EXHAUSTED|quota|rate limit/i,
    thongBao: "Đã hết lượt gọi AI trong lúc này, chờ khoảng 1 phút rồi bấm Điền lại.",
  },
  {
    mau: /fetch failed|ECONN|ENOTFOUND|ETIMEDOUT|timeout|network/i,
    thongBao: "Không kết nối được tới AI, kiểm tra mạng rồi bấm Điền lại.",
  },
];

/** Câu luôn kết thúc bằng dấu chấm, vì có chỗ nối thêm câu sau */
export function thongBaoLoiAi(chiTiet: string): string {
  return (
    LOAI_LOI.find(({ mau }) => mau.test(chiTiet))?.thongBao ??
    "AI không điền được nháp, bấm Điền lại. Vẫn lỗi thì báo người điều phối."
  );
}
