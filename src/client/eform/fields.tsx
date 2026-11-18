"use client";

import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { useEform } from "@/client/eform/EformContext";
import { cauThuVien, khoCau, maGoTatCuaO, nhanGoiY, O_XUONG_DONG, timGoiYTab, type NguCanh } from "@/shared/eform/goi-y-tab";
import type { Nguon } from "@/shared/eform/types";

// Kiểu nút và ô nhập dùng chung cho cả trang eForm
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ef-xanh";
export const BTN_OUTLINE = `rounded-md border border-ef-vien bg-white px-2.5 py-1 text-[13px] font-medium text-ef-chu hover:border-ef-phu/50 hover:bg-ef-nen disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
export const BTN_AI = `rounded-md border border-tim-vien bg-white px-2.5 py-1 text-[13px] font-medium text-tim hover:bg-tim-nhat disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
export const BTN_CHINH = `rounded-md bg-ef-xanh px-4 py-2 text-sm font-semibold text-white hover:bg-ef-dam disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;
/** Bảng trong phiếu: đầu bảng xám nhạt, chỉ kẻ ngang */
export const TH = "border-b border-ef-vien bg-ef-nen px-3 py-2 text-left text-xs font-semibold text-ef-phu";
export const TD = "border-b border-ef-vien/70 px-3 py-2 align-top";

const INPUT_BASE =
  "w-full rounded-md border px-3 py-2 text-sm leading-6 text-ef-chu outline-none transition-[border-color,box-shadow] focus:border-ef-xanh focus:ring-2 focus:ring-ef-xanh/20 disabled:cursor-not-allowed disabled:opacity-70";

// Vạch màu bên trái ô cho biết nguồn: tím là AI điền, vàng là AI chưa chắc.
// Giao diện gọn (lớp .gon ở gốc màn hình): ô AI điền giữ nền trắng, chỉ còn vạch tím; chỉ màu vàng là cần bác sĩ xem
export function inputClass(nguon: Nguon | null) {
  if (nguon === "ai")
    return `${INPUT_BASE} border-tim-vien bg-tim-nhat shadow-[inset_3px_0_0_var(--ai_tim)] [.gon_&]:border-ef-vien [.gon_&]:bg-white`;
  if (nguon === "xem") return `${INPUT_BASE} border-xem/50 bg-xem-nhat shadow-[inset_3px_0_0_var(--xem)]`;
  if (nguon === "cu") return `${INPUT_BASE} border-ef-vien bg-ef-nen/60`;
  return `${INPUT_BASE} border-ef-vien bg-white`;
}

/** id của khối bao quanh một trường, để cột Trợ lý AI cuộn tới */
export function anchorId(id: string) {
  return `truong-${id}`;
}

const BADGE = "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-px text-[11px] font-semibold";

/** Giao diện gọn ẩn nhãn "AI điền" và "Đã sửa" (vạch tím ở lề ô đã đủ), nhãn vàng rút ngắn */
export function SourceBadge({ nguon }: { nguon: Nguon | null }) {
  if (nguon === "ai") return <span className={`${BADGE} bg-tim-nhat text-tim ring-1 ring-tim-vien [.gon_&]:hidden`}>✨ AI điền</span>;
  if (nguon === "xem")
    return (
      <span className={`${BADGE} bg-xem-nhat text-xem ring-1 ring-xem/40`}>
        ⚠ <span className="[.gon_&]:hidden">AI chưa chắc, cần xem lại</span>
        <span className="hidden [.gon_&]:inline">Cần xem lại</span>
      </span>
    );
  if (nguon === "sua") return <span className={`${BADGE} bg-ef-dam/10 text-ef-dam [.gon_&]:hidden`}>Đã sửa</span>;
  return null;
}

export function BcytTag() {
  return (
    <span className="text-xs font-normal text-ef-xanh" title="Trường này được ghép thẳng vào báo cáo y tế">
      (Hiển thị trên báo cáo y tế)
    </span>
  );
}

/** Nút bỏ đánh dấu "cần xem lại" ngay tại trường, bác sĩ không phải sang cột Trợ lý AI */
function XacNhanButton({ id }: { id: string }) {
  const { get, put } = useEform();
  return (
    <button
      type="button"
      title="Giá trị đã đúng, bỏ đánh dấu cần xem lại"
      onClick={() => put(id, get(id).value, "ai")}
      className={`rounded-full border border-xem/50 bg-white px-2 py-px text-[11px] font-semibold text-xem hover:bg-xem-nhat ${FOCUS}`}
    >
      ✓ Đúng
    </button>
  );
}

export function FieldLabel({ label, nguon, bcyt, id }: { label: string; nguon?: Nguon | null; bcyt?: boolean; id?: string }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="text-[13px] font-semibold text-ef-chu">{label}</span>
      {bcyt && <BcytTag />}
      <SourceBadge nguon={nguon ?? null} />
      {id && nguon === "xem" && <XacNhanButton id={id} />}
    </span>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-ef-vien bg-white">
      <h2 className="border-b border-ef-vien px-5 py-3 text-[15px] font-semibold text-ef-dam">{title}</h2>
      <div className="space-y-5 p-5">{children}</div>
    </section>
  );
}

/** Nhóm trường con trong một mục, ví dụ Khám lâm sàng */
export const NHOM = "space-y-4 rounded-lg border border-ef-vien/80 bg-ef-nen/40 p-4";

interface TextBoxProps {
  id: string;
  label: string;
  rows?: number;
  bcyt?: boolean;
  /** Nút đặt cùng hàng với nhãn */
  actions?: ReactNode;
  /** Nội dung đặt ngay dưới ô nhập */
  children?: ReactNode;
}

/** Ngữ cảnh xếp gợi ý: lý do khám, mô tả và mã chẩn đoán đang có trên phiếu */
function useNguCanh(): NguCanh {
  const { get } = useEform();
  const text = ["ly_do", "mo_ta_ban_dau", "mo_ta_ra_vien"].map((id) => get(id).value).join(". ");
  const icd = ["icd_ban_dau", "icd_ra_vien", "icd_kem_theo"].map((id) => get(id).value).join(",");
  return useMemo(() => ({ text, icd: icd.split(/[,;\s]+/).filter(Boolean) }), [text, icd]);
}

export function TextBox({ id, label, rows = 2, bcyt, actions, children }: TextBoxProps) {
  const { data, get, edit, goiYTab } = useEform();
  const field = get(id);
  const nguCanh = useNguCanh();
  const kho = useMemo(() => khoCau(id, data, nguCanh), [id, data, nguCanh]);
  const maGoTat = useMemo(() => maGoTatCuaO(id, data.goTat), [id, data.goTat]);
  // Chỉ gợi ý khi con trỏ đứng ở cuối ô và bác sĩ đã bấm chuột vào ô hoặc gõ: đi qua ô bằng phím Tab thì Tab vẫn chuyển ô,
  // không nhận nhầm gợi ý. Esc ẩn gợi ý cho tới lần gõ tiếp theo
  const [oCuoi, setOCuoi] = useState(false);
  const [dangViet, setDangViet] = useState(false);
  const [boQua, setBoQua] = useState<string | null>(null);
  const goiY =
    goiYTab.bat && oCuoi && dangViet && boQua !== field.value
      ? timGoiYTab(field.value, kho, maGoTat, O_XUONG_DONG.has(id))
      : null;
  const khoaGoiY = goiY ? `${id}|${goiY.chen}` : null;
  useEffect(() => {
    if (khoaGoiY) goiYTab.daHien(khoaGoiY);
  }, [khoaGoiY, goiYTab]);

  const xemConTro = (el: HTMLTextAreaElement) =>
    setOCuoi(document.activeElement === el && el.selectionStart === el.value.length && el.selectionEnd === el.value.length);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!goiY || e.nativeEvent.isComposing) return;
    if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      const value = nhanGoiY(field.value, goiY);
      goiYTab.daNhan(id, goiY.chen.trim(), value.length - field.value.length);
      edit(id, value);
    } else if (e.key === "Escape") {
      setBoQua(field.value);
    }
  };

  return (
    <div id={anchorId(id)} className="scroll-mt-44">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <FieldLabel id={id} label={label} nguon={field.nguon} bcyt={bcyt} />
        {actions && <div className="flex flex-wrap gap-1.5">{actions}</div>}
      </div>
      {/* Ô nhập và lớp chữ mờ chồng lên nhau trong cùng một ô lưới: lớp chữ mờ có cùng khung chữ nên dòng xuống y hệt,
          và ô cao theo nội dung cộng gợi ý (không cuộn) để chữ mờ không bị khuất */}
      <div className="grid">
        <textarea
          aria-label={label}
          aria-describedby={goiY && !goiYTab.daQuen ? `${anchorId(id)}-goi-y` : undefined}
          rows={rows}
          value={field.value}
          onChange={(e) => {
            const them = e.target.value.length - field.value.length;
            if (them > 0) goiYTab.daGo(them);
            edit(id, e.target.value);
            setDangViet(true);
            xemConTro(e.target);
          }}
          onSelect={(e) => xemConTro(e.currentTarget)}
          onFocus={(e) => xemConTro(e.currentTarget)}
          onMouseDown={() => setDangViet(true)}
          onBlur={() => {
            setOCuoi(false);
            setDangViet(false);
          }}
          onKeyDown={onKeyDown}
          className={`${inputClass(field.nguon)} col-start-1 row-start-1 resize-none overflow-hidden`}
        />
        <div
          aria-hidden
          className="pointer-events-none col-start-1 row-start-1 border border-transparent px-3 py-2 text-sm leading-6 whitespace-pre-wrap [overflow-wrap:break-word]"
        >
          <span className="invisible">{field.value}</span>
          {goiY && <span className="text-ef-phu/60 print:hidden">{goiY.hien}</span>}
          {/* Giữ chiều cao dòng cuối khi ô kết thúc bằng dấu xuống dòng */}
          <span className="invisible">{"​"}</span>
        </div>
      </div>
      {goiY && !goiYTab.daQuen && (
        <p id={`${anchorId(id)}-goi-y`} className="mt-1 text-[11px] text-ef-phu">
          <kbd className="rounded border border-ef-vien bg-ef-nen px-1 font-sans">Tab</kbd> để nhận gợi ý,{" "}
          <kbd className="rounded border border-ef-vien bg-ef-nen px-1 font-sans">Esc</kbd> để bỏ qua
        </p>
      )}
      {children}
    </div>
  );
}

/** Lựa chọn dạng thẻ: ô đang chọn viền xanh, nền xanh nhạt */
export const RADIO =
  "flex cursor-pointer items-center gap-1.5 rounded-md border border-ef-vien bg-white px-2.5 py-1.5 text-[13px] text-ef-chu hover:border-ef-phu/50 has-checked:border-ef-xanh has-checked:bg-ef-xanh-nhat has-checked:font-medium has-focus-visible:ring-2 has-focus-visible:ring-ef-xanh/30 has-disabled:cursor-not-allowed has-disabled:opacity-60";

export function RadioField({ id, label, options }: { id: string; label: string; options: string[] }) {
  const { get, edit } = useEform();
  const field = get(id);
  return (
    <fieldset id={anchorId(id)} className="scroll-mt-44">
      <legend className="mb-1">
        <FieldLabel id={id} label={label} nguon={field.nguon} />
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <label key={option} className={RADIO}>
            <input
              type="radio"
              name={id}
              checked={field.value === option}
              onChange={() => edit(id, option)}
              className="accent-ef-xanh"
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ReadonlyItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[13px] font-semibold text-ef-chu">{label}</div>
      <div className="rounded-md bg-ef-nen px-3 py-2 text-sm leading-6 text-ef-phu">{value}</div>
    </div>
  );
}

/** Nút thư viện mẫu câu tĩnh: bấm một mẫu để thêm vào cuối ô. Giao diện gọn bỏ nút, câu thư viện đã nằm trong chữ mờ Tab */
export function ThuVienButton({ id }: { id: string }) {
  const { data, append, gon } = useEform();
  const nguCanh = useNguCanh();
  const items = useMemo(() => cauThuVien(id, data.thuVien, nguCanh), [id, data.thuVien, nguCanh]);
  if (gon) return null;
  return (
    <details className="relative">
      <summary className={`${BTN_OUTLINE} cursor-pointer list-none`}>Mở thư viện tham khảo</summary>
      <div className="absolute right-0 z-10 mt-1 w-80 max-w-[80vw] rounded-lg border border-ef-vien bg-white p-1 shadow-lg">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => append(id, item)}
            className="block w-full rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-ef-nen"
          >
            {item}
          </button>
        ))}
      </div>
    </details>
  );
}
