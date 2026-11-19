// Bộ nhận dạng giọng nói chạy trên máy theo từng model (Zipformer mặc định, Rumble-2-Flash để so sánh).
// Mỗi model chỉ tạo đúng một OfflineRecognizer, giữ trên globalThis để sống qua lần nạp lại module khi chạy dev
// (mỗi recognizer Rumble thêm ~1 GB RAM nên tuyệt đối không tạo thừa).
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { OfflineRecognizer } from "sherpa-onnx-node";
import { ASR_SAMPLE_RATE } from "@/shared/api";
import { MODEL_GIONG_NOI, MODEL_RUMBLE, MODEL_THEO_TEN, type TenModelGiongNoi } from "@/shared/model-giong-noi";

const GOC = /*turbopackIgnore: true*/ process.cwd();
const tuGoc = (rel: string) => path.join(GOC, ...rel.split("/"));

/** Rumble chỉ giải mã tin cậy tới ~30 giây (maxTotalLen 512 cắt âm thầm); đoạn dài hơn mức này thì chia đôi */
const RUMBLE_DOAN_TOI_DA_GIAY = 18;

export interface BoNhanDang {
  /** Nhận dạng một đoạn âm thanh 16 kHz, trả chữ thô của model (chưa chuẩn hóa) */
  decode(samples: Float32Array): string;
  /** Thêm ít nhất chừng này giây âm thanh mới nhận dạng lại chữ tạm */
  buocTamGiay: number;
  /** Phần câu đang nói dở dài hơn mức này (giây) thì giữ chữ tạm cũ, không nhận dạng lại (decode chặn event loop) */
  tamToiDaGiay: number;
}

/** Model đang chọn bằng ASR_MODEL; đọc lại mỗi lần gọi. Giá trị lạ thì dùng zipformer */
export function getAsrModel(): TenModelGiongNoi {
  const raw = process.env.ASR_MODEL?.trim().toLowerCase();
  if (!raw || raw === "zipformer") return "zipformer";
  if (raw === "rumble") return "rumble";
  console.warn(`ASR_MODEL="${process.env.ASR_MODEL}" không hợp lệ (chỉ nhận zipformer hoặc rumble), dùng zipformer.`);
  return "zipformer";
}

/** Giải mã đoạn dài bằng cách chia đôi (đệ quy) đến khi mỗi nửa ≤ toiDa mẫu, rồi nối chữ bằng dấu cách */
export function giaiMaChiaDoi(samples: Float32Array, decodeMot: (s: Float32Array) => string, toiDa: number): string {
  if (samples.length <= toiDa) return decodeMot(samples);
  const giua = Math.floor(samples.length / 2);
  return [giaiMaChiaDoi(samples.subarray(0, giua), decodeMot, toiDa), giaiMaChiaDoi(samples.subarray(giua), decodeMot, toiDa)]
    .filter(Boolean)
    .join(" ");
}

function taoZipformer(): BoNhanDang {
  const M = MODEL_GIONG_NOI;
  const f = (ten: string) => tuGoc(`${M.thuMuc}/${ten}`);
  const r = new OfflineRecognizer({
    featConfig: { sampleRate: ASR_SAMPLE_RATE, featureDim: 80 },
    modelConfig: {
      transducer: { encoder: f(M.file.encoder), decoder: f(M.file.decoder), joiner: f(M.file.joiner) },
      tokens: f(M.file.tokens),
      numThreads: 2,
      provider: "cpu",
      debug: 0,
    },
    decodingMethod: "greedy_search",
  });
  return {
    decode(samples) {
      const stream = r.createStream();
      stream.acceptWaveform({ samples, sampleRate: ASR_SAMPLE_RATE });
      r.decode(stream);
      return r.getResult(stream).text.trim();
    },
    buocTamGiay: 0.4,
    tamToiDaGiay: Infinity,
  };
}

function taoRumble(): BoNhanDang {
  const M = MODEL_RUMBLE;
  const f = (ten: string) => tuGoc(`${M.thuMuc}/${ten}`);
  const r = new OfflineRecognizer({
    featConfig: { sampleRate: ASR_SAMPLE_RATE, featureDim: 128 },
    modelConfig: {
      qwen3Asr: {
        convFrontend: f(M.file.convFrontend),
        encoder: f(M.file.encoder),
        decoder: f(M.file.decoder),
        tokenizer: f(M.file.tokenizer),
        maxTotalLen: 512,
        maxNewTokens: 128,
      },
      tokens: "",
      numThreads: 4,
      provider: "cpu",
      debug: 0,
    },
  });
  const decodeMot = (samples: Float32Array) => {
    const stream = r.createStream();
    // Chỉ setOption trên từng stream mới ép được tiếng Việt (trường language trong config không có tác dụng)
    stream.setOption("language", "Vietnamese");
    stream.acceptWaveform({ samples, sampleRate: ASR_SAMPLE_RATE });
    r.decode(stream);
    return r.getResult(stream).text.trim();
  };
  return {
    decode: (samples) => giaiMaChiaDoi(samples, decodeMot, RUMBLE_DOAN_TOI_DA_GIAY * ASR_SAMPLE_RATE),
    buocTamGiay: 2.0,
    tamToiDaGiay: 10,
  };
}

const g = globalThis as unknown as { boNhanDangAsr?: Partial<Record<TenModelGiongNoi, BoNhanDang>> };

/** Bộ nhận dạng của model, tạo lần đầu rồi dùng lại; thiếu file model thì báo lỗi bằng tiếng Việt */
export function layBoNhanDang(model: TenModelGiongNoi): BoNhanDang {
  const cache = (g.boNhanDangAsr ??= {});
  const co = cache[model];
  if (co) return co;
  const thieu = MODEL_THEO_TEN[model].canCo.filter((rel) => !fs.existsSync(tuGoc(rel)));
  if (thieu.length) {
    throw new Error(`Chưa có model giọng nói (thiếu ${thieu.join(", ")}). Chạy: npm run tai-model-giong-noi -- --model=${model}`);
  }
  return (cache[model] = model === "rumble" ? taoRumble() : taoZipformer());
}
