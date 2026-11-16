"use client";

import { useState } from "react";
import { goiAiDienNhap } from "@/client/api";
import { useEform } from "@/client/eform/EformContext";
import { chenGoTat, ketQuaGoTat, tachGoTat, type KetQuaGoTat } from "@/shared/eform/go-tat";
import { ketQuaTheoQuyTac, timPhieuMau, type PhieuMau } from "@/shared/eform/phieu-mau";
import type { PipelineResult } from "@/shared/api";

/** Màn hình áp kết quả vào phiếu và trả câu báo đã điền gì (bong bóng hiện câu này) */
export type OnDien = (result: PipelineResult, text: string, mau?: PhieuMau, goTat?: KetQuaGoTat) => string;

/** Câu gõ tắt thay câu cùng ô trong kết quả mẫu hay AI */
function chenVao(result: PipelineResult, goTat?: KetQuaGoTat): PipelineResult {
  return goTat?.daDung.length ? { ...result, draft: chenGoTat(result.draft, goTat.cacO) } : result;
}

/**
 * Một lệnh bác sĩ nói hoặc gõ → điền phiếu: mã gõ tắt bung trước, tên mẫu gọi phiếu mẫu, phần còn lại gửi AI.
 * Dùng chung cho cột Trợ lý AI (giao diện cũ) và bong bóng (giao diện gọn).
 */
export function useDienAi(onDien: OnDien, vanBanDau = "") {
  const { data } = useEform();
  const [text, setText] = useState(vanBanDau);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Câu báo của lần điền gần nhất */
  const [thongBao, setThongBao] = useState("");
  /** Đoạn chữ của lần điền gần nhất, để biết bác sĩ đã nói hoặc gõ thêm chưa */
  const [daGui, setDaGui] = useState("");
  /** Mẫu bác sĩ gọi nhưng trùng tên nhiều mẫu: hiện nút để chọn, giữ lại chi tiết và gõ tắt đã tách */
  const [luaChon, setLuaChon] = useState<{ cacMau: PhieuMau[]; chiTiet: string; goTat: KetQuaGoTat } | null>(null);
  /** AI viết theo câu quen trong bộ gõ tắt của bác sĩ đang đăng nhập */
  const taiKhoan = data.ca.dang_nhap;

  const xong = (result: PipelineResult, chuDaGui: string, mau?: PhieuMau, goTat?: KetQuaGoTat) => {
    setThongBao(onDien(result, chuDaGui, mau, goTat));
    setDaGui(chuDaGui);
  };

  /** Đổ phiếu mẫu vào phiếu: chỉ có tên mẫu thì không gọi API, có chi tiết thì gọi AI một lần để thay chỗ trống */
  async function dungMau(mau: PhieuMau, chuDaGui: string, chiTiet = "", goTat?: KetQuaGoTat) {
    setLuaChon(null);
    setError(null);
    if (!chiTiet) {
      xong(chenVao(mau.ketQua, goTat), chuDaGui, mau, goTat);
      return;
    }
    setLoading(true);
    try {
      const result = await goiAiDienNhap(chiTiet, "AI không điền được phiếu.", { mauId: mau.id, taiKhoan });
      xong(chenVao(result, goTat), chuDaGui, mau, goTat);
    } catch (err) {
      // AI lỗi (quá tải, hết lượt) thì vẫn điền theo mẫu, chỗ trống thay bằng quy tắc
      xong(chenVao(ketQuaTheoQuyTac(mau, chiTiet, data.vietTat), goTat), chuDaGui, mau, goTat);
      const lyDo = err instanceof Error ? err.message : "Không gọi được AI.";
      setError(`${lyDo} Đã điền theo mẫu, chi tiết chỉ thay được bên, số ngày, nhiệt độ; hãy kiểm tra các chỗ vàng.`);
    } finally {
      setLoading(false);
    }
  }

  /** Trả true nếu đã điền xong (không còn chờ chọn mẫu, không lỗi) */
  async function dien(): Promise<boolean> {
    if (!text.trim() || loading) return false;
    // Mã gõ tắt của bác sĩ bung vào ô trước; phần còn lại gọi mẫu hoặc AI như cũ
    const goTat = tachGoTat(text, data.goTat);
    const chu = goTat.conLai;
    const theoTen = chu ? timPhieuMau(chu, data.phieuMau) : null;
    // Mã chẩn đoán trong bộ gõ tắt ("vmx" → viêm mũi xoang cấp) cũng gọi mẫu cùng tên, để có chỉ định và đơn
    const theoChanDoan = !theoTen && goTat.cacO.chan_doan_chinh ? timPhieuMau(goTat.cacO.chan_doan_chinh, data.phieuMau) : null;
    const goi = theoTen ?? theoChanDoan;
    const chiTiet = theoTen ? theoTen.conLai : chu;
    if (goi?.loai === "nhieu") {
      setLuaChon({ cacMau: goi.cacMau, chiTiet, goTat });
      return false;
    }
    if (goi?.loai === "mot") {
      await dungMau(goi.mau, text, chiTiet, goTat);
      return true;
    }
    if (!chu) {
      xong(ketQuaGoTat(goTat.cacO), text, undefined, goTat);
      setError(null);
      return true;
    }
    setLoading(true);
    setError(null);
    try {
      xong(chenVao(await goiAiDienNhap(chu, "AI không điền được phiếu.", { taiKhoan }), goTat), text, undefined, goTat);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI không điền được phiếu.");
      return false;
    } finally {
      setLoading(false);
    }
  }

  return { text, setText, loading, error, setError, thongBao, setThongBao, daGui, luaChon, setLuaChon, dien, dungMau };
}
