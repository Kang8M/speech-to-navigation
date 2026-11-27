// Bộ gõ tắt riêng của từng bác sĩ (như macro UniKey): gõ "tbt mv ldmh" thì mỗi mã bung đúng câu của bác sĩ vào đúng ô.
// Không gọi LLM. Dữ liệu: data/go-tat/<tài khoản>.json (không đưa lên git), chưa có thì dùng bộ giả data/eform/go-tat-mau.json.
import type { PipelineResult } from "../api";
import type { Draft, Values } from "../types";

/** Ô nhận câu gõ tắt. "kham_khac" là ô Khám các bộ phận khác (eForm có, schema LLM không có); "tu" là từ ngắn bung tại chỗ */
export const O_GO_TAT = [
  "ly_do_kham",
  "benh_su",
  "kham_toan_than",
  "kham_chuyen_khoa",
  "kham_khac",
  "chan_doan_chinh",
  "huong_dieu_tri",
  "loi_dan",
  "tu",
] as const;

export type OGoTat = (typeof O_GO_TAT)[number];
export type OPhieu = Exclude<OGoTat, "tu">;

export interface GoTat {
  /** Mã gõ tắt, phân biệt hoa thường như UniKey */
  ma: string;
  o: OGoTat;
  noi_dung: string;
}

export interface KetQuaGoTat {
  /** Câu đã bung theo từng ô */
  cacO: Partial<Record<OPhieu, string>>;
  /** Các mã đã dùng, theo thứ tự gõ */
  daDung: string[];
  /** Phần còn lại sau khi bỏ mã bung vào ô (từ ngắn đã bung tại chỗ), để gọi mẫu hoặc AI như trước */
  conLai: string;
}

/** Ô khám viết theo từng bộ phận ("Tai: …", "Mũi: …") nên xuống dòng; ô khác nối bằng dấu cách */
const XUONG_DONG = new Set<OPhieu>(["kham_chuyen_khoa", "kham_khac"]);

export function tachGoTat(text: string, bo: GoTat[]): KetQuaGoTat {
  const theoMa = new Map(bo.map((item) => [item.ma, item]));
  const cacO: Partial<Record<OPhieu, string>> = {};
  const daDung: string[] = [];
  // Tách thành từ và dấu ngăn cách xen kẽ: ["tbt", " ", "mv", ", ", …]
  const manh = text.split(/([\s,;]+)/);
  for (let i = 0; i < manh.length; i += 2) {
    const item = theoMa.get(manh[i].replace(/\.$/, ""));
    if (!item) continue;
    daDung.push(item.ma);
    if (item.o === "tu") {
      manh[i] = item.noi_dung + (manh[i].endsWith(".") ? "." : "");
      continue;
    }
    const cu = cacO[item.o];
    // Nối cùng dòng mà câu trước chưa có dấu kết câu (macro hay bỏ dấu chấm cuối) thì thêm dấu chấm cho khỏi dính câu
    const noi = XUONG_DONG.has(item.o) ? "\n" : /[.!?]$/.test(cu ?? "") ? " " : ". ";
    cacO[item.o] = cu ? `${cu}${noi}${item.noi_dung}` : item.noi_dung;
    manh[i] = "";
  }
  const conLai = daDung.length === 0
    ? text
    : manh
        .join("")
        .replace(/\s*[,;](?:\s*[,;])+\s*/g, ", ")
        .replace(/^[\s,;.]+|[\s,;]+$/g, "")
        .replace(/\s{2,}/g, " ");
  return { cacO, daDung, conLai };
}

/** Câu gõ tắt thay câu ở cùng ô trong kết quả mẫu hay AI (bác sĩ đã chọn đích danh). Ô Khám các bộ phận khác không thuộc draft, màn hình tự đặt */
export function chenGoTat(draft: Draft, cacO: Partial<Record<OPhieu, string>>): Draft {
  const vaoDraft = { ...cacO };
  delete vaoDraft.kham_khac;
  return { ...draft, phieu_kham: { ...((draft.phieu_kham as Values | undefined) ?? {}), ...vaoDraft } };
}

/** Chỉ có gõ tắt, không còn chữ nào khác: kết quả dựng tại chỗ, không gọi AI */
export function ketQuaGoTat(cacO: Partial<Record<OPhieu, string>>): PipelineResult {
  return { draft: chenGoTat({ chi_dinh: [], ke_don: [] }, cacO), matches: {}, provider: "go-tat", duration_ms: 0 };
}
