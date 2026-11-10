"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { BaoCaoDialog } from "@/components/eform/BaoCaoDialog";
import { EformContext, type EformApi } from "@/components/eform/EformContext";
import { EformForm } from "@/components/eform/EformForm";
import { EformHeader } from "@/components/eform/EformHeader";
import { BTN_OUTLINE, SourceBadge, BcytTag } from "@/components/eform/fields";
import type { EformData, Nguon, Truong } from "@/lib/eform/types";

const TRANG_THAI_NOI_SOI = "Chờ KQ CLS";
const EMPTY: Truong = { value: "", nguon: null };

function initFields(values: Record<string, string>): Record<string, Truong> {
  return Object.fromEntries(
    Object.entries(values).map(([id, value]) => [id, { value, nguon: value ? ("cu" as const) : null }]),
  );
}

/** Sửa tay vào dữ liệu cũ hoặc phần AI thêm thì chuyển thành "Đã sửa" */
function afterEdit(nguon: Nguon | null | undefined): Nguon {
  return nguon === "cu" || nguon === "ai" || nguon === "sua" ? "sua" : "bs";
}

function nowText(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function EformScreen({ data }: { data: EformData }) {
  const [fields, setFields] = useState(() => initFields(data.ca.gia_tri));
  const [trangThai, setTrangThai] = useState(data.ca.trang_thai);
  const [lastEdit, setLastEdit] = useState(data.ca.chinh_sua_cuoi);
  const [expanded, setExpanded] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }, []);

  const api = useMemo<EformApi>(
    () => ({
      data,
      notify,
      get: (id) => fields[id] ?? EMPTY,
      edit: (id, value) =>
        setFields((prev) => ({ ...prev, [id]: { value, nguon: afterEdit(prev[id]?.nguon) } })),
      put: (id, value, nguon) => setFields((prev) => ({ ...prev, [id]: { value, nguon } })),
      append: (id, text, nguon) =>
        setFields((prev) => {
          const current = prev[id]?.value ?? "";
          return {
            ...prev,
            [id]: { value: current ? `${current}\n${text}` : text, nguon: nguon ?? afterEdit(prev[id]?.nguon) },
          };
        }),
    }),
    [data, fields, notify],
  );

  const changeStatus = (next: string) => {
    setTrangThai(next);
    if (next !== TRANG_THAI_NOI_SOI) api.put("chuyen_noi_soi", "", null);
  };

  const save = () => {
    setLastEdit({ nguoi: data.ca.dang_nhap, luc: nowText() });
    notify("Đã lưu trong trình duyệt (mô phỏng, không gửi đi đâu).");
  };

  return (
    <EformContext.Provider value={api}>
      <EformHeader lastEdit={lastEdit} expanded={expanded} onToggleExpand={() => setExpanded((open) => !open)} />

      <main className={`mx-auto w-full flex-1 space-y-4 p-4 ${expanded ? "" : "max-w-5xl"}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Chú giải:</span>
          <SourceBadge nguon="cu" />
          <SourceBadge nguon="ai" />
          <SourceBadge nguon="sua" />
          <BcytTag />
        </div>
        <EformForm noiSoiEnabled={trangThai === TRANG_THAI_NOI_SOI} />
      </main>

      {toast && (
        <div role="status" className="fixed bottom-20 left-1/2 z-40 max-w-[90vw] -translate-x-1/2 rounded bg-navy px-3 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="sticky bottom-0 z-30 flex flex-wrap items-center gap-2 border-t border-gray-200 bg-white px-4 py-2 shadow-[0_-1px_3px_rgba(0,0,0,0.08)]">
        <label className="flex items-center gap-1.5 text-sm">
          <span className="font-medium text-navy">Trạng thái</span>
          <select
            value={trangThai}
            onChange={(e) => changeStatus(e.target.value)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
          >
            {data.tuyChon.trang_thai.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-1.5 sm:ml-auto">
          <Link href="/" className={BTN_OUTLINE}>
            Quay lại
          </Link>
          <button type="button" className={BTN_OUTLINE} onClick={() => setShowReport(true)}>
            Báo cáo y tế
          </button>
          <button type="button" className={BTN_OUTLINE} onClick={() => notify("Mô phỏng: bản demo không in phiếu.")}>
            In ngay
          </button>
          <button type="button" className="rounded bg-primary px-3 py-1 text-sm font-semibold text-white hover:opacity-90" onClick={save}>
            Lưu
          </button>
          <button type="button" className={BTN_OUTLINE} onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            Lên đầu trang
          </button>
        </div>
      </div>

      {showReport && <BaoCaoDialog onClose={() => setShowReport(false)} />}
    </EformContext.Provider>
  );
}
