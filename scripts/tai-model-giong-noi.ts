// Tải model nhận dạng giọng nói chạy trên máy về models/.
//   npm run tai-model-giong-noi                    Zipformer tiếng Việt (~70 MB) + Silero VAD (mặc định)
//   npm run tai-model-giong-noi -- --model=rumble  Rumble-2-Flash INT8 (~655 MB) + Silero VAD
// Cả hai lấy từ Hugging Face theo khóa revision, kiểm SHA-256 rồi ghi provision.json giống bước setup của trang /stt,
// nên eForm và /stt dùng chung một bộ model. Silero VAD lấy từ release công khai của k2-fsa/sherpa-onnx.
// File lớn được ghi thẳng ra đĩa qua stream (có thử lại và tiếp tục bằng Range). Thư mục models/ không đưa lên git.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import {
  MODEL_GIONG_NOI as Z,
  MODEL_RUMBLE as R,
  VAD_GIONG_NOI,
  type TenModelGiongNoi,
} from "../src/shared/model-giong-noi";

const VAD_URL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx";
const SO_LAN_THU = 3;
const GOC = process.cwd();
const tuGoc = (rel: string) => path.join(GOC, ...rel.split("/"));
const MB = (file: string) => (fs.statSync(file).size / 1e6).toFixed(1);

const CAU_HINH: Record<TenModelGiongNoi, { ten: string; id: string; revision: string; thuMuc: string; sha256: Record<string, string> }> = {
  zipformer: { ten: "Zipformer", id: Z.id, revision: Z.revision, thuMuc: Z.thuMuc, sha256: Z.sha256 },
  rumble: { ten: "Rumble-2-Flash", id: R.id, revision: R.revision, thuMuc: R.thuMuc, sha256: R.sha256 },
};

function layModel(): TenModelGiongNoi {
  const gia = process.argv.find((a) => a.startsWith("--model="))?.slice("--model=".length) ?? "zipformer";
  if (gia === "zipformer" || gia === "rumble") return gia;
  throw new Error(`--model chỉ nhận zipformer hoặc rumble, không phải "${gia}".`);
}

async function sha256(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const doan of fs.createReadStream(file)) hash.update(doan);
  return hash.digest("hex");
}

/** Một lần tải, ghi nối tiếp vào file tạm nếu server hỗ trợ Range (206). */
async function taiMotLan(url: string, tam: string): Promise<void> {
  const daCo = fs.existsSync(tam) ? fs.statSync(tam).size : 0;
  // Quá 20 phút một lần tải (hoặc kết nối treo) thì bỏ để vòng thử lại chạy tiếp, file .dang-tai giữ nguyên để tải nối
  const signal = AbortSignal.timeout(20 * 60_000);
  const res = await fetch(url, daCo > 0 ? { headers: { Range: `bytes=${daCo}-` }, signal } : { signal });
  if (res.status === 416) {
    fs.rmSync(tam, { force: true });
    throw new Error("HTTP 416 (đoạn đã tải không hợp lệ, sẽ tải lại từ đầu)");
  }
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const tiepTuc = daCo > 0 && res.status === 206;
  await pipeline(
    Readable.fromWeb(res.body as WebReadableStream),
    fs.createWriteStream(tam, { flags: tiepTuc ? "a" : "w" }),
  );
}

/** Tải url về dich, thử tối đa SO_LAN_THU lần; file chỉ thành dich khi SHA-256 khớp (mongDoi có thì mới kiểm). */
async function tai(url: string, dich: string, mongDoi?: string): Promise<void> {
  fs.mkdirSync(path.dirname(dich), { recursive: true });
  const tam = `${dich}.dang-tai`;
  let loiCuoi = "";
  for (let lan = 1; lan <= SO_LAN_THU; lan++) {
    try {
      await taiMotLan(url, tam);
      if (mongDoi) {
        const thucTe = await sha256(tam);
        if (thucTe !== mongDoi) {
          fs.rmSync(tam, { force: true });
          throw new Error(`SHA-256 không khớp (${thucTe}), đã xóa file vừa tải`);
        }
      }
      fs.renameSync(tam, dich);
      console.log(`  đã tải ${path.basename(dich)} (${MB(dich)} MB)`);
      return;
    } catch (error) {
      loiCuoi = error instanceof Error ? error.message : String(error);
      console.log(`  lần ${lan}/${SO_LAN_THU} lỗi với ${path.basename(dich)}: ${loiCuoi}`);
      if (lan < SO_LAN_THU) await new Promise((done) => setTimeout(done, 2000 * lan));
    }
  }
  throw new Error(`Không tải được ${url} sau ${SO_LAN_THU} lần: ${loiCuoi}`);
}

function lietKe(thuMuc: string, thut = "  "): void {
  for (const f of fs.readdirSync(thuMuc)) {
    const p = path.join(thuMuc, f);
    if (fs.statSync(p).isDirectory()) {
      console.log(`${thut}${f}/`);
      lietKe(p, thut + "  ");
    } else console.log(`${thut}${f} (${MB(p)} MB)`);
  }
}

async function main() {
  const model = layModel();
  const cfg = CAU_HINH[model];
  const thuMuc = tuGoc(cfg.thuMuc);
  const goc = `https://huggingface.co/${cfg.id}/resolve/${cfg.revision}`;
  fs.mkdirSync(thuMuc, { recursive: true });
  console.log(`Model ${cfg.ten}: ${cfg.id} @ ${cfg.revision.slice(0, 7)} → ${cfg.thuMuc}`);

  for (const rel of Object.keys(cfg.sha256)) {
    const dich = path.join(thuMuc, ...rel.split("/"));
    const mongDoi = cfg.sha256[rel];
    if (fs.existsSync(dich) && (await sha256(dich)) === mongDoi) {
      console.log(`  đã có ${rel}, bỏ qua.`);
      continue;
    }
    await tai(`${goc}/${rel}`, dich, mongDoi);
  }
  fs.writeFileSync(
    path.join(thuMuc, "provision.json"),
    JSON.stringify({ model_id: cfg.id, revision: cfg.revision, sha256: cfg.sha256 }, null, 2) + "\n",
  );

  const vad = tuGoc(VAD_GIONG_NOI);
  if (fs.existsSync(vad)) console.log("Đã có silero_vad.onnx, bỏ qua.");
  else {
    console.log("Tải silero_vad.onnx…");
    await tai(VAD_URL, vad);
  }

  console.log(`\nCác file trong ${cfg.thuMuc}:`);
  lietKe(thuMuc);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
