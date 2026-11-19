// Đo nhận dạng giọng nói (Zipformer hoặc Rumble-2-Flash) trên các file âm thanh trong data/giong-noi/.
//   npm run eval-giong-noi [-- --model=zipformer|rumble] [--thu-muc=<đường dẫn>] [--chi-tiet] [--nhan-lai]
// Mỗi file <id ca>[.<nhãn>].wav (16 kHz, mono) được so với câu input_noi của ca đó trong data/cases/,
// hoặc với file .txt cùng tên nếu có. Âm thanh đi qua đúng luồng của ứng dụng (phiên VAD, gửi từng mẩu 0,4 giây).
// Cờ:
// - --model: chọn model (mặc định theo biến ASR_MODEL, không có thì zipformer). Chữ thô lưu <tên>.tho.json (zipformer)
//   hoặc <tên>.tho.rumble.json (rumble). Giá trị lạ thì thoát với lỗi.
// - --thu-muc: thư mục chứa .wav, tính từ thư mục chạy lệnh (mặc định data/giong-noi).
// - --chi-tiet: in từng câu. --nhan-lai: bỏ chữ thô đã lưu, nhận dạng lại (cần để đo RTF).
// In ba nhóm số cho chữ thô của model và chữ sau khi sửa (src/shared/giong-noi/sua-chu.ts):
// - WER: tỉ lệ lỗi từ, so cả dấu, đã đổi số thành chữ ở cả hai phía.
// - Mục danh mục: chạy bộ tách quy tắc trên câu gốc và trên chữ nhận dạng, đếm mã dịch vụ, mã thuốc giữ được.
// - Số liệu thuốc: số dòng thuốc có liều, số lần/ngày, số ngày trùng với khi tách câu gốc.
// Thêm cột RTF (giây giải mã / giây âm thanh) và số giây giải mã, chỉ đo khi thật sự nhận dạng;
// chữ lấy từ bộ lưu thì in "–". Một dòng "Sửa nhầm": chạy bộ sửa trên chính câu gốc, đếm số từ bị đổi sai (nên bằng 0).
// File im-lang.wav (5 giây im lặng) cùng im-lang.txt rỗng được script tự sinh nếu thiếu; file này không tính WER,
// chỉ in số câu chốt (kỳ vọng 0, tức model không bịa câu khi không có lời).
import fs from "node:fs";
import path from "node:path";
import { readWave } from "sherpa-onnx-node";
import { ketThucPhien, guiAmThanh, taoPhien } from "@/server/ai/asr";
import { getAsrModel } from "@/server/ai/bo-nhan-dang";
import { runPipeline } from "@/server/ai/pipeline";
import { loadCases, loadCatalogs, loadForms, loadRules, loadSuaChu, loadVietTat } from "@/server/du-lieu/config";
import { ASR_SAMPLE_RATE } from "@/shared/api";
import { soThanhChu } from "@/shared/giong-noi/so";
import { suaChu } from "@/shared/giong-noi/sua-chu";
import type { Values } from "@/shared/types";

const MODEL_HOP_LE = ["zipformer", "rumble"];

function docCo(ten: string): string | undefined {
  const co = process.argv.find((a) => a.startsWith(`--${ten}=`));
  return co?.slice(ten.length + 3);
}

/** Đặt ASR_MODEL từ --model trước khi tạo phiên đầu tiên; giá trị lạ thì thoát */
function chonModel(): string {
  const co = docCo("model");
  if (co !== undefined) {
    if (!MODEL_HOP_LE.includes(co)) {
      console.error(`Model "${co}" không hợp lệ. Chỉ nhận: ${MODEL_HOP_LE.join(", ")}.`);
      process.exit(1);
    }
    process.env.ASR_MODEL = co;
  }
  return getAsrModel();
}

const THU_MUC = path.resolve(process.cwd(), docCo("thu-muc") ?? path.join("data", "giong-noi"));
const MAU = 0.4 * ASR_SAMPLE_RATE;

/** Chữ thường, bỏ dấu câu, số thành chữ; giữ dấu thanh vì sai dấu là sai từ */
function tachTu(text: string): string[] {
  return soThanhChu(text.normalize("NFC").toLocaleLowerCase("vi"))
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Khoảng cách chỉnh sửa giữa hai dãy từ */
function khoangCach(a: string[], b: string[]): number {
  let truoc = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const hien = [i];
    for (let j = 1; j <= b.length; j++) {
      hien[j] = Math.min(truoc[j] + 1, hien[j - 1] + 1, truoc[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    truoc = hien;
  }
  return truoc[b.length];
}

/** Sinh im-lang.wav (5 giây số 0, 16 kHz, mono, PCM 16-bit) và im-lang.txt rỗng nếu chưa có */
function taoFileImLang(): void {
  const wav = path.join(THU_MUC, "im-lang.wav");
  const txt = path.join(THU_MUC, "im-lang.txt");
  if (!fs.existsSync(THU_MUC)) return;
  if (!fs.existsSync(wav)) {
    const n = 5 * ASR_SAMPLE_RATE;
    const buf = Buffer.alloc(44 + n * 2);
    buf.write("RIFF", 0);
    buf.writeUInt32LE(36 + n * 2, 4);
    buf.write("WAVEfmt ", 8);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(ASR_SAMPLE_RATE, 24);
    buf.writeUInt32LE(ASR_SAMPLE_RATE * 2, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write("data", 36);
    buf.writeUInt32LE(n * 2, 40);
    fs.writeFileSync(wav, buf);
  }
  if (!fs.existsSync(txt)) fs.writeFileSync(txt, "");
}

interface KetQuaNhanDang {
  cau: string[];
  /** Giây giải mã; null khi lấy từ bộ lưu */
  giay: number | null;
  /** Giây âm thanh */
  amThanh: number;
}

/**
 * Chữ thô được lưu cạnh file âm thanh (<tên>.tho.json, hoặc <tên>.tho.rumble.json) để chỉnh bảng sửa chữ rồi chạy lại cho nhanh.
 * Đổi file .wav thì tự nhận dạng lại; đổi cấu hình model hay VAD thì thêm --nhan-lai.
 */
function nhanDangCoLuu(file: string, nhanLai: boolean, model: string): KetQuaNhanDang {
  const luu = file.replace(/\.wav$/, model === "rumble" ? ".tho.rumble.json" : ".tho.json");
  const mtime = fs.statSync(file).mtimeMs;
  if (!nhanLai && fs.existsSync(luu)) {
    const cu = JSON.parse(fs.readFileSync(luu, "utf8")) as { mtime: number; cau: string[] };
    if (cu.mtime === mtime) return { cau: cu.cau, giay: null, amThanh: readWave(file).samples.length / ASR_SAMPLE_RATE };
  }
  const kq = nhanDang(file);
  fs.writeFileSync(luu, JSON.stringify({ mtime, cau: kq.cau }, null, 1));
  return kq;
}

function nhanDang(file: string): KetQuaNhanDang {
  const wave = readWave(file);
  if (wave.sampleRate !== ASR_SAMPLE_RATE) throw new Error(`${path.basename(file)}: cần ${ASR_SAMPLE_RATE} Hz, file là ${wave.sampleRate} Hz`);
  const bat = performance.now();
  const id = taoPhien();
  const cau: string[] = [];
  for (let i = 0; i < wave.samples.length; i += MAU) {
    cau.push(...(guiAmThanh(id, wave.samples.subarray(i, i + MAU))?.chot ?? []));
  }
  cau.push(...(ketThucPhien(id)?.chot ?? []));
  return { cau, giay: (performance.now() - bat) / 1000, amThanh: wave.samples.length / ASR_SAMPLE_RATE };
}

const ma = (rows: Values[], key: string) => rows.map((row) => String(row[key] ?? "")).filter(Boolean);
const lieu = (row: Values) => [row.lieu_moi_lan, row.so_lan_ngay, row.so_ngay].map((v) => String(v ?? "")).join("|");

interface Diem {
  loi: number;
  tu: number;
  maGiu: number;
  maTong: number;
  lieuGiu: number;
  lieuTong: number;
}

const DIEM_RONG = (): Diem => ({ loi: 0, tu: 0, maGiu: 0, maTong: 0, lieuGiu: 0, lieuTong: 0 });

async function main() {
  const model = chonModel();
  taoFileImLang();
  console.log(`Model: ${model} | thư mục: ${THU_MUC}`);
  const files = fs.existsSync(THU_MUC) ? fs.readdirSync(THU_MUC).filter((f) => f.endsWith(".wav")).sort() : [];
  if (files.length === 0) {
    console.error(`Chưa có file .wav trong ${THU_MUC}. Chạy npm run tao-am-thanh-mau hoặc tự ghi âm, xem data/giong-noi/README.md.`);
    process.exit(1);
  }
  const cases = loadCases();
  const ctx = { forms: loadForms(), catalogs: loadCatalogs(), vietTat: loadVietTat(), rules: loadRules(), cases };
  const bang = loadSuaChu();
  const chiTiet = process.argv.includes("--chi-tiet");
  const nhanLai = process.argv.includes("--nhan-lai");

  const tong = { tho: DIEM_RONG(), sua: DIEM_RONG() };
  const dong: string[] = [];
  const imLang: string[] = [];
  let suaNham = 0;
  let giayGiaiMa = 0;
  let giayAmDo = 0;
  let giayAmTong = 0;

  for (const file of files) {
    const ten = file.replace(/\.wav$/, "");
    const txt = path.join(THU_MUC, `${ten}.txt`);
    const ca = cases.find((item) => ten === item.id || ten.startsWith(`${item.id}.`) || ten.startsWith(`${item.id}-`));
    const goc = fs.existsSync(txt) ? fs.readFileSync(txt, "utf8") : ca?.input_noi;
    // Tham chiếu rỗng chỉ hợp lệ với file im lặng; nếu không thì coi như thiếu
    if (goc === undefined || (goc.trim() === "" && ten !== "im-lang")) {
      console.warn(`Bỏ qua ${file}: không tìm thấy ca hay file .txt cùng tên.`);
      continue;
    }

    const { cau, giay, amThanh } = nhanDangCoLuu(path.join(THU_MUC, file), nhanLai, model);
    giayAmTong += amThanh;
    if (giay !== null) {
      giayGiaiMa += giay;
      giayAmDo += amThanh;
    }
    const rtf = giay === null ? "–" : (giay / amThanh).toFixed(2);
    const thoiGian = giay === null ? "–" : giay.toFixed(1);

    if (goc.trim() === "") {
      // File im lặng: không có từ gốc nên không tính WER, chỉ đếm câu model bịa ra
      imLang.push(
        `${ten.padEnd(22)}${String(cau.length).padStart(3)} câu chốt (kỳ vọng 0)   RTF ${rtf.padStart(5)}  ${thoiGian.padStart(6)} s${cau.length ? `   → ${cau.join(" | ")}` : ""}`,
      );
      if (chiTiet) console.log(`\n── ${ten}\nCÂU CHỐT (${cau.length}): ${cau.join(" | ")}`);
      continue;
    }

    const ban = { tho: cau.join(" "), sua: cau.map((c) => suaChu(c, bang)).join(" ") };
    const tuGoc = tachTu(goc);
    const gocSua = goc.split(/(?<=[.?!])\s+/).map((c) => suaChu(c, bang)).join(" ");
    const nham = khoangCach(tuGoc, tachTu(gocSua));
    suaNham += nham;
    if (nham > 0 && chiTiet) console.log(`\n[sửa nhầm câu gốc] ${ten}: ${gocSua}`);
    const ketQuaGoc = await runPipeline(goc, ctx, { provider: "mock", ruleOnly: true });
    const maGoc = [...ma(ketQuaGoc.draft.chi_dinh as Values[], "ma_dich_vu"), ...ma(ketQuaGoc.draft.ke_don as Values[], "ma_thuoc")];
    const lieuGoc = new Map((ketQuaGoc.draft.ke_don as Values[]).filter((r) => r.ma_thuoc).map((r) => [String(r.ma_thuoc), lieu(r)]));

    const cot: string[] = [];
    for (const kieu of ["tho", "sua"] as const) {
      const kq = await runPipeline(ban[kieu], ctx, { provider: "mock", ruleOnly: true });
      const thuoc = kq.draft.ke_don as Values[];
      const maMoi = new Set([...ma(kq.draft.chi_dinh as Values[], "ma_dich_vu"), ...ma(thuoc, "ma_thuoc")]);
      const d: Diem = {
        loi: khoangCach(tuGoc, tachTu(ban[kieu])),
        tu: tuGoc.length,
        maGiu: maGoc.filter((m) => maMoi.has(m)).length,
        maTong: maGoc.length,
        lieuGiu: thuoc.filter((r) => r.ma_thuoc && lieuGoc.get(String(r.ma_thuoc)) === lieu(r)).length,
        lieuTong: lieuGoc.size,
      };
      for (const k of Object.keys(d) as (keyof Diem)[]) tong[kieu][k] += d[k];
      cot.push(`${((d.loi / d.tu) * 100).toFixed(1).padStart(6)}% ${`${d.maGiu}/${d.maTong}`.padStart(6)} ${`${d.lieuGiu}/${d.lieuTong}`.padStart(6)}`);
    }
    dong.push(`${ten.padEnd(22)}${cot.join("   ")}   ${rtf.padStart(5)} ${thoiGian.padStart(6)}`);
    if (chiTiet) {
      console.log(`\n── ${ten}\nGỐC : ${goc}\nTHÔ : ${ban.tho}\nSỬA : ${ban.sua}`);
    }
  }

  const tieuDe = `${"WER".padStart(7)} ${"Mã".padStart(6)} ${"Liều".padStart(6)}`;
  console.log(`\n${"".padEnd(22)}${"── Chữ thô ──".padEnd(24)}   ── Sau khi sửa ──`);
  console.log(`${"File".padEnd(22)}${tieuDe}   ${tieuDe}   ${"RTF".padStart(5)} ${"Giây".padStart(6)}`);
  for (const d of dong) console.log(d);
  const tomTat = (d: Diem) =>
    `${((d.loi / d.tu) * 100).toFixed(1).padStart(6)}% ${`${d.maGiu}/${d.maTong}`.padStart(6)} ${`${d.lieuGiu}/${d.lieuTong}`.padStart(6)}`;
  const rtfTong = giayAmDo > 0 ? (giayGiaiMa / giayAmDo).toFixed(2) : "–";
  console.log(`${"Tổng".padEnd(22)}${tomTat(tong.tho)}   ${tomTat(tong.sua)}   ${rtfTong.padStart(5)} ${giayGiaiMa.toFixed(1).padStart(6)}`);
  console.log(`Sửa nhầm trên câu gốc: ${suaNham} từ`);
  if (imLang.length) {
    console.log("\nIm lặng (số câu chốt trên file không có lời):");
    for (const d of imLang) console.log(d);
  }
  console.log(`\nModel ${model}: giải mã ${giayGiaiMa.toFixed(1)} s cho ${giayAmDo.toFixed(1)} s âm thanh đã đo, RTF ${rtfTong} (tổng âm thanh ${giayAmTong.toFixed(1)} s).`);
  if (giayAmDo === 0) console.log("RTF chưa đo vì chữ lấy từ bộ lưu: thêm --nhan-lai để đo tốc độ.");
  console.log("\nMã: mã dịch vụ, mã thuốc giữ được so với tách câu gốc. Liều: dòng thuốc có liều, số lần/ngày, số ngày trùng câu gốc.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
