"use client";

import { useState } from "react";
import { MO_PHONG, useEform } from "@/client/eform/EformContext";
import { SourceBadge } from "@/client/eform/fields";

interface Props {
  lastEdit: { nguoi: string; luc: string };
  expanded: boolean;
  onToggleExpand: () => void;
}

/** Header ghim trên cùng, bố cục theo màn EMR: logo, Menu, người dùng, cơ sở; dòng PID và các nhãn */
export function EformHeader({ lastEdit, expanded, onToggleExpand }: Props) {
  const { data, notify } = useEform();
  const { ca } = data;
  const [showAllergy, setShowAllergy] = useState(false);

  return (
    <div className="sticky top-0 z-30 border-b border-gray-300 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b-2 border-emr-orange px-4 py-1.5 text-[13px]">
        <div className="leading-none">
          <div className="text-base font-bold tracking-wider text-[#8a6d3b]">VINMEC</div>
          <div className="mt-0.5 bg-emr-orange px-1 text-[8px] font-bold text-white">BỆNH ÁN ĐIỆN TỬ</div>
        </div>
        <span className="rounded-sm bg-accent-2/30 px-1.5 text-[11px] font-bold text-ink">DỮ LIỆU GIẢ · MÔ PHỎNG</span>
        <button
          type="button"
          onClick={() => notify(MO_PHONG)}
          className="ml-auto rounded-sm bg-emr-menu px-3 py-1 font-semibold text-white hover:opacity-90"
        >
          ⋮ Menu
        </button>
        <span className="text-emr-blue">👤 {ca.dang_nhap}</span>
        <span>📍 {ca.co_so}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-[13px]">
        <span>
          PID:{" "}
          <span className="font-semibold text-emr-blue">
            {ca.pid} / ({ca.ma_luot_kham}) - {ca.ho_ten}
          </span>
        </span>
        <span className="rounded-sm bg-[#e05cc4] px-1.5 text-[11px] font-semibold text-white">♀ {ca.gioi_tinh}</span>
        {ca.canh_bao_di_ung && (
          <span className="relative">
            <button
              type="button"
              aria-label={`Dị ứng ${ca.canh_bao_di_ung}, xem chi tiết`}
              aria-expanded={showAllergy}
              onClick={() => setShowAllergy((open) => !open)}
              className="rounded-sm bg-[#c9302c] px-1.5 py-0.5 text-[11px] font-semibold text-white"
            >
              Dị ứng: {ca.canh_bao_di_ung} ⓘ
            </button>
            {showAllergy && (
              <span className="absolute left-0 top-full z-10 mt-1 w-72 max-w-[80vw] border border-gray-300 bg-white p-2 text-xs text-ink shadow-lg">
                {ca.lich_su.di_ung.map((row) => (
                  <span key={`${row.ngay}-${row.loai_phieu}`} className="block">
                    {row.ngay}: {row.loai} – {row.thong_tin}
                  </span>
                ))}
              </span>
            )}
          </span>
        )}
        <button
          type="button"
          onClick={() => notify(MO_PHONG)}
          className="ml-auto bg-emr-cyan px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
        >
          Xem LSKB
        </button>
        <button type="button" aria-pressed={expanded} onClick={onToggleExpand} className="text-xs text-emr-blue underline">
          {expanded ? "Thu hẹp" : "Mở rộng"}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1 text-xs text-gray-600">
        <details>
          <summary className="cursor-pointer font-semibold text-ink">Đánh giá ban đầu người bệnh ngoại trú thông thường</summary>
          <div className="mt-1 max-h-40 overflow-y-auto pb-1">
            <SourceBadge nguon="cu" />
            <dl className="mt-1 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
              {ca.danh_gia_ban_dau.map((item) => (
                <div key={item.nhan} className="flex gap-1">
                  <dt className="text-muted">{item.nhan}:</dt>
                  <dd>{item.gia_tri}</dd>
                </div>
              ))}
            </dl>
          </div>
        </details>
        <span>
          Chỉnh sửa lần cuối bởi {lastEdit.nguoi} ⓘ lúc {lastEdit.luc}
        </span>
      </div>
    </div>
  );
}
