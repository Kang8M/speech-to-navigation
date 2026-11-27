import { demChoTrong } from "./mau-cau";
import type { Truong } from "./types";

/** Ô do mẫu điền: khác chữ gốc của mẫu (quy tắc vừa thay) hoặc còn chỗ [..] thì "xem", còn lại "cu" */
export function ganNguonMau(moi: Record<string, Truong>, goc: Record<string, Truong>): Record<string, Truong> {
  const kq: Record<string, Truong> = {};
  for (const [k, t] of Object.entries(moi)) {
    const doi = t.value !== goc[k]?.value || demChoTrong(t.value) > 0;
    kq[k] = { ...t, nguon: doi ? "xem" : "cu" };
  }
  return kq;
}

/** Ô trống → {cau,"bs"}; nguồn bs/sua → nối (xuongDong ? "\n" : " "); còn lại → thay bằng {cau,"bs"}; ô đã chứa nguyên câu → trả hienTai */
export function datGoTat(hienTai: Truong, cau: string, xuongDong: boolean): Truong {
  if (!hienTai.value.trim()) return { value: cau, nguon: "bs" };
  if (hienTai.value.includes(cau)) return hienTai;
  if (hienTai.nguon === "bs" || hienTai.nguon === "sua") {
    return { value: hienTai.value + (xuongDong ? "\n" : " ") + cau, nguon: "bs" };
  }
  return { value: cau, nguon: "bs" };
}

/** Ô thuộc oTuMau có nguồn "cu"|"xem" → "bs"; không ô nào đổi thì trả đúng object fields cũ */
export function doiNguonKhiLuu(fields: Record<string, Truong>, oTuMau: ReadonlySet<string>): Record<string, Truong> {
  let kq: Record<string, Truong> | null = null;
  for (const k of oTuMau) {
    const t = fields[k];
    if (t && (t.nguon === "cu" || t.nguon === "xem")) {
      kq ??= { ...fields };
      kq[k] = { ...t, nguon: "bs" };
    }
  }
  return kq ?? fields;
}
