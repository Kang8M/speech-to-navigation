// Model nhận dạng giọng nói chạy trên máy, dùng chung cho eForm (/api/asr), trang /stt (Python) và lệnh
// `npm run tai-model-giong-noi`. Khớp với stt/model_artifacts.py: đổi model thì sửa cả hai nơi.
// Gốc: zzasdf/viet_iter3_pseudo_label (~70 nghìn giờ dữ liệu), bản int8 của sherpa-onnx, encoder ~70 MB.

/** Tên model nhận dạng giọng nói: Zipformer (mặc định) hoặc Rumble-2-Flash (thử nghiệm so sánh) */
export type TenModelGiongNoi = "zipformer" | "rumble";

export const MODEL_GIONG_NOI = {
  id: "csukuangfj/sherpa-onnx-zipformer-vi-int8-2025-04-20",
  revision: "b2745a435379992ad3f299635468db0c34918e1e",
  /** Thư mục tính từ gốc dự án */
  thuMuc: "models/stt/zipformer-vi",
  file: {
    encoder: "encoder-epoch-12-avg-8.int8.onnx",
    decoder: "decoder-epoch-12-avg-8.onnx",
    joiner: "joiner-epoch-12-avg-8.int8.onnx",
    tokens: "tokens.txt",
    bpe: "bpe.model",
  },
  /** SHA-256 lúc tải, giống provision.json do bước setup của /stt ghi */
  sha256: {
    "encoder-epoch-12-avg-8.int8.onnx": "b3abdef7a660fea7faf5e076b3c7613b0fc98406707103784d018189bb522124",
    "decoder-epoch-12-avg-8.onnx": "d1d27cca84c824a8acf5ce6edf0f2c0880cfe295d2e69b95134de1707e1d9998",
    "joiner-epoch-12-avg-8.int8.onnx": "38ec49e1c18e4feb0cad4de13e25c83a866cf56f4a66f22e8ff579d591a69a46",
    "tokens.txt": "f536d03c2e95ebd2930cf0abec88e823bd17d3c1933da7ae6a82db3b80605e15",
    "bpe.model": "289dbb44527c13c419ae3a4d8ce6a349f01a97f8777e69934a77e3692d2f10db",
  } as Record<string, string>,
} as const;

/**
 * Rumble-2-Flash (bản int8 của sherpa-onnx, dùng để so sánh với Zipformer).
 * Khóa revision; khóa sha256 là đường dẫn tương đối từ thư mục model (tokenizer nằm trong thư mục con).
 * Ba file tokenizer không có LFS hash trên HF, nên SHA-256 đo lúc tải lần đầu (Task 0).
 */
export const MODEL_RUMBLE = {
  id: "TypeWhisper/Rumble-2-Flash-sherpa-onnx-int8",
  revision: "a8128305e8e8c4aa5bf6fcd0a8454347ff80d6d1",
  /** Thư mục tính từ gốc dự án */
  thuMuc: "models/stt/rumble-2-flash",
  file: {
    convFrontend: "conv_frontend.onnx",
    encoder: "encoder.int8.onnx",
    decoder: "decoder.int8.onnx",
    tokenizer: "tokenizer",
  },
  tepTokenizer: ["vocab.json", "merges.txt", "tokenizer_config.json"],
  sha256: {
    "conv_frontend.onnx": "00c48c47db2937884636a3d99f23166390088e8c939ff7e9e803e69b8af4c0b5",
    "encoder.int8.onnx": "e6b4847992553dfa57bffda161b8c62d0af79c952c73269e6a2f6dc887f3e5dd",
    "decoder.int8.onnx": "e9be29023d0d52518e75cc4b77abbfc569564c7453ad1f546e50174c9a8b426c",
    "tokenizer/vocab.json": "c5e356c0638515539c196bca5da724fcf35a91fceaf1a2204c2a7193adc21059",
    "tokenizer/merges.txt": "ca57770275b525f8766ed68bf4b2d1d66b85adc41b06d8b5686cc3ca2b808aa9",
    "tokenizer/tokenizer_config.json": "c812aa17410d17b1b8c12f499d5359d6d9bd7395729bc7a7e1742aaa21f2b7df",
  } as Record<string, string>,
} as const;

/** Silero VAD (chốt câu), tính từ gốc dự án */
export const VAD_GIONG_NOI = "models/silero_vad.onnx";

/** Thư mục và các file model cần có, theo tên model. canCo tính từ gốc dự án (gồm cả file tokenizer của Rumble). */
export const MODEL_THEO_TEN: Record<TenModelGiongNoi, { thuMuc: string; canCo: string[] }> = {
  zipformer: {
    thuMuc: MODEL_GIONG_NOI.thuMuc,
    canCo: Object.keys(MODEL_GIONG_NOI.sha256).map((f) => `${MODEL_GIONG_NOI.thuMuc}/${f}`),
  },
  rumble: {
    thuMuc: MODEL_RUMBLE.thuMuc,
    canCo: Object.keys(MODEL_RUMBLE.sha256).map((f) => `${MODEL_RUMBLE.thuMuc}/${f}`),
  },
};
