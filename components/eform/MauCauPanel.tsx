"use client";

import { useState } from "react";
import { useEform } from "@/components/eform/EformContext";
import { BTN_AI } from "@/components/eform/fields";
import { VUNG_KHAM, goiYMauCau, tachMau } from "@/lib/eform/mau-cau";

const TRUONG_KHAM = "kham_chuyen_khoa";

function TheMau({ nhanVung, text, theoLyDo }: { nhanVung: string; text: string; theoLyDo: boolean }) {
  const { append, notify } = useEform();
  const [chon, setChon] = useState<Record<number, string>>({});
  const phan = tachMau(text);

  const insert = () => {
    const cau = phan.map((p, index) => (p.kieu === "chu" ? p.text : (chon[index] ?? p.goc))).join("");
    append(TRUONG_KHAM, `${nhanVung}: ${cau}`, "ai");
    setChon({});
    notify(`Đã chèn mẫu câu ${nhanVung} vào Khám chuyên khoa.`);
  };

  return (
    <div className="rounded border border-gray-200 bg-white p-2 text-[13px]">
      {!theoLyDo && <span className="mb-1 block text-[11px] text-muted">Mẫu chung</span>}
      <p className="leading-7">
        {phan.map((p, index) =>
          p.kieu === "chu" ? (
            <span key={index}>{p.text}</span>
          ) : (
            <select
              key={index}
              aria-label={`Chọn: ${p.luaChon.join(", ")}`}
              value={chon[index] ?? ""}
              onChange={(e) => setChon((prev) => ({ ...prev, [index]: e.target.value }))}
              className="mx-0.5 max-w-full rounded border border-tim-vien bg-tim-nhat px-1 text-[13px]"
            >
              <option value="">…</option>
              {p.luaChon.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          ),
        )}
      </p>
      <button type="button" className={`${BTN_AI} mt-1`} onClick={insert}>
        Chèn
      </button>
    </div>
  );
}

export function MauCauPanel() {
  const { data, get } = useEform();
  const lyDo = get("ly_do").value;
  const { nhomKhop, theoVung } = goiYMauCau(lyDo, data.mauCau, data.quyTac.phu_dinh);

  return (
    <div className="mt-1.5 rounded border border-tim-vien bg-tim-nhat p-2">
      <p className="mb-2 text-xs text-muted">
        ✨ AI gợi ý theo lý do khám{nhomKhop.length > 0 ? `: ${nhomKhop.join("; ")}` : " (chưa khớp nhóm nào, đang hiện mẫu chung)"}. Bác sĩ chọn kết quả thực tế ở từng chỗ trống rồi bấm Chèn.
      </p>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {VUNG_KHAM.map((vung) => (
          <div key={vung.id} className="space-y-1.5">
            <h3 className="text-[13px] font-semibold text-ink">{vung.nhan}</h3>
            {theoVung[vung.id].map((mau) => (
              <TheMau key={mau.text} nhanVung={vung.nhan} text={mau.text} theoLyDo={mau.theoLyDo} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
