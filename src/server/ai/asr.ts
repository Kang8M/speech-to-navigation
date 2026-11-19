// Nhận dạng giọng nói chạy trên máy (sherpa-onnx): Zipformer tiếng Việt mặc định, hoặc Rumble-2-Flash khi ASR_MODEL=rumble. Âm thanh không rời khỏi máy
// và không được lưu: chỉ nằm trong bộ nhớ của phiên đến khi câu được nhận dạng xong.
//
// Model là loại không streaming, nên mỗi phiên làm hai lớp để chữ hiện ra trong lúc nói:
// - Chữ tạm: khi đang có tiếng nói, cứ thêm một bước âm thanh (0,4 giây Zipformer, 2 giây Rumble) thì nhận dạng lại phần câu đang nói dở.
// - Chữ chốt: Silero VAD thấy ngắt nghỉ thì nhận dạng cả câu vừa xong và trả về để đưa vào ô nhập.
import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Vad } from "sherpa-onnx-node";
import { ASR_MAX_SECONDS, ASR_SAMPLE_RATE, type AsrKetQua } from "@/shared/api";
import { chuanHoaCau } from "@/shared/giong-noi/chuan-hoa-cau";
import { batDauDoanChuTam } from "@/shared/giong-noi/doan-chu-tam";
import { MODEL_THEO_TEN, type TenModelGiongNoi, VAD_GIONG_NOI } from "@/shared/model-giong-noi";
import { type BoNhanDang, getAsrModel, layBoNhanDang } from "./bo-nhan-dang";

// Model do ASR_MODEL chọn (xem bo-nhan-dang.ts); Silero VAD dùng chung cho cả hai model
const GOC = /*turbopackIgnore: true*/ process.cwd();
const tuGoc = (rel: string) => path.join(GOC, ...rel.split("/"));
const VAD_FILE = tuGoc(VAD_GIONG_NOI);
/** Cửa sổ của Silero VAD ở 16 kHz */
const VAD_WINDOW = 512;
/** Một câu dài hơn mức này thì VAD tự cắt, nên chữ tạm cũng chỉ cần nhận dạng tối đa chừng ấy */
const MAX_SEGMENT_SECONDS = 20;
/** Rumble: chữ tạm lấy thêm chừng này giây trước chỗ VAD bắt đầu thấy tiếng nói */
const DEM_DAU_TAM_GIAY = 0.5;
/** Phiên không nhận thêm âm thanh trong khoảng này thì bị xóa */
const IDLE_MS = 60_000;

export function getAsrProvider(): string {
  return process.env.ASR_PROVIDER?.trim() || "zipformer";
}

/** File model còn thiếu (kể cả Silero VAD), đường dẫn tương đối tính từ gốc dự án; rỗng là đủ */
export function fileModelThieu(model: TenModelGiongNoi = getAsrModel()): string[] {
  return [...MODEL_THEO_TEN[model].canCo, VAD_GIONG_NOI].filter((rel) => !fs.existsSync(tuGoc(rel)));
}

export function modelSanSang(model: TenModelGiongNoi = getAsrModel()): boolean {
  return fileModelThieu(model).length === 0;
}

class PhienNhanDang {
  private bo: BoNhanDang;
  constructor(private model: TenModelGiongNoi) {
    this.bo = layBoNhanDang(model);
  }

  private vad = new Vad(
    {
      sileroVad: {
        model: VAD_FILE,
        threshold: 0.5,
        minSilenceDuration: 0.5,
        minSpeechDuration: 0.25,
        windowSize: VAD_WINDOW,
        maxSpeechDuration: MAX_SEGMENT_SECONDS,
      },
      sampleRate: ASR_SAMPLE_RATE,
      numThreads: 1,
      provider: "cpu",
      debug: 0,
    },
    MAX_SEGMENT_SECONDS + 10,
  );
  /** Âm thanh từ cuối câu đã chốt gần nhất, để nhận dạng chữ tạm */
  private conLai: Float32Array = new Float32Array(0);
  /** Vị trí tuyệt đối (số mẫu) của mẫu đầu tiên trong conLai */
  private batDau = 0;
  /** Mẫu chưa đủ một cửa sổ VAD */
  private du: Float32Array = new Float32Array(0);
  private tong = 0;
  private tamLuc = 0;
  private tam = "";
  /** Vị trí tuyệt đối (số mẫu) nơi VAD bắt đầu thấy câu đang nói; null khi đang im lặng */
  private noiTu: number | null = null;
  /** Số đoạn VAD đã đưa ra nhận dạng (kể cả đoạn model trả chữ rỗng), để eval đếm */
  doanVad = 0;
  lanCuoi = Date.now();

  private them(a: Float32Array, b: Float32Array): Float32Array {
    const out = new Float32Array(a.length + b.length);
    out.set(a);
    out.set(b, a.length);
    return out;
  }

  private layCauChot(): string[] {
    const chot: string[] = [];
    while (!this.vad.isEmpty()) {
      const doan = this.vad.front(false);
      this.doanVad++;
      const text = chuanHoaCau(this.bo.decode(doan.samples), this.model, true);
      if (text) chot.push(text);
      // Bỏ phần âm thanh đã chốt khỏi bộ đệm chữ tạm
      const ketThuc = doan.start + doan.samples.length;
      if (ketThuc > this.batDau) {
        this.conLai = this.conLai.slice(Math.min(ketThuc - this.batDau, this.conLai.length));
        this.batDau = ketThuc;
      }
      this.vad.pop();
      this.noiTu = null;
      this.tam = "";
      this.tamLuc = this.tong;
    }
    return chot;
  }

  nhan(samples: Float32Array): AsrKetQua {
    this.lanCuoi = Date.now();
    if (this.tong + samples.length > ASR_SAMPLE_RATE * ASR_MAX_SECONDS) {
      throw new Error(`Phiên nói dài quá ${ASR_MAX_SECONDS / 60} phút.`);
    }
    const dauBuf = this.tong - this.du.length;
    this.tong += samples.length;
    this.conLai = this.them(this.conLai, samples);
    // Chỉ giữ tối đa một câu dài nhất cho chữ tạm
    const toiDa = MAX_SEGMENT_SECONDS * ASR_SAMPLE_RATE;
    if (this.conLai.length > toiDa) {
      this.batDau += this.conLai.length - toiDa;
      this.conLai = this.conLai.slice(this.conLai.length - toiDa);
    }

    const buf = this.them(this.du, samples);
    const chot: string[] = [];
    let i = 0;
    for (; i + VAD_WINDOW <= buf.length; i += VAD_WINDOW) {
      this.vad.acceptWaveform(buf.subarray(i, i + VAD_WINDOW));
      chot.push(...this.layCauChot());
      // Ghi chỗ bắt đầu nói (đầu cửa sổ VAD đầu tiên thấy tiếng); im lặng thì xóa
      if (!this.vad.isDetected()) this.noiTu = null;
      else this.noiTu ??= dauBuf + i;
    }
    this.du = buf.slice(i);

    if (!this.vad.isDetected()) this.tam = "";
    else if (this.tong - this.tamLuc >= this.bo.buocTamGiay * ASR_SAMPLE_RATE) {
      this.tamLuc = this.tong;
      // Câu nói dở đã quá dài thì giữ chữ tạm cũ: decode đồng bộ sẽ chặn server quá lâu
      // Rumble chỉ nhận dạng từ lúc bắt đầu nói (kèm đệm đầu), không tính phần im lặng đứng trước; Zipformer nhận dạng cả bộ đệm như cũ
      const tu = this.bo.chiTuLucNoi
        ? batDauDoanChuTam({
            batDau: this.batDau,
            doDai: this.conLai.length,
            noiTu: this.noiTu,
            demDau: DEM_DAU_TAM_GIAY * ASR_SAMPLE_RATE,
            toiDa: this.bo.tamToiDaGiay * ASR_SAMPLE_RATE,
          })
        : this.conLai.length <= this.bo.tamToiDaGiay * ASR_SAMPLE_RATE
          ? 0
          : null;
      if (tu !== null) this.tam = chuanHoaCau(this.bo.decode(tu === 0 ? this.conLai : this.conLai.subarray(tu)), this.model, false);
    }
    return { chot, tam: this.tam };
  }

  ketThuc(): AsrKetQua {
    if (this.du.length > 0) this.vad.acceptWaveform(this.du);
    this.du = new Float32Array(0);
    this.vad.flush();
    return { chot: this.layCauChot(), tam: "" };
  }
}

// Giữ qua các lần nạp lại module khi chạy dev
const g = globalThis as unknown as { phienAsr?: Map<string, PhienNhanDang> };
const PHIEN = (g.phienAsr ??= new Map<string, PhienNhanDang>());

function donPhienCu() {
  const now = Date.now();
  for (const [id, phien] of PHIEN) if (now - phien.lanCuoi > IDLE_MS) PHIEN.delete(id);
}

export function taoPhien(): string {
  donPhienCu();
  // Chốt model lúc mở phiên: đổi ASR_MODEL giữa chừng không làm phiên đang nói lẫn model
  const model = getAsrModel();
  const thieu = fileModelThieu(model);
  if (thieu.length) throw new Error(`Chưa có model giọng nói (thiếu ${thieu.join(", ")}). Chạy: npm run tai-model-giong-noi -- --model=${model}`);
  const phien = new PhienNhanDang(model);
  const id = randomUUID();
  PHIEN.set(id, phien);
  return id;
}

export function guiAmThanh(id: string, samples: Float32Array): AsrKetQua | null {
  return PHIEN.get(id)?.nhan(samples) ?? null;
}

/** thongKe (tùy chọn) được điền số đoạn VAD sau khi chốt xong, cho eval */
export function ketThucPhien(id: string, thongKe?: { doanVad: number }): AsrKetQua | null {
  const phien = PHIEN.get(id);
  if (!phien) return null;
  PHIEN.delete(id);
  const kq = phien.ketThuc();
  if (thongKe) thongKe.doanVad = phien.doanVad;
  return kq;
}
