// Áp kết quả ô lệnh nhanh (mẫu + chi tiết + gõ tắt) vào phiếu, hoàn toàn trên máy, không gọi AI.
// Nguồn ô: chữ mẫu giữ nguyên là "cu", chỗ quy tắc vừa thay là "xem", câu gõ tắt là "bs" (xem nguon-mau.ts).
import { dienPhieu, type DongChiDinh, type DongThuoc, type KetQuaDien, type MucDaDien } from "./dien-phieu";
import { ketQuaGoTat } from "./go-tat";
import { O_XUONG_DONG } from "./goi-y-tab";
import { khoaDong } from "./goi-y";
import type { LenhDien } from "./lenh-nhanh";
import { datGoTat, ganNguonMau } from "./nguon-mau";
import { chuanHoaNguonThuoc } from "./don-thuoc";
import { icdTheoMau } from "./phieu-mau";
import type { EformData, Nguon, Truong } from "./types";

export interface ApLenh {
  /** Các ô vừa đổi, gộp thẳng vào phiếu */
  truong: Record<string, Truong>;
  /** Ô do mẫu điền (không tính ô gõ tắt): lúc lưu đổi nguồn thành "bs" */
  oTuMau: string[];
  /** Chỉ định của mẫu chưa có trong tab Chỉ định */
  chiDinhThem: DongChiDinh[];
  /** Thuốc của mẫu chưa có trong tab Đơn thuốc: chưa duyệt, nguồn "bs" hoặc "xem", không bao giờ "ai" */
  thuocThem: DongThuoc[];
  /** Các ô vừa điền (daDien), chỉ định và thuốc thêm. Không phải AI điền: màn hình không đếm daDien vào số đo AI */
  ketQua: KetQuaDien | null;
  thongBao: string;
}

const TRONG: Truong = { value: "", nguon: null };
const NHAN_KHAM_KHAC = "Khám các bộ phận khác";
/** Ô mã ICD10 (danh sách mã ngăn bằng dấu phẩy): không nối câu như ô chữ, nối bằng dấu cách sẽ thành một mã sai */
const O_MA_ICD = new Set(["icd_ban_dau", "icd_ra_vien", "icd_kem_theo"]);

export function apKetQuaLenh(kq: LenhDien, data: EformData, get: (id: string) => Truong, chiDinhHienTai: DongChiDinh[], thuocHienTai: DongThuoc[] = []): ApLenh {
  const mau = kq.mau;
  let truong: Record<string, Truong> = {};
  const nhan: Record<string, string> = {};
  let boQua = 0;
  let chiDinhThem: DongChiDinh[] = [];
  let thuocThem: DongThuoc[] = [];

  if (mau) {
    const ketQua = kq.ketQua ?? mau.ketQua;
    const dien = (draft: typeof ketQua.draft, matches: typeof ketQua.matches) =>
      dienPhieu(draft, matches, data, get, {
        chiOTrong: true,
        icd: icdTheoMau(mau, draft),
        oKhac: mau.oKhac,
        chepLichSu: true,
        clinicalOnly: true,
        kemThuoc: true,
      });
    const moi = dien(ketQua.draft, ketQua.matches);
    const goc = dien(mau.ketQua.draft, mau.ketQua.matches);
    truong = ganNguonMau(moi.truong, goc.truong);
    for (const muc of moi.daDien) nhan[muc.id] = muc.nhan;
    boQua = moi.boQua.length;

    const khamKhac = get("kham_khac");
    if (mau.khamKhac && !khamKhac.value.trim()) {
      Object.assign(truong, ganNguonMau({ kham_khac: { value: mau.khamKhac, nguon: "cu" } }, { kham_khac: { value: mau.khamKhac, nguon: "cu" } }));
      nhan.kham_khac = NHAN_KHAM_KHAC;
    } else if (mau.khamKhac && khamKhac.value !== mau.khamKhac) {
      boQua += 1;
    }

    // Review Focus 1: gọi lại cùng mẫu không thêm dòng trùng (theo mã, chưa có mã thì theo tên)
    const daCo = new Set(chiDinhHienTai.map(khoaDong));
    // Dòng do mẫu thêm không phải AI điền: bỏ cờ tu_ai để số đo lượt thử không tính là dòng AI
    chiDinhThem = moi.chiDinh.filter((row) => !daCo.has(khoaDong(row))).map((row) => ({ ...row, tu_ai: false }));
    // Thuốc của mẫu: cùng cách chống trùng; chuẩn hóa nguồn để không bao giờ là "ai"
    const daCoThuoc = new Set(thuocHienTai.map(khoaDong));
    thuocThem = chuanHoaNguonThuoc(moi.donThuoc.filter((row) => !daCoThuoc.has(khoaDong(row))));
  }
  const oTuMau = new Set(Object.keys(truong));
  if (mau) {
    // Ô chép từ lần khám trước (tiền sử, dị ứng) là dữ liệu cũ thật, giữ "cu" khi lưu: không tính là do mẫu điền
    const lichSu = dienPhieu({}, {}, data, get, { chepLichSu: true, clinicalOnly: true }).truong;
    for (const [id, t] of Object.entries(lichSu)) if (truong[id]?.value === t.value) oTuMau.delete(id);
  }

  // Gõ tắt: câu của chính bác sĩ, đặt sau mẫu nên thay chữ mẫu ở cùng ô
  const { cacO, daDung } = kq.goTat;
  const theoGoTat = dienPhieu(ketQuaGoTat(cacO).draft, {}, data, () => TRONG, { clinicalOnly: true });
  const cauGoTat: Record<string, string> = Object.fromEntries(Object.entries(theoGoTat.truong).map(([id, t]) => [id, t.value]));
  for (const muc of theoGoTat.daDien) nhan[muc.id] ??= muc.nhan;
  if (cacO.kham_khac) {
    cauGoTat.kham_khac = cacO.kham_khac;
    nhan.kham_khac ??= NHAN_KHAM_KHAC;
  }
  for (const [id, cau] of Object.entries(cauGoTat)) {
    const hienTai = truong[id] ?? get(id);
    let sau: Truong;
    if (O_MA_ICD.has(id)) {
      // Mã ICD: trùng thì thôi; bác sĩ đã nhập hay đã sửa mã khác thì giữ, báo bỏ qua; còn lại thay bằng mã của gõ tắt
      if (hienTai.value === cau) continue;
      if (hienTai.value.trim() && (hienTai.nguon === "bs" || hienTai.nguon === "sua")) {
        boQua += 1;
        continue;
      }
      sau = { value: cau, nguon: "bs" };
    } else {
      sau = datGoTat(hienTai, cau, O_XUONG_DONG.has(id));
      // Ô đã có nguyên câu: không đổi gì, không đếm
      if (sau === hienTai) continue;
    }
    truong[id] = sau;
    oTuMau.delete(id);
  }

  const daDien: MucDaDien[] = Object.entries(truong).map(([id, t]) => ({ id, nhan: nhan[id] ?? id, nguon: t.nguon as Nguon }));
  const n = daDien.length;
  const vang = daDien.filter((muc) => muc.nguon === "xem").length + [...chiDinhThem, ...thuocThem].filter((row) => row.nguon === "xem").length;

  let thongBao: string;
  if (mau) {
    thongBao = `Đã điền ${n} ô từ mẫu "${mau.ten}".`;
    if (vang > 0) thongBao += ` Còn ${vang} chỗ vàng cần xem.`;
    if (chiDinhThem.length > 0) thongBao += ` Thêm ${chiDinhThem.length} chỉ định.`;
    if (thuocThem.length > 0) thongBao += ` Đã thêm ${thuocThem.length} thuốc từ mẫu vào Đơn thuốc, chưa duyệt.`;
    if (boQua > 0) thongBao += ` Bỏ qua ${boQua} ô đã có chữ.`;
    if (daDung.length > 0) thongBao += ` Gõ tắt: ${daDung.join(", ")}.`;
  } else {
    thongBao = `Đã điền gõ tắt ${daDung.join(", ")}: ${n} ô.`;
    if (boQua > 0) thongBao += ` Bỏ qua ${boQua} ô đã có chữ.`;
  }

  return {
    truong,
    oTuMau: [...oTuMau],
    chiDinhThem,
    thuocThem,
    ketQua: { truong, daDien, boQua: [], chiDinh: chiDinhThem, donThuoc: thuocThem },
    thongBao,
  };
}
