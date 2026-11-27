"use client";

import { useState } from "react";
import { useEform } from "@/client/eform/EformContext";
import { dungMau, xuLyLenh, type KetQuaLenh, type LenhDien } from "@/shared/eform/lenh-nhanh";

// Ô lệnh nhanh: tên mẫu + chi tiết + mã gõ tắt. Chạy hoàn toàn trên máy, không gọi API, không gửi chữ đi đâu.
// Phần cần AI thì bác sĩ chép xuống ô Nội dung buổi khám để đi luồng che thông tin.

interface Props {
  /** Áp kết quả vào phiếu, trả câu báo */
  onDien: (kq: LenhDien) => string;
  /** Chép phần chưa điền được xuống ô Nội dung buổi khám */
  onChepXuong?: (text: string) => void;
  chuaLuu: boolean;
  onLuu?: () => void;
  saving?: boolean;
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tim";
const NUT_NHO = `rounded-md border border-tim-vien bg-white px-2.5 py-1 text-xs font-medium text-tim hover:bg-tim-nhat disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
const NUT_LUU = `rounded-md bg-tim px-3 py-1.5 text-xs font-semibold text-white hover:bg-tim/90 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

const KHONG_THAY = "Không thấy mẫu hay gõ tắt nào. Nói hoặc gõ nội dung ở phần dưới để AI trích.";

export function LenhNhanh({ onDien, onChepXuong, chuaLuu, onLuu, saving }: Props) {
  const { data } = useEform();
  const [lenh, setLenh] = useState("");
  const [thongBao, setThongBao] = useState("");
  const [phanDu, setPhanDu] = useState<string[]>([]);
  /** Lệnh khớp nhiều mẫu: chờ bác sĩ chọn một */
  const [choChon, setChoChon] = useState<Extract<KetQuaLenh, { loai: "chon_mau" }> | null>(null);

  const dien = (kq: LenhDien) => {
    setChoChon(null);
    setThongBao(onDien(kq));
    setPhanDu(kq.phanDu);
    setLenh("");
  };

  const chay = () => {
    if (!lenh.trim()) return;
    const kq = xuLyLenh(lenh, { goTat: data.goTat, phieuMau: data.phieuMau, vietTat: data.vietTat });
    if (kq.loai === "dien") return dien(kq);
    setPhanDu([]);
    if (kq.loai === "chon_mau") {
      setChoChon(kq);
      setThongBao("Lệnh khớp nhiều mẫu, chọn một:");
      return;
    }
    setChoChon(null);
    setThongBao(KHONG_THAY);
  };

  const du = phanDu.join(", ");

  return (
    <section aria-label="Lệnh nhanh" className="space-y-2 rounded-xl border border-tim-vien bg-white px-4 py-3 text-[13px] shadow-[0_1px_2px_rgba(26,37,51,0.06)]">
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-ef-chu">Lệnh nhanh <span className="font-normal text-ef-phu">(chạy trên máy, không gửi đi)</span></span>
        <input
          type="text"
          value={lenh}
          onChange={(event) => setLenh(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            chay();
          }}
          placeholder="Tên mẫu, chi tiết, mã gõ tắt. Enter để điền"
          className="w-full rounded-lg border border-ef-vien bg-white px-3 py-2 text-sm text-ef-chu outline-none placeholder:text-ef-phu/80 focus:border-tim focus:ring-2 focus:ring-tim/20"
        />
      </label>
      {thongBao && <p role="status" className="text-xs text-ef-chu">{thongBao}</p>}
      {choChon && (
        <div className="flex flex-wrap gap-1.5">
          {choChon.cacMau.map((mau) => (
            <button key={mau.id} type="button" className={NUT_NHO} onClick={() => dien(dungMau(mau, choChon.chiTiet, choChon.goTat, data.vietTat))}>
              {mau.ten}
            </button>
          ))}
        </div>
      )}
      {du && (
        <div className="space-y-1.5 rounded-md bg-ef-nen px-3 py-2 text-xs text-ef-phu">
          <p>{`"${du}" chưa điền được: nói hoặc gõ ở Nội dung buổi khám.`}</p>
          {onChepXuong && <button type="button" className={NUT_NHO} onClick={() => { onChepXuong(du); setPhanDu([]); }}>Chép xuống</button>}
        </div>
      )}
      {chuaLuu && onLuu && (
        <button type="button" className={NUT_LUU} disabled={saving} onClick={onLuu}>{saving ? "Đang lưu…" : "Lưu phiếu"}</button>
      )}
    </section>
  );
}
