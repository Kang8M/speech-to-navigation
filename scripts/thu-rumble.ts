// Spike tạm: thử nạp Rumble-2-Flash (sherpa-onnx INT8, Qwen3-ASR) bằng sherpa-onnx-node và đo tốc độ.
// Chạy: npx tsx scripts/thu-rumble.ts
// Không import từ src/server. Dùng `any` vì d.ts của dự án chưa có kiểu qwen3Asr.
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sherpa = require("sherpa-onnx-node") as any;

const GOC = process.cwd();
const DIR = path.join(GOC, "models", "stt", "rumble-2-flash");
const WAV = path.join(GOC, "data", "giong-noi", "ca-01.tts.wav");
const CASE = path.join(GOC, "data", "cases", "ca-01-viem-tai-giua-cap-tre.json");

const rss = () => Math.round(process.memoryUsage().rss / 1048576);

function taoRecognizer(numThreads: number, qwenThem: Record<string, unknown> = {}) {
  return new sherpa.OfflineRecognizer({
    featConfig: { sampleRate: 16000, featureDim: 128 },
    modelConfig: {
      qwen3Asr: {
        convFrontend: path.join(DIR, "conv_frontend.onnx"),
        encoder: path.join(DIR, "encoder.int8.onnx"),
        decoder: path.join(DIR, "decoder.int8.onnx"),
        tokenizer: path.join(DIR, "tokenizer"),
        maxTotalLen: 512,
        maxNewTokens: 128,
        ...qwenThem,
      },
      tokens: "",
      numThreads,
      provider: "cpu",
      debug: 0,
    },
  });
}

function giaiMa(rec: any, samples: Float32Array, language?: string) {
  const s = rec.createStream();
  if (language) s.setOption("language", language);
  s.acceptWaveform({ sampleRate: 16000, samples });
  const t0 = performance.now();
  rec.decode(s);
  const ms = performance.now() - t0;
  return { ms, ket: rec.getResult(s) };
}

/** Cắt sau `s` giây, lùi về chỗ năng lượng thấp nhất trong cửa sổ ±1,5 s để không cắt giữa từ */
function chiaDoan(samples: Float32Array, s: number): Float32Array[] {
  const sr = 16000, win = 320;
  const out: Float32Array[] = [];
  let start = 0;
  while (samples.length - start > (s + 2) * sr) {
    const tam = start + s * sr;
    let best = tam, bestE = Infinity;
    for (let p = tam - 1.5 * sr; p < tam + 1.5 * sr; p += win) {
      let e = 0;
      for (let i = 0; i < win; i++) e += samples[p + i] ** 2;
      if (e < bestE) { bestE = e; best = p; }
    }
    out.push(samples.subarray(start, best));
    start = best;
  }
  out.push(samples.subarray(start));
  return out;
}

const wave = sherpa.readWave(WAV);
const giay = wave.samples.length / wave.sampleRate;
const tham = fs.existsSync(CASE) ? JSON.parse(fs.readFileSync(CASE, "utf8")).input_noi : "(không có)";
console.log(`Âm thanh: ${giay.toFixed(2)} s, sampleRate ${wave.sampleRate}`);
console.log(`Tham chiếu: ${tham}`);
console.log(`RSS đầu: ${rss()} MB`);

const DOAN = chiaDoan(wave.samples, 15);
console.log(`Chia ${DOAN.length} đoạn: ${DOAN.map((d) => (d.length / 16000).toFixed(1)).join(" + ")} s`);

for (const nt of [4, 2, 6]) {
  const t0 = performance.now();
  const rec = taoRecognizer(nt);
  const load = performance.now() - t0;
  console.log(`\n=== numThreads=${nt}, nạp ${(load / 1000).toFixed(2)} s, RSS ${rss()} MB`);
  giaiMa(rec, DOAN[0], "Vietnamese"); // làm nóng
  for (const [nhan, lang] of [["không ép", undefined], ["setOption Vietnamese", "Vietnamese"]] as const) {
    let ms = 0;
    const texts: string[] = [];
    const raw: unknown[] = [];
    for (const d of DOAN) {
      const r = giaiMa(rec, d, lang);
      ms += r.ms;
      texts.push(r.ket.text);
      raw.push(r.ket);
    }
    console.log(`[${nhan}] tổng ${ms.toFixed(0)} ms, RTF ${(ms / 1000 / giay).toFixed(3)}, RSS ${rss()} MB`);
    console.log(`  raw đoạn 1: ${JSON.stringify(raw[0])}`);
    console.log(`  text: ${texts.join(" ")}`);
  }
}

// Ép ngôn ngữ qua config
try {
  const rec = taoRecognizer(4, { language: "Vietnamese" });
  const { ms, ket } = giaiMa(rec, DOAN[0]);
  console.log(`\n[config language=Vietnamese, đoạn 1] ${ms.toFixed(0)} ms: ${JSON.stringify(ket)}`);
} catch (e) {
  console.log("\n[config language] lỗi:", (e as Error).message);
}

// Một đoạn ~20 s và ~30 s để xem giới hạn maxTotalLen 512
{
  const rec = taoRecognizer(4);
  for (const gy of [20, 30, 36]) {
    const d = wave.samples.subarray(0, gy * 16000);
    const r = giaiMa(rec, d, "Vietnamese");
    console.log(`\n[chunk ${gy} s] ${r.ms.toFixed(0)} ms, RTF ${(r.ms / 1000 / gy).toFixed(3)}, RSS ${rss()} MB`);
    console.log(`  text: ${r.ket.text}`);
  }
}
