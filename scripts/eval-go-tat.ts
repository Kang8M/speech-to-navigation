// Đo AI có viết đúng câu quen của bác sĩ không: bác sĩ nói tự do, AI có ra nguyên văn câu trong bộ gõ tắt của bác sĩ đó.
// Mỗi ca chạy 2 lần: không có câu quen trong prompt (như trước) và có câu quen, để thấy câu quen giúp được bao nhiêu.
//   npm run eval-go-tat -- --provider=gemini                bộ giả data/eform/go-tat-mau.json + ca data/eform/go-tat-ca.json
//   npm run eval-go-tat -- --provider=gemini --tai-khoan=X  bộ riêng data/go-tat/X.json + ca data/go-tat/X.ca.json (không lên git)
// Gọi LLM thật thì tốn lượt (2 lượt mỗi ca). Ở mock, bộ tách quy tắc không dùng câu quen nên hai cột như nhau.
import fs from "node:fs";
import path from "node:path";
import { runPipeline } from "@/server/ai/pipeline";
import { loadCases, loadCatalogs, loadForms, loadRules, loadVietTat } from "@/server/du-lieu/config";
import { docBoGoTat } from "@/server/du-lieu/go-tat";
import type { GoTat } from "@/shared/eform/go-tat";
import type { Values } from "@/shared/types";

interface CaGoTat {
  id: string;
  noi: string;
  /** Theo từng trường: các mã có câu phải xuất hiện nguyên văn */
  mong_doi: Record<string, string[]>;
}

/** Gemini miễn phí: 15 lượt mỗi phút */
const CHO_GIUA_LUOT_MS: Record<string, number> = { gemini: 4500 };

/** So không phân biệt hoa thường, gộp khoảng trắng, bỏ dấu chấm/phẩy cuối câu quen (nối câu hay mất dấu này) */
const chuan = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();
const chuanCau = (text: string) => chuan(text).replace(/[.,;]+$/, "");

interface Diem {
  dung: number;
  thieu: number;
  /** Câu quen có trong kết quả mà bác sĩ không nói tới ý đó */
  thua: number;
}

function cham(ca: CaGoTat, phieu: Values, bo: GoTat[], diem: Diem, chiTiet: string[]) {
  for (const truong of new Set([...Object.keys(ca.mong_doi), ...bo.map((item) => item.o)])) {
    const ra = chuan(String(phieu[truong] ?? ""));
    const can = new Set(ca.mong_doi[truong] ?? []);
    for (const item of bo.filter((item) => item.o === truong)) {
      const co = ra.includes(chuanCau(item.noi_dung));
      if (can.has(item.ma) && co) diem.dung++;
      else if (can.has(item.ma)) {
        diem.thieu++;
        chiTiet.push(`${ca.id} ${truong}: thiếu "${item.ma}"`);
      } else if (co) {
        diem.thua++;
        chiTiet.push(`${ca.id} ${truong}: thừa "${item.ma}"`);
      }
    }
  }
}

const phanTram = (d: Diem) => (d.dung + d.thieu === 0 ? "-" : `${((d.dung / (d.dung + d.thieu)) * 100).toFixed(1)}%`);

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Không có .env.local thì dùng mock
  }
  const args = process.argv.slice(2);
  const provider = args.find((a) => a.startsWith("--provider="))?.split("=")[1] || process.env.LLM_PROVIDER?.trim() || "mock";
  const taiKhoan = args.find((a) => a.startsWith("--tai-khoan="))?.split("=")[1];
  const [fileBo, fileCa] = taiKhoan
    ? [path.join("data", "go-tat", `${taiKhoan}.json`), path.join("data", "go-tat", `${taiKhoan}.ca.json`)]
    : [path.join("data", "eform", "go-tat-mau.json"), path.join("data", "eform", "go-tat-ca.json")];
  const bo = docBoGoTat(fileBo);
  const cacCa = JSON.parse(fs.readFileSync(fileCa, "utf8")) as CaGoTat[];
  const context = { forms: loadForms(), catalogs: loadCatalogs(), vietTat: loadVietTat(), rules: loadRules(), cases: loadCases() };
  const cho = CHO_GIUA_LUOT_MS[provider] ?? 0;

  console.log(`Chế độ: ${provider} · bộ ${taiKhoan ? `riêng của ${taiKhoan}` : "giả"} (${bo.length} mã) · ${cacCa.length} ca x 2 lần`);
  const ketQua = { khong: { dung: 0, thieu: 0, thua: 0 }, co: { dung: 0, thieu: 0, thua: 0 } };
  const chiTiet = { khong: [] as string[], co: [] as string[] };
  const loi: string[] = [];
  let luot = 0;
  for (const ca of cacCa) {
    for (const kieu of ["khong", "co"] as const) {
      if (luot++ > 0 && cho) await new Promise((r) => setTimeout(r, cho));
      try {
        const chay = () => runPipeline(ca.noi, context, { provider, cauQuen: kieu === "co" ? bo : undefined });
        // Quá tải (503) thì chờ rồi thử lại một lần, cho khỏi mất ca
        const result = await chay().catch(async (error) => {
          if (!/\b503\b|UNAVAILABLE/.test(String(error))) throw error;
          await new Promise((r) => setTimeout(r, 10_000));
          return chay();
        });
        cham(ca, (result.draft.phieu_kham ?? {}) as Values, bo, ketQua[kieu], chiTiet[kieu]);
      } catch (error) {
        loi.push(`${ca.id} (${kieu === "co" ? "có" : "không có"} câu quen): ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  console.log("\n                       Đúng  Thiếu  Thừa  Nguyên văn");
  for (const [kieu, nhan] of [["khong", "Không có câu quen"], ["co", "Có câu quen"]] as const) {
    const d = ketQua[kieu];
    console.log(`${nhan.padEnd(22)}${String(d.dung).padStart(5)}${String(d.thieu).padStart(7)}${String(d.thua).padStart(6)}  ${phanTram(d).padStart(10)}`);
  }
  console.log("\nNguyên văn = câu quen ra đúng nguyên văn / số câu quen mong đợi. Thừa = câu quen của ý bác sĩ không nói (phải bằng 0).");
  if (chiTiet.co.length > 0) {
    console.log("\nChi tiết (có câu quen):");
    chiTiet.co.forEach((dong) => console.log(`- ${dong}`));
  }
  if (loi.length > 0) {
    console.log(`\nCó ${loi.length} lượt lỗi:`);
    loi.forEach((dong) => console.log(`- ${dong}`));
    process.exitCode = 1;
  }
}

main();
