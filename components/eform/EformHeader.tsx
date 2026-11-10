"use client";

import { useState } from "react";
import { MO_PHONG, useEform } from "@/components/eform/EformContext";
import { BTN_OUTLINE, SourceBadge } from "@/components/eform/fields";

interface Props {
  lastEdit: { nguoi: string; luc: string };
  expanded: boolean;
  onToggleExpand: () => void;
}

export function EformHeader({ lastEdit, expanded, onToggleExpand }: Props) {
  const { data, notify } = useEform();
  const { ca } = data;
  const [showAllergy, setShowAllergy] = useState(false);

  return (
    <div className="sticky top-0 z-30 border-b border-gray-200 bg-white px-4 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span className="font-medium text-ink">{ca.dang_nhap}</span>
        <span>{ca.co_so}</span>
        <span className="rounded bg-accent-2/25 px-1.5 text-xs font-semibold text-ink">DỮ LIỆU GIẢ</span>
        <span className="text-xs">Mô phỏng eForm ngoại trú</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm text-muted">
          {ca.pid} / {ca.ma_luot_kham}
        </span>
        <strong className="text-base text-navy">{ca.ho_ten}</strong>
        <span className="rounded bg-primary/15 px-1.5 text-xs font-medium text-primary">{ca.gioi_tinh}</span>
        {ca.canh_bao_di_ung && (
          <span className="relative flex items-center gap-1 rounded bg-red-700 px-1.5 py-0.5 text-xs font-semibold text-white">
            Dị ứng: {ca.canh_bao_di_ung}
            <button
              type="button"
              aria-label="Xem chi tiết dị ứng"
              aria-expanded={showAllergy}
              onClick={() => setShowAllergy((open) => !open)}
              className="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[11px] font-bold text-red-700"
            >
              i
            </button>
            {showAllergy && (
              <span className="absolute left-0 top-full z-10 mt-1 w-72 max-w-[80vw] rounded border border-gray-200 bg-white p-2 text-xs font-normal text-ink shadow-lg">
                {ca.lich_su.di_ung.map((row) => (
                  <span key={`${row.ngay}-${row.loai_phieu}`} className="block">
                    {row.ngay}: {row.loai} – {row.thong_tin}
                  </span>
                ))}
              </span>
            )}
          </span>
        )}
        <button type="button" className={BTN_OUTLINE} onClick={() => notify(MO_PHONG)}>
          Xem LSKB
        </button>
        <button type="button" className={BTN_OUTLINE} aria-pressed={expanded} onClick={onToggleExpand}>
          {expanded ? "Thu hẹp" : "Mở rộng"}
        </button>
        <span className="text-xs text-muted lg:ml-auto">
          Chỉnh sửa lần cuối bởi {lastEdit.nguoi} lúc {lastEdit.luc}
        </span>
      </div>
      <details className="mt-1 text-sm">
        <summary className="cursor-pointer font-medium text-navy">Đánh giá ban đầu người bệnh ngoại trú</summary>
        <div className="mt-1 max-h-40 overflow-y-auto">
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
    </div>
  );
}
