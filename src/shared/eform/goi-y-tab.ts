// Gợi ý chữ mờ trong ô chữ tự do, bấm Tab để nhận (giống gợi ý khi gõ của Copilot hay Claude).
// Không gọi LLM: câu lấy từ bộ gõ tắt của bác sĩ, các lần đã kê, phiếu mẫu theo bệnh và thư viện mẫu câu,
// xếp theo ngữ cảnh (lý do khám, chẩn đoán) rồi khớp tiền tố không dấu ngay trên trình duyệt.
import { foldKeepLength, normalizeVi } from "../normalize";
import type { Values } from "../types";
import type { GoTat } from "./go-tat";
import type { PhieuMau } from "./phieu-mau";
import type { DonDaKe } from "./thoi-quen";

/** Một nhóm bệnh trong thư viện câu: nhận ra khi mã ICD bắt đầu bằng một tiền tố, hoặc lý do khám, chẩn đoán có từ khóa */
export interface NhomThuVien {
  id: string;
  ten: string;
  /** Tiền tố mã ICD10: "H66" khớp H66.0, H66.1… */
  icd: string[];
  tu_khoa: string[];
  /** id ô trên eForm → câu */
  cau: Record<string, string[]>;
}

/** Thư viện câu (data/eform/thu-vien.json): câu chung cho mọi ca và câu theo nhóm bệnh */
export interface ThuVien {
  chung: Record<string, string[]>;
  nhom: NhomThuVien[];
}

export interface NguonCau {
  goTat: GoTat[];
  thoiQuen: DonDaKe[];
  phieuMau: PhieuMau[];
  thuVien: ThuVien;
}

/** Một câu trong kho gợi ý. `chac`: đủ chắc để gợi ý cả khi ô còn trống (không phải câu của bệnh khác) */
export interface CauGoiY {
  cau: string;
  chac: boolean;
}

export interface NguCanh {
  /** Lý do khám và mô tả chẩn đoán đang có trên phiếu */
  text: string;
  /** Mã ICD đang chọn */
  icd: string[];
}

/**
 * Điểm theo nguồn: câu của chính bác sĩ trước (gõ tắt, lời dặn đã kê cho đúng chẩn đoán), rồi phiếu mẫu đúng bệnh,
 * thư viện theo nhóm bệnh đúng, thư viện chung, cuối cùng là câu của bệnh khác (phiếu mẫu, nhóm thư viện,
 * lời dặn đã kê cho chẩn đoán khác)
 */
const DIEM = { goTat: 3, thoiQuen: 3, mauDungBenh: 2.5, nhomDungBenh: 2, thuVien: 1.5, benhKhac: 1 };
/** Câu gặp ở nhiều nguồn hay nhiều mẫu là câu quen, cộng thêm mỗi lần lặp */
const DIEM_LAP = 0.25;
/** Số ký tự tối thiểu (bỏ dấu cách) trước khi gợi ý tiếp câu đang gõ */
const TOI_THIEU = 2;

/** id ô trên bộ gõ tắt và phiếu mẫu (config/forms) → id ô trên eForm; ô không có ở đây trùng tên */
const O_SANG_EFORM: Record<string, string> = { ly_do_kham: "ly_do" };

/** Ô khám ghi theo từng bộ phận nên câu sau xuống dòng; ô khác nối bằng dấu cách */
export const O_XUONG_DONG = new Set(["kham_chuyen_khoa", "kham_khac"]);

const oEform = (o: string) => O_SANG_EFORM[o] ?? o;

function tachCau(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((cau) => cau.trim())
    .filter(Boolean);
}

/** Ngữ cảnh có nguyên cụm `ten` (so không dấu, trọn từ) */
function coCum(ngucanhChuan: string, ten: string): boolean {
  const chuan = normalizeVi(ten);
  return chuan.length >= 3 && ` ${ngucanhChuan} `.includes(` ${chuan} `);
}

function mauDungBenh(mau: PhieuMau, nguCanh: NguCanh, ngucanhChuan: string): boolean {
  if (mau.icd && nguCanh.icd.includes(mau.icd)) return true;
  return [mau.ten, ...mau.bi_danh].some((ten) => coCum(ngucanhChuan, ten));
}

/** Độ khớp của nhóm với phiếu: khớp mã ICD tính 10, mỗi tên hay từ khóa có trong lý do khám, chẩn đoán tính 1; 0 là không khớp */
function diemNhom(nhom: NhomThuVien, nguCanh: NguCanh, ngucanhChuan: string): number {
  const icd = nguCanh.icd.some((ma) => nhom.icd.some((tienTo) => ma.startsWith(tienTo))) ? 10 : 0;
  return icd + [nhom.ten, ...nhom.tu_khoa].filter((ten) => coCum(ngucanhChuan, ten)).length;
}

/** Nhóm khớp phiếu, nhóm khớp nhiều hơn đứng trước ("chảy mủ tai" đưa viêm tai giữa lên trên viêm tai ngoài) */
function nhomDungBenh(thuVien: ThuVien, nguCanh: NguCanh, ngucanhChuan: string): NhomThuVien[] {
  return thuVien.nhom
    .map((nhom) => ({ nhom, diem: diemNhom(nhom, nguCanh, ngucanhChuan) }))
    .filter((item) => item.diem > 0)
    .sort((a, b) => b.diem - a.diem)
    .map((item) => item.nhom);
}

/** Câu thư viện cho một ô, nhóm đúng bệnh trước câu chung; nút "Mở thư viện tham khảo" ở giao diện cũ dùng */
export function cauThuVien(id: string, thuVien: ThuVien, nguCanh: NguCanh): string[] {
  const ngucanhChuan = normalizeVi(nguCanh.text);
  const nhom = nhomDungBenh(thuVien, nguCanh, ngucanhChuan).flatMap((item) => item.cau[id] ?? []);
  return [...new Set([...nhom, ...(thuVien.chung[id] ?? [])])];
}

/**
 * Các câu có thể gợi ý cho một ô, đã xếp từ nên gợi ý nhất.
 * Bỏ câu còn chỗ trống [a|b] hay [số]: chỗ đó là kết quả khám, bác sĩ phải tự chọn, không để máy chọn hộ.
 * Câu chỉ gặp ở bệnh khác (phiếu mẫu, lời dặn đã kê cho chẩn đoán khác) không `chac`: ô trống không gợi ý câu đó,
 * để ca đau tai chưa có mã không hiện "Súc họng nước muối ấm."; bác sĩ gõ đầu câu thì vẫn gợi ý tiếp được.
 */
export function khoCau(id: string, nguon: NguonCau, nguCanh: NguCanh): CauGoiY[] {
  const diem = new Map<string, { cau: string; diem: number; lan: number; thuTu: number }>();
  const them = (cau: string, d: number) => {
    if (!cau || cau.includes("[")) return;
    const khoa = normalizeVi(cau);
    if (!khoa) return;
    const cu = diem.get(khoa);
    if (cu) {
      cu.lan += 1;
      if (d > cu.diem) Object.assign(cu, { cau, diem: d });
      return;
    }
    diem.set(khoa, { cau, diem: d, lan: 1, thuTu: diem.size });
  };

  for (const item of nguon.goTat) if (oEform(item.o) === id) them(item.noi_dung.trim(), DIEM.goTat);
  if (id === "loi_dan") {
    for (const don of nguon.thoiQuen) {
      const d = nguCanh.icd.includes(don.icd_chinh) ? DIEM.thoiQuen : DIEM.benhKhac;
      tachCau(don.loi_dan).forEach((cau) => them(cau, d));
    }
  }

  const ngucanhChuan = normalizeVi(nguCanh.text);
  for (const mau of nguon.phieuMau) {
    const d = mauDungBenh(mau, nguCanh, ngucanhChuan) ? DIEM.mauDungBenh : DIEM.benhKhac;
    const phieu = (mau.ketQua.draft.phieu_kham as Values | undefined) ?? {};
    for (const [o, value] of Object.entries(phieu)) {
      if (oEform(o) === id && typeof value === "string") tachCau(value).forEach((cau) => them(cau, d));
    }
    if (id === "kham_khac") tachCau(mau.khamKhac).forEach((cau) => them(cau, d));
  }

  const nhomDung = new Set(nhomDungBenh(nguon.thuVien, nguCanh, ngucanhChuan));
  for (const nhom of nhomDung) for (const cau of nhom.cau[id] ?? []) them(cau.trim(), DIEM.nhomDungBenh);
  for (const cau of nguon.thuVien.chung[id] ?? []) them(cau.trim(), DIEM.thuVien);
  for (const nhom of nguon.thuVien.nhom) {
    if (!nhomDung.has(nhom)) for (const cau of nhom.cau[id] ?? []) them(cau.trim(), DIEM.benhKhac);
  }

  // Câu ghi bên khác bên đang có trên phiếu (lý do khám "đau tai trái", câu "Tai phải: …") xếp như câu bệnh khác
  const benPhieu = benCua(ngucanhChuan);
  const diemCuoi = (item: { cau: string; diem: number }) =>
    benPhieu.size && lechBen(benCua(normalizeVi(item.cau)), benPhieu) ? Math.min(item.diem, DIEM.benhKhac) : item.diem;
  return [...diem.values()]
    .map((item) => ({ ...item, diem: diemCuoi(item) }))
    .sort((a, b) => b.diem + DIEM_LAP * (b.lan - 1) - (a.diem + DIEM_LAP * (a.lan - 1)) || a.thuTu - b.thuTu)
    .map((item) => ({ cau: item.cau, chac: item.diem > DIEM.benhKhac }));
}

/** Bên ghi trong chữ đã chuẩn hóa không dấu: phải, trái, hai bên */
function benCua(chuan: string): Set<string> {
  const ben = new Set<string>();
  const chu = ` ${chuan.replace(/[.,;/+%]/g, " ")} `;
  if (chu.includes(" phai ")) ben.add("phai");
  if (chu.includes(" trai ")) ben.add("trai");
  if (chu.includes(" hai ben ") || chu.includes(" 2 ben ")) ben.add("hai ben");
  return ben;
}

/** Câu ghi phải hoặc trái mà phiếu không có bên đó. Câu chỉ ghi "hai bên" (thường là câu khám bình thường) không tính lệch */
function lechBen(benCau: Set<string>, benPhieu: Set<string>): boolean {
  const ben = [...benCau].filter((item) => item !== "hai ben");
  return ben.length > 0 && !ben.some((item) => benPhieu.has(item));
}

/** Bộ phận ghi ở đầu dòng khám ("Tai phải: …" → "tai") */
function boPhan(dong: string): string | null {
  const muc = dong.trim().match(/^([^:\n]{1,20}):/)?.[1];
  return muc ? normalizeVi(muc).split(" ")[0] || null : null;
}

/** Ô khám đã có dòng cho bộ phận của câu này, ví dụ đã ghi "Tai phải: …" thì không gợi ý "Tai: bình thường" */
function daKhamBoPhan(value: string, cau: string): boolean {
  const bp = boPhan(cau);
  return bp !== null && value.split("\n").some((dong) => boPhan(dong) === bp);
}

/** Mã gõ tắt dùng được trong ô: mã của chính ô đó và từ ngắn (o = tu). Mã trùng thì dòng đầu thắng, như khi bung cả câu */
export function maGoTatCuaO(id: string, goTat: GoTat[]): Map<string, GoTat> {
  const theoMa = new Map<string, GoTat>();
  for (const item of goTat) {
    if ((item.o === "tu" || oEform(item.o) === id) && !theoMa.has(item.ma)) theoMa.set(item.ma, item);
  }
  return theoMa;
}

export interface GoiYTab {
  /** Thay đoạn từ vị trí này đến cuối ô bằng `chen` khi bác sĩ bấm Tab */
  tu: number;
  chen: string;
  /** Chữ mờ hiện sau con trỏ */
  hien: string;
}

const tuCua = (text: string) => normalizeVi(text).split(" ").filter((tu) => tu.length >= 2);

/** Câu đã có trong ô, hoặc gần trùng: từ 70% số từ của câu trở lên đã nằm trong ô (ví dụ cùng lời dặn, viết khác thứ tự) */
function daCo(value: string, cau: string): boolean {
  if (normalizeVi(value).includes(normalizeVi(cau))) return true;
  const trongO = new Set(tuCua(value));
  const tu = tuCua(cau);
  return tu.length >= 3 && tu.filter((item) => trongO.has(item)).length / tu.length >= 0.7;
}

/** `giuChuThuong`: vế sau dấu phẩy gõ chữ thường thì giữ chữ thường, đầu câu thì theo câu mẫu (viết hoa) */
function tiepCau(value: string, start: number, kho: CauGoiY[], giuChuThuong: boolean): GoiYTab | null {
  const doan = value.slice(start);
  if (doan.replace(/\s/g, "").length < TOI_THIEU) return null;
  const gap = foldKeepLength(doan);
  const cau = kho.find(({ cau }) => cau.length > doan.length && foldKeepLength(cau).startsWith(gap) && !daCo(value, cau))?.cau;
  if (!cau) return null;
  const chen = giuChuThuong && doan[0] !== doan[0].toUpperCase() ? cau[0].toLowerCase() + cau.slice(1) : cau;
  return { tu: start, chen, hien: chen.slice(doan.length) };
}

/**
 * Gợi ý cho ô đang có giá trị `value`, con trỏ ở cuối ô.
 * 1. Chữ cuối là mã gõ tắt: gợi ý bung mã.
 * 2. Ô trống hoặc vừa hết câu: gợi ý câu đủ chắc tiếp theo chưa có trong ô; ô khám bỏ câu của bộ phận đã có dòng.
 * 3. Đang gõ dở một câu (hoặc vế sau dấu phẩy): gợi ý câu bắt đầu như vậy, so khớp không dấu nên gõ "ong tai" vẫn ra "Ống tai".
 */
export function timGoiYTab(value: string, kho: CauGoiY[], maGoTat: Map<string, GoTat>, xuongDong: boolean): GoiYTab | null {
  const ma = value.match(/(?:^|[\s,;])(\S+)$/)?.[1];
  const goTat = ma ? maGoTat.get(ma) : undefined;
  if (ma && goTat) return { tu: value.length - ma.length, chen: goTat.noi_dung, hien: ` → ${goTat.noi_dung}` };

  // Đầu câu đang gõ: sau dấu kết câu hoặc xuống dòng cuối cùng, bỏ khoảng trắng
  const ketCau = Math.max(value.lastIndexOf("\n"), ...[".", "!", "?", ";"].map((dau) => value.lastIndexOf(dau)));
  let start = ketCau + 1;
  while (start < value.length && /\s/.test(value[start])) start++;

  if (start === value.length) {
    const cau = kho.find((item) => item.chac && !daCo(value, item.cau) && !(xuongDong && daKhamBoPhan(value, item.cau)))?.cau;
    if (!cau) return null;
    const noi = value.trim() === "" || /\s$/.test(value) ? "" : xuongDong ? "\n" : " ";
    const tu = value.trim() === "" ? 0 : value.length;
    return { tu, chen: noi + cau, hien: noi + cau };
  }

  const theoCau = tiepCau(value, start, kho, false);
  if (theoCau) return theoCau;
  const phay = value.lastIndexOf(",");
  if (phay < start) return null;
  let sauPhay = phay + 1;
  while (sauPhay < value.length && /\s/.test(value[sauPhay])) sauPhay++;
  return tiepCau(value, sauPhay, kho, true);
}

/** Giá trị ô sau khi nhận gợi ý */
export function nhanGoiY(value: string, goiY: GoiYTab): string {
  return value.slice(0, goiY.tu) + goiY.chen;
}
