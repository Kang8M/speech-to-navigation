// Chọn đoạn âm thanh để nhận dạng chữ tạm của Rumble. Thuần TS, không import node/server.
// Rumble chỉ nhận dạng từ lúc bắt đầu nói (kèm ít giây đệm đầu), không kèm phần im lặng đứng trước; đoạn đó dài quá thì bỏ qua lần này.

export interface ThamSoDoanChuTam {
  /** Vị trí tuyệt đối (số mẫu) của mẫu đầu tiên trong bộ đệm */
  batDau: number;
  /** Số mẫu trong bộ đệm */
  doDai: number;
  /** Vị trí tuyệt đối nơi VAD bắt đầu thấy tiếng nói; null khi chưa thấy */
  noiTu: number | null;
  /** Số mẫu đệm lấy thêm trước chỗ bắt đầu nói */
  demDau: number;
  /** Đoạn dài hơn mức này (số mẫu) thì bỏ qua */
  toiDa: number;
}

/** @returns vị trí bắt đầu (chỉ số trong bộ đệm) của đoạn cần nhận dạng, hoặc null nếu phải bỏ qua lần này */
export function batDauDoanChuTam({ batDau, doDai, noiTu, demDau, toiDa }: ThamSoDoanChuTam): number | null {
  const tu = noiTu === null ? 0 : Math.min(doDai, Math.max(0, noiTu - demDau - batDau));
  return doDai - tu > toiDa ? null : tu;
}
