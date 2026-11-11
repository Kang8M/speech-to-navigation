"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { BaoCaoDialog } from "@/components/eform/BaoCaoDialog";
import { ChiDinhTab } from "@/components/eform/ChiDinhTab";
import { DonThuocTab } from "@/components/eform/DonThuocTab";
import { EformContext, type EformApi } from "@/components/eform/EformContext";
import { EformForm } from "@/components/eform/EformForm";
import { EformHeader } from "@/components/eform/EformHeader";
import { BcytTag, SourceBadge, anchorId } from "@/components/eform/fields";
import { splitCodes } from "@/components/eform/IcdField";
import { TroLyAi, type TabId } from "@/components/eform/TroLyAi";
import { dienPhieu, type DongChiDinh, type DongThuoc, type KetQuaDien } from "@/lib/eform/dien-phieu";
import { chonBoMau } from "@/lib/eform/goi-y";
import type { EformData, Nguon, Truong } from "@/lib/eform/types";
import type { PipelineResult } from "@/lib/pipeline";

const TRANG_THAI_NOI_SOI = "Chờ KQ CLS";
const EMPTY: Truong = { value: "", nguon: null };

const TABS: { id: TabId; nhan: string }[] = [
  { id: "phieu", nhan: "Phiếu khám ngoại trú" },
  { id: "chi_dinh", nhan: "Chỉ định dịch vụ" },
  { id: "don_thuoc", nhan: "Đơn thuốc" },
];

interface BanChup {
  fields: Record<string, Truong>;
  chiDinh: DongChiDinh[];
  donThuoc: DongThuoc[];
  ketQua: KetQuaDien | null;
}

function initFields(values: Record<string, string>): Record<string, Truong> {
  return Object.fromEntries(
    Object.entries(values).map(([id, value]) => [id, { value, nguon: value ? ("cu" as const) : null }]),
  );
}

/** Sửa tay vào dữ liệu cũ hoặc phần AI thêm thì chuyển thành "Đã sửa" */
function afterEdit(nguon: Nguon | null | undefined): Nguon {
  return nguon === "cu" || nguon === "ai" || nguon === "xem" || nguon === "sua" ? "sua" : "bs";
}

/** Bác sĩ có thể nói nhiều lần: giữ các dòng đã có, chỉ thêm dòng mới chưa trùng mã (hoặc tên khi chưa có mã) */
function gopDong<T extends { ma: string; ten: string }>(cu: T[], moi: T[]): T[] {
  const khoa = (row: T) => row.ma || row.ten.toLowerCase();
  const daCo = new Set(cu.map(khoa));
  return [...cu, ...moi.filter((row) => !daCo.has(khoa(row)))];
}

/** Gộp danh sách trường AI đã điền qua các lần; lần mới ghi đè lần cũ */
function gopKetQua(cu: KetQuaDien | null, moi: KetQuaDien): KetQuaDien {
  if (!cu) return moi;
  const idMoi = new Set(moi.daDien.map((item) => item.id));
  return { ...moi, daDien: [...moi.daDien, ...cu.daDien.filter((item) => !idMoi.has(item.id))] };
}

function nowText(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export function EformScreen({ data }: { data: EformData }) {
  const [fields, setFields] = useState(() => initFields(data.ca.gia_tri));
  const [chiDinh, setChiDinh] = useState<DongChiDinh[]>([]);
  const [donThuoc, setDonThuoc] = useState<DongThuoc[]>([]);
  const [ketQua, setKetQua] = useState<KetQuaDien | null>(null);
  const [banChup, setBanChup] = useState<BanChup | null>(null);
  const [tab, setTab] = useState<TabId>("phieu");
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

  const aiDien = (result: PipelineResult) => {
    const kq = dienPhieu(result.draft, result.matches, data, api.get);
    setBanChup({ fields, chiDinh, donThuoc, ketQua });
    setFields((prev) => ({ ...prev, ...kq.truong }));
    setChiDinh((prev) => gopDong(prev, kq.chiDinh));
    setDonThuoc((prev) => gopDong(prev, kq.donThuoc));
    setKetQua((prev) => gopKetQua(prev, kq));
    setTab("phieu");
    notify(`AI đã điền ${kq.daDien.length} trường, ${kq.chiDinh.length} chỉ định, ${kq.donThuoc.length} thuốc. Bác sĩ duyệt trước khi Lưu.`);
  };

  const hoanTac = () => {
    if (!banChup) return;
    setFields(banChup.fields);
    setChiDinh(banChup.chiDinh);
    setDonThuoc(banChup.donThuoc);
    setKetQua(banChup.ketQua);
    setBanChup(null);
    notify("Đã hoàn tác lần AI điền.");
  };

  const goTo = (id: string) => {
    setTab("phieu");
    // Đợi tab phiếu khám hiện ra rồi mới cuộn và đặt con trỏ vào ô
    setTimeout(() => {
      const el = document.getElementById(anchorId(id));
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("textarea, select, input")?.focus({ preventScroll: true });
    }, 50);
  };

  const changeStatus = (next: string) => {
    setTrangThai(next);
    if (next !== TRANG_THAI_NOI_SOI) api.put("chuyen_noi_soi", "", null);
  };

  const save = () => {
    setLastEdit({ nguoi: data.ca.dang_nhap, luc: nowText() });
    const conXem =
      Object.values(fields).filter((f) => f.nguon === "xem").length +
      [...chiDinh, ...donThuoc].filter((row) => row.nguon === "xem").length;
    notify(
      conXem > 0
        ? `Đã lưu (mô phỏng). Lưu ý: còn ${conXem} chỗ AI chưa chắc, bác sĩ nên xem lại.`
        : "Đã lưu trong trình duyệt (mô phỏng, không gửi đi đâu).",
    );
  };

  const soDong = { chi_dinh: chiDinh.length, don_thuoc: donThuoc.length, phieu: 0 };
  // Có bộ mẫu khớp chẩn đoán thì đánh dấu ✨ trên tab, để bác sĩ đang ở phiếu khám biết có gợi ý
  const boMau = chonBoMau(
    [...new Set(["icd_ra_vien", "icd_ban_dau", "icd_kem_theo"].flatMap((id) => splitCodes(api.get(id).value)))],
    data.goiY,
  ).map((item) => item.mau);
  const coGoiY = {
    phieu: false,
    chi_dinh: boMau.some((mau) => mau.chiDinh.length > 0),
    don_thuoc: boMau.some((mau) => mau.donThuoc.length > 0),
  };

  return (
    <EformContext.Provider value={api}>
      <div className="flex flex-1 flex-col bg-white text-[13px]" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
        <EformHeader lastEdit={lastEdit} expanded={expanded} onToggleExpand={() => setExpanded((open) => !open)} />

        <div className={`mx-auto grid w-full flex-1 lg:grid-cols-[minmax(0,1fr)_22rem] ${expanded ? "" : "max-w-7xl"}`}>
          <main className="min-w-0 space-y-3 px-4 pb-6 pt-2">
            <h1 className="border-b-[6px] border-emr-blue pb-1.5 pt-2 text-center text-2xl text-gray-700">Phiếu khám ngoại trú</h1>

            <div role="tablist" className="flex flex-wrap gap-1 border-b border-gray-300">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => setTab(item.id)}
                  className={`-mb-px border px-3 py-1.5 ${
                    tab === item.id ? "border-gray-300 border-b-white bg-white font-bold text-emr-blue" : "border-transparent text-gray-600 hover:text-emr-blue"
                  }`}
                >
                  {item.nhan}
                  {coGoiY[item.id] && (
                    <span className="ml-1 text-tim" title="Có gợi ý theo chẩn đoán">
                      ✨
                    </span>
                  )}
                  {item.id !== "phieu" && soDong[item.id] > 0 && (
                    <span className="ml-1 rounded-full bg-tim px-1.5 text-[11px] text-white">{soDong[item.id]}</span>
                  )}
                </button>
              ))}
            </div>

            {tab === "phieu" && (
              <>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>Chú giải:</span>
                  <SourceBadge nguon="cu" />
                  <SourceBadge nguon="ai" />
                  <SourceBadge nguon="xem" />
                  <SourceBadge nguon="sua" />
                  <BcytTag />
                </div>
                <EformForm noiSoiEnabled={trangThai === TRANG_THAI_NOI_SOI} />
              </>
            )}
            {tab === "chi_dinh" && <ChiDinhTab rows={chiDinh} onChange={setChiDinh} />}
            {tab === "don_thuoc" && <DonThuocTab rows={donThuoc} onChange={setDonThuoc} />}
          </main>

          <TroLyAi
            ketQua={ketQua}
            onDien={aiDien}
            onHoanTac={banChup ? hoanTac : null}
            onGoTo={goTo}
            onOpenTab={setTab}
            soChiDinh={chiDinh.length}
            soThuoc={donThuoc.length}
          />
        </div>

        {toast && (
          <div role="status" className="fixed bottom-28 left-1/2 z-40 max-w-[90vw] -translate-x-1/2 rounded bg-emr-navy px-3 py-2 text-sm text-white shadow-lg">
            {toast}
          </div>
        )}

        <div className="sticky bottom-0 z-30 bg-emr-blue shadow-[0_-1px_3px_rgba(0,0,0,0.15)]">
          <div role="radiogroup" aria-label="Trạng thái lượt khám" className="flex flex-wrap justify-center gap-1.5 px-3 py-2">
            {data.tuyChon.trang_thai.map((item) => (
              <button
                key={item}
                type="button"
                role="radio"
                aria-checked={trangThai === item}
                onClick={() => changeStatus(item)}
                className={`rounded-full px-4 py-1 text-xs font-bold ${
                  trangThai === item ? "bg-emr-pill-on text-[#6b4a12]" : "bg-white text-emr-navy hover:bg-gray-100"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
            <Link href="/" className="bg-white px-3 py-1 text-xs hover:bg-gray-100">
              ⊕ Quay lại
            </Link>
            <button type="button" className="bg-white px-3 py-1 text-xs hover:bg-gray-100" onClick={() => setShowReport(true)}>
              📄 Báo cáo y tế
            </button>
            <button
              type="button"
              className="bg-[#4fc3c7] px-3 py-1 text-xs text-white hover:opacity-90"
              onClick={() => notify("Mô phỏng: bản demo không in phiếu.")}
            >
              🖨 In ngay
            </button>
            <button type="button" className="min-w-40 flex-1 bg-emr-save py-1 text-xs font-bold text-ink hover:opacity-90" onClick={save}>
              💾 Lưu
            </button>
            <button
              type="button"
              aria-label="Lên đầu trang"
              className="bg-white px-3 py-1 text-xs hover:bg-gray-100"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              ▲
            </button>
          </div>
        </div>

        {showReport && <BaoCaoDialog onClose={() => setShowReport(false)} />}
      </div>
    </EformContext.Provider>
  );
}
